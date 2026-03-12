import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SUPPORTED_LOCALES } from '../i18n';

export const prerender = false;

const SITE = 'https://killer-skills.com';

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

function buildHreflangLinks(pagePath: string): string {
  return (
    SUPPORTED_LOCALES.map((loc) => {
      const url = `${SITE}/${loc}${pagePath}`;
      return `<xhtml:link rel="alternate" hreflang="${loc}" href="${normalizeUrl(url)}" />`;
    }).join('\n') +
    `\n<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/en${pagePath}`)}" />`
  );
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0];
  const urls: string[] = [];

  // 1. Collections index page (/collections)
  for (const locale of SUPPORTED_LOCALES) {
    urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}/collections`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
${buildHreflangLinks('/collections')}
</url>`);
  }

  // 2. Individual collection pages (/collections/{slug})
  try {
    const collectionsCol = await getCollection('collections');
    for (const col of collectionsCol) {
      const cleanSlug = col.id.replace(/\.json$/, '');
      const pagePath = `/collections/${cleanSlug}`;

      for (const locale of SUPPORTED_LOCALES) {
        urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}${pagePath}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.7</priority>
${buildHreflangLinks(pagePath)}
</url>`);
      }
    }
  } catch (e) {
    console.error('[sitemap-collections] Failed to load collections:', e);
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
