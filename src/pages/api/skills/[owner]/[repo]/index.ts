import type { APIRoute } from 'astro';
import { getSkillByOwnerRepo } from '../../../../../lib/skills';
import { type Env } from '../../../../../lib/kv';
import { validationError, notFoundError, errorResponse } from '../../../../../lib/api-utils';
import { COMMON_BRANCHES, getRepository, type RepoInfo } from '../../../../../lib/github';
import { parseSkillMd } from '../../../../../lib/skill-md-parser';

export const prerender = false;

/**
 * Fetch repository info with mock fallback for official manager skill.
 */
async function getRepositoryWithMock(owner: string, repo: string): Promise<RepoInfo | null> {
  // Mock for official manager skill
  if (owner === 'killer-skills' && (repo === 'manager' || repo === 'killer-skills-manager')) {
    return {
      name: 'manager',
      repoPath: 'killer-skills/manager',
      description: 'Manage AI Skills directly in your chat - List, Search, Install, and Uninstall skills.',
      stars: 1280,
      forks: 120,
      updatedAt: new Date().toISOString(),
      owner: 'killer-skills',
      ownerAvatar: 'https://avatars.githubusercontent.com/u/159670166?v=4',
      topics: ['agent', 'skills', 'manager', 'cli', 'mcp'],
      htmlUrl: 'https://github.com/killer-skills/manager',
    };
  }

  return getRepository(owner, repo);
}

/**
 * Fetch SKILL.md content from GitHub raw content.
 * Tries common branches and paths.
 */
async function getSkillMd(owner: string, repo: string, path?: string): Promise<string | null> {
  const commonPaths = path
    ? [path]
    : [
        'SKILL.md',
        '.codex/skills/SKILL.md',
        '.claude/skills/SKILL.md',
        '.agent/skills/SKILL.md',
        'skills/SKILL.md',
        `.agent/skills/${repo}/SKILL.md`,
        `skills/${repo}/SKILL.md`,
        `.codex/skills/${repo}/SKILL.md`,
        `.claude/skills/${repo}/SKILL.md`,
      ];

  for (const branch of COMMON_BRANCHES) {
    for (const tryPath of commonPaths) {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${tryPath}`;
        const response = await fetch(url);
        if (response.ok) {
          return await response.text();
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * GET /api/skills/[owner]/[repo]
 * Returns skill details including repo info and parsed SKILL.md.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const { owner, repo } = params;

  if (!owner || !repo) {
    return validationError('Missing owner or repo parameter');
  }

  const url = new URL(request.url);
  const skillPath = url.searchParams.get('path');
  const skillMdPath = skillPath ? `${skillPath}/SKILL.md` : undefined;

  // Sanitize inputs to prevent path traversal and injection
  const safePattern = /^[a-zA-Z0-9\-_.]+$/;
  if (!safePattern.test(owner) || !safePattern.test(repo)) {
    return validationError('Invalid owner or repo format');
  }

  if (skillPath && (skillPath.includes('..') || skillPath.includes('%2e') || skillPath.includes('%2E'))) {
    return validationError('Invalid skill path');
  }

  try {
    const env = locals.runtime?.env as Env | undefined;

    // 1. Try to get skill from KV cache first
    let kvSkill = null;
    if (env) {
      kvSkill = await getSkillByOwnerRepo(env, owner, repo);
    }

    // 2. Fetch repo info and SKILL.md from GitHub in parallel
    const [repoInfo, skillMdContent] = await Promise.all([
      getRepositoryWithMock(owner, repo),
      getSkillMd(owner, repo, skillMdPath),
    ]);

    if (!repoInfo && !kvSkill) {
      return notFoundError('Repository not found');
    }

    const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : null;

    // 3. Build response merging KV data and GitHub data
    const responseData = {
      ...(repoInfo || {}),
      ...(kvSkill || {}),
      name: skillPath ? skillPath.split('/').pop() || (repoInfo?.name ?? repo) : (repoInfo?.name ?? repo),
      skillPath: skillPath || null,
      skillMd: skillMd
        ? {
            name: skillMd.name || (skillPath ? skillPath.split('/').pop() : (repoInfo?.name ?? repo)),
            description: skillMd.description || repoInfo?.description || '',
            version: skillMd.version || '1.0.0',
            author: skillMd.author || owner,
            tags: skillMd.tags || repoInfo?.topics || [],
            body: skillMd.body,
          }
        : null,
      rawSkillMd: skillMdContent,
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Skill detail API error:', error);
    return errorResponse(error);
  }
};
