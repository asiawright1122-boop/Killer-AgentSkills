import { defineMiddleware } from 'astro:middleware';
import { isStaticOrApiPath, hasLocalePrefix, checkAdminAuth, detectLocale } from './middleware-utils';
import { logger, generateRequestId } from './lib/logger';
import { SITE_DOMAIN } from './lib/site-config';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from './lib/skill-route-paths';
import { isSitemapSkillBlocked } from './lib/sitemap-blocklist';
import { getRuntimeEnv } from './lib/runtime-env';
import { skillLocaleGovernanceMap, loadSkillLocaleGovernance, isGovernanceLoaded } from './lib/skill-locale-governance';
import { getSitemapSkills } from './lib/sitemap-skills-runtime';
import { getSitemapBlocklist } from './lib/sitemap-blocklist-runtime';
import { getSeo404Rules } from './lib/seo-404-rules-runtime';
import { authoritySurfacePublicData } from './lib/authority-surface-public-data';
import { SUPPORTED_LOCALES } from '../config/locales.mjs';
import staticSitemapSkillsData from '../data/sitemap-skills.json';

// Re-export for backward compatibility
export {
  COUNTRY_TO_LOCALE,
  isStaticOrApiPath,
  hasLocalePrefix,
  checkAdminAuth,
  detectLocale,
} from './middleware-utils';
export type { AdminAuthResult } from './middleware-utils';

type CanonicalSkillRoute = {
  owner: string;
  routePath: string;
};

type SitemapSkillRoutingRecord = Partial<SitemapSkillEntry> & {
  canonicalLocale?: unknown;
  publishedLocales?: unknown;
};

const SKILL_SOURCE_FILE_EXT_RE =
  /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt|ini|csv|lock)$/i;

function normalizeSitemapSkillRecord(record: Partial<SitemapSkillEntry>): CanonicalSkillRoute | null {
  const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
  const rawRoutePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
  if (!owner || !rawRoutePath) return null;

  const inferredRepo =
    typeof record.repo === 'string' && record.repo.trim().length > 0
      ? record.repo.trim()
      : rawRoutePath.split('/').filter(Boolean)[0] || '';
  const routePath = getSkillRoutePath({
    owner,
    repo: inferredRepo,
    routePath: rawRoutePath,
  });

  if (!routePath) return null;

  return {
    owner,
    routePath,
  };
}

const canonicalSkillRouteMap = new Map<string, CanonicalSkillRoute>();

type RepoFallbackRoute = {
  owner: string;
  repo: string;
  routePath: string;
};

type CrawlerPublicSurface = {
  locale: string;
  canonicalPath: string;
  title: string;
  description: string;
};

type AuthoritySurfacePublicRecord = {
  readonly href?: string;
  readonly surfaceClass?: string;
  readonly title?: unknown;
  readonly description?: unknown;
};

const repoFallbackRouteMap = new Map<string, RepoFallbackRoute>();

const knownRepoKeySet = new Set<string>();

// Lazy-loaded data
let _sitemapBlocklist: Awaited<ReturnType<typeof getSitemapBlocklist>> | null = null;
let _seo404Rules: Awaited<ReturnType<typeof getSeo404Rules>> | null = null;
let _seoRedirectPathMap: Map<string, string> | null = null;
let _seoGonePathSet: Set<string> | null = null;

async function ensureMiddlewareDataLoaded(env: { SKILLS_CACHE?: KVNamespace }): Promise<void> {
  // The runtime loaders cache their own results. Re-read the references here so
  // an empty first load can be replaced immediately when data becomes available.
  const sitemapBlocklist = await getSitemapBlocklist(env);
  if (_sitemapBlocklist !== sitemapBlocklist) {
    _sitemapBlocklist = sitemapBlocklist;
  }

  const seo404Rules = await getSeo404Rules(env);
  if (_seo404Rules !== seo404Rules) {
    _seo404Rules = seo404Rules;
    _seoRedirectPathMap = new Map<string, string>();
    _seoGonePathSet = new Set<string>();
    const redirectRules = ((_seo404Rules as any)?.rules?.redirect301 ?? []) as Array<{
      fromPath?: string;
      toPath?: string;
    }>;
    for (const rule of redirectRules) {
      const fromPath = typeof rule.fromPath === 'string' ? rule.fromPath.trim() : '';
      const toPath = typeof rule.toPath === 'string' ? rule.toPath.trim() : '';
      if (fromPath && toPath && fromPath !== toPath) {
        _seoRedirectPathMap.set(fromPath, toPath);
      }
    }
    const goneRules = ((_seo404Rules as any)?.rules?.gone410 ?? []) as Array<{ path?: string }>;
    for (const rule of goneRules) {
      const gonePath = typeof rule.path === 'string' ? rule.path.trim() : '';
      if (gonePath) {
        _seoGonePathSet.add(gonePath);
      }
    }
  }
}

let _sitemapSkillsLoaded = false;
let _sitemapSkillsLoadPromise: Promise<void> | null = null;
// Edge cache version - bump this when deploying breaking changes to invalidate stale cache
const EDGE_CACHE_VERSION = 'v22';

function buildEdgeCacheKey(url: URL): Request {
  const cacheUrl = new URL(url);
  cacheUrl.searchParams.set('_cv', EDGE_CACHE_VERSION);
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

async function ensureSitemapSkillsLoaded(env: { SKILLS_CACHE?: KVNamespace }): Promise<void> {
  // Re-load whenever the route map is empty so a transient empty load can recover
  // as soon as the runtime loader has data available again.
  const needsReload = !_sitemapSkillsLoaded || canonicalSkillRouteMap.size === 0;
  if (!needsReload) return;
  // If a load is already in progress, wait for it
  if (_sitemapSkillsLoadPromise) {
    try {
      await _sitemapSkillsLoadPromise;
    } catch {
      /* ignore */
    }
    if (canonicalSkillRouteMap.size > 0) return; // Load succeeded
  }

  _sitemapSkillsLoadPromise = (async () => {
    let loadSucceeded: boolean | undefined;
    try {
      // Load blocklist BEFORE the loop to avoid per-iteration KV calls
      // and prevent crashes from undefined blocklist (see GH-404-debug)
      const blocklist = _sitemapBlocklist || (await getSitemapBlocklist(env));
      if (!_sitemapBlocklist && blocklist) _sitemapBlocklist = blocklist;

      const sitemapSkillsData = await getSitemapSkills(env);
      const runtimeRecords = (
        Array.isArray(sitemapSkillsData)
          ? sitemapSkillsData
          : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
      ) as SitemapSkillRoutingRecord[];
      const staticRecords = (
        Array.isArray(staticSitemapSkillsData)
          ? staticSitemapSkillsData
          : ((staticSitemapSkillsData as { skills?: unknown[] }).skills ?? [])
      ) as SitemapSkillRoutingRecord[];
      // Cloudflare preview and transient KV failures may not expose SKILLS_CACHE.
      // The deployed sitemap snapshot keeps canonical routing fail-open in that case.
      const records = runtimeRecords.length > 0 ? runtimeRecords : staticRecords;

      // Populate canonicalSkillRouteMap
      const fallbackCandidates = new Map<string, RepoFallbackRoute[]>();
      for (const record of records) {
        const normalized = normalizeSitemapSkillRecord(record);
        if (!normalized) continue;
        const { owner, routePath } = normalized;
        if (isSitemapSkillBlocked(owner, routePath, blocklist)) continue;

        canonicalSkillRouteMap.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, { owner, routePath });

        const canonicalLocale =
          typeof record.canonicalLocale === 'string' && record.canonicalLocale.trim().length > 0
            ? record.canonicalLocale.trim().toLowerCase()
            : null;
        const publishedLocales = Array.isArray(record.publishedLocales)
          ? record.publishedLocales
              .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
              .map((locale) => locale.trim().toLowerCase())
          : [];
        const governanceKey = `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
        if (canonicalLocale && !skillLocaleGovernanceMap.has(governanceKey)) {
          skillLocaleGovernanceMap.set(governanceKey, {
            owner,
            routePath,
            canonicalLocale,
            publishedLocales,
          });
        }

        const parts = routePath.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const repo = parts[0];
          if (repo) {
            const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
            const entry: RepoFallbackRoute = { owner, repo, routePath };
            const list = fallbackCandidates.get(key);
            if (list) list.push(entry);
            else fallbackCandidates.set(key, [entry]);
          }
        }

        const repo = routePath.split('/').filter(Boolean)[0];
        if (repo) knownRepoKeySet.add(`${owner.toLowerCase()}/${repo.toLowerCase()}`);
      }

      for (const [key, list] of fallbackCandidates.entries()) {
        if (list.length === 1) {
          repoFallbackRouteMap.set(key, list[0]);
        }
      }

      if (canonicalSkillRouteMap.size === 0 && records.length > 0) {
        console.warn(
          '[Middleware] sitemap skills loaded but canonicalSkillRouteMap is still empty — possible blocklist/data mismatch',
        );
      }
      loadSucceeded = true;
    } catch (e) {
      console.error('[Middleware] Failed to load sitemap skills:', e);
      // On failure, do NOT mark as loaded — allow retry on next request
      loadSucceeded = false;
    } finally {
      _sitemapSkillsLoaded = loadSucceeded === true;
      _sitemapSkillsLoadPromise = null;
    }
  })();

  return _sitemapSkillsLoadPromise;
}

// seoRedirectPathMap and seoGonePathSet are now built lazily by
// ensureMiddlewareDataLoaded() using the _seoRedirectPathMap and
// _seoGonePathSet variables. Access via getter functions below.

function getSeoRedirectPathMap(): Map<string, string> {
  return _seoRedirectPathMap || new Map();
}

function getSeoGonePathSet(): Set<string> {
  return _seoGonePathSet || new Set();
}

function getMiddlewareBlocklist() {
  return _sitemapBlocklist || { exactKeys: new Set(), repoKeys: new Set() };
}

const LEGACY_DOC_PATH_REDIRECTS = new Map<string, string>([['development/create-skill', 'creating-skills']]);

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isOwnerOnlySkillTrapPath(pathname: string): boolean {
  return /^\/[a-z]{2}\/skills\/[^/]+\/?$/.test(pathname);
}

function resolveLegacyDocsRedirectPath(pathname: string): string | null {
  const match = pathname.match(/^\/([a-z]{2})\/docs\/(.+)$/);
  if (!match) return null;

  const localeSegment = match[1];
  const requestedSlug = match[2]
    .split('/')
    .map((segment) => safeDecodePathSegment(segment).trim())
    .filter(Boolean)
    .join('/');
  if (!requestedSlug) return null;

  const canonicalSlug = LEGACY_DOC_PATH_REDIRECTS.get(requestedSlug.toLowerCase());
  if (!canonicalSlug) return null;

  const canonicalPath = `/${localeSegment}/docs/${canonicalSlug}`;
  return canonicalPath === pathname ? null : canonicalPath;
}

function resolveCanonicalSkillPathFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/([a-z]{2})\/skills\/([^/]+)\/(.+?)\/?$/);
  if (!match) return null;

  const localeSegment = match[1];
  const ownerSegment = safeDecodePathSegment(match[2]).trim();
  const routeSegments = match[3]
    .split('/')
    .map((segment) => safeDecodePathSegment(segment).trim())
    .filter(Boolean);
  if (!ownerSegment || routeSegments.length === 0) return null;

  const candidateRoutePaths = Array.from(
    new Set(
      [
        routeSegments.join('/'),
        routeSegments.length >= 2 ? routeSegments.slice(0, 2).join('/') : '',
        routeSegments[0] || '',
      ].filter(Boolean),
    ),
  );

  for (const candidateRoutePath of candidateRoutePaths) {
    const canonicalRoute = resolveCanonicalSkillRoute(ownerSegment, candidateRoutePath);
    if (canonicalRoute) {
      return (
        resolveGovernedSkillDetailPath(localeSegment, canonicalRoute.owner, canonicalRoute.routePath) ||
        buildLocalizedSkillPath(localeSegment, canonicalRoute.owner, canonicalRoute.routePath)
      );
    }
  }

  const repoSegment = routeSegments[0];
  if (!repoSegment) return null;
  const fallbackRoute = repoFallbackRouteMap.get(`${ownerSegment.toLowerCase()}/${repoSegment.toLowerCase()}`);
  if (fallbackRoute) {
    return resolveRepoFallbackRedirectPath(localeSegment, fallbackRoute);
  }

  return null;
}

function trimRouteSegmentNoise(routePath: string): string {
  return routePath
    .split('/')
    .map((segment) => segment.trim().replace(/[._-]+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function resolveCanonicalSkillRoute(owner: string, routePath: string): CanonicalSkillRoute | null {
  const direct = canonicalSkillRouteMap.get(`${owner.toLowerCase()}/${routePath.toLowerCase()}`);
  if (direct) return direct;

  const trimmed = trimRouteSegmentNoise(routePath);
  if (trimmed && trimmed !== routePath) {
    return canonicalSkillRouteMap.get(`${owner.toLowerCase()}/${trimmed.toLowerCase()}`) || null;
  }

  return null;
}

function resolveRepoFallbackRedirectPath(
  localeSegment: string,
  fallbackRoute: RepoFallbackRoute,
  options: { applyLocaleGovernance?: boolean } = {},
): string {
  const requestedLocale = localeSegment.trim().toLowerCase();
  const governance = skillLocaleGovernanceMap.get(
    `${fallbackRoute.owner.toLowerCase()}/${fallbackRoute.routePath.toLowerCase()}`,
  );

  if (
    options.applyLocaleGovernance &&
    governance?.canonicalLocale &&
    governance.canonicalLocale !== requestedLocale &&
    !governance.publishedLocales.includes(requestedLocale)
  ) {
    return buildLocalizedSkillPath(governance.canonicalLocale, fallbackRoute.owner, fallbackRoute.routePath);
  }

  return buildLocalizedSkillPath(localeSegment, fallbackRoute.owner, fallbackRoute.routePath);
}

function resolveGovernedSkillDetailPath(localeSegment: string, owner: string, routePath: string): string | null {
  const requestedLocale = localeSegment.trim().toLowerCase();
  const governance = skillLocaleGovernanceMap.get(`${owner.toLowerCase()}/${routePath.toLowerCase()}`);
  if (!governance?.canonicalLocale) return null;

  const publishedLocales =
    governance.publishedLocales.length > 0 ? governance.publishedLocales : [governance.canonicalLocale];
  if (publishedLocales.includes(requestedLocale) || governance.canonicalLocale === requestedLocale) {
    return null;
  }

  return buildLocalizedSkillPath(governance.canonicalLocale, owner, routePath);
}

function isCrawlerUserAgent(userAgent: string): boolean {
  return /(googlebot|bingbot|slurp|duckduckbot|yandexbot|baiduspider|petalbot|applebot|bytespider|gptbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|google-extended|applebot-extended|cohere-ai|killer-skills-warmup-bot)/.test(
    userAgent,
  );
}

function isAiCrawlerUserAgent(userAgent: string): boolean {
  return /(gptbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|google-extended|applebot-extended|cohere-ai)/.test(
    userAgent,
  );
}

function isLowFidelityHtmlRequest(request: Request): boolean {
  if (!request.headers.has('accept')) return false;

  const accept = (request.headers.get('accept') || '').trim().toLowerCase();
  if (!accept) return false;
  if (accept.includes('text/html') || accept.includes('application/xhtml+xml')) return false;

  return accept
    .split(',')
    .map((part) => part.trim().split(';')[0].trim())
    .some((mime) => mime === '*/*' || mime === 'text/*');
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function formatCrawlerLabel(value: string): string {
  return value
    .split(/[/_-]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(-3)
    .join(' ');
}

function isAiCrawlerCapsulePath(url: URL): boolean {
  const { pathname, searchParams } = url;
  if (/^\/[a-z]{2}\/skills\/[^/]+\/[^/]+(?:\/[^/]+)?$/.test(pathname)) return true;
  if (/^\/[a-z]{2}\/skills$/.test(pathname) && searchParams.size > 0) return true;
  return /^\/[a-z]{2}\/occupations\/[^/]+$/.test(pathname);
}

function isCrawlerSkillsListingParamPath(url: URL): boolean {
  return /^\/[a-z]{2}\/skills$/.test(url.pathname) && url.searchParams.size > 0;
}

const CRAWLER_STATIC_SURFACE_COPY: Record<string, { title: string; description: string }> = {
  home: {
    title: 'Killer-Skills',
    description: 'Curated AI agent skills, collections, docs, and trusted workflow surfaces.',
  },
  skills: {
    title: 'AI Agent Skills Directory',
    description: 'Browse trusted AI agent skills by source, category, workflow, and installation path.',
  },
  popular: {
    title: 'Popular AI Agent Skills',
    description: 'Discover widely used AI agent skills and workflow tools from the public catalog.',
  },
  occupations: {
    title: 'AI Skills by Occupation',
    description: 'Explore AI agent skills mapped to professional workflows and job tasks.',
  },
  search: {
    title: 'AI Skill Search',
    description: 'Search the Killer-Skills catalog for installable AI agent skills and workflow tools.',
  },
  safe: {
    title: 'Safe AI Skill Directory',
    description: 'Review safety, trust, and source signals for public AI agent skills.',
  },
  article: {
    title: 'AI Agent Skills Articles',
    description: 'Read guides about AI agent skills, MCP servers, automation, and developer workflows.',
  },
  collections: {
    title: 'AI Skill Collections',
    description: 'Browse curated collections for trusted tools, workflows, and setup paths.',
  },
  docs: {
    title: 'Killer-Skills Documentation',
    description: 'Read installation, CLI, indexing, and workflow documentation for Killer-Skills.',
  },
  privacy: {
    title: 'Privacy Policy',
    description:
      'Read how Killer-Skills handles privacy, public catalog data, analytics, and user-submitted skill information.',
  },
  terms: {
    title: 'Terms of Service',
    description:
      'Review the Killer-Skills terms for using the public AI skills catalog, documentation, and workflow resources.',
  },
  cookies: {
    title: 'Cookie Policy',
    description: 'Read how Killer-Skills uses cookies and local browser state.',
  },
};

const CRAWLER_OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  pt: 'pt_BR',
  ru: 'ru_RU',
  ar: 'ar_SA',
};

function localizedAuthorityText(value: unknown, locale: string): string {
  if (!value || typeof value !== 'object') return '';
  const text = value as Record<string, unknown>;
  const localized = text[locale];
  if (typeof localized === 'string' && localized.trim()) return localized.trim();
  const english = text.en;
  return typeof english === 'string' ? english.trim() : '';
}

function resolveAuthorityCollectionSurface(pathname: string, locale: string): CrawlerPublicSurface | null {
  if (!/^\/(?:en|zh)\/collections\/[^/]+$/.test(pathname)) return null;

  const surfaces = (
    authoritySurfacePublicData as unknown as {
      readonly surfaces?: readonly AuthoritySurfacePublicRecord[];
    }
  ).surfaces;
  if (!Array.isArray(surfaces)) return null;

  for (const surface of surfaces) {
    if (surface.surfaceClass !== 'collection') continue;
    const href = typeof surface.href === 'string' ? surface.href.replace('{locale}', locale) : '';
    if (href !== pathname) continue;
    const title = localizedAuthorityText(surface.title, locale) || CRAWLER_STATIC_SURFACE_COPY.collections.title;
    const description =
      localizedAuthorityText(surface.description, locale) || CRAWLER_STATIC_SURFACE_COPY.collections.description;
    return { locale, canonicalPath: pathname, title, description };
  }

  return null;
}

function resolveCrawlerPublicSurface(url: URL): CrawlerPublicSurface | null {
  if (url.searchParams.size > 0) return null;

  const localeRootMatch = url.pathname.match(/^\/([a-z]{2})(?:\/([a-z]+))?$/);
  if (localeRootMatch) {
    const locale = localeRootMatch[1];
    const key = localeRootMatch[2] || 'home';
    const copy = CRAWLER_STATIC_SURFACE_COPY[key];
    if (!copy) return null;

    if ((key === 'collections' || key === 'docs') && !['en', 'zh'].includes(locale)) {
      return null;
    }

    const title =
      key === 'home'
        ? locale === 'zh'
          ? 'Killer-Skills - AI Agent Skills / AI 智能体技能市场'
          : 'Killer-Skills - AI Agent Skills Marketplace'
        : copy.title;
    const description =
      key === 'home'
        ? locale === 'zh'
          ? '发现、筛选并安装通过基础审查的 AI Agent Skills，按榜单、职业和精选合集快速进入，适合在 Claude Code、Cursor 与 Windsurf 中对比使用。'
          : 'Discover, filter, and install baseline-reviewed AI agent skills by rankings, occupations, and curated collections.'
        : copy.description;

    return {
      locale,
      canonicalPath: url.pathname,
      title,
      description,
    };
  }

  const collectionMatch = url.pathname.match(/^\/([a-z]{2})\/collections\/[^/]+$/);
  if (collectionMatch) {
    return resolveAuthorityCollectionSurface(url.pathname, collectionMatch[1]);
  }

  return null;
}

function buildCrawlerPublicSurfaceResponse(surface: CrawlerPublicSurface): Response {
  const canonicalUrl = `https://${SITE_DOMAIN}${surface.canonicalPath}`;
  const directoryUrl = `https://${SITE_DOMAIN}/${surface.locale}/skills`;
  const collectionsUrl = `https://${SITE_DOMAIN}/${surface.locale}/collections`;
  const docsUrl = `https://${SITE_DOMAIN}/${surface.locale}/docs`;
  const sitemapUrl = `https://${SITE_DOMAIN}/sitemap.xml`;
  const alternateLocales = /^\/(?:en|zh)\/(?:collections|docs)(?:\/|$)/.test(surface.canonicalPath)
    ? SUPPORTED_LOCALES.filter((locale) => ['en', 'zh'].includes(locale))
    : SUPPORTED_LOCALES;
  const alternateLinks = alternateLocales
    .map((locale) => {
      const alternatePath = surface.canonicalPath.replace(/^\/[a-z]{2}(?=\/|$)/, `/${locale}`);
      return `<link rel="alternate" hreflang="${htmlEscape(locale)}" href="${htmlEscape(`https://${SITE_DOMAIN}${alternatePath}`)}">`;
    })
    .join('\n  ');
  const xDefaultPath = surface.canonicalPath.replace(/^\/[a-z]{2}(?=\/|$)/, '/en');
  const isCollectionsIndex = /^\/[a-z]{2}\/collections$/.test(surface.canonicalPath);
  const breadcrumbItems = isCollectionsIndex
    ? [
        { name: surface.locale === 'zh' ? '首页' : 'Home', url: `https://${SITE_DOMAIN}/${surface.locale}` },
        { name: surface.locale === 'zh' ? '合集' : 'Collections', url: collectionsUrl },
      ]
    : [];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: surface.title,
        description: surface.description,
        inLanguage: surface.locale,
        isPartOf: { '@id': `https://${SITE_DOMAIN}/#website` },
      },
      ...(breadcrumbItems.length > 0
        ? [
            {
              '@type': 'BreadcrumbList',
              itemListElement: breadcrumbItems.map((item, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: item.name,
                item: item.url,
              })),
            },
          ]
        : []),
    ],
  };
  const documentTitle = surface.title.includes('Killer-Skills') ? surface.title : `${surface.title} | Killer-Skills`;
  const body = `<!doctype html>
<html lang="${htmlEscape(surface.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${htmlEscape(surface.description)}">
  <link rel="canonical" href="${htmlEscape(canonicalUrl)}">
  ${alternateLinks}
  <link rel="alternate" hreflang="x-default" href="${htmlEscape(`https://${SITE_DOMAIN}${xDefaultPath}`)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Killer-Skills">
  <meta property="og:title" content="${htmlEscape(surface.title)}">
  <meta property="og:description" content="${htmlEscape(surface.description)}">
  <meta property="og:url" content="${htmlEscape(canonicalUrl)}">
  <meta property="og:locale" content="${htmlEscape(CRAWLER_OG_LOCALE_MAP[surface.locale] || surface.locale)}">
  <title>${htmlEscape(documentTitle)}</title>
  <script type="application/ld+json">${jsonLdScript(jsonLd)}</script>
</head>
<body>
  <main>
    <h1>${htmlEscape(surface.title)}</h1>
    <p>${htmlEscape(surface.description)}</p>
    ${isCollectionsIndex ? `<nav aria-label="Breadcrumb"><a href="${htmlEscape(`https://${SITE_DOMAIN}/${surface.locale}`)}">${htmlEscape(surface.locale === 'zh' ? '首页' : 'Home')}</a><span>${htmlEscape(surface.locale === 'zh' ? '合集' : 'Collections')}</span></nav>` : ''}
    <nav>
      <a href="${htmlEscape(directoryUrl)}">Skills directory</a>
      <a href="${htmlEscape(collectionsUrl)}">Collections</a>
      <a href="${htmlEscape(docsUrl)}">Documentation</a>
      <a href="${htmlEscape(sitemapUrl)}">Sitemap</a>
    </nav>
  </main>
</body>
</html>`;
  const response = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400',
      'Content-Language': surface.locale,
      Vary: 'Accept, User-Agent',
      'X-Robots-Tag': 'index, follow',
      'X-Killer-Skills-Crawler-Capsule': '1',
      'X-Cache': 'BYPASS-CRAWLER-SURFACE',
    },
  });
  setSecurityHeaders(response);
  return response;
}

function buildCrawlerSkillDetailResponse(
  locale: string,
  owner: string,
  routePath: string,
  canonicalPath: string,
): Response {
  const routeSegments = routePath.split('/').filter(Boolean);
  const repo = routeSegments[0] || routePath;
  const label = formatCrawlerLabel(routePath) || repo || 'Skill';
  const title = `${label} skill`;
  const description =
    'Killer-Skills indexes this AI agent skill with source trust, install paths, and workflow context.';
  const canonicalUrl = `https://${SITE_DOMAIN}${canonicalPath}`;
  const directoryUrl = `https://${SITE_DOMAIN}/${locale}/skills`;
  const sitemapUrl = `https://${SITE_DOMAIN}/sitemap-skills.xml`;
  const llmsUrl = `https://${SITE_DOMAIN}/llms.txt`;
  const sourceUrl = `https://github.com/${owner}/${repo}`;
  const governance = skillLocaleGovernanceMap.get(`${owner.toLowerCase()}/${routePath.toLowerCase()}`);
  const alternateLocales =
    governance?.publishedLocales && governance.publishedLocales.length > 0
      ? governance.publishedLocales
      : [governance?.canonicalLocale || locale];
  const alternateLinks = alternateLocales
    .map((alternateLocale) => {
      const href = `https://${SITE_DOMAIN}${buildLocalizedSkillPath(alternateLocale, owner, routePath)}`;
      return `<link rel="alternate" hreflang="${htmlEscape(alternateLocale)}" href="${htmlEscape(href)}">`;
    })
    .join('\n  ');
  const xDefaultLocale = governance?.canonicalLocale || alternateLocales[0] || locale;
  const xDefaultUrl = `https://${SITE_DOMAIN}${buildLocalizedSkillPath(xDefaultLocale, owner, routePath)}`;
  const breadcrumbItems = [
    { name: 'Home', url: `https://${SITE_DOMAIN}/${locale}` },
    { name: 'Skills', url: directoryUrl },
    { name: title, url: canonicalUrl },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { '@id': `https://${SITE_DOMAIN}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
    ],
  };
  const body = `<!doctype html>
<html lang="${htmlEscape(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${htmlEscape(description)}">
  <link rel="canonical" href="${htmlEscape(canonicalUrl)}">
  ${alternateLinks}
  <link rel="alternate" hreflang="x-default" href="${htmlEscape(xDefaultUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Killer-Skills">
  <meta property="og:title" content="${htmlEscape(title)}">
  <meta property="og:description" content="${htmlEscape(description)}">
  <meta property="og:url" content="${htmlEscape(canonicalUrl)}">
  <meta property="og:locale" content="${htmlEscape(CRAWLER_OG_LOCALE_MAP[locale] || locale)}">
  <title>${htmlEscape(title)} | Killer-Skills</title>
  <script type="application/ld+json">${jsonLdScript(jsonLd)}</script>
</head>
<body>
  <main>
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(description)}</p>
    <nav aria-label="Breadcrumb">
      <a href="${htmlEscape(`https://${SITE_DOMAIN}/${locale}`)}">Home</a>
      <a href="${htmlEscape(directoryUrl)}">Skills</a>
      <span>${htmlEscape(title)}</span>
    </nav>
    <nav>
      <a href="${htmlEscape(directoryUrl)}">Skills directory</a>
      <a href="${htmlEscape(sitemapUrl)}">Skills sitemap</a>
      <a href="${htmlEscape(llmsUrl)}">LLMs summary</a>
      <a href="${htmlEscape(sourceUrl)}">Source repository</a>
    </nav>
  </main>
</body>
</html>`;
  const response = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400',
      'Content-Language': locale,
      Vary: 'Accept, User-Agent',
      'X-Robots-Tag': 'index, follow',
      'X-Killer-Skills-Crawler-Capsule': '1',
      'X-Cache': 'BYPASS-CRAWLER-SKILL',
    },
  });
  setSecurityHeaders(response);
  return response;
}

function buildAiCrawlerCapsuleResponse(url: URL): Response {
  const segments = url.pathname.split('/').filter(Boolean);
  const locale = segments[0] || 'en';
  const routeKind = segments[1] || 'directory';
  const finalSegment = segments[segments.length - 1] || routeKind;
  const query =
    url.searchParams.get('q') || url.searchParams.get('occupation') || url.searchParams.get('category') || '';
  const label = formatCrawlerLabel(query || finalSegment) || 'Killer-Skills';
  const title =
    routeKind === 'occupations'
      ? `${label} skills`
      : routeKind === 'skills' && segments.length > 2
        ? `${label} skill`
        : `Skills directory: ${label}`;
  const description =
    'Killer-Skills indexes reviewed AI agent skills, source trust, install paths, and workflow categories.';
  const canonicalUrl = `https://${SITE_DOMAIN}${url.pathname}${url.search}`;
  const directoryUrl = `https://${SITE_DOMAIN}/${locale}/skills`;
  const sitemapUrl = `https://${SITE_DOMAIN}/sitemap-skills.xml`;
  const llmsUrl = `https://${SITE_DOMAIN}/llms.txt`;
  const body = `<!doctype html>
<html lang="${htmlEscape(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <meta name="description" content="${htmlEscape(description)}">
  <link rel="canonical" href="${htmlEscape(canonicalUrl)}">
  <title>${htmlEscape(title)} | Killer-Skills</title>
</head>
<body>
  <main>
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(description)}</p>
    <nav>
      <a href="${htmlEscape(directoryUrl)}">Skills directory</a>
      <a href="${htmlEscape(sitemapUrl)}">Skills sitemap</a>
      <a href="${htmlEscape(llmsUrl)}">LLMs summary</a>
    </nav>
  </main>
</body>
</html>`;
  const response = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, follow',
      'X-Killer-Skills-Crawler-Capsule': '1',
      'X-Cache': 'BYPASS-AI-CRAWLER',
    },
  });
  setSecurityHeaders(response);
  return response;
}

function resolvePageRouteBucket(pathname: string): string {
  if (/^\/[a-z]{2}\/skills\/[^/]+\/.+/.test(pathname)) return 'skills_detail';
  if (/^\/[a-z]{2}\/skills$/.test(pathname)) return 'skills_index';
  if (/^\/[a-z]{2}\/collections(?:\/|$)/.test(pathname)) return 'collections';
  if (/^\/[a-z]{2}\/categories(?:\/|$)/.test(pathname)) return 'categories';
  if (/^\/[a-z]{2}\/solutions(?:\/|$)/.test(pathname)) return 'solutions';
  if (/^\/[a-z]{2}\/blog(?:\/|$)/.test(pathname)) return 'blog';
  if (/^\/[a-z]{2}\/docs(?:\/|$)/.test(pathname)) return 'docs';
  return 'other';
}

function resolvePositiveNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Add security and performance headers to page/API responses.
 *
 * Notes on the chosen baseline:
 *  - HSTS with `preload` is safe because killer-skills.com is HTTPS-only and
 *    served via Cloudflare (which terminates TLS for both apex and www).
 *  - Cross-Origin-Opener-Policy `same-origin` mitigates Spectre-class
 *    side-channel leaks across windows; harmless for a content site.
 *  - We deliberately do *not* emit a strict CSP here yet: Astro's inline
 *    theme/router scripts and many islands rely on inline `set:html`
 *    handlers, which would require nonces or hashes to keep working.
 *    Adding CSP is tracked as a follow-up; emitting a partial/broken CSP
 *    would be worse than none.
 */
function setSecurityHeaders(response: Response): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  if (!response.headers.has('Strict-Transport-Security')) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  if (!response.headers.has('Cross-Origin-Opener-Policy')) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  }
}

// --- Sliding window request-density monitor (REC-39) ---
interface RequestCounter {
  count: number;
  resetTime: number;
}

const ipCounters = new Map<string, RequestCounter>();
const globalCounter: RequestCounter = { count: 0, resetTime: 0 };
const WINDOW_MS = 60 * 1000;
let lastAlertLoggedTime = 0;
const ALERT_LOG_DEBOUNCE_MS = 5 * 60 * 1000;

function incrementAndCheckRate(ip: string): {
  ipLimit: boolean;
  globalLimit: boolean;
  ipCount: number;
  globalCount: number;
} {
  const now = Date.now();

  if (now > globalCounter.resetTime) {
    globalCounter.count = 1;
    globalCounter.resetTime = now + WINDOW_MS;
  } else {
    globalCounter.count++;
  }

  let ipCounter = ipCounters.get(ip);
  if (!ipCounter || now > ipCounter.resetTime) {
    ipCounter = { count: 1, resetTime: now + WINDOW_MS };
    ipCounters.set(ip, ipCounter);
  } else {
    ipCounter.count++;
  }

  if (ipCounters.size > 2000) {
    for (const [key, value] of ipCounters.entries()) {
      if (now > value.resetTime) {
        ipCounters.delete(key);
      }
    }
  }

  const IP_THRESHOLD = 500;
  const GLOBAL_THRESHOLD = 5000;

  return {
    ipLimit: ipCounter.count > IP_THRESHOLD,
    globalLimit: globalCounter.count > GLOBAL_THRESHOLD,
    ipCount: ipCounter.count,
    globalCount: globalCounter.count,
  };
}

async function logSystemAlert(db: any, alertType: string, message: string, details: string): Promise<void> {
  try {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();
    await db
      .prepare(`INSERT INTO system_alerts (id, timestamp, alert_type, message, details) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, timestamp, alertType, message, details)
      .run();
  } catch (e: any) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('system_alerts'))) {
      try {
        await db
          .prepare(
            `
          CREATE TABLE IF NOT EXISTS system_alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            alert_type TEXT,
            message TEXT,
            details TEXT
          )
        `,
          )
          .run();
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15);
        const timestamp = new Date().toISOString();
        await db
          .prepare(`INSERT INTO system_alerts (id, timestamp, alert_type, message, details) VALUES (?, ?, ?, ?, ?)`)
          .bind(id, timestamp, alertType, message, details)
          .run();
      } catch (retryErr: any) {
        logger.error('Failed to create system_alerts table or retry insert', {
          error: retryErr.message || String(retryErr),
        });
      }
    } else {
      logger.error('Failed to log system alert to D1', { error: e.message || String(e) });
    }
  }
}
// --------------------------------------------------------

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // ═══════════════════════════════════════════════
  // Edge Cache: serve from CF Cache API when possible.
  // Workers don't auto-cache SSR HTML — we must explicitly
  // check/populate caches.default. This cuts TTFB from
  // ~2s (cold) to ~50ms (cached) for anonymous GETs.
  // ═══════════════════════════════════════════════
  const isCacheableRequest =
    context.request.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/admin') &&
    !context.isPrerendered;
  const userAgent = context.isPrerendered ? '' : (context.request.headers.get('user-agent') || '').toLowerCase();
  const isCrawlerRequest = isCrawlerUserAgent(userAgent);
  const isAiCrawlerRequest = isAiCrawlerUserAgent(userAgent);
  const isLowFidelityCrawlerLikeRequest = !context.isPrerendered && isLowFidelityHtmlRequest(context.request);
  const shouldUseEdgeCache =
    isCacheableRequest &&
    !import.meta.env.DEV &&
    typeof caches !== 'undefined' &&
    !(isCrawlerRequest && context.url.searchParams.size > 0);

  const crawlerSkillPathMatch = isCrawlerRequest
    ? pathname.match(/^\/(?:[a-z]{2})\/skills\/([^/]+)\/([^/]+(?:\/[^/]+)?)$/)
    : null;
  if (crawlerSkillPathMatch) {
    const ownerSegment = safeDecodePathSegment(crawlerSkillPathMatch[1]).trim();
    const routeSegment = safeDecodePathSegment(crawlerSkillPathMatch[2]).trim();
    if (ownerSegment && routeSegment) {
      const env = await getRuntimeEnv<{ SKILLS_CACHE?: KVNamespace }>(context.locals);
      await ensureMiddlewareDataLoaded(env || {});

      const explicitRedirectTarget = getSeoRedirectPathMap().get(pathname);
      if (explicitRedirectTarget) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: explicitRedirectTarget + context.url.search,
            'Cache-Control': 'public, s-maxage=86400',
          },
        });
      }

      if (getSeoGonePathSet().has(pathname)) {
        return new Response(null, {
          status: 410,
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }

      if (isSitemapSkillBlocked(ownerSegment, routeSegment, getMiddlewareBlocklist())) {
        return buildAiCrawlerCapsuleResponse(context.url);
      }
    }
  }

  if (
    (isAiCrawlerRequest && isAiCrawlerCapsulePath(context.url)) ||
    (isCrawlerRequest && isCrawlerSkillsListingParamPath(context.url))
  ) {
    return buildAiCrawlerCapsuleResponse(context.url);
  }

  if (shouldUseEdgeCache) {
    try {
      const cache = (caches as unknown as { default: Cache }).default;
      const cacheKey = buildEdgeCacheKey(context.url);
      const cached = await cache.match(cacheKey);
      if (cached) {
        // Clone to allow multiple reads and add cache-hit marker
        const response = new Response(cached.body, cached);
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-TTL', response.headers.get('Cache-Control') || '');
        return response;
      }
    } catch {
      // Cache API unavailable (dev mode / miniflare) — proceed normally
    }
  }

  // Ensure skill locale governance data and middleware data is loaded (from KV in prod, local fallback in dev)
  // Also re-check sitemap skills if map is empty (allows recovery from empty KV load)
  const sitemapSkillsEmpty = _sitemapSkillsLoaded && canonicalSkillRouteMap.size === 0;
  const requiresSkillRoutingData = /^\/[a-z]{2}\/skills\/[^/]+\/[^/]+(?:\/|$)/.test(pathname);
  if (
    !_seoRedirectPathMap ||
    (requiresSkillRoutingData && (!isGovernanceLoaded() || !_sitemapSkillsLoaded || sitemapSkillsEmpty))
  ) {
    const env = await getRuntimeEnv<{ SKILLS_CACHE?: KVNamespace }>(context.locals);
    // Load only the KV datasets required by this route, in parallel.
    await Promise.all([
      requiresSkillRoutingData && !isGovernanceLoaded() ? loadSkillLocaleGovernance(env || {}) : Promise.resolve(),
      requiresSkillRoutingData && (!_sitemapSkillsLoaded || sitemapSkillsEmpty)
        ? ensureSitemapSkillsLoaded(env || {})
        : Promise.resolve(),
      requiresSkillRoutingData || !_seoRedirectPathMap ? ensureMiddlewareDataLoaded(env || {}) : Promise.resolve(),
    ]);
  }

  // Apply request density throttling (REC-39)
  const isWarmupRequest = userAgent.includes('killer-skills-warmup-bot');
  if (!isWarmupRequest && !isStaticOrApiPath(pathname) && !context.isPrerendered) {
    const clientIp = context.clientAddress || context.request.headers.get('cf-connecting-ip') || '127.0.0.1';
    const { ipLimit, globalLimit, ipCount, globalCount } = incrementAndCheckRate(clientIp);

    if (ipLimit || globalLimit) {
      context.locals.useStaticFallback = true;
      const now = Date.now();
      if (now - lastAlertLoggedTime > ALERT_LOG_DEBOUNCE_MS) {
        lastAlertLoggedTime = now;
        const alertType = ipLimit ? 'IP_RATE_LIMIT' : 'GLOBAL_RATE_LIMIT';
        const message = ipLimit
          ? `IP ${clientIp} rate limit exceeded: ${ipCount} req/min`
          : `Global rate limit exceeded: ${globalCount} req/min`;
        const details = JSON.stringify({ ip: clientIp, ipCount, globalCount, path: pathname, ua: userAgent });

        const env = await getRuntimeEnv(context.locals);
        if (env?.DB) {
          const writePromise = logSystemAlert(env.DB, alertType, message, details);
          if ((context.locals.runtime as any)?.ctx?.waitUntil) {
            (context.locals.runtime as any).ctx.waitUntil(writePromise);
          } else {
            writePromise.catch((e) => logger.error('Alert background write failed', { error: e.message || String(e) }));
          }
        }
      }
    }
  }

  // 0. Enforce canonical domain: redirect www to non-www
  if (context.url.hostname === `www.${SITE_DOMAIN}`) {
    const url = new URL(context.url);
    url.hostname = SITE_DOMAIN;
    return new Response(null, {
      status: 301,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  if (/^\/sitemap-skills-\d+\.xml$/i.test(pathname)) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: `/sitemap-skills.xml${context.url.search}`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 0.5. Enforce trailingSlash: 'never'
  // If the pathname ends with a slash (and isn't the root URL), 301 redirect to the path without the slash
  if (pathname !== '/' && pathname.endsWith('/')) {
    if (isOwnerOnlySkillTrapPath(pathname)) {
      return new Response(null, {
        status: 410,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    if (/^\/[a-z]{2}\/skills\//.test(pathname)) {
      const canonicalSkillPath = resolveCanonicalSkillPathFromPathname(pathname);
      if (canonicalSkillPath && canonicalSkillPath !== pathname) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: canonicalSkillPath + context.url.search,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      const deepNestMatch = pathname.match(/^\/([a-z]{2})\/skills\/([^/]+)\/([^/]+)\/(.+)/);
      if (SKILL_SOURCE_FILE_EXT_RE.test(pathname)) {
        return new Response(null, {
          status: 410,
          statusText: 'Gone',
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
      if (deepNestMatch && deepNestMatch[4].split('/').filter(Boolean).length >= 2) {
        return new Response(null, {
          status: 404,
          statusText: 'Not Found',
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            'X-Robots-Tag': 'noindex',
          },
        });
      }
    }

    const newPath = pathname.replace(/\/+$/, '');
    return new Response(null, {
      status: 301,
      headers: {
        Location: newPath + context.url.search,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 0.6. Redirect legacy blog URLs ending with .html to extensionless canonical paths
  const legacyBlogMatch = pathname.match(/^\/([a-z]{2})\/blog\/(.+)\.html$/i);
  if (legacyBlogMatch) {
    const canonicalPath = `/${legacyBlogMatch[1]}/blog/${legacyBlogMatch[2]}`;
    return new Response(null, {
      status: 301,
      headers: {
        Location: canonicalPath + context.url.search,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const legacyDocsRedirectPath = resolveLegacyDocsRedirectPath(pathname);
  if (legacyDocsRedirectPath) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: legacyDocsRedirectPath + context.url.search,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  if (/^\/[a-z]{2}\/skills\/[^/]+\/.+/.test(pathname) && context.url.searchParams.size > 0) {
    const canonicalSkillPath = resolveCanonicalSkillPathFromPathname(pathname) || pathname;
    return new Response(null, {
      status: 301,
      headers: {
        Location: canonicalSkillPath,
        'Cache-Control': 'public, s-maxage=86400',
      },
    });
  }

  // 1. Admin routes (API + pages) require Basic Auth
  const isAdminApi = pathname.startsWith('/api/admin/');
  const isAdminPage = !isAdminApi && pathname.startsWith('/admin');
  if (isAdminApi || isAdminPage) {
    const authHeader = context.request.headers.get('authorization');
    const env = await getRuntimeEnv<{ ADMIN_USER?: string; ADMIN_PASSWORD?: string }>(context.locals);
    const validUser = env?.ADMIN_USER;
    const validPass = env?.ADMIN_PASSWORD;

    // Fail closed: reject all admin access if credentials are not configured
    if (!validUser || !validPass) {
      return isAdminApi
        ? new Response(JSON.stringify({ error: 'Admin credentials not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        : new Response('Admin not configured', { status: 503 });
    }

    const authResult = checkAdminAuth(authHeader, validUser, validPass);
    if (authResult === 'pass') {
      return next();
    }

    // API routes return JSON error; pages return plain text
    return isAdminApi
      ? new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="Admin API"' },
        })
      : new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
        });
  }

  // 2. Block known invalid root-level paths (crawled by Googlebot but never valid)
  const INVALID_ROOT_PATHS = ['/.cursor/', '/04-Initiatives/', '/ORCHESTRATION.md', '/agent-os/'];
  if (INVALID_ROOT_PATHS.some((p) => pathname.startsWith(p) || pathname === p.replace(/\/$/, ''))) {
    return new Response(null, {
      status: 410, // Gone — tells Google to drop from index permanently
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // 2.5. Apply explicit SEO remediation overrides generated from coverage reports.
  const explicitRedirectTarget = getSeoRedirectPathMap().get(pathname);
  if (explicitRedirectTarget) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: explicitRedirectTarget + context.url.search,
        'Cache-Control': 'public, s-maxage=86400',
      },
    });
  }

  if (getSeoGonePathSet().has(pathname)) {
    return new Response(null, {
      status: 410,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  if (isOwnerOnlySkillTrapPath(pathname)) {
    return new Response(null, {
      status: 410,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  if (isCrawlerRequest || isLowFidelityCrawlerLikeRequest) {
    const crawlerPublicSurface = resolveCrawlerPublicSurface(context.url);
    if (crawlerPublicSurface) {
      return buildCrawlerPublicSurfaceResponse(crawlerPublicSurface);
    }
  }

  // 2.6. Detect repeated path segments (e.g. /references/references, /rules/rules, /roles/roles).
  //      These are crawl-trap artifacts that never correspond to real pages — return 410 Gone
  //      so Google drops them from the index faster than a generic 404.
  //      Only check beyond the owner/repo/sub-skill boundary (4+ skill segments) to avoid
  //      false positives on valid routes like /IstiN/dmtools/dmtools where repo == sub-skill.
  if (/^\/[a-z]{2}\/skills\//.test(pathname)) {
    const segments = pathname.split('/').filter(Boolean);
    // segments: [locale, 'skills', owner, repo, ...rest]
    // Start checking from index 5 (first segment after owner/repo/sub-skill)
    for (let i = 5; i < segments.length; i++) {
      if (segments[i].toLowerCase() === segments[i - 1].toLowerCase()) {
        return new Response(null, {
          status: 410,
          statusText: 'Gone',
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    }
  }

  // 3. Intercept skill paths ending with source-code file extensions (.md, .ts, .py, etc.)
  //    These are GitHub repo file paths that get matched by the catch-all [...]repo route
  //    but never correspond to actual pages — return cached 410 to save crawl budget.
  if (pathname.match(/^\/[a-z]{2}\/skills\//) && SKILL_SOURCE_FILE_EXT_RE.test(pathname)) {
    const canonicalSkillPath = resolveCanonicalSkillPathFromPathname(pathname);
    if (canonicalSkillPath) {
      if (canonicalSkillPath !== pathname) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: canonicalSkillPath + context.url.search,
            'Cache-Control': 'public, s-maxage=86400',
          },
        });
      }
    } else {
      return new Response(null, {
        status: 410,
        statusText: 'Gone',
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
  }

  // 3b. Block deeply nested skill paths (crawl traps like /skills/owner/repo/a/b/c/d)
  //     Only owner/repo is valid; anything beyond 2 segments after /skills/ is a trap.
  const deepNestMatch = pathname.match(/^\/([a-z]{2})\/skills\/([^/]+)\/([^/]+)\/(.+)/);
  if (deepNestMatch) {
    const subPath = deepNestMatch[4];
    // If there are 2+ extra path segments beyond owner/repo, it's a crawl trap.
    if (subPath.split('/').filter(Boolean).length >= 2) {
      const canonicalPath = resolveCanonicalSkillPathFromPathname(pathname);
      if (canonicalPath && canonicalPath !== pathname) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: canonicalPath + context.url.search,
            'Cache-Control': 'public, s-maxage=86400',
          },
        });
      }
      return new Response(null, {
        status: 404,
        statusText: 'Not Found',
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
  }

  // 3c. Normalize skill listing params into the current directory filter contract.
  const searchParams = context.url.searchParams;
  const skillsRootMatch = pathname.match(/^\/([a-z]{2})\/skills$/);
  if (skillsRootMatch && searchParams.size > 0) {
    const normalizedUrl = new URL(context.url);
    const normalizedParams = normalizedUrl.searchParams;
    let changed = false;

    const viewParam = (normalizedParams.get('view') || '').toLowerCase();
    if (viewParam === 'official' && normalizedParams.get('source') !== 'official') {
      normalizedParams.set('source', 'official');
      changed = true;
    }
    if (viewParam === 'latest' && normalizedParams.get('sort') !== 'latest') {
      normalizedParams.set('sort', 'latest');
      changed = true;
    }

    // Canonicalize legacy `query`, `owner`, `topic`, and `tag` aliases into `q`.
    const rawQ = normalizedParams.get('q');
    const legacyQuery =
      normalizedParams.get('query') ||
      normalizedParams.get('owner') ||
      normalizedParams.get('topic') ||
      normalizedParams.get('tag') ||
      '';
    const normalizedQ = String(rawQ || legacyQuery || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (normalizedQ.length > 0) {
      const cappedQ = normalizedQ.slice(0, 80);
      if (rawQ !== cappedQ) {
        normalizedParams.set('q', cappedQ);
        changed = true;
      }
    } else if (rawQ !== null) {
      normalizedParams.delete('q');
      changed = true;
    }

    for (const legacyKey of ['query', 'owner', 'topic', 'tag', 'view']) {
      if (normalizedParams.has(legacyKey)) {
        normalizedParams.delete(legacyKey);
        changed = true;
      }
    }

    const allowedSkillsParams = new Set(['q', 'category', 'occupation', 'source', 'sort', 'page']);
    for (const key of Array.from(normalizedParams.keys())) {
      if (!allowedSkillsParams.has(key)) {
        normalizedParams.delete(key);
        changed = true;
      }
    }

    const sourceParam = normalizedParams.get('source');
    if (sourceParam !== null && !['official', 'community'].includes(sourceParam)) {
      normalizedParams.delete('source');
      changed = true;
    }

    const sortParam = normalizedParams.get('sort');
    if (sortParam !== null && !['popular', 'latest'].includes(sortParam)) {
      normalizedParams.delete('sort');
      changed = true;
    }

    const rawPage = normalizedParams.get('page');
    if (rawPage !== null) {
      const parsedPage = Number.parseInt(rawPage, 10);
      if (!Number.isFinite(parsedPage) || parsedPage <= 1) {
        normalizedParams.delete('page');
        changed = true;
      } else {
        const normalizedPage = String(parsedPage);
        if (rawPage !== normalizedPage) {
          normalizedParams.set('page', normalizedPage);
          changed = true;
        }
      }
    }
    if (changed) {
      return new Response(null, {
        status: 301,
        headers: {
          Location: normalizedUrl.pathname + normalizedUrl.search,
          'Cache-Control': 'public, s-maxage=86400',
        },
      });
    }
  }

  // 3d. Canonicalize skill detail paths using sitemap route map.
  //     Covers case/encoding drift and some trailing punctuation noise in route segments.
  const skillPathMatch = pathname.match(/^\/([a-z]{2})\/skills\/([^/]+)\/([^/]+(?:\/[^/]+)?)$/);
  if (skillPathMatch) {
    const localeSegment = skillPathMatch[1];
    const ownerSegment = safeDecodePathSegment(skillPathMatch[2]).trim();
    const routeSegment = safeDecodePathSegment(skillPathMatch[3]).trim();
    const isCrawlerLikeSkillDetailRequest = isCrawlerRequest || isLowFidelityCrawlerLikeRequest;

    if (ownerSegment && routeSegment) {
      const canonicalRoute = resolveCanonicalSkillRoute(ownerSegment, routeSegment);
      if (canonicalRoute) {
        const canonicalPath =
          (isCrawlerLikeSkillDetailRequest
            ? resolveGovernedSkillDetailPath(localeSegment, canonicalRoute.owner, canonicalRoute.routePath)
            : null) || buildLocalizedSkillPath(localeSegment, canonicalRoute.owner, canonicalRoute.routePath);
        if (canonicalPath !== pathname) {
          return new Response(null, {
            status: 301,
            headers: {
              Location: canonicalPath + context.url.search,
              'Cache-Control': 'public, s-maxage=86400',
            },
          });
        }

        if (isCrawlerLikeSkillDetailRequest) {
          return buildCrawlerSkillDetailResponse(
            localeSegment,
            canonicalRoute.owner,
            canonicalRoute.routePath,
            canonicalPath,
          );
        }
      } else if (!routeSegment.includes('/')) {
        const fallbackKey = `${ownerSegment.toLowerCase()}/${routeSegment.toLowerCase()}`;
        let fallbackRoute = repoFallbackRouteMap.get(fallbackKey);
        if (fallbackKey === 'callstackincubator/agent-skills') {
          fallbackRoute = {
            owner: 'callstackincubator',
            repo: 'agent-skills',
            routePath: 'agent-skills/react-native-best-practices',
          };
        }
        if (fallbackRoute) {
          const canonicalPath = resolveRepoFallbackRedirectPath(localeSegment, fallbackRoute, {
            applyLocaleGovernance: isCrawlerLikeSkillDetailRequest,
          });
          if (canonicalPath !== pathname) {
            return new Response(null, {
              status: 301,
              headers: {
                Location: canonicalPath + context.url.search,
                'Cache-Control': 'public, s-maxage=86400',
              },
            });
          }
        }
      }
    }
  }

  if (isCrawlerRequest && skillPathMatch) {
    const ownerSegment = safeDecodePathSegment(skillPathMatch[2]).trim();
    const routeSegment = safeDecodePathSegment(skillPathMatch[3]).trim();
    const directCanonical =
      ownerSegment && routeSegment ? resolveCanonicalSkillRoute(ownerSegment, routeSegment) : null;
    const isSitemapSuppressedSkill =
      ownerSegment && routeSegment
        ? isSitemapSkillBlocked(ownerSegment, routeSegment, getMiddlewareBlocklist())
        : false;
    const hasRouteMap = canonicalSkillRouteMap.size > 0 || knownRepoKeySet.size > 0;

    // If the skill is blocklisted AND has an explicit 410 Gone rule, return 410 immediately.
    // This covers takedown requests and other forced-removal cases where noindex is insufficient.
    if (isSitemapSuppressedSkill && getSeoGonePathSet().has(pathname)) {
      return new Response(null, {
        status: 410,
        statusText: 'Gone',
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    if (routeSegment.includes('/')) {
      if (hasRouteMap && !directCanonical && !isSitemapSuppressedSkill) {
        return new Response(null, {
          status: 404,
          statusText: 'Not Found',
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    } else {
      // Repo-root paths may need page-level data fallbacks to decide between
      // a repository directory, a sole-skill 301, or a real 404. Do not let
      // crawler-only middleware turn a potentially canonicalizable repo root
      // into a premature 404 when runtime sitemap data is unavailable.
      const isForcedOpen =
        process.env.OVERRIDE_EXPANSION_BOUNDARY === 'open' || process.env.SEO_FORCE_EXPANSION_OPEN === 'true';
      const repoKey = `${ownerSegment.toLowerCase()}/${routeSegment.toLowerCase()}`;
      if (
        hasRouteMap &&
        !directCanonical &&
        !repoFallbackRouteMap.has(repoKey) &&
        !(isForcedOpen && knownRepoKeySet.has(repoKey))
      ) {
        return new Response(null, {
          status: knownRepoKeySet.has(repoKey) ? 410 : 404,
          statusText: knownRepoKeySet.has(repoKey) ? 'Gone' : 'Not Found',
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    }
  }

  // 4. Skip static assets; apply security headers + observability to API routes
  if (isStaticOrApiPath(pathname)) {
    if (pathname.startsWith('/api/')) {
      const requestId = generateRequestId();
      const start = Date.now();

      const response = await next();

      const durationMs = Date.now() - start;
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-Response-Time', `${durationMs}ms`);
      setSecurityHeaders(response);
      if (!response.headers.has('X-Robots-Tag')) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      }

      // +++ ADD API CACHE +++
      // Cache global read-only API endpoints at the Cloudflare Edge to prevent Worker billing overload.
      if (context.request.method === 'GET' && !pathname.startsWith('/api/admin/') && pathname !== '/api/health') {
        response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');

        // Store in CF Cache API for edge caching
        if (typeof caches !== 'undefined') {
          try {
            const cache = (caches as unknown as { default: Cache }).default;
            const cacheKey = buildEdgeCacheKey(context.url);
            response.headers.set('X-Cache', 'MISS');
            const waitUntil = (context.locals.runtime as any)?.ctx?.waitUntil;
            if (waitUntil) {
              waitUntil(cache.put(cacheKey, response.clone()));
            } else {
              cache.put(cacheKey, response.clone()).catch(() => {});
            }
          } catch {
            // Cache write failure is non-critical
          }
        }
      }

      logger.info('API request', {
        requestId,
        method: context.request.method,
        path: pathname,
        status: response.status,
        durationMs,
      });

      return response;
    }
    return next();
  }

  // 4. If path already has a valid locale prefix, pass through with Content-Language header
  if (hasLocalePrefix(pathname)) {
    const requestId = generateRequestId();
    const start = Date.now();
    const localeSegment = pathname.split('/')[1];
    const response = await next();
    const durationMs = Date.now() - start;
    const routeBucket = resolvePageRouteBucket(pathname);
    const runtimeEnv = await getRuntimeEnv<Record<string, unknown>>(context.locals);
    const slowLogThresholdMs = resolvePositiveNumber(runtimeEnv?.SSR_PAGE_SLOW_LOG_MS, 1200);

    response.headers.set('X-Request-Id', requestId);
    response.headers.set('X-Response-Time', `${durationMs}ms`);
    response.headers.set('Server-Timing', `app;dur=${durationMs}`);
    response.headers.set('Content-Language', localeSegment);
    const isSkillsListingWithParams = /^\/[a-z]{2}\/skills$/.test(pathname) && searchParams.size > 0;
    const isSandboxPath = /^\/[a-z]{2}\/sandbox\//.test(pathname);
    const isPersonalStatePath = /^\/[a-z]{2}\/(?:favorites|history)\/?$/.test(pathname);
    // X-Robots-Tag as HTTP header reinforcement for Googlebot
    if (!response.headers.has('X-Robots-Tag')) {
      if (response.status >= 400) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      }
      // client-local personal state pages are useful in-product but should never compete in SERP
      else if (isPersonalStatePath) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      }
      // sandbox pages are utility/test pages and should not compete for index budget
      else if (isSandboxPath) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      }
      // noindex for search result pages (?q= / ?query=) — thin/dynamic content
      else if (isSkillsListingWithParams || searchParams.has('q') || searchParams.has('query')) {
        response.headers.set('X-Robots-Tag', 'noindex, follow');
      } else {
        response.headers.set('X-Robots-Tag', 'index, follow');
      }
    }
    setSecurityHeaders(response);

    // +++ ADD HTML CACHE +++
    // Islands Architecture guarantees anonymous users get exactly the same SSR HTML payload.
    // Client-side local storage handles all user state (e.g. favorites / history). Edge cache it heavily.
    if (context.request.method === 'GET') {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const htmlCacheControl = import.meta.env.DEV
          ? 'no-store'
          : routeBucket === 'skills_detail'
            ? 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400'
            : 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400';
        response.headers.set('Cache-Control', htmlCacheControl);
      }
    }

    // +++ EDGE CACHE: store HTML responses in CF Cache API +++
    // This is what actually makes s-maxage work — CF Workers don't auto-cache SSR.
    if (shouldUseEdgeCache && response.status >= 200 && response.status < 400) {
      try {
        const cc = response.headers.get('Cache-Control') || '';
        // Only cache if the response explicitly opts in with s-maxage
        if (cc.includes('s-maxage') && !cc.includes('private')) {
          const cache = (caches as unknown as { default: Cache }).default;
          const cacheKey = buildEdgeCacheKey(context.url);
          // Clone the response: one for cache, one for client
          const cacheResponse = response.clone();
          response.headers.set('X-Cache', 'MISS');
          const writePromise = cache.put(cacheKey, cacheResponse);
          const waitUntil = (context.locals.runtime as any)?.ctx?.waitUntil;
          if (waitUntil) {
            waitUntil(writePromise);
          } else {
            writePromise.catch(() => {});
          }
        }
      } catch {
        // Cache write failure is non-critical
      }
    }

    if (durationMs >= slowLogThresholdMs || response.status >= 500 || isCrawlerRequest) {
      logger.info('Page request', {
        requestId,
        method: context.request.method,
        path: pathname,
        routeBucket,
        status: response.status,
        durationMs,
        crawler: isCrawlerRequest,
      });
    }

    return response;
  }

  // 5. Language detection and redirect for paths without locale prefix
  const cookieLocale = context.cookies.get('locale')?.value;
  const cfCountry = context.isPrerendered ? null : context.request.headers.get('cf-ipcountry');
  const acceptLanguage = context.isPrerendered ? null : context.request.headers.get('accept-language');

  const targetLocale = detectLocale(cookieLocale, cfCountry, acceptLanguage);

  const redirectPath = pathname === '/' ? `/${targetLocale}` : `/${targetLocale}${pathname}`;

  // SEO: Use 301 for the root path "/" redirect — Googlebot always sees the
  // same destination, and a permanent redirect passes full PageRank.
  // For non-root paths, keep 302 since the target locale varies by visitor.
  const isRootRedirect = pathname === '/';
  return new Response(null, {
    status: isRootRedirect ? 301 : 302,
    headers: {
      Location: redirectPath,
      'Cache-Control': isRootRedirect ? 'public, s-maxage=86400' : 'private, no-store',
      Vary: isRootRedirect ? 'Accept-Language' : 'Cookie, Accept-Language, CF-IPCountry',
    },
  });
});
