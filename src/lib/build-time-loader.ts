/**
 * Build-time data loader for prerendered pages.
 *
 * Strategy:
 * 1. Try dynamic `import('node:fs')` — works in Node.js build environments.
 * 2. Fall back to static Vite JSON import — works in miniflare (Astro 6 CF Worker
 *    prerender) where node:fs is unavailable but Vite can resolve JSON imports.
 *
 * The `node:fs` dynamic import avoids Vite inlining the JSON into the SSR worker
 * bundle. The static fallback only applies at build time during prerender.
 */

// Static imports as fallback for miniflare prerender where node:fs is unavailable.
// Vite resolves these at build time and trees them out of the SSR worker bundle
// because they're only referenced inside a `try/catch` fallback path.
import sitemapSkillsJson from '../../data/sitemap-skills.json';
import skillLocaleGovernanceJson from '../../data/seo-skill-locale-governance.json';
import sitemapBlocklistJson from '../../data/seo-sitemap-blocklist.json';
import skillIndexabilityReportJson from '../../reports/seo/latest-skill-indexability.json';

const staticFallbacks: Record<string, unknown> = {
  'data/sitemap-skills.json': sitemapSkillsJson,
  'data/seo-skill-locale-governance.json': skillLocaleGovernanceJson,
  'data/seo-sitemap-blocklist.json': sitemapBlocklistJson,
  'reports/seo/latest-skill-indexability.json': skillIndexabilityReportJson,
};

export async function loadJsonDataAtBuildTime(relativePath: string): Promise<unknown> {
  // 1. Try node:fs first (preferred — doesn't bundle JSON into worker)
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (_e) {
    // node:fs unavailable (miniflare environment) — fall through
  }

  // 2. Try static Vite import fallback
  if (relativePath in staticFallbacks) {
    return staticFallbacks[relativePath];
  }

  // 3. Last resort: try dynamic import with file:// URL
  try {
    const path = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const filePath = path.resolve(process.cwd(), relativePath);
    const data = await import(pathToFileURL(filePath).href);
    return data.default || data;
  } catch {
    // Give up
  }

  console.warn(`[build-time-loader] Failed to load ${relativePath} — all strategies exhausted`);
  return null;
}
