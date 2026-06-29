import type { APIRoute } from 'astro';
import { SUPPORTED_LOCALES } from '../i18n';
import { getCanonicalCollections, getCollectionCanonicalSlug } from '../lib/collection-slugs';
import { getLocalizedSeoEligibleLocales, getPreferredCanonicalLocale } from '../lib/seo-locales';
import { SITE_URL } from '../lib/site-config';
import { compileSitemapBlocklist } from '../lib/sitemap-blocklist';
import { loadJsonDataAtBuildTime } from '../lib/build-time-loader';

export const prerender = true;

const SITE = SITE_URL;

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

function buildHreflangLinks(pagePath: string, locales: readonly string[]): string {
  const canonicalLocale = getPreferredCanonicalLocale(locales);
  return (
    locales
      .map((loc) => {
        const url = `${SITE}/${loc}${pagePath}`;
        return `<xhtml:link rel="alternate" hreflang="${loc}" href="${normalizeUrl(url)}" />`;
      })
      .join('\n') +
    `\n<xhtml:link rel="alternate" hreflang="x-default" href="${normalizeUrl(`${SITE}/${canonicalLocale}${pagePath}`)}" />`
  );
}

// Load collections from local JSON files at build time
async function loadCollectionsAtBuildTime() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(process.cwd(), 'src/content/collections');

  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const entries = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const data = JSON.parse(content);
      const slug = file.replace(/\.json$/, '');
      entries.push({
        id: slug,
        data,
      });
    } catch {
      // Ignore malformed files
    }
  }

  return entries;
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0];
  const sitemapBlocklistData = await loadJsonDataAtBuildTime('data/seo-sitemap-blocklist.json');
  const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);
  const urls: string[] = [];

  // 1. Collections index page (/collections)
  for (const locale of SUPPORTED_LOCALES) {
    urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${locale}/collections`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
${buildHreflangLinks('/collections', SUPPORTED_LOCALES)}
</url>`);
  }

  // 2. Individual collection pages (/collections/{slug})
  try {
    const collectionsCol = getCanonicalCollections(await loadCollectionsAtBuildTime());
    for (const col of collectionsCol) {
      const canonicalSlug = getCollectionCanonicalSlug(col);
      if (
        sitemapBlocklist.exactKeys.has(canonicalSlug.toLowerCase()) ||
        sitemapBlocklist.exactKeys.has(`collections/${canonicalSlug.toLowerCase()}`)
      ) {
        continue;
      }
      const pagePath = `/collections/${canonicalSlug}`;
      const localizedSeoLocales = getLocalizedSeoEligibleLocales(col.data, SUPPORTED_LOCALES);
      if (localizedSeoLocales.length === 0) continue;

      const canonicalLocale = getPreferredCanonicalLocale(localizedSeoLocales);
      urls.push(`<url>
<loc>${normalizeUrl(`${SITE}/${canonicalLocale}${pagePath}`)}</loc>
<lastmod>${today}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.7</priority>
${buildHreflangLinks(pagePath, [canonicalLocale])}
</url>`);
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
