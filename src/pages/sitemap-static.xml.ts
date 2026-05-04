import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { getSolutionSeoEligibleLocales, SOLUTION_INTENT_SLUGS, type SolutionSlug } from '../lib/solution-intents';
import { getPreferredCanonicalLocale } from '../lib/seo-locales';
import { SITE_URL } from '../lib/site-config';

export const prerender = false;

const SITE = SITE_URL;
const STATIC_PAGES = [
  '', // Home
  '/skills',
  '/categories',
  '/collections',
  '/blog',
  '/docs',
  '/cli',
  '/community',
  '/integrations',
  '/privacy',
  '/terms',
  '/cookies',
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
    for (const locale of SUPPORTED_LOCALES) {
      urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}${page}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>
<priority>${page === '' ? '1.0' : '0.8'}</priority>
${buildHreflangLinks(page)}
      </url>`);
    }
  }

  const solutionPages: Array<{ path: string; locales: readonly string[] }> = [
    {
      path: '/solutions',
      locales: getSolutionSeoEligibleLocales(),
    },
    ...SOLUTION_INTENT_SLUGS.map((slug: SolutionSlug) => ({
      path: `/solutions/${slug}`,
      locales: getSolutionSeoEligibleLocales(slug),
    })),
  ];

  for (const page of solutionPages) {
    const canonicalLocale = getPreferredCanonicalLocale(page.locales);
    urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${canonicalLocale}${page.path}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
${buildHreflangLinks(page.path, [canonicalLocale])}
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
