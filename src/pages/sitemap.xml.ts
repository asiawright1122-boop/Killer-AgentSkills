import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { getSkillsFromKV, getSitemapSkillsFromKV, type Env } from '../lib/kv';
import type { UnifiedSkill } from '../lib/skills';

// @ts-ignore
import docsCache from '../../data/docs-cache.json';

export const prerender = false;

const SITE = 'https://killer-skills.com';
const STATIC_PAGES = [
  '',
  '/skills',
  '/categories',
  '/cli',
  '/community',
  '/integrations',
  '/privacy',
  '/terms',
  '/cookies',
  // Note: /favorites and /history are excluded (noindex, client-only localStorage content)
];

// Generate hreflang links for a given path (without locale prefix)
function buildHreflangLinks(pagePath: string): string {
  return SUPPORTED_LOCALES.map(loc =>
    `<xhtml:link rel="alternate" hreflang="${loc}" href="${SITE}/${loc}${pagePath}" />`
  ).join('\n') + `\n<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en${pagePath}" />`;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any).runtime?.env as Env | undefined;

  let skills: { owner: string; repo: string; updatedAt?: string }[] = [];
  try {
    skills = await getSitemapSkillsFromKV(env as Env);
  } catch (e) {
    console.error('Failed to load skills for sitemap', e);
  }

  const today = formatDate(new Date());
  const urls: string[] = [];

  // Static pages — generate one URL per locale with hreflang cross-references
  for (const page of STATIC_PAGES) {
    for (const locale of SUPPORTED_LOCALES) {
      urls.push(`<url>
<loc>${SITE}/${locale}${page}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>${page === '' ? '1.0' : '0.8'}</priority>
${buildHreflangLinks(page)}
</url>`);
    }
  }

  // Docs pages from cache
  if (docsCache?.pages) {
    for (const page of (docsCache as any).pages) {
      const path = page.slug === 'index' ? '/docs' : `/docs/${page.slug}`;
      for (const locale of SUPPORTED_LOCALES) {
        urls.push(`<url>
<loc>${SITE}/${locale}${path}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.9</priority>
${buildHreflangLinks(path)}
</url>`);
      }
    }
  }

  // Skill detail pages — use updatedAt for lastmod
  for (const skill of skills) {
    // Skip invalid entries (defensive: prevent /skills/undefined/undefined URLs)
    if (!skill.owner || !skill.repo) continue;

    const skillPath = `/skills/${skill.owner}/${skill.repo}`;
    const lastmod = skill.updatedAt ? formatDate(skill.updatedAt) : today;
    for (const locale of SUPPORTED_LOCALES) {
      urls.push(`<url>
<loc>${SITE}/${locale}${skillPath}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
${buildHreflangLinks(skillPath)}
</url>`);
    }
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

