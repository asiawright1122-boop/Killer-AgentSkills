import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { getSitemapSkillsFromKV, type Env } from '../lib/kv';

export const prerender = false;

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

export const GET: APIRoute = async ({ locals }) => {
    const env = (locals as any).runtime?.env as Env | undefined;
    const today = formatDate(new Date());

    let skills: { owner: string; repo: string; updatedAt?: string }[] = [];
    try {
        skills = await getSitemapSkillsFromKV(env as Env);
    } catch (e) {
        console.error('[sitemap-skills] Failed to load skills', e);
    }

    const urls: string[] = [];

    for (const skill of skills) {
        // Skip invalid entries
        if (!skill.owner || !skill.repo) continue;

        const skillPath = `/skills/${skill.owner}/${skill.repo}`;
        const lastmod = skill.updatedAt ? formatDate(skill.updatedAt) : today;
        for (const locale of SUPPORTED_LOCALES) {
            urls.push(`<url>
<loc>${SITE}/${locale}${skillPath}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
${buildHreflangLinks(skillPath)}
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
