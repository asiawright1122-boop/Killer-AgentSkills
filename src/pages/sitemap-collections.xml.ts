import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';
import { getAuthoritySurfaceEntries } from '../lib/authority-surfaces';
import { compileSitemapBlocklist } from '../lib/sitemap-blocklist';
import { loadJsonDataAtBuildTime } from '../lib/build-time-loader';

export const prerender = true;

const SITE = SITE_URL;
const COLLECTION_SITEMAP_LOCALES = ['en', 'zh'] as const;

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

function getCollectionSlug(href: string): string {
  const marker = '/collections/';
  const index = href.indexOf(marker);
  return index >= 0 ? href.slice(index + marker.length).replace(/^\/+|\/+$/g, '') : '';
}

function buildHreflangLinks(slug: string): string {
  const links = COLLECTION_SITEMAP_LOCALES.map((locale) => {
    const href = normalizeUrl(`${SITE}/${locale}/collections/${slug}`);
    return `<xhtml:link rel="alternate" hreflang="${locale}" href="${href}" />`;
  });
  links.push(
    `<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/en/collections/${slug}`)}" />`,
  );
  return links.join('\n');
}

export const GET: APIRoute = async () => {
  const sitemapBlocklistData = await loadJsonDataAtBuildTime('data/seo-sitemap-blocklist.json');
  const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);
  const today = new Date().toISOString().split('T')[0];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const locale of COLLECTION_SITEMAP_LOCALES) {
    const surfaces = getAuthoritySurfaceEntries(locale, { placement: 'collections' }).filter(
      (surface) => surface.surfaceClass === 'collection',
    );

    for (const surface of surfaces) {
      const slug = getCollectionSlug(surface.href);
      if (!slug) continue;
      const slugKey = slug.toLowerCase();
      if (
        sitemapBlocklist.exactKeys.has(slugKey) ||
        sitemapBlocklist.exactKeys.has(`collections/${slugKey}`) ||
        sitemapBlocklist.exactKeys.has(surface.href.replace(/^\/+/, '').toLowerCase())
      ) {
        continue;
      }

      const loc = normalizeUrl(`${SITE}${surface.href}`);
      if (seen.has(loc)) continue;
      seen.add(loc);

      const priority = surface.tier === 'P0' ? '0.8' : surface.tier === 'P1' ? '0.7' : '0.6';
      urls.push(`<url>
<loc>${loc}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>${priority}</priority>
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
