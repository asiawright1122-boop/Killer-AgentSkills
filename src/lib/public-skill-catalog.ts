import type { Env } from './kv';
import { getSkillsKV } from './kv';
import {
  getAllSkills,
  getFeaturedSkills,
  getFeaturedSkillsDirect,
  getLightweightSkills,
  getLightweightSkillsByRefs,
  getLightweightSkillsCategorySummary,
  getLightweightSkillsPage,
  getLightweightSkillsTop,
  getLocalizedDescription,
  getOfficialSkillCounts,
  getRelatedSkills,
  getSkillById,
  getSkillByOwnerRepo,
  getTotalSkillsCount,
  isPublicSkill,
  type UnifiedSkill,
} from './skills';
import { sanitizePublicAIOutput } from './public-ai-output';

export type { UnifiedSkill };

export {
  getAllSkills,
  getFeaturedSkills,
  getFeaturedSkillsDirect,
  getLightweightSkills,
  getLightweightSkillsByRefs,
  getLightweightSkillsCategorySummary,
  getLightweightSkillsPage,
  getLightweightSkillsTop,
  getLocalizedDescription,
  getOfficialSkillCounts,
  getRelatedSkills,
  getSkillById,
  getSkillByOwnerRepo,
  getTotalSkillsCount,
  isPublicSkill,
};

export interface PublicSkillRepoMetadata {
  filePath?: string;
  defaultBranch?: string;
}

const SAFE_GITHUB_REF_PATTERN = /^[A-Za-z0-9._/-]{1,120}$/;

function publicString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const sanitized = sanitizePublicAIOutput(value).trim();
  return sanitized.length > 0 ? sanitized : undefined;
}

function safePublicPath(value: unknown): string | undefined {
  const sanitized = publicString(value);
  if (!sanitized || sanitized.includes('..')) return undefined;
  return sanitized;
}

function safeGithubRef(value: unknown): string | undefined {
  const sanitized = publicString(value);
  if (!sanitized || sanitized.includes('..') || !SAFE_GITHUB_REF_PATTERN.test(sanitized)) return undefined;
  return sanitized;
}

function toPublicRepoMetadata(source: unknown): PublicSkillRepoMetadata | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const metadata: PublicSkillRepoMetadata = {
    ...(safePublicPath(record.filePath) && { filePath: safePublicPath(record.filePath) }),
    ...(safeGithubRef(record.defaultBranch) && { defaultBranch: safeGithubRef(record.defaultBranch) }),
  };
  return Object.keys(metadata).length > 0 ? metadata : null;
}

async function readSkillCacheRecord(env: Env, key: string): Promise<Record<string, unknown> | null> {
  if (!env?.SKILLS_CACHE) return null;

  try {
    const value = await env.SKILLS_CACHE.get(key, 'json');
    if (!value) return null;
    if (typeof value === 'string') {
      return JSON.parse(value) as Record<string, unknown>;
    }
    return typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getPublicSkillById(env: Env, id: string): Promise<UnifiedSkill | null> {
  return getSkillById(env, id);
}

export async function getPublicSkillByOwnerRepo(env: Env, owner: string, repo: string): Promise<UnifiedSkill | null> {
  return getSkillByOwnerRepo(env, owner, repo);
}

export async function hasCatalogedSkillRepo(env: Env, owner: string, repo: string): Promise<boolean> {
  const repoPath = `${owner}/${repo}`;
  const direct = await getSkillsKV(env, `skill:${repoPath}`).catch(() => null);
  if (direct) return true;

  return Boolean(await readSkillCacheRecord(env, `skill:${repoPath}`));
}

export async function getPublicSkillRepoMetadata(
  env: Env,
  owner: string,
  repo: string,
): Promise<PublicSkillRepoMetadata | null> {
  const publicSkill = await getPublicSkillByOwnerRepo(env, owner, repo);
  const publicMetadata = toPublicRepoMetadata(publicSkill);
  if (publicMetadata) return publicMetadata;

  const legacyMetadata = await readSkillCacheRecord(env, `meta:${owner}/${repo}`);
  return toPublicRepoMetadata(legacyMetadata);
}
