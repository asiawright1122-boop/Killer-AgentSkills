import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';

export const prerender = true;

const SITE = 'https://killer-skills.com';
const STATIC_PAGES = [
    '',           // Home
    '/skills',
    '/categories',
    '/blog',
    '/cli',
    '/community',
    '/integrations',
    '/privacy',
    '/terms',
    '/cookies',
];

const ensureTrailingSlash = (url: string, path: string, locale?: string) => {
    if (url.endsWith('/') || url.endsWith('.xml') || url.endsWith('.txt')) return url;
    // Don't append slash to exact domain root or locale root (matching Layout.astro)
    if (path === '' || path === '/' || (locale && path === `/${locale}`)) return url;
    return `${url}/`;
};

function buildHreflangLinks(pagePath: string): string {
    return SUPPORTED_LOCALES.map(loc => {
        const url = `${SITE}/${loc}${pagePath}`;
        return `<xhtml:link rel="alternate" hreflang="${loc}" href="${ensureTrailingSlash(url, pagePath, loc)}" />`;
    }).join('\n') + `\n<xhtml:link rel="alternate" hreflang="x-default" href="${ensureTrailingSlash(`${SITE}/en${pagePath}`, pagePath, 'en')}" />`;
}

export const GET: APIRoute = async () => {
    const today = new Date().toISOString().split('T')[0];
    const urls: string[] = [];

    for (const page of STATIC_PAGES) {
        for (const locale of SUPPORTED_LOCALES) {
            urls.push(`<url>
<loc>${ensureTrailingSlash(`${SITE}/${locale}${page}`, page, locale)}</loc>
<lastmod>${today}</lastmod>
<changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>
<priority>${page === '' ? '1.0' : '0.8'}</priority>
${buildHreflangLinks(page)}
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
