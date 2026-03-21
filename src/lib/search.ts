/**
 * Search scoring and filtering logic for skills.
 * Uses Fuse.js for fuzzy, weighted, multi-field natural language search.
 */

import Fuse from 'fuse.js';
import { normalizeCategoryId } from './category-taxonomy';
import type { UnifiedSkill } from './skills';

/**
 * Calculate a quality/popularity bonus score for secondary ranking.
 * Used to break ties when Fuse.js match scores are similar.
 */
export function calculateQualityScore(skill: UnifiedSkill): number {
  let qualityScore = 0;

  // === Quality score (weight 60%) ===
  if (skill.source === 'verified') qualityScore += 0.4;
  else if (skill.source === 'featured') qualityScore += 0.3;
  else if (skill.source === 'cache') qualityScore += 0.2;

  if (skill.description && (typeof skill.description === 'string' ? skill.description.length > 20 : true)) {
    qualityScore += 0.3;
  }

  const daysSinceUpdate = (Date.now() - new Date(skill.updatedAt).getTime()) / 86400000;
  if (daysSinceUpdate < 30) qualityScore += 0.3;
  else if (daysSinceUpdate < 180) qualityScore += 0.15;
  else if (daysSinceUpdate > 365) qualityScore -= 0.1;

  // === Popularity score (weight 40%) ===
  const popularityScore = Math.min(Math.log10((skill.stars || 0) + 1) / 5, 1);

  return qualityScore * 0.6 + popularityScore * 0.4;
}

/**
 * Prepare a flat searchable record for Fuse.js from a UnifiedSkill.
 * Flattens nested SEO fields and localized descriptions into top-level fields.
 */
function prepareSearchRecord(skill: UnifiedSkill, locale: string = 'en') {
  const desc = typeof skill.description === 'object' ? skill.description : {};
  const descStr = typeof skill.description === 'string' ? skill.description : '';

  return {
    ...skill,
    // Flat description fields for Fuse keys
    _descEn: typeof skill.description === 'object' ? desc['en'] || '' : descStr,
    _descLocale: typeof skill.description === 'object' ? desc[locale] || '' : '',
    // Flat SEO fields
    _keywordsEn: skill.seo?.keywords?.['en'] || [],
    _keywordsLocale: skill.seo?.keywords?.[locale] || [],
    _featuresEn: skill.seo?.features?.['en'] || [],
    _featuresLocale: skill.seo?.features?.[locale] || [],
    _definitionEn: skill.seo?.definition?.['en'] || '',
    _definitionLocale: skill.seo?.definition?.[locale] || '',
  };
}

type SearchRecord = ReturnType<typeof prepareSearchRecord>;

/**
 * Search skills by query string using Fuse.js fuzzy matching.
 * Returns results sorted by combined Fuse score + quality/popularity.
 *
 * Searches across: name, skillName, descriptions (en + locale),
 * SEO keywords, features, definition, topics, and category.
 *
 * @param skills - Array of skills to search
 * @param query - Search query string
 * @param locale - Current locale for localized field matching (default: 'en')
 */
export function searchSkills(skills: UnifiedSkill[], query: string, locale: string = 'en'): UnifiedSkill[] {
  if (!query.trim()) return skills;

  // Prepare flattened records for Fuse
  const records = skills.map((s) => prepareSearchRecord(s, locale));

  // Configure Fuse.js with weighted keys
  // NOTE: SEO keywords intentionally EXCLUDED — they are AI-generated and contain
  // spam like "PDF parsing AI" injected into unrelated skills (e.g. orpc-contract-first).
  // Only use clean data sources: name, skillName, skillMd.description, description, topics.
  const fuse = new Fuse<SearchRecord>(records, {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'skillName', weight: 0.8 },
      { name: '_descEn', weight: 0.5 },
      { name: '_descLocale', weight: 0.5 },
      { name: '_featuresEn', weight: 0.3 },
      { name: '_featuresLocale', weight: 0.3 },
      { name: 'topics', weight: 0.3 },
      { name: 'category', weight: 0.2 },
    ],
    // Tighter fuzzy matching to reduce false positives
    threshold: 0.3, // Stricter: was 0.4
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    useExtendedSearch: false,
    ignoreLocation: true,
  });

  const fuseResults = fuse.search(query);

  // Combine Fuse score with quality/popularity for final ranking
  // Fuse score: 0 = perfect match, 1 = no match (inverted)
  const scored = fuseResults.map((result) => {
    const fuseScore = 1 - (result.score || 0); // Invert: higher = better
    const qualityScore = calculateQualityScore(result.item as unknown as UnifiedSkill);
    // 70% match relevance + 30% quality/popularity
    const combinedScore = fuseScore * 0.7 + qualityScore * 0.3;
    return { skill: result.item as unknown as UnifiedSkill, combinedScore };
  });

  // Sort by combined score (highest first)
  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  return scored.map(({ skill }) => skill);
}

/**
 * Simple category filter.
 * Supports category group mapping for broader category matching.
 */
export const CATEGORY_GROUPS: Readonly<Record<string, readonly string[]>> = {
  // Specific domains first
  finance: [
    'finance',
    'money',
    'stock',
    'crypto',
    'currency',
    'market',
    'invest',
    'bank',
    'economy',
    'price',
    'defi',
    'trading',
    'wallet',
  ],
  data: [
    'data',
    'analytics',
    'database',
    'sql',
    'visualization',
    'chart',
    'scrape',
    'crawling',
    'etl',
    'pipeline',
    'bi',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
  ],
  browser: [
    'browser',
    'web',
    'scraping',
    'pupeteer',
    'selenium',
    'playwright',
    'chrome',
    'firefox',
    'automation',
    'crawler',
  ],
  productivity: [
    'productivity',
    'workflow',
    'automation',
    'utility',
    'tool',
    'manager',
    'organize',
    'time',
    'calendar',
    'email',
    'notion',
    'slack',
    'schedule',
    'task',
  ],
  design: ['design', 'ui', 'ux', 'frontend', 'css', 'style', 'art', 'creative', 'image', 'figma', 'tailwind'],

  // New Domains
  devops: [
    'devops',
    'cloud',
    'kubernetes',
    'docker',
    'aws',
    'azure',
    'gcp',
    'deploy',
    'ci/cd',
    'server',
    'linux',
    'hosting',
    'cloudflare',
  ],
  security: [
    'security',
    'auth',
    'authentication',
    'authorization',
    'privacy',
    'encryption',
    'oauth',
    'password',
    'jwt',
  ],
  communication: ['communication', 'chat', 'message', 'discord', 'telegram', 'whatsapp', 'sms', 'social'],

  // Generic / Fallback domains
  ai: [
    'ai',
    'machine-learning',
    'nlp',
    'llm',
    'gpt',
    'agent',
    'agents',
    'openai',
    'anthropic',
    'claude',
    'gemini',
    'llama',
    'prompt',
    'rag',
  ],
  developer: [
    'development',
    'coding',
    'programming',
    'git',
    'github',
    'api',
    'sdk',
    'cli',
    'framework',
    'library',
    'language',
    'test',
    'debug',
    'code-review',
    'ide',
    'mcp',
    'typescript',
    'python',
    'javascript',
    'react',
    'node',
    'rust',
    'go',
    'ruby',
  ],
  documentation: ['documentation', 'markdown', 'docs', 'readme', 'pdf'],
};

export function filterByCategory(skills: UnifiedSkill[], category: string): UnifiedSkill[] {
  const normalizedCategory = normalizeCategoryId(category);
  const categoryKey = normalizedCategory || category.toLowerCase();

  // 1. Strict Check: If the skill has an explicit category that matches a known group,
  // it should ONLY appear in that category.
  // This prevents "Developer" skills from showing up in "AI" just because they mention "AI" in description.
  skills = skills.filter((s) => {
    const normalizedSkillCategory = normalizeCategoryId(s.category);
    if (normalizedSkillCategory && CATEGORY_GROUPS[normalizedSkillCategory]) {
      return normalizedSkillCategory === categoryKey;
    }
    return true; // No strict category, proceed to soft matching
  });

  const targetKeywords = CATEGORY_GROUPS[categoryKey] || [categoryKey];

  return skills.filter((s) => {
    const normalizedSkillCategory = normalizeCategoryId(s.category);

    // 2. Direct category match
    if (normalizedSkillCategory === categoryKey) return true;

    // 3. Check if any of the target keywords appear in the skill's topics
    if (s.topics?.some((topic) => targetKeywords.some((keyword) => topic.toLowerCase().includes(keyword)))) {
      return true;
    }

    // 4. Fallback: Check if name or description contains the category keyword itself
    const textToCheck = `${s.name} ${s.description}`.toLowerCase();
    const isPrimaryKeywordMatch = targetKeywords.some((k) => textToCheck.includes(k));

    return isPrimaryKeywordMatch;
  });
}
