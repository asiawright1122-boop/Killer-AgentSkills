import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';
import type { SitemapSkillEntry } from '../lib/skill-route-paths';
import { isSitemapSkillBlocked, compileSitemapBlocklist } from '../lib/sitemap-blocklist';
import { loadJsonDataAtBuildTime } from '../lib/build-time-loader';

// The sitemap index is derived from build-time content snapshots, so shipping a
// static asset gives crawlers the most stable entrypoint.
export const prerender = true;

const SITE = SITE_URL;

const parseDateMs = (value?: string) => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

function dedupeSitemapSkills(
  skills: SitemapSkillEntry[],
  blocklist: ReturnType<typeof compileSitemapBlocklist>,
): SitemapSkillEntry[] {
  const deduped = new Map<string, SitemapSkillEntry>();

  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const repo = typeof skill.repo === 'string' ? skill.repo.trim() : '';
    const routePath = typeof skill.routePath === 'string' ? skill.routePath.trim() : '';
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

export const GET: APIRoute = async () => {
  // Load sitemap skills data at build time via dynamic node:fs
  const sitemapSkillsData = await loadJsonDataAtBuildTime('data/sitemap-skills.json');
  const sitemapBlocklistData = await loadJsonDataAtBuildTime('data/seo-sitemap-blocklist.json');
  const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);
  const skills: SitemapSkillEntry[] = dedupeSitemapSkills(
    Array.isArray(sitemapSkillsData)
      ? (sitemapSkillsData as SitemapSkillEntry[])
      : (sitemapSkillsData as any)?.skills || [],
    sitemapBlocklist,
  );

  // Get last modification date for skills
  let skillsLastMod = new Date().toISOString().split('T')[0];
  if (skills.length > 0) {
    const latest = skills
      .filter((s) => s.updatedAt)
      .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0];
    if (latest?.updatedAt) {
      skillsLastMod = new Date(latest.updatedAt).toISOString().split('T')[0];
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap>
  <loc>${SITE}/sitemap-static.xml</loc>
  <lastmod>${today}</lastmod>
</sitemap>
<sitemap>
  <loc>${SITE}/sitemap-blog.xml</loc>
  <lastmod>${today}</lastmod>
</sitemap>
<sitemap>
  <loc>${SITE}/sitemap-collections.xml</loc>
  <lastmod>${today}</lastmod>
</sitemap>
<sitemap>
  <loc>${SITE}/sitemap-docs.xml</loc>
  <lastmod>${today}</lastmod>
</sitemap>
<sitemap>
  <loc>${SITE}/sitemap-skills.xml</loc>
  <lastmod>${skillsLastMod}</lastmod>
</sitemap>
</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
};
