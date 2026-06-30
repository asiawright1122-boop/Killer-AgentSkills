/**
 * Sitemap blocklist runtime loader.
 *
 * Loads seo-sitemap-blocklist.json from KV at runtime (production) or from
 * local JSON file in dev mode. This prevents the bundler from inlining the
 * ~103 KiB JSON file into the Worker bundle.
 */

import { compileSitemapBlocklist, type CompiledSitemapBlocklist } from './sitemap-blocklist';

let _blocklistCache: CompiledSitemapBlocklist | null = null;
let _blocklistCacheTime = 0;

export async function getSitemapBlocklist(env?: { SKILLS_CACHE?: KVNamespace }): Promise<CompiledSitemapBlocklist> {
  if (_blocklistCache && Date.now() - _blocklistCacheTime < 60000) {
    return _blocklistCache;
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('seo-sitemap-blocklist');
      if (raw) {
        _blocklistCache = compileSitemapBlocklist(JSON.parse(raw));
        _blocklistCacheTime = Date.now();
        return _blocklistCache;
      }
    } catch {
      // Ignore KV errors
    }
  }

  // Fallback: local file (dev mode)
  if (import.meta.env.DEV) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const filePath = path.resolve(process.cwd(), 'data/seo-sitemap-blocklist.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        _blocklistCache = compileSitemapBlocklist(JSON.parse(content));
        _blocklistCacheTime = Date.now();
        return _blocklistCache;
      }
    } catch {
      // Ignore errors
    }
  }

  // Return empty blocklist as fallback (must match CompiledSitemapBlocklist shape)
  return { exactKeys: new Set(), repoKeys: new Set() };
}

export function clearSitemapBlocklistCache(): void {
  _blocklistCache = null;
  _blocklistCacheTime = 0;
}
