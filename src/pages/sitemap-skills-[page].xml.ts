import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { SITE_URL } from '../lib/site-config';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from '../lib/skill-route-paths';
import { isSitemapSkillBlocked } from '../lib/sitemap-blocklist';
import { getSitemapSkills } from '../lib/sitemap-skills-runtime';
import { skillLocaleGovernanceMap, loadSkillLocaleGovernance } from '../lib/skill-locale-governance';
import { getSitemapBlocklist } from '../lib/sitemap-blocklist-runtime';

// SSR page — uses runtime KV for data instead of static imports
export const prerender = false;

const SITE = SITE_URL;

type SkillIndexabilityEntry = {
  owner?: string;
  routePath?: string;
  canonicalLocale?: string;
  isIndexable?: boolean;
};

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

const parseDateMs = (value?: string) => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

function dedupeSitemapSkills(
  skills: SitemapSkillEntry[],
  blocklist: Awaited<ReturnType<typeof getSitemapBlocklist>>,
): SitemapSkillEntry[] {
  const deduped = new Map<string, SitemapSkillEntry>();
  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const repo = typeof skill.repo === 'string' ? skill.repo.trim() : '';
    const routePath = getSkillRoutePath(skill);
    if (!owner || !repo || !routePath) continue;
    if (isSitemapSkillBlocked(owner, routePath, blocklist)) continue;
    const key = `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
    const current = deduped.get(key);
    if (!current || parseDateMs(skill.updatedAt) > parseDateMs(current.updatedAt)) {
      deduped.set(key, { owner, repo, routePath, ...(skill.updatedAt ? { updatedAt: skill.updatedAt } : {}) });
    }
  }
  return Array.from(deduped.values());
}

function buildHreflangLinks(owner: string, routePath: string, locales: string[], xDefaultLocale: string): string {
  return (
    locales
      .map(
        (loc) =>
          `<xhtml:link rel="alternate" hreflang="${loc}" href="${normalizeUrl(`${SITE}${buildLocalizedSkillPath(loc, owner, routePath)}`)}" />`,
      )
      .join('\n') +
    `\n<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(
      `${SITE}${buildLocalizedSkillPath(xDefaultLocale, owner, routePath)}`,
    )}" />`
  );
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export const GET: APIRoute = async ({ params, locals }) => {
  const pageParam = params.page || '1';
  const page = parseInt(pageParam, 10);
  const LIMIT = 200;

  if (isNaN(page) || page < 1) {
    return new Response('Invalid page', { status: 404 });
  }

  const today = formatDate(new Date());

  // Get env from Cloudflare runtime
  const { getRuntimeEnv } = await import('../lib/runtime-env');
  const env = (await getRuntimeEnv<{ SKILLS_CACHE?: KVNamespace }>(locals)) as { SKILLS_CACHE?: KVNamespace };

  // Load data from runtime KV (production) or local fallback (dev)
  const sitemapSkillsData = await getSitemapSkills(env);
  await loadSkillLocaleGovernance(env || {});
  const blocklist = await getSitemapBlocklist(env);

  const skills: SitemapSkillEntry[] = dedupeSitemapSkills(
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : [],
    blocklist,
  );

  // Build indexability map from governance map (fallback)
  const skillIndexabilityMap = new Map<string, SkillIndexabilityEntry>();
  for (const [key, governance] of skillLocaleGovernanceMap.entries()) {
    skillIndexabilityMap.set(key, {
      owner: governance.owner,
      routePath: governance.routePath,
      canonicalLocale: governance.canonicalLocale ?? undefined,
      isIndexable: (governance as any).publishedLocales ? (governance as any).publishedLocales.length > 0 : true,
    });
  }

  // Pagination
  const start = (page - 1) * LIMIT;
  const end = start + LIMIT;
  const paginatedSkills = skills.slice(start, end);

  if (paginatedSkills.length === 0 && page > 1) {
    return new Response('Page not found', { status: 404 });
  }

  const urls: string[] = [];

  for (const skill of paginatedSkills) {
    const routePath = getSkillRoutePath(skill);
    if (!routePath) continue;

    const lastmod = skill.updatedAt ? formatDate(skill.updatedAt) : today;
    const indexability = skillIndexabilityMap.get(`${skill.owner.toLowerCase()}/${routePath.toLowerCase()}`);
    if (!indexability || indexability.isIndexable !== true) continue;

    const governance = skillLocaleGovernanceMap.get(`${skill.owner.toLowerCase()}/${routePath.toLowerCase()}`);
    const eligibleLocales: string[] = (governance as any)?.publishedLocales
      ? ((governance as any).publishedLocales as string[]).filter((locale) => SUPPORTED_LOCALES.includes(locale as any))
      : [];
    if (governance && eligibleLocales.length === 0) continue;

    const canonicalLocale =
      typeof indexability.canonicalLocale === 'string' &&
      SUPPORTED_LOCALES.includes(indexability.canonicalLocale as any)
        ? indexability.canonicalLocale
        : typeof (governance as any)?.canonicalLocale === 'string' &&
            SUPPORTED_LOCALES.includes((governance as any).canonicalLocale as any)
          ? (governance as any).canonicalLocale
          : eligibleLocales.includes('en')
            ? 'en'
            : eligibleLocales[0] || 'en';

    urls.push(`<url>
<loc>${normalizeUrl(`${SITE}${buildLocalizedSkillPath(canonicalLocale, skill.owner, routePath)}`)}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
${buildHreflangLinks(skill.owner, routePath, eligibleLocales, canonicalLocale)}
</url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
};
