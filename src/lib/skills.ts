/**
 * Unified Skill loading logic for the Astro migration.
 * All skill data is loaded from KV — never statically import skills-cache.json (2.9MB).
 */

import type { Env } from './kv';
import { getSkillsFromKV, getSkillsKV, getSkillsListing } from './kv';

export interface UnifiedSkill {
  id: string;
  name: string;
  skillName: string;
  owner: string;
  repo: string;
  description: string | Record<string, string>;
  category: string;
  topics: string[];
  stars: number;
  source: 'verified' | 'featured' | 'cache';
  updatedAt: string;
  qualityScore?: number;
  filePath?: string;
  skillMd?: {
    name?: string;
    description?: string;
    version?: string;
    tags?: string[];
    body?: string;
    bodyPreview?: string;
  };
  lastSynced?: string;
  forks?: number;
  seo?: {
    title?: Record<string, string>;
    description?: Record<string, string>;
    definition: Record<string, string>;
    features: Record<string, string[]>;
    keywords: Record<string, string[]>;
  };
  agentAnalysis?: {
    suitability: string | Record<string, string>;
    recommendation: string | Record<string, string>;
    useCases: string[] | Record<string, string[]>;
    limitations: string[] | Record<string, string[]>;
  };
}

/**
 * Get the localized description string from a UnifiedSkill's description field.
 * Falls back to English, then Chinese, then the first available value.
 */
export function getLocalizedDescription(description: UnifiedSkill['description'] | undefined, locale: string): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  return description[locale] || description['en'] || description['zh'] || Object.values(description)[0] || '';
}

import { OFFICIAL_REPOS } from './skills-config';

// Module-level cache for getAllSkills within a single Worker request
let _cachedSkills: UnifiedSkill[] | null = null;
let _cacheTs = 0;
const CACHE_TTL = 5000; // 5s — covers a single SSR render cycle

/** Reset cache — exported for testing only */
export function _resetSkillsCache() {
  _cachedSkills = null;
  _cacheTs = 0;
}

/**
 * Load all skills from KV.
 * Returns an array of UnifiedSkill objects, or an empty array on failure.
 * Results are cached heavily using both Module Cache and Cloudflare Cache API (when available)
 * to avoid duplicate D1 queries and massive JSON deserialization overhead.
 */
export async function getAllSkills(env: Env): Promise<UnifiedSkill[]> {
  // 1. Module-level super fast cache (same isolate)
  if (_cachedSkills && Date.now() - _cacheTs < CACHE_TTL) {
    return _cachedSkills;
  }

  // 2. Try global Cloudflare Cache API (cross-isolate caching)
  let cache;
  const cacheKey = new Request('https://killer-skills-internal/api/get-all-skills', { method: 'GET' });
  try {
    if (typeof caches !== 'undefined' && (caches as any).default) {
      cache = (caches as any).default;
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const skills = (await cachedResponse.json()) as UnifiedSkill[];
        _cachedSkills = skills;
        _cacheTs = Date.now();
        return skills;
      }
    }
  } catch (e) {
    console.warn('[Cache API] Miss or Error:', e);
  }

  console.time('getAllSkills DB Fetch & Parse');
  // 3. Fallback: Full DB query and JSON parse (slow path)
  const raw = await getSkillsFromKV(env);
  let skills = raw as UnifiedSkill[];

  // Augment skills with explicit categories from OFFICIAL_REPOS config
  skills = skills.map((skill) => {
    // Find matching official repo config
    const officialConfig = Object.values(OFFICIAL_REPOS).find((c) => c.owner === skill.owner && c.repo === skill.repo);

    if (officialConfig?.category) {
      return { ...skill, category: officialConfig.category };
    }
    return skill;
  });

  console.timeEnd('getAllSkills DB Fetch & Parse');

  _cachedSkills = skills;
  _cacheTs = Date.now();

  // 4. Save to Cache API
  if (cache) {
    try {
      const response = new Response(JSON.stringify(skills), {
        headers: {
          'Cache-Control': 's-maxage=3600', // Cache for 1 hour at edge
          'Content-Type': 'application/json',
        },
      });
      // waitUntil is handled by Astro natively if executing within CF handler context
      await cache.put(cacheKey, response);
    } catch (e) {
      console.warn('[Cache API] Put Error:', e);
    }
  }

  return skills;
}

// Module-level cache for getLightweightSkills within a single Worker request
let _cachedLightSkills: UnifiedSkill[] | null = null;
let _cacheLightTs = 0;

/**
 * Load lightweight skills from KV for listing pages.
 * Only loads essential fields (name, description, topics, etc.) instead of full markdown payloads,
 * reducing payload size from ~63MB to ~1MB and preventing Cloudflare Error 1102 (CPU time limit).
 */
export async function getLightweightSkills(env: Env): Promise<UnifiedSkill[]> {
  // 1. Module-level super fast cache (same isolate)
  if (_cachedLightSkills && Date.now() - _cacheLightTs < CACHE_TTL) {
    return _cachedLightSkills;
  }

  // 2. Try global Cloudflare Cache API (cross-isolate caching)
  let cache;
  const cacheKey = new Request('https://killer-skills-internal/api/get-light-skills', { method: 'GET' });
  try {
    if (typeof caches !== 'undefined' && (caches as any).default) {
      cache = (caches as any).default;
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const skills = (await cachedResponse.json()) as UnifiedSkill[];
        _cachedLightSkills = skills;
        _cacheLightTs = Date.now();
        return skills;
      }
    }
  } catch (e) {
    console.warn('[Cache API] Miss or Error:', e);
  }

  console.time('getLightweightSkills DB Fetch');
  // 3. Fallback: D1 listing query (fast path, extracts only card fields)
  const raw = await getSkillsListing(env);
  let skills = raw as UnifiedSkill[];

  // Augment skills with explicit categories from OFFICIAL_REPOS config
  skills = skills.map((skill) => {
    // Find matching official repo config
    const officialConfig = Object.values(OFFICIAL_REPOS).find((c) => c.owner === skill.owner && c.repo === skill.repo);

    if (officialConfig?.category) {
      return { ...skill, category: officialConfig.category };
    }
    return skill;
  });

  console.timeEnd('getLightweightSkills DB Fetch');

  _cachedLightSkills = skills;
  _cacheLightTs = Date.now();

  // 4. Save to Cache API
  if (cache) {
    try {
      const response = new Response(JSON.stringify(skills), {
        headers: {
          'Cache-Control': 's-maxage=3600', // Cache for 1 hour at edge
          'Content-Type': 'application/json',
        },
      });
      // waitUntil is handled by Astro natively if executing within CF handler context
      await cache.put(cacheKey, response);
    } catch (e) {
      console.warn('[Cache API] Put Error:', e);
    }
  }

  return skills;
}

/**
 * Find a specific skill by its full ID (e.g., 'anthropics/skills/algorithmic-art').
 * Uses D1 multi-level query (exact → LIKE → owner/repo index).
 * No full-table scan fallback — D1 handles all matching.
 */
export async function getSkillById(env: Env, id: string): Promise<UnifiedSkill | null> {
  const direct = await getSkillsKV(env, `skill:${id}`);
  return direct ? (direct as UnifiedSkill) : null;
}

/**
 * Find a specific skill by owner and repo.
 * Uses D1 indexed query (owner/repo index).
 * For multi-skill repos (e.g., anthropics/skills), returns the FIRST match.
 * Use getSkillById for precise sub-skill lookups.
 */
export async function getSkillByOwnerRepo(env: Env, owner: string, repo: string): Promise<UnifiedSkill | null> {
  const direct = await getSkillsKV(env, `skill:${owner}/${repo}`);
  return direct ? (direct as UnifiedSkill) : null;
}

/**
 * Get featured/top skills sorted by stars.
 * @param limit - Maximum number of skills to return (default: 10)
 */
export async function getFeaturedSkills(env: Env, limit: number = 10): Promise<UnifiedSkill[]> {
  const skills = await getAllSkills(env);
  return skills.sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, limit);
}

/**
 * Get featured skills directly from D1 with LIMIT — avoids loading all skills.
 * This is the optimized version for homepage use.
 */
export async function getFeaturedSkillsDirect(env: Env, limit: number = 6): Promise<UnifiedSkill[]> {
  if (!env?.DB) {
    console.warn('[D1] No DB binding, falling back to getAllSkills');
    return getFeaturedSkills(env, limit);
  }

  try {
    const result = await env.DB.prepare(`SELECT data_json FROM skills ORDER BY stars DESC LIMIT ?`).bind(limit).all();

    if (result.success && result.results) {
      return result.results.map((row: any) => {
        const skill = JSON.parse(row.data_json) as UnifiedSkill;
        // Augment with official category if applicable
        const officialConfig = Object.values(OFFICIAL_REPOS).find(
          (c) => c.owner === skill.owner && c.repo === skill.repo,
        );
        if (officialConfig?.category) {
          return { ...skill, category: officialConfig.category };
        }
        return skill;
      });
    }
    return [];
  } catch (e) {
    console.error('[D1] getFeaturedSkillsDirect error:', e);
    return getFeaturedSkills(env, limit);
  }
}

import { getLocalSkillsFallback } from './kv';

/**
 * Get official skill counts grouped by owner — avoids loading all skill JSON.
 * Returns [{owner, count}] sorted by count descending.
 */
export async function getOfficialSkillCounts(
  env: Env,
  owners: string[],
  limit: number = 6,
): Promise<{ owner: string; count: number }[]> {
  if (!env?.DB || owners.length === 0) {
    const all = await getLocalSkillsFallback();
    if (all.length > 0) {
      const counts: Record<string, number> = {};
      for (const s of all) {
        if (owners.includes(s.owner)) {
          counts[s.owner] = (counts[s.owner] || 0) + 1;
        }
      }
      return Object.entries(counts)
        .map(([owner, count]) => ({ owner, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    }
    return [];
  }

  try {
    const placeholders = owners.map(() => '?').join(',');
    const result = await env.DB.prepare(
      `SELECT owner, COUNT(*) as count FROM skills WHERE owner IN (${placeholders}) GROUP BY owner ORDER BY count DESC LIMIT ?`,
    )
      .bind(...owners, limit)
      .all();

    if (result.success && result.results) {
      return result.results.map((row: any) => ({
        owner: row.owner as string,
        count: row.count as number,
      }));
    }
    return [];
  } catch (e) {
    console.error('[D1] getOfficialSkillCounts error:', e);
    return [];
  }
}

/**
 * Get related skills based on category and tags.
 */
export async function getRelatedSkills(
  env: Env,
  currentSkill: UnifiedSkill,
  limit: number = 3,
): Promise<UnifiedSkill[]> {
  const allSkills = await getAllSkills(env);

  return allSkills
    .filter((skill) => {
      // Exclude current skill
      if (skill.id === currentSkill.id) return false;
      if (skill.owner === currentSkill.owner && skill.repo === currentSkill.repo) return false;

      // Must match category if available
      if (currentSkill.category && skill.category !== currentSkill.category) return false;

      return true;
    })
    .map((skill) => {
      // Calculate relevance score
      let score = 0;

      // Tag overlap
      const currentTags = new Set(currentSkill.topics || []);
      const skillTags = skill.topics || [];
      const overlap = skillTags.filter((tag) => currentTags.has(tag)).length;

      score += overlap * 10;

      // Bonus for being verified
      if (skill.source === 'verified' || skill.source === 'featured') {
        score += 5;
      }

      return { skill, score };
    })
    .sort((a, b) => {
      // Sort by score desc, then stars desc
      if (b.score !== a.score) return b.score - a.score;
      return (b.skill.stars || 0) - (a.skill.stars || 0);
    })
    .map((item) => item.skill)
    .slice(0, limit);
}
