import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { getSitemapSkillsFromKV, type Env } from '../lib/kv';


export const prerender = false;

const SITE = 'https://killer-skills.com';

/**
 * Sitemap Index — Splits the sitemap into logical sub-sitemaps for better
 * crawl efficiency. Google recommends max 50,000 URLs / 50MB per sitemap.
 * 
 * Structure:
 *   /sitemap.xml          → This file (Sitemap Index)
 *   /sitemap-static.xml   → Static pages (home, categories, cli, etc.)
 *   /sitemap-docs.xml     → Documentation pages
 *   /sitemap-skills.xml   → All skill detail pages
 */
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any).runtime?.env as Env | undefined;

  // Get last modification date for skills
  let skillsLastMod = new Date().toISOString().split('T')[0];
  let skills: { updatedAt?: string; }[] = [];
  try {
    skills = await getSitemapSkillsFromKV(env as Env) || [];
    if (skills.length > 0) {
      // Use the most recent updatedAt as the sitemap lastmod
      const latest = skills
        .filter(s => s.updatedAt)
        .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0];
      if (latest?.updatedAt) {
        skillsLastMod = new Date(latest.updatedAt).toISOString().split('T')[0];
      }
    }
  } catch (e) {
    console.error('[sitemap-index] Failed to get skills last mod', e);
  }

  const today = new Date().toISOString().split('T')[0];

  // Calculate number of sitemap chunks (limit 1000 skills per file)
  const LIMIT = 1000;
  const totalSkills = (skills && skills.length > 0) ? skills.length : 0;
  const totalPages = Math.ceil(totalSkills / LIMIT) || 1;

  const skillSitemaps = [];
  for (let i = 1; i <= totalPages; i++) {
    skillSitemaps.push(`<sitemap>
  <loc>${SITE}/sitemap-skills-${i}.xml</loc>
  <lastmod>${skillsLastMod}</lastmod>
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
