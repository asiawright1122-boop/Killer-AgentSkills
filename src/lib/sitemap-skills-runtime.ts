/**
 * Sitemap skills data runtime loader.
 *
 * Loads sitemap-skills.json from KV at runtime (production) or from local JSON
 * file in dev mode. This prevents the bundler from inlining the ~3 MiB JSON
 * file into the Worker bundle.
 */

export type { Env } from './kv';

export interface SitemapSkillEntry {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  updatedAt: string;
  metadataEligibleLocales: string[];
  bodyEligibleLocales: string[];
  eligibleLocales: string[];
  publishedLocales: string[];
  canonicalLocale: string;
  detectedBodyLocale: string;
  suppressedMetadataLocales: string[];
}

let _sitemapSkillsCache: SitemapSkillEntry[] | null = null;
let _sitemapSkillsCacheTime = 0;

function shouldPreferLocalRuntimeData(): boolean {
  return import.meta.env?.DEV === true || typeof process !== 'undefined';
}

async function readLocalSitemapSkills(): Promise<SitemapSkillEntry[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const filePath = path.resolve(process.cwd(), 'data/sitemap-skills.json');

  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : data.skills || [];
  } catch {
    return [];
  }
}

export async function getSitemapSkills(env?: { SKILLS_CACHE?: KVNamespace }): Promise<SitemapSkillEntry[]> {
  if (_sitemapSkillsCache && Date.now() - _sitemapSkillsCacheTime < 30000) {
    return _sitemapSkillsCache;
  }

  const isDevRuntime = shouldPreferLocalRuntimeData();

  // Local dev / CI preview smoke tests use repository data as the source of
  // truth. Prefer it over any bound KV so request-side routing and test samples
  // cannot diverge when a remote KV snapshot is stale.
  if (isDevRuntime) {
    try {
      const localSkills = await readLocalSitemapSkills();
      if (localSkills.length > 0) {
        _sitemapSkillsCache = localSkills;
        _sitemapSkillsCacheTime = Date.now();
        return _sitemapSkillsCache;
      }
    } catch {
      // Ignore errors and fall through to KV.
    }
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('sitemap-skills');
      if (raw) {
        _sitemapSkillsCache = JSON.parse(raw) as SitemapSkillEntry[];
        _sitemapSkillsCacheTime = Date.now();
        return _sitemapSkillsCache;
      }
    } catch {
      // Ignore KV errors, fall through to local
    }
  }

  // Fallback: local file (dev mode)
  if (isDevRuntime) {
    try {
      _sitemapSkillsCache = await readLocalSitemapSkills();
      _sitemapSkillsCacheTime = Date.now();
      return _sitemapSkillsCache;
    } catch {
      // Ignore errors
    }
  }

  return [];
}

export function clearSitemapSkillsCache(): void {
  _sitemapSkillsCache = null;
  _sitemapSkillsCacheTime = 0;
}

/** Inject pre-loaded data (used by tests to bypass KV/DEV requirements). */
export function setSitemapSkillsCache(data: SitemapSkillEntry[]): void {
  _sitemapSkillsCache = data;
  _sitemapSkillsCacheTime = Date.now();
}
