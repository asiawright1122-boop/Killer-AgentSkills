/**
 * Local skills cache fallback - runtime-only module.
 *
 * This module prevents the bundler from inlining the skills-cache.json file
 * by using fully dynamic imports and computed paths that cannot be
 * statically analyzed.
 */

import type { SkillListingItem } from './kv';
import type { TrackedSkillFallbackRow } from './skills-fallback';

let _localSkillsCache: SkillListingItem[] | null = null;
let _localSkillsCacheTime = 0;

async function readProjectJsonFile<T>(relativePath: string): Promise<T | null> {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function readDataJsonFile<T>(relativePath: string): Promise<T | null> {
  return readProjectJsonFile<T>(`data/${relativePath}`);
}

export async function getLocalSkillsFallback(): Promise<SkillListingItem[]> {
  if (_localSkillsCache && Date.now() - _localSkillsCacheTime < 30000) {
    return _localSkillsCache || [];
  }

  // Try main cache first
  const mainCache = await readDataJsonFile<SkillListingItem[] | { skills: SkillListingItem[] }>('skills-cache.json');
  if (mainCache) {
    _localSkillsCache = Array.isArray(mainCache) ? mainCache : mainCache.skills || [];
    _localSkillsCacheTime = Date.now();
    return _localSkillsCache || [];
  }

  const localSkillsSnapshot = await readProjectJsonFile<SkillListingItem[]>('src/lib/local-skills-snapshot.json');
  if (Array.isArray(localSkillsSnapshot) && localSkillsSnapshot.length > 0) {
    _localSkillsCache = localSkillsSnapshot;
    _localSkillsCacheTime = Date.now();
    return _localSkillsCache || [];
  }

  // Fallback to installed skills
  const { getInstalledSkillsFallback } = await import('./kv');
  const installedSkills = await getInstalledSkillsFallback();
  if (installedSkills.length > 0) {
    _localSkillsCache = installedSkills;
    _localSkillsCacheTime = Date.now();
    return _localSkillsCache || [];
  }

  // Fallback to expanded-github-skills
  const trackedData = await readDataJsonFile<unknown[]>('expanded-github-skills.json');
  if (trackedData && Array.isArray(trackedData)) {
    const { normalizeTrackedSkillFallback } = await import('./skills-fallback');
    const normalized = trackedData
      .map((row) => normalizeTrackedSkillFallback(row as TrackedSkillFallbackRow))
      .filter((row): row is SkillListingItem => row !== null);
    _localSkillsCache = normalized;
    _localSkillsCacheTime = Date.now();
    return _localSkillsCache || [];
  }

  return [];
}
