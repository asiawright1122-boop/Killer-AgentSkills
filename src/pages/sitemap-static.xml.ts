import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { SITE_URL } from '../lib/site-config';

export const prerender = true;

const SITE = SITE_URL;
const AUTHORITY_SURFACE_LOCALES = ['en', 'zh'] as const;
const STATIC_PAGES = [
  { path: '' }, // Home
  { path: '/collections', locales: AUTHORITY_SURFACE_LOCALES },
  { path: '/docs', locales: AUTHORITY_SURFACE_LOCALES },
  { path: '/skills' },
  { path: '/popular' },
  { path: '/occupations' },
  { path: '/search' },
  { path: '/safe' },
  { path: '/article' },
  { path: '/privacy' },
  { path: '/terms' },
  { path: '/cookies' },
];

const normalizeUrl = (url: string) => {
  if (url === SITE || url === `${SITE}/`) return SITE;
  return url.replace(/\/+$/, '');
};

function buildHreflangLinks(pagePath: string, locales: readonly string[] = SUPPORTED_LOCALES): string {
  const xDefaultLocale = locales.includes('en') ? 'en' : locales[0] || 'en';
  return (
    locales
      .map((loc) => {
        const url = `${SITE}/${loc}${pagePath}`;
        return `<xhtml:link rel="alternate" hreflang="${loc}" href="${normalizeUrl(url)}" />`;
      })
      .join('\n') +
    `\n<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/${xDefaultLocale}${pagePath}`)}" />`
  );
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0];
  const urls: string[] = [];

  for (const page of STATIC_PAGES) {
    const pagePath = page.path;
    const pageLocales = page.locales || SUPPORTED_LOCALES;

    for (const locale of pageLocales) {
      urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}${pagePath}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>${pagePath === '' ? 'daily' : 'weekly'}</changefreq>
<priority>${pagePath === '' ? '1.0' : '0.8'}</priority>
${buildHreflangLinks(pagePath, pageLocales)}
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
