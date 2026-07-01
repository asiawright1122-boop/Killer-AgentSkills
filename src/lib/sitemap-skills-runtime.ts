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
  if (import.meta.env.DEV) {
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
