import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { SITE_URL } from '../lib/site-config';
import { compileSitemapBlocklist } from '../lib/sitemap-blocklist';
import { loadJsonDataAtBuildTime } from '../lib/build-time-loader';
import { loadBlogPostsFromGlob } from '../lib/blog-glob-loader';

export const prerender = true;

const SITE = SITE_URL;
const normalizeUrl = (url: string) => url.replace(/\/+$/, '');
const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES as readonly string[]);

const BLOG_CATEGORIES = ['document-automation', 'developer-experience', 'enterprise-solutions', 'creative-tools'];

function buildHreflangLinks(slug: string, availableLocales: string[]): string {
  const uniqueLocales = availableLocales.filter((loc) => SUPPORTED_LOCALE_SET.has(loc));
  if (uniqueLocales.length === 0) return '';

  const xDefaultLocale = uniqueLocales.includes('en') ? 'en' : uniqueLocales[0];
  return (
    uniqueLocales
      .map(
        (loc) =>
          `<xhtml:link rel="alternate" hreflang="${loc}" href="${normalizeUrl(`${SITE}/${loc}/blog/${slug}`)}" />`,
      )
      .join('\n') +
    `\n<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/${xDefaultLocale}/blog/${slug}`)}" />`
  );
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export const GET: APIRoute = async () => {
  const allPosts = await loadBlogPostsFromGlob();
  const sitemapBlocklistData = await loadJsonDataAtBuildTime('data/seo-sitemap-blocklist.json');
  const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);
  const urls: string[] = [];

  // Group posts by slug and keep per-locale variants.
  const postsBySlug = new Map<string, Map<string, (typeof allPosts)[number]>>();
  for (const post of allPosts) {
    const slug = post.id
      .split('/')
      .slice(1)
      .join('/')
      .replace(/\.mdx?$/, '');
    const locale = post.id.split('/')[0] || post.data.lang;
    if (!slug || !locale || !SUPPORTED_LOCALE_SET.has(locale)) continue;

    const localeMap = postsBySlug.get(slug) || new Map<string, (typeof allPosts)[number]>();
    localeMap.set(locale, post);
    postsBySlug.set(slug, localeMap);
  }

  for (const [slug, localeMap] of postsBySlug.entries()) {
    if (
      sitemapBlocklist.exactKeys.has(slug.toLowerCase()) ||
      sitemapBlocklist.exactKeys.has(`blog/${slug.toLowerCase()}`)
    ) {
      continue;
    }

    const availableLocales = Array.from(localeMap.keys());
    if (availableLocales.length === 0) continue;

    for (const locale of availableLocales) {
      const post = localeMap.get(locale);
      if (!post) continue;
      const lastmod = formatDate(post.data.updatedDate || post.data.pubDate || new Date());
      urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}/blog/${slug}`)}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>monthly</changefreq>
<priority>0.7</priority>
${buildHreflangLinks(slug, availableLocales)}
</url>`);
    }
  }

  // Blog category pages
  const today = new Date().toISOString().split('T')[0];
  for (const cat of BLOG_CATEGORIES) {
    if (
      sitemapBlocklist.exactKeys.has(cat.toLowerCase()) ||
      sitemapBlocklist.exactKeys.has(`blog/category/${cat.toLowerCase()}`)
    ) {
      continue;
    }

    for (const locale of SUPPORTED_LOCALES) {
      // Pre-validate: Category must have at least one post in this locale, or fall back to English if it has posts there
      const hasLocalPost = allPosts.some(
        (post) => post.data.category === cat && (post.id.split('/')[0] || post.data.lang) === locale,
      );
      const hasEnglishFallback =
        locale !== 'en' &&
        allPosts.some((post) => post.data.category === cat && (post.id.split('/')[0] || post.data.lang) === 'en');

      if (!hasLocalPost && !hasEnglishFallback) {
        continue;
      }

      urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}/blog/category/${cat}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
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
