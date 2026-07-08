import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';
import { compileSitemapBlocklist } from '../lib/sitemap-blocklist';
import { loadJsonDataAtBuildTime } from '../lib/build-time-loader';
import docsCache from '../../data/docs-cache.json';

export const prerender = true;

const SITE = SITE_URL;
const DOCS_SITEMAP_LOCALES = ['en', 'zh'] as const;

type DocsCachePage = {
  slug?: string;
};

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

function docsPath(slug: string): string {
  return slug === 'index' ? '/docs' : `/docs/${slug}`;
}

function buildHreflangLinks(slug: string): string {
  const pagePath = docsPath(slug);
  const links = DOCS_SITEMAP_LOCALES.map((locale) => {
    const href = normalizeUrl(`${SITE}/${locale}${pagePath}`);
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${href}" />`;
  });
  links.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/en${pagePath}`)}" />`);
  return links.join('\n');
}

export const GET: APIRoute = async () => {
  const sitemapBlocklistData = await loadJsonDataAtBuildTime('data/seo-sitemap-blocklist.json');
  const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);
  const today = new Date().toISOString().split('T')[0];
  const pages = ((docsCache as { pages?: DocsCachePage[] }).pages || [])
    .map((page) => (typeof page.slug === 'string' ? page.slug.trim().replace(/^\/+|\/+$/g, '') : ''))
    .filter(Boolean);
  const urls: string[] = [];

  for (const slug of pages) {
    const slugKey = slug.toLowerCase();
    if (
      sitemapBlocklist.exactKeys.has(slugKey) ||
      sitemapBlocklist.exactKeys.has(`docs/${slugKey}`) ||
      (slug === 'index' && sitemapBlocklist.exactKeys.has('docs'))
    ) {
      continue;
    }

    const pagePath = docsPath(slug);
    for (const locale of DOCS_SITEMAP_LOCALES) {
      urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}${pagePath}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>monthly</changefreq>
<priority>${slug === 'installation' || slug === 'cli/overview' ? '0.7' : '0.5'}</priority>
${buildHreflangLinks(slug)}
</url>`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
};
