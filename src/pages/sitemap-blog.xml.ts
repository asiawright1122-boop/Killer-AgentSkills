import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SUPPORTED_LOCALES } from '../i18n';

export const prerender = true;

const SITE = 'https://killer-skills.com';

function buildHreflangLinks(locale: string, slug: string): string {
    // Generate alternate links for all locales for this specific slug
    return SUPPORTED_LOCALES.map(loc =>
        `<xhtml:link rel="alternate" hreflang="${loc}" href="${SITE}/${loc}/blog/${slug}" />`
    ).join('\n') + `\n<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en/blog/${slug}" />`;
}

function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
}

export const GET: APIRoute = async () => {
    const allPosts = await getCollection('blog', ({ data }) => !data.draft);
    const urls: string[] = [];

    // Since we want to group by slug across locales for hreflang, 
    // we should iterate over unique slugs (from English or first seen)
    // and then generate entries for all locales.

    const uniqueSlugs = [...new Set(allPosts.map(post => {
        // Post ID is typically locale/slug.md or just slug.md
        const parts = post.id.split('/');
        return parts.length > 1 ? parts.slice(1).join('/').replace(/\.md$/, '') : post.id.replace(/\.md$/, '');
    }))];

    for (const slug of uniqueSlugs) {
        for (const locale of SUPPORTED_LOCALES) {
            // Find the post for this locale/slug to get the correct lastmod
            const post = allPosts.find(p => p.id.includes(slug) && p.data.lang === locale) ||
                allPosts.find(p => p.id.includes(slug) && p.data.lang === 'en');

            if (post) {
                const lastmod = formatDate(post.data.updatedDate || post.data.pubDate || new Date());
                urls.push(`<url>
<loc>${SITE}/${locale}/blog/${slug}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>monthly</changefreq>
<priority>0.7</priority>
${buildHreflangLinks(locale, slug)}
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
