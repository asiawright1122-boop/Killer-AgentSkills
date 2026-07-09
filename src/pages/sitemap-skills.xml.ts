import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { SITE_URL } from '../lib/site-config';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from '../lib/skill-route-paths';
import {
  isSitemapSkillBlocked,
  compileSitemapBlocklist,
  type CompiledSitemapBlocklist,
} from '../lib/sitemap-blocklist';
import { loadJsonDataAtBuildTime } from '../lib/build-time-loader';

// Keep the canonical skills sitemap as a static asset so crawlers always hit a
// direct 200 file instead of depending on runtime route resolution.
export const prerender = true;

const SITE = SITE_URL;

type SkillLocaleGovernanceEntry = {
  owner?: string;
  routePath?: string;
  eligibleLocales?: string[];
  bodyEligibleLocales?: string[];
  publishedLocales?: string[];
  canonicalLocale?: string;
};

type SkillIndexabilityEntry = {
  owner?: string;
  routePath?: string;
  canonicalLocale?: string;
  isIndexable?: boolean;
};

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

const getRouteKey = (owner: string, routePath: string) => `${owner.toLowerCase()}/${routePath.toLowerCase()}`;

const parseDateMs = (value?: string) => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

function dedupeSitemapSkills(skills: SitemapSkillEntry[], blocklist: CompiledSitemapBlocklist): SitemapSkillEntry[] {
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

function buildGovernanceMap(data: unknown): Map<string, SkillLocaleGovernanceEntry> {
  const records = (
    Array.isArray(data)
      ? data
      : data && typeof data === 'object' && 'skills' in data
        ? (data as { skills?: unknown[] }).skills
        : []
  ) as SkillLocaleGovernanceEntry[];
  const map = new Map<string, SkillLocaleGovernanceEntry>();
  for (const record of records) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    if (!owner || !routePath) continue;
    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, record);
  }
  return map;
}

function buildIndexabilityMap(indexabilityData: unknown): Map<string, SkillIndexabilityEntry> {
  const records =
    typeof indexabilityData === 'object' &&
    indexabilityData &&
    'skills' in indexabilityData &&
    Array.isArray((indexabilityData as { skills?: unknown[] }).skills)
      ? ((indexabilityData as { skills: unknown[] }).skills as SkillIndexabilityEntry[])
      : [];
  const map = new Map<string, SkillIndexabilityEntry>();
  for (const record of records) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    if (!owner || !routePath) continue;
    map.set(getRouteKey(owner, routePath), record);
  }
  return map;
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

export const GET: APIRoute = async () => {
  const today = formatDate(new Date());

  // Load data at build time via dynamic node:fs to prevent Vite inlining
  const sitemapSkillsData = await loadJsonDataAtBuildTime('data/sitemap-skills.json');
  const skillLocaleGovernanceData = await loadJsonDataAtBuildTime('data/seo-skill-locale-governance.json');
  const skillIndexabilityReportData = await loadJsonDataAtBuildTime('reports/seo/latest-skill-indexability.json');
  const sitemapBlocklistData = await loadJsonDataAtBuildTime('data/seo-sitemap-blocklist.json');
  const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

  const skills: SitemapSkillEntry[] = dedupeSitemapSkills(
    Array.isArray(sitemapSkillsData)
      ? (sitemapSkillsData as SitemapSkillEntry[])
      : (sitemapSkillsData as any)?.skills || [],
    sitemapBlocklist,
  );

  const skillLocaleGovernanceMap = buildGovernanceMap(skillLocaleGovernanceData);
  const skillIndexabilityMap = buildIndexabilityMap(skillIndexabilityReportData);
  const skillUpdatedAtMap = new Map(skills.map((skill) => [getRouteKey(skill.owner, skill.routePath), skill]));

  const urls: string[] = [];

  const indexableSkills = Array.from(skillIndexabilityMap.values()).sort((a, b) => {
    const aKey = getRouteKey(
      typeof a.owner === 'string' ? a.owner : '',
      typeof a.routePath === 'string' ? a.routePath : '',
    );
    const bKey = getRouteKey(
      typeof b.owner === 'string' ? b.owner : '',
      typeof b.routePath === 'string' ? b.routePath : '',
    );
    return aKey.localeCompare(bKey);
  });

  for (const indexability of indexableSkills) {
    const owner = typeof indexability.owner === 'string' ? indexability.owner.trim() : '';
    const routePath = typeof indexability.routePath === 'string' ? indexability.routePath.trim() : '';
    if (!owner || !routePath) continue;
    if (indexability.isIndexable !== true) continue;
    if (isSitemapSkillBlocked(owner, routePath, sitemapBlocklist)) continue;

    const updatedAtSkill = skillUpdatedAtMap.get(getRouteKey(owner, routePath));
    const lastmod = updatedAtSkill?.updatedAt ? formatDate(updatedAtSkill.updatedAt) : today;

    const governance = skillLocaleGovernanceMap.get(getRouteKey(owner, routePath));
    const publishedLocales = Array.isArray(governance?.publishedLocales)
      ? (governance.publishedLocales || []).filter((locale) => SUPPORTED_LOCALES.includes(locale as any))
      : [];
    const eligibleLocales =
      publishedLocales.length > 0
        ? publishedLocales
        : (governance?.eligibleLocales || []).filter((locale) => SUPPORTED_LOCALES.includes(locale as any));
    if (governance && eligibleLocales.length === 0) continue;

    const canonicalLocale =
      typeof indexability.canonicalLocale === 'string' &&
      SUPPORTED_LOCALES.includes(indexability.canonicalLocale as any) &&
      (eligibleLocales.length === 0 || eligibleLocales.includes(indexability.canonicalLocale))
        ? indexability.canonicalLocale
        : typeof governance?.canonicalLocale === 'string' &&
            SUPPORTED_LOCALES.includes(governance.canonicalLocale as any) &&
            (eligibleLocales.length === 0 || eligibleLocales.includes(governance.canonicalLocale))
          ? governance.canonicalLocale
          : eligibleLocales.includes('en')
            ? 'en'
            : eligibleLocales[0] || 'en';
    const hreflangLocales = eligibleLocales.length > 0 ? eligibleLocales : [canonicalLocale];

    urls.push(`<url>
<loc>${normalizeUrl(`${SITE}${buildLocalizedSkillPath(canonicalLocale, owner, routePath)}`)}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
${buildHreflangLinks(owner, routePath, hreflangLocales, canonicalLocale)}
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
