import type { APIRoute } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../i18n';
import { SITE_URL } from '../lib/site-config';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from '../lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from '../lib/sitemap-blocklist';

export const prerender = false;

const SITE = SITE_URL;

// Pre-built sitemap data — avoids D1 query and CPU timeout (1102)
import sitemapSkillsData from '../../data/sitemap-skills.json';
import sitemapBlocklistData from '../../data/seo-sitemap-blocklist.json';
import skillLocaleGovernanceData from '../../data/seo-skill-locale-governance.json';

const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

type SkillLocaleGovernanceEntry = {
  owner?: string;
  routePath?: string;
  eligibleLocales?: string[];
  canonicalLocale?: string;
};

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

function loadSkillIndexabilityReport(): unknown {
  const reportPath = resolve(process.cwd(), 'reports/seo/latest-skill-indexability.json');
  if (!existsSync(reportPath)) return null;

  try {
    return JSON.parse(readFileSync(reportPath, 'utf-8'));
  } catch {
    return null;
  }
}

function dedupeSitemapSkills(skills: SitemapSkillEntry[]): SitemapSkillEntry[] {
  const deduped = new Map<string, SitemapSkillEntry>();

  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const repo = typeof skill.repo === 'string' ? skill.repo.trim() : '';
    const routePath = getSkillRoutePath(skill);
    if (!owner || !repo || !routePath) continue;
    if (isSitemapSkillBlocked(owner, routePath, sitemapBlocklist)) continue;

    const key = `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
    const current = deduped.get(key);
    if (!current || parseDateMs(skill.updatedAt) > parseDateMs(current.updatedAt)) {
      deduped.set(key, { owner, repo, routePath, ...(skill.updatedAt ? { updatedAt: skill.updatedAt } : {}) });
    }
  }

  return Array.from(deduped.values());
}

const skillLocaleGovernanceRecords = (
  Array.isArray(skillLocaleGovernanceData)
    ? skillLocaleGovernanceData
    : ((skillLocaleGovernanceData as { skills?: unknown[] }).skills ?? [])
) as SkillLocaleGovernanceEntry[];

const skillLocaleGovernanceMap = (() => {
  const map = new Map<string, SkillLocaleGovernanceEntry>();

  for (const record of skillLocaleGovernanceRecords) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    if (!owner || !routePath) continue;
    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, record);
  }

  return map;
})();

const skillIndexabilityReportData = loadSkillIndexabilityReport();

const skillIndexabilityRecords = (
  typeof skillIndexabilityReportData === 'object' &&
  skillIndexabilityReportData &&
  'skills' in skillIndexabilityReportData &&
  Array.isArray((skillIndexabilityReportData as { skills?: unknown[] }).skills)
    ? (skillIndexabilityReportData as { skills: unknown[] }).skills
    : []
) as SkillIndexabilityEntry[];

const skillIndexabilityMap = (() => {
  const map = new Map<string, SkillIndexabilityEntry>();

  for (const record of skillIndexabilityRecords) {
    const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
    if (!owner || !routePath) continue;
    map.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, record);
  }

  return map;
})();

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

export const GET: APIRoute = async ({ params }) => {
  const pageParam = params.page || '1';
  const page = parseInt(pageParam, 10);
  const LIMIT = 200; // Skills per sitemap file

  if (isNaN(page) || page < 1) {
    return new Response('Invalid page', { status: 404 });
  }

  const today = formatDate(new Date());

  // Use pre-built static data instead of D1 query to avoid CPU timeout (1102)
  const skills: SitemapSkillEntry[] = dedupeSitemapSkills(
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : (sitemapSkillsData as any).skills || [],
  );

  // Pagination Logic
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
    const eligibleLocales = (governance?.eligibleLocales || []).filter((locale) =>
      SUPPORTED_LOCALES.includes(locale as any),
    );
    if (governance && eligibleLocales.length === 0) continue;

    const canonicalLocale =
      typeof indexability.canonicalLocale === 'string' &&
      SUPPORTED_LOCALES.includes(indexability.canonicalLocale as any)
        ? indexability.canonicalLocale
        : typeof governance?.canonicalLocale === 'string' &&
            SUPPORTED_LOCALES.includes(governance.canonicalLocale as any)
          ? governance.canonicalLocale
          : eligibleLocales.includes('en')
            ? 'en'
            : eligibleLocales[0] || 'en';

    urls.push(`<url>
<loc>${normalizeUrl(`${SITE}${buildLocalizedSkillPath(canonicalLocale, skill.owner, routePath)}`)}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
${buildHreflangLinks(skill.owner, routePath, [canonicalLocale], canonicalLocale)}
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
