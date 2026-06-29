/**
 * Skill collection lookup runtime loader.
 *
 * Loads skill-collection-lookup.json from KV at runtime (production) or from
 * local JSON file in dev mode. This prevents the bundler from inlining the
 * ~18 KiB JSON file into the Worker bundle.
 */

let _skillCollectionLookup: Record<string, string[]> | null = null;
let _cacheTime = 0;

export async function getSkillCollectionLookup(env?: {
  SKILLS_CACHE?: KVNamespace;
}): Promise<Record<string, string[]>> {
  if (_skillCollectionLookup && Date.now() - _cacheTime < 60000) {
    return _skillCollectionLookup;
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('skill-collection-lookup');
      if (raw) {
        _skillCollectionLookup = JSON.parse(raw);
        _cacheTime = Date.now();
        return _skillCollectionLookup;
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
      const filePath = path.resolve(process.cwd(), 'data/skill-collection-lookup.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        _skillCollectionLookup = JSON.parse(content);
        _cacheTime = Date.now();
        return _skillCollectionLookup;
      }
    } catch {
      // Ignore errors
    }
  }

  return {};
}

export function clearSkillCollectionLookupCache(): void {
  _skillCollectionLookup = null;
  _cacheTime = 0;
}
