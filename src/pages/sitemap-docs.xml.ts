import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { SITE_URL } from '../lib/site-config';
import { compileSitemapBlocklist } from '../lib/sitemap-blocklist';
import sitemapBlocklistData from '../../data/seo-sitemap-blocklist.json';

// @ts-ignore -- JSON import without type declaration
import docsCache from '../../data/docs-cache.json';

export const prerender = false;

const SITE = SITE_URL;
const normalizeUrl = (url: string) => url.replace(/\/+$/, '');
const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

function buildHreflangLinks(pagePath: string): string {
  return (
    SUPPORTED_LOCALES.map(
      (loc) => `<xhtml:link rel="alternate" hreflang="${loc}" href="${normalizeUrl(`${SITE}/${loc}${pagePath}`)}" />`,
    ).join('\n') +
    `\n<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/en${pagePath}`)}" />`
  );
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export const GET: APIRoute = async () => {
  const today = formatDate(new Date());
  const urls: string[] = [];

  if (docsCache?.pages) {
    for (const page of (docsCache as any).pages) {
      const slugKey = page.slug === 'index' ? 'docs' : `docs/${page.slug}`;
      if (sitemapBlocklist.exactKeys.has(slugKey.toLowerCase())) {
        continue;
      }

      const path = page.slug === 'index' ? '/docs' : `/docs/${page.slug}`;
      // Use frontmatter date from cache, fallback to today.
      const lastmod = page.updatedAt ? formatDate(page.updatedAt) : page.pubDate ? formatDate(page.pubDate) : today;

      for (const locale of SUPPORTED_LOCALES) {
        urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}${path}`)}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
${buildHreflangLinks(path)}
</url>`);
      }
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
