/**
 * Docs cache runtime loader.
 *
 * Loads docs-cache.json from KV at runtime (production) or from local JSON
 * file in dev mode. This prevents the bundler from inlining the ~205 KiB
 * JSON file into the Worker bundle.
 */

export interface DocsCacheEntry {
  slug: string;
  title: Record<string, string>;
  section?: string;
  content?: Record<string, string>;
}

let _docsCache: DocsCacheEntry[] | null = null;
let _docsCacheTime = 0;

export async function getDocsCache(env?: { SKILLS_CACHE?: KVNamespace }): Promise<DocsCacheEntry[]> {
  if (_docsCache && Date.now() - _docsCacheTime < 30000) {
    return _docsCache;
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('docs-cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Data may be wrapped in { version, lastUpdated, pages, sidebar }
        // or be a flat array of entries
        _docsCache = Array.isArray(parsed) ? parsed : parsed.pages || [];
        _docsCacheTime = Date.now();
        return _docsCache;
      }
    } catch {
      // Ignore KV errors
    }
  }

  // Fallback: local file (dev mode)
  if (import.meta.env.DEV) {
    try {
      const fs = await import('node:fs');
      const pathMod = await import('node:path');
      const filePath = pathMod.resolve(process.cwd(), 'data/docs-cache.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        _docsCache = Array.isArray(parsed) ? parsed : parsed.pages || [];
        _docsCacheTime = Date.now();
        return _docsCache;
      }
    } catch {
      // Ignore errors
    }
  }

  return [];
}

export function clearDocsCache(): void {
  _docsCache = null;
  _docsCacheTime = 0;
}
