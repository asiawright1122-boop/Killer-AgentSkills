/**
 * Shared Validation & Scoring Logic
 *
 * This module provides pure functions for validating and scoring Agent Skills.
 * It is designed to be dependency-free (no fs, fetch, etc.) so it can run in:
 * - VPS Node.js scripts (build-skills-cache.ts)
 * - Cloudflare Workers (content-workflow.ts)
 * - Next.js Server/Client (github/api.ts)
 */

// ============ Constants ============

/**
 * Official repository list — imported from single source of truth.
 * Re-exported for backward compatibility.
 */
import { OFFICIAL_REPOS, isOfficialRepo } from './official-repos';
export { OFFICIAL_REPOS, isOfficialRepo };

/**
 * Keywords that indicate the document is probably NOT a real Agent Skill.
 */
export const EXCLUDE_KEYWORDS = [
  'interview',
  'notes',
  'blog',
  'resume',
  'portfolio',
  'leetcode',
  'algorithm interview',
  'algorithm questions',
  'algorithm practice',
  'tutorial',
  'course',
  'book',
  'learning',
  'study',
  'guide',
  'product manager',
  'product management',
  'mvp builder',
  'mvp-generator',
  'startup',
  'studiojinsei',
  'cheatsheet',
  'cheat sheet',
  'awesome list',
  'dotfiles',
  'my dotfiles',
  'personal config',
];

/**
 * Positive theme keywords — at least one must appear in body or description/topics
 * for a non-official skill to be indexed. Prevents generic programming docs from
 * polluting the AI Agent Skill index.
 */
export const POSITIVE_THEME_KEYWORDS = [
  // Core AI agent platforms
  'claude',
  'cursor',
  'windsurf',
  'copilot',
  'gemini',
  'kiro',
  // Protocol & tooling
  'mcp',
  'model context protocol',
  'skill.md',
  '.claude',
  '.cursor',
  '.windsurf',
  '.codex',
  // Agent / LLM ecosystem
  'ai agent',
  'agent skill',
  'llm',
  'large language model',
  'agentic',
  'prompt',
  // Coding assistant context
  'coding assistant',
  'ai coding',
  'ai-powered',
  'ai assistant',
  // Automation in agent context
  'workflow automation',
  'ai workflow',
  'agent workflow',
];

const NON_TARGET_THEME_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(interview|mock\s*interview|interview\s*prep|interview\s*questions?)\b/i, reason: 'interview' },
  { pattern: /\b(resume|portfolio|leetcode)\b/i, reason: 'career-prep' },
  {
    pattern: /\b(product\s*manager|product\s*managers|product\s*management|pm-os|prd-writer|jobs-to-be-done)\b/i,
    reason: 'product-management',
  },
  {
    pattern: /\b(mvp\s*builder|mvp-builder|mvp\s*generator|minimum\s*viable\s+product|startup\s*pitch)\b/i,
    reason: 'mvp-startup',
  },
];

/**
 * Suspicious names that indicate test/placeholder content.
 */
export const SUSPICIOUS_NAMES = ['test', 'demo', 'example', 'hello-world', 'todo', 'temp', 'dummy'];

/**
 * Strong structural headers that indicate a well-formed Agent Skill.
 */
export const SKILL_HEADERS = [
  '# usage',
  '## usage',
  '### usage',
  '# input',
  '## input',
  '### input',
  '# parameters',
  '## parameters',
  '### parameters',
  '# arguments',
  '## arguments',
  '### arguments',
  '# output',
  '## output',
  '### output',
  '# actions',
  '## actions',
  '### actions',
  '# instructions',
  '## instructions',
  '### instructions',
  '# api',
  '## api',
  '# examples',
  '## examples',
  '### examples',
  '# guidelines',
  '## guidelines',
  '### guidelines',
  '# common commands',
  '## common commands',
  '### common commands',
  '# when to use',
  '## when to use',
  '### when to use',
];

/**
 * Functional keywords that support the structural signal.
 */
export const FUNCTIONAL_KEYWORDS = [
  'action',
  'input',
  'output',
  'trigger',
  'api',
  'tool',
  'schema',
  'guideline',
  'instruction',
  'command',
];

// ============ Interfaces ============

/**
 * Minimal skill data required for validation.
 */
export interface SkillValidationInput {
  name: string;
  owner: string;
  repo?: string; // Optional for validation, required for full scoring
  body: string;
  description?: string;
  topics?: string[];
  category?: string;
  filePath?: string;
}

/**
 * Extended skill data required for quality scoring.
 */
export interface SkillScoringInput extends SkillValidationInput {
  repo: string;
  repoPath?: string;
  stars?: number;
  updatedAt?: string;
  version?: string;
  tags?: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
}

function toValidationText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => toValidationText(item)).join(' ');
  if (typeof value === 'object')
    return Object.values(value as Record<string, unknown>)
      .map((item) => toValidationText(item))
      .join(' ');
  return String(value);
}

export function getNonTargetSkillReason(skill: SkillValidationInput): string {
  const repo = (skill as SkillScoringInput).repo || '';
  const combinedText = [
    skill.name,
    skill.owner,
    repo,
    skill.description || '',
    ...(skill.topics || []),
    skill.category || '',
    skill.filePath || '',
    skill.body,
  ]
    .map((value) => toValidationText(value))
    .join(' ')
    .toLowerCase();

  for (const entry of NON_TARGET_THEME_PATTERNS) {
    if (entry.pattern.test(combinedText)) return entry.reason;
  }

  return '';
}

// ============ Validation Functions ============

/**
 * Validates whether a skill document represents a real Agent Skill.
 * Returns { valid: true } if the skill passes all checks.
 */
export function isValidAgentSkill(skill: SkillValidationInput): ValidationResult {
  const { name, owner, body, description = '', topics = [] } = skill;
  const repo = (skill as SkillScoringInput).repo;
  const isOfficial = isOfficialRepo(owner, repo);

  const nonTargetReason = getNonTargetSkillReason(skill);
  if (!isOfficial && nonTargetReason) {
    return { valid: false, reason: `Non-target skill theme: ${nonTargetReason}` };
  }

  // 1. Check exclude keywords in description/topics
  const combinedText = [description, ...topics].join(' ').toLowerCase();
  for (const kw of EXCLUDE_KEYWORDS) {
    if (combinedText.includes(kw)) {
      return { valid: false, reason: `Matches exclusion keyword: ${kw}` };
    }
  }

  // 2. Must have a name
  if (!name || name.trim() === '') {
    return { valid: false, reason: 'Missing name field' };
  }

  // 3. Check suspicious names (non-official only)
  const nameLower = name.toLowerCase();
  if (!isOfficial) {
    for (const sus of SUSPICIOUS_NAMES) {
      if (nameLower === sus || nameLower.includes(sus + '-')) {
        return { valid: false, reason: `Suspicious name: ${name}` };
      }
    }
  }

  // 4. Structural analysis
  const bodyLower = body.toLowerCase();

  // Check for strong headers
  const hasHeader = SKILL_HEADERS.some((h) => bodyLower.includes(h));

  // Check for functional keywords
  let foundKeywords = 0;
  for (const k of FUNCTIONAL_KEYWORDS) {
    if (bodyLower.includes(k)) foundKeywords++;
  }

  // 5. Strict check (non-official only)
  if (!isOfficial) {
    if (!hasHeader && foundKeywords < 2) {
      return { valid: false, reason: 'Missing standard structure (e.g., ## Usage, ## Input) or functional keywords' };
    }
    if (bodyLower.length < 50) {
      return { valid: false, reason: 'Content too short' };
    }

    // 6. Positive theme gate: body or description/topics must reference AI agent ecosystem.
    // Prevents generic programming docs from passing structural checks and polluting the index.
    const fullText = [bodyLower, combinedText].join(' ');
    const hasPositiveTheme = POSITIVE_THEME_KEYWORDS.some((kw) => fullText.includes(kw));
    if (!hasPositiveTheme) {
      return {
        valid: false,
        reason: 'No AI agent ecosystem context found (missing: claude, cursor, windsurf, mcp, llm, agent skill, etc.)',
      };
    }
  }

  return {
    valid: true,
    reason: hasHeader ? 'Valid Agent Skill' : 'Passed structural validation',
  };
}

// ============ Scoring Functions ============

/**
 * Calculates a quality score (0-100) for a skill.
 * Higher scores indicate higher quality Agent Skills.
 *
 * Scoring breakdown:
 * - Structural headers: up to 25 points
 * - Functional keywords: up to 20 points
 * - Code blocks/schema: up to 15 points
 * - Standard path: 20 points
 * - Metadata completeness: up to 25 points
 * - Activity & reputation: up to 30 points (official) or 20 points (community)
 */
export function calculateQualityScore(skill: SkillScoringInput): number {
  let score = 0;
  const isOfficial = isOfficialRepo(skill.owner, skill.repo);

  // 1. Critical Errors (Automatic 0)
  if (!skill.name) return 0;
  if (!isOfficial && getNonTargetSkillReason(skill)) return 0;

  // Check for suspicious names
  const nameLower = skill.name.toLowerCase();
  if (!isOfficial && SUSPICIOUS_NAMES.some((k) => nameLower === k || nameLower.includes(k + '-'))) {
    return 0;
  }

  // 2. Structural Analysis
  const bodyLower = skill.body.toLowerCase();

  // A. Headers Check
  let headerScore = 0;
  for (const h of SKILL_HEADERS) {
    if (bodyLower.includes(h)) {
      headerScore = 25;
      break;
    }
  }
  score += headerScore;

  // B. Keyword Check
  let foundKeywords = 0;
  for (const k of FUNCTIONAL_KEYWORDS) {
    if (bodyLower.includes(k)) foundKeywords++;
  }
  const keywordScore = Math.min(20, foundKeywords * 5);
  score += keywordScore;

  // C. Code Block / Schema Check
  if (skill.body.includes('```')) score += 10;
  if (bodyLower.includes('json') || bodyLower.includes('yaml')) score += 5;

  // CRITICAL FILTER (non-official)
  if (!isOfficial) {
    if (headerScore === 0 && foundKeywords < 2) return 0;
    if (bodyLower.length < 50) return 0;
  }

  // 3. Path Bonus
  const standardPaths = ['.codex/', '.claude/', '.agent/', 'skills/'];
  if (skill.repoPath && standardPaths.some((p) => skill.repoPath!.includes(p))) {
    score += 20;
  }

  // 4. Metadata Completeness
  if (skill.name) score += 5;
  if (skill.version) score += 5;
  if (skill.tags && skill.tags.length > 0) score += 5;

  const desc = skill.description || '';
  if (desc.length > 50) score += 10;

  // 5. Activity & Reputation
  if (isOfficial) {
    score += 30;
  } else {
    if (skill.updatedAt) {
      const daysSinceUpdate = Math.floor((Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate < 180) score += 5;
    }

    if (skill.stars && skill.stars > 50) score += 15;
    else if (skill.stars && skill.stars > 10) score += 10;
  }

  return Math.min(100, score);
}
