/**
 * Related skills lookup runtime loader.
 *
 * Loads related-skills-lookup.json from KV at runtime (production) or from
 * local JSON file in dev mode. This prevents the bundler from inlining the
 * ~3.4 MiB JSON file into the Worker bundle.
 */

export interface RelatedSkillsLookupData {
  lookup: Record<string, number[]>;
  skills: Array<{
    id: string;
    name?: string;
    owner?: string;
    repo?: string;
    routePath?: string;
    description?: string;
    stars?: number;
  }>;
}

let _relatedSkillsCache: RelatedSkillsLookupData | null = null;
let _relatedSkillsCacheTime = 0;

async function readLocalRelatedSkills(): Promise<RelatedSkillsLookupData | null> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const filePath = path.resolve(process.cwd(), 'data/related-skills-lookup.json');

  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function getRelatedSkillsLookup(env?: {
  SKILLS_CACHE?: KVNamespace;
}): Promise<RelatedSkillsLookupData | null> {
  if (_relatedSkillsCache && Date.now() - _relatedSkillsCacheTime < 30000) {
    return _relatedSkillsCache;
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('related-skills-lookup');
      if (raw) {
        _relatedSkillsCache = JSON.parse(raw);
        _relatedSkillsCacheTime = Date.now();
        return _relatedSkillsCache;
      }
    } catch {
      // Ignore KV errors, fall through to local
    }
  }

  // Fallback: local file (dev mode)
  if (import.meta.env.DEV) {
    try {
      _relatedSkillsCache = await readLocalRelatedSkills();
      _relatedSkillsCacheTime = Date.now();
      return _relatedSkillsCache;
    } catch {
      // Ignore errors
    }
  }

  return null;
}

export function clearRelatedSkillsCache(): void {
  _relatedSkillsCache = null;
  _relatedSkillsCacheTime = 0;
}
