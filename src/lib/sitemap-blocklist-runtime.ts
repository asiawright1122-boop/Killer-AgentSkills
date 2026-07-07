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

function shouldPreferLocalRuntimeData(): boolean {
  return import.meta.env?.DEV === true || typeof process !== 'undefined';
}

async function readLocalSitemapBlocklist(): Promise<CompiledSitemapBlocklist | null> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const filePath = path.resolve(process.cwd(), 'data/seo-sitemap-blocklist.json');
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return compileSitemapBlocklist(JSON.parse(content));
}

export async function getSitemapBlocklist(env?: { SKILLS_CACHE?: KVNamespace }): Promise<CompiledSitemapBlocklist> {
  if (_blocklistCache && Date.now() - _blocklistCacheTime < 60000) {
    return _blocklistCache;
  }

  const isDevRuntime = shouldPreferLocalRuntimeData();

  if (isDevRuntime) {
    try {
      const localBlocklist = await readLocalSitemapBlocklist();
      if (localBlocklist) {
        _blocklistCache = localBlocklist;
        _blocklistCacheTime = Date.now();
        return _blocklistCache;
      }
    } catch {
      // Ignore errors and fall through to KV.
    }
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
  if (isDevRuntime) {
    try {
      const localBlocklist = await readLocalSitemapBlocklist();
      if (localBlocklist) {
        _blocklistCache = localBlocklist;
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

/** Inject pre-loaded data (used by tests to bypass KV/DEV requirements). */
export function setSitemapBlocklistCache(data: CompiledSitemapBlocklist): void {
  _blocklistCache = data;
  _blocklistCacheTime = Date.now();
}
