import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';
import type { SitemapSkillEntry } from '../lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from '../lib/sitemap-blocklist';

export const prerender = false;

const SITE = SITE_URL;

// Pre-built sitemap data — avoids D1 query and CPU timeout (1102)
import sitemapSkillsData from '../../data/sitemap-skills.json';
import sitemapBlocklistData from '../../data/seo-sitemap-blocklist.json';

const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

const parseDateMs = (value?: string) => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

function dedupeSitemapSkills(skills: SitemapSkillEntry[]): SitemapSkillEntry[] {
  const deduped = new Map<string, SitemapSkillEntry>();

  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const repo = typeof skill.repo === 'string' ? skill.repo.trim() : '';
    const routePath = typeof skill.routePath === 'string' ? skill.routePath.trim() : '';
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

/**
 * Sitemap Index — Splits the sitemap into logical sub-sitemaps for better
 * crawl efficiency. Google recommends max 50,000 URLs / 50MB per sitemap.
 *
 * Structure:
 *   /sitemap.xml          → This file (Sitemap Index)
 *   /sitemap-static.xml   → Static pages (home, categories, cli, etc.)
 *   /sitemap-docs.xml     → Documentation pages
 *   /sitemap-blog.xml     → Blog pages
 *   /sitemap-collections.xml → Collection pages
 *   /sitemap-skills-N.xml → Skill detail pages (paginated)
 */
export const GET: APIRoute = async () => {
  // Use pre-built static data instead of D1 query to avoid CPU timeout (1102)
  const skills: SitemapSkillEntry[] = dedupeSitemapSkills(
    Array.isArray(sitemapSkillsData) ? sitemapSkillsData : (sitemapSkillsData as any).skills || [],
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

  // Calculate number of sitemap chunks (limit 200 skills per file)
  const LIMIT = 200;
  const totalSkills = skills && skills.length > 0 ? skills.length : 0;
  const totalPages = Math.ceil(totalSkills / LIMIT) || 1;

  const skillSitemaps = [];
  for (let i = 1; i <= totalPages; i++) {
    // Calculate accurate lastmod for THIS specific chunk
    const start = (i - 1) * LIMIT;
    const end = start + LIMIT;
    const chunkSkills = skills.slice(start, end);
    let chunkLastMod = today;

    if (chunkSkills.length > 0) {
      const latestInChunk = chunkSkills
        .filter((s) => s.updatedAt)
        .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0];

      if (latestInChunk?.updatedAt) {
        chunkLastMod = new Date(latestInChunk.updatedAt).toISOString().split('T')[0];
      } else {
        // Fallback to global max if chunk has no valid dates (unlikely)
        chunkLastMod = skillsLastMod;
      }
    }

    skillSitemaps.push(`<sitemap>
  <loc>${SITE}/sitemap-skills-${i}.xml</loc>
  <lastmod>${chunkLastMod}</lastmod>
</sitemap>`);
  }

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
${skillSitemaps.join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
};
