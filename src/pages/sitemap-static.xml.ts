import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';

export const prerender = false;

const SITE = 'https://killer-skills.com';
const STATIC_PAGES = [
    '',           // Home
    '/skills',
    '/categories',
    '/cli',
    '/community',
    '/integrations',
    '/privacy',
    '/terms',
    '/cookies',
];

function buildHreflangLinks(pagePath: string): string {
    return SUPPORTED_LOCALES.map(loc =>
        `<xhtml:link rel="alternate" hreflang="${loc}" href="${SITE}/${loc}${pagePath}" />`
    ).join('\n') + `\n<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en${pagePath}" />`;
}

export const GET: APIRoute = async () => {
    const today = new Date().toISOString().split('T')[0];
    const urls: string[] = [];

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
