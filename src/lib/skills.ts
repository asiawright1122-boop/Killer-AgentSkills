/**
 * Unified Skill loading logic for the Astro migration.
 * All skill data is loaded from KV — never statically import skills-cache.json (2.9MB).
 */

import type { Env } from './kv';
import { getSkillsFromKV, getSkillsKV } from './kv';

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
  seo?: {
    definition: Record<string, string>;
    features: Record<string, string[]>;
    keywords: Record<string, string[]>;
  };
  agentAnalysis?: {
    suitability: string;
    recommendation: string;
    useCases: string[];
    limitations: string[];
  };
}

/**
 * Get the localized description string from a UnifiedSkill's description field.
 * Falls back to English, then Chinese, then the first available value.
 */
export function getLocalizedDescription(
  description: UnifiedSkill['description'] | undefined,
  locale: string
): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  return description[locale] || description['en'] || description['zh'] || Object.values(description)[0] || '';
}

import { OFFICIAL_REPOS } from './skills-config';

/**
 * Load all skills from KV.
 * Returns an array of UnifiedSkill objects, or an empty array on failure.
 */
export async function getAllSkills(env: Env): Promise<UnifiedSkill[]> {
  const raw = await getSkillsFromKV(env);
  let skills = raw as UnifiedSkill[];

  // Augment skills with explicit categories from OFFICIAL_REPOS config
  skills = skills.map(skill => {
    // Find matching official repo config
    const officialConfig = Object.values(OFFICIAL_REPOS).find(
      c => c.owner === skill.owner && c.repo === skill.repo
    );

    if (officialConfig?.category) {
      return { ...skill, category: officialConfig.category };
    }
    return skill;
  });

  return skills;
}

/**
 * Find a specific skill by its full ID (e.g., 'anthropics/skills/algorithmic-art').
 * This is the preferred method for sub-skills within multi-skill repos.
 */
export async function getSkillById(
  env: Env,
  id: string
): Promise<UnifiedSkill | null> {
  // Try direct KV lookup first
  const direct = await getSkillsKV(env, `skill:${id}`);
  if (direct) return direct as UnifiedSkill;

  // Fallback: scan all skills
  const skills = await getAllSkills(env);
  return skills.find(
    (s) => s.id === id || s.name === id.split('/').pop()
  ) ?? null;
}

/**
 * Find a specific skill by owner and repo.
 * First tries a direct KV lookup by key, then falls back to scanning all skills.
 * Note: For multi-skill repos (e.g., anthropics/skills), this returns the FIRST match.
 * Use getSkillById for precise lookups.
 */
export async function getSkillByOwnerRepo(
  env: Env,
  owner: string,
  repo: string
): Promise<UnifiedSkill | null> {
  // Try direct KV lookup first (faster for single skill)
  const direct = await getSkillsKV(env, `skill:${owner}/${repo}`);
  if (direct) return direct as UnifiedSkill;

  // Fallback: scan all skills
  const skills = await getAllSkills(env);
  return skills.find(
    (s) => s.owner === owner && s.repo === repo
  ) ?? null;
}

/**
 * Filter skills by category.
 */
export async function getSkillsByCategory(
  env: Env,
  category: string
): Promise<UnifiedSkill[]> {
  const skills = await getAllSkills(env);
  return skills.filter((s) => s.category === category);
}

/**
 * Get featured/top skills sorted by stars.
 * @param limit - Maximum number of skills to return (default: 10)
 */
export async function getFeaturedSkills(
  env: Env,
  limit: number = 10
): Promise<UnifiedSkill[]> {
  const skills = await getAllSkills(env);
  return skills
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, limit);
}

/**
 * Get related skills based on category and tags.
 */
export async function getRelatedSkills(
  env: Env,
  currentSkill: UnifiedSkill,
  limit: number = 3
): Promise<UnifiedSkill[]> {
  const allSkills = await getAllSkills(env);

  return allSkills
    .filter(skill => {
      // Exclude current skill
      if (skill.id === currentSkill.id) return false;
      if (skill.owner === currentSkill.owner && skill.repo === currentSkill.repo) return false;

      // Must match category if available
      if (currentSkill.category && skill.category !== currentSkill.category) return false;

      return true;
    })
    .map(skill => {
      // Calculate relevance score
      let score = 0;

      // Tag overlap
      const currentTags = new Set(currentSkill.topics || []);
      const skillTags = skill.topics || [];
      const overlap = skillTags.filter(tag => currentTags.has(tag)).length;

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
    .map(item => item.skill)
    .slice(0, limit);
}
