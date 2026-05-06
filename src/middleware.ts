import { defineMiddleware } from 'astro:middleware';
import { isStaticOrApiPath, hasLocalePrefix, checkAdminAuth, detectLocale } from './middleware-utils';
import { logger, generateRequestId } from './lib/logger';
import { SITE_DOMAIN } from './lib/site-config';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from './lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from './lib/sitemap-blocklist';
import sitemapSkillsData from '../data/sitemap-skills.json';
import seo404RulesData from '../data/seo-404-rules.json';
import sitemapBlocklistData from '../data/seo-sitemap-blocklist.json';
import skillLocaleGovernanceData from '../data/seo-skill-locale-governance.json';

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

type SeoRedirectRule = {
  fromPath: string;
  toPath: string;
};

type SeoGoneRule = {
  path: string;
};

const SKILL_SOURCE_FILE_EXT_RE =
  /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt|ini|csv|lock)$/i;

const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

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

const canonicalSkillRouteMap = (() => {
  const map = new Map<string, CanonicalSkillRoute>();
  const records = (
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
  ) as Array<Partial<SitemapSkillEntry>>;

  for (const record of records) {
    const normalized = normalizeSitemapSkillRecord(record);
    if (!normalized) continue;
    const { owner, routePath } = normalized;
    if (isSitemapSkillBlocked(owner, routePath, sitemapBlocklist)) continue;
    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, { owner, routePath });
  }

  return map;
})();

type RepoFallbackRoute = {
  owner: string;
  repo: string;
  routePath: string;
};

type SkillLocaleGovernanceRecord = {
  owner: string;
  routePath: string;
  canonicalLocale: string | null;
  publishedLocales: string[];
};

const repoFallbackRouteMap = (() => {
  const map = new Map<string, RepoFallbackRoute>();
  const candidates = new Map<string, RepoFallbackRoute[]>();
  const records = (
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
  ) as Array<Partial<SitemapSkillEntry>>;

  for (const record of records) {
    const normalized = normalizeSitemapSkillRecord(record);
    if (!normalized) continue;
    const { owner, routePath } = normalized;
    if (isSitemapSkillBlocked(owner, routePath, sitemapBlocklist)) continue;
    const parts = routePath.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const repo = parts[0];
    if (!repo) continue;
    const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
    const entry: RepoFallbackRoute = { owner, repo, routePath };
    const list = candidates.get(key);
    if (list) list.push(entry);
    else candidates.set(key, [entry]);
  }

  for (const [key, list] of candidates.entries()) {
    if (list.length === 1) {
      map.set(key, list[0]);
    }
  }

  return map;
})();

const knownRepoKeySet = (() => {
  const set = new Set<string>();
  const records = (
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : ((sitemapSkillsData as { skills?: unknown[] }).skills ?? [])
  ) as Array<Partial<SitemapSkillEntry>>;

  for (const record of records) {
    const normalized = normalizeSitemapSkillRecord(record);
    if (!normalized) continue;
    const { owner, routePath } = normalized;
    if (isSitemapSkillBlocked(owner, routePath, sitemapBlocklist)) continue;
    const repo = routePath.split('/').filter(Boolean)[0];
    if (!repo) continue;
    set.add(`${owner.toLowerCase()}/${repo.toLowerCase()}`);
  }

  return set;
})();

const skillLocaleGovernanceMap = (() => {
  const map = new Map<string, SkillLocaleGovernanceRecord>();
  const records = ((skillLocaleGovernanceData as { skills?: unknown[]; records?: unknown[] }).skills ??
    (skillLocaleGovernanceData as { records?: unknown[] }).records ??
    []) as unknown[];

  for (const record of records) {
    const typedRecord = record as Partial<SkillLocaleGovernanceRecord>;
    const owner = typeof typedRecord.owner === 'string' ? typedRecord.owner.trim() : '';
    const routePath = typeof typedRecord.routePath === 'string' ? typedRecord.routePath.trim() : '';
    if (!owner || !routePath) continue;

    const canonicalLocale =
      typeof typedRecord.canonicalLocale === 'string' && typedRecord.canonicalLocale.trim().length > 0
        ? typedRecord.canonicalLocale.trim().toLowerCase()
        : null;
    const publishedLocales = Array.isArray(typedRecord.publishedLocales)
      ? typedRecord.publishedLocales
          .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
          .map((locale) => locale.trim().toLowerCase())
      : [];

    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, {
      owner,
      routePath,
      canonicalLocale,
      publishedLocales,
    });
  }

  return map;
})();

const seoRedirectPathMap = (() => {
  const map = new Map<string, string>();
  const records = ((seo404RulesData as { rules?: { redirect301?: unknown[] } }).rules?.redirect301 ?? []) as unknown[];

  for (const record of records) {
    const typedRecord = record as Partial<SeoRedirectRule>;
    const fromPath = typeof typedRecord.fromPath === 'string' ? typedRecord.fromPath.trim() : '';
    const toPath = typeof typedRecord.toPath === 'string' ? typedRecord.toPath.trim() : '';
    if (!fromPath || !toPath || fromPath === toPath) continue;
    map.set(fromPath, toPath);
  }

  return map;
})();

const seoGonePathSet = (() => {
  const set = new Set<string>();
  const records = ((seo404RulesData as { rules?: { gone410?: unknown[] } }).rules?.gone410 ?? []) as unknown[];

  for (const record of records) {
    const typedRecord = record as Partial<SeoGoneRule>;
    const path = typeof typedRecord.path === 'string' ? typedRecord.path.trim() : '';
    if (!path) continue;
    set.add(path);
  }

  return set;
})();

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

function resolveRepoFallbackRedirectPath(localeSegment: string, fallbackRoute: RepoFallbackRoute): string {
  const requestedLocale = localeSegment.trim().toLowerCase();
  const governance = skillLocaleGovernanceMap.get(
    `${fallbackRoute.owner.toLowerCase()}/${fallbackRoute.routePath.toLowerCase()}`,
  );

  if (
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
  return /(googlebot|bingbot|slurp|duckduckbot|yandexbot|baiduspider|petalbot|applebot|bytespider|killer-skills-warmup-bot)/.test(
    userAgent,
  );
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
 * Add security and performance headers to page responses.
 */
function setSecurityHeaders(response: Response): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const userAgent = context.isPrerendered ? '' : (context.request.headers.get('user-agent') || '').toLowerCase();
  const isCrawlerRequest = isCrawlerUserAgent(userAgent);

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

  // 1. Admin routes (API + pages) require Basic Auth
  const isAdminApi = pathname.startsWith('/api/admin/');
  const isAdminPage = !isAdminApi && pathname.startsWith('/admin');
  if (isAdminApi || isAdminPage) {
    const authHeader = context.request.headers.get('authorization');
    const env = context.locals.runtime?.env;
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
  const explicitRedirectTarget = seoRedirectPathMap.get(pathname);
  if (explicitRedirectTarget) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: explicitRedirectTarget + context.url.search,
        'Cache-Control': 'public, s-maxage=86400',
      },
    });
  }

  if (seoGonePathSet.has(pathname)) {
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

  // 2.75. Block sitemap-blocklisted skill routes for all requests so suppressed repos never render as 200 pages.
  const blocklistedSkillMatch = pathname.match(/^\/[a-z]{2}\/skills\/([^/]+)\/(.+)$/);
  if (blocklistedSkillMatch) {
    const ownerSegment = safeDecodePathSegment(blocklistedSkillMatch[1]).trim();
    const routeSegment = safeDecodePathSegment(blocklistedSkillMatch[2]).trim();
    if (ownerSegment && routeSegment && isSitemapSkillBlocked(ownerSegment, routeSegment, sitemapBlocklist)) {
      return new Response(null, {
        status: 410,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
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

  // 3c. Redirect legacy ?tag= parameter to ?topic= (consolidate duplicate params)
  const searchParams = context.url.searchParams;
  if (searchParams.has('tag')) {
    const tagValue = searchParams.get('tag')!;
    const newUrl = new URL(context.url);
    newUrl.searchParams.delete('tag');
    newUrl.searchParams.set('topic', tagValue);
    return new Response(null, {
      status: 301,
      headers: {
        Location: newUrl.pathname + newUrl.search,
        'Cache-Control': 'public, s-maxage=86400',
      },
    });
  }

  // 3c.1 Normalize skill listing params (strip unknown params; prefer q over query)
  if (/^\/[a-z]{2}\/skills$/.test(pathname) && searchParams.size > 0) {
    const allowedSkillsParams = new Set(['q', 'query', 'category', 'view', 'owner', 'topic', 'page']);
    const normalizedUrl = new URL(context.url);
    let changed = false;
    for (const key of Array.from(normalizedUrl.searchParams.keys())) {
      if (!allowedSkillsParams.has(key)) {
        normalizedUrl.searchParams.delete(key);
        changed = true;
      }
    }
    // Canonicalize `query` -> `q` to prevent duplicate parameter URLs.
    const rawQ = normalizedUrl.searchParams.get('q');
    const rawQuery = normalizedUrl.searchParams.get('query');
    const normalizedQ = String(rawQ || rawQuery || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (normalizedQ.length > 0) {
      const cappedQ = normalizedQ.slice(0, 80);
      if (rawQ !== cappedQ || normalizedUrl.searchParams.has('query')) {
        normalizedUrl.searchParams.set('q', cappedQ);
        normalizedUrl.searchParams.delete('query');
        changed = true;
      }
    } else if (rawQ !== null || rawQuery !== null) {
      normalizedUrl.searchParams.delete('q');
      normalizedUrl.searchParams.delete('query');
      changed = true;
    }
    const rawPage = normalizedUrl.searchParams.get('page');
    if (rawPage !== null) {
      const parsedPage = Number.parseInt(rawPage, 10);
      if (!Number.isFinite(parsedPage) || parsedPage <= 1) {
        normalizedUrl.searchParams.delete('page');
        changed = true;
      } else {
        const normalizedPage = String(parsedPage);
        if (rawPage !== normalizedPage) {
          normalizedUrl.searchParams.set('page', normalizedPage);
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

    if (ownerSegment && routeSegment) {
      const canonicalRoute = resolveCanonicalSkillRoute(ownerSegment, routeSegment);
      if (canonicalRoute) {
        const canonicalPath =
          resolveGovernedSkillDetailPath(localeSegment, canonicalRoute.owner, canonicalRoute.routePath) ||
          buildLocalizedSkillPath(localeSegment, canonicalRoute.owner, canonicalRoute.routePath);
        if (canonicalPath !== pathname) {
          return new Response(null, {
            status: 301,
            headers: {
              Location: canonicalPath + context.url.search,
              'Cache-Control': 'public, s-maxage=86400',
            },
          });
        }
      } else if (!routeSegment.includes('/')) {
        const fallbackKey = `${ownerSegment.toLowerCase()}/${routeSegment.toLowerCase()}`;
        const fallbackRoute = repoFallbackRouteMap.get(fallbackKey);
        if (fallbackRoute) {
          const canonicalPath = resolveRepoFallbackRedirectPath(localeSegment, fallbackRoute);
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

    if (routeSegment.includes('/')) {
      if (!directCanonical) {
        return new Response(null, {
          status: 404,
          statusText: 'Not Found',
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    } else {
      const repoKey = `${ownerSegment.toLowerCase()}/${routeSegment.toLowerCase()}`;
      if (!directCanonical && !repoFallbackRouteMap.has(repoKey)) {
        return new Response(null, {
          status: knownRepoKeySet.has(repoKey) ? 410 : 404,
          statusText: knownRepoKeySet.has(repoKey) ? 'Gone' : 'Not Found',
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
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
    const runtimeEnv = context.locals.runtime?.env as Record<string, unknown> | undefined;
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
        const htmlCacheControl =
          routeBucket === 'skills_detail'
            ? 'public, max-age=60, s-maxage=86400, stale-while-revalidate=86400'
            : 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400';
        response.headers.set('Cache-Control', htmlCacheControl);
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

  // Locale detection redirects depend on request headers/cookies.
  // Use 302 to avoid cacheable permanent redirect conflicts in crawlers.
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectPath,
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Accept-Language, CF-IPCountry',
    },
  });
});
