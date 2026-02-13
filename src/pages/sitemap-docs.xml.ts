import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';

// @ts-ignore
import docsCache from '../../data/docs-cache.json';

export const prerender = true;

const SITE = 'https://killer-skills.com';

function buildHreflangLinks(pagePath: string): string {
    return SUPPORTED_LOCALES.map(loc =>
        `<xhtml:link rel="alternate" hreflang="${loc}" href="${SITE}/${loc}${pagePath}" />`
    ).join('\n') + `\n<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en${pagePath}" />`;
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
