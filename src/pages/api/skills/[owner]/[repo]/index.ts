import type { APIRoute } from 'astro';
import { getSkillByOwnerRepo } from '../../../../../lib/skills';
import { type Env } from '../../../../../lib/kv';
import { validationError, notFoundError, errorResponse } from '../../../../../lib/api-utils';
import { GITHUB_API_BASE, COMMON_BRANCHES, getGitHubHeaders, type GitHubRepoResponse } from '../../../../../lib/github';

export const prerender = false;

/**
 * Fetch repository info from GitHub API.
 */
async function getRepository(owner: string, repo: string): Promise<Record<string, any> | null> {
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

  try {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
    const response = await fetch(url, { headers: getGitHubHeaders() });

    if (!response.ok) return null;

    const data = (await response.json()) as GitHubRepoResponse;
    return {
      name: data.name,
      repoPath: data.full_name,
      description: data.description || '',
      stars: data.stargazers_count,
      forks: data.forks_count,
      updatedAt: data.updated_at,
      owner: data.owner.login,
      ownerAvatar: data.owner.avatar_url,
      topics: data.topics || [],
      htmlUrl: data.html_url,
    };
  } catch (error) {
    console.error('Error fetching repository:', error);
    return null;
  }
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
 * Parse SKILL.md frontmatter.
 */
function parseSkillMd(content: string): {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  body: string;
} {
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = normalizedContent.match(frontmatterRegex);

  if (!match) {
    return { body: normalizedContent };
  }

  const [, frontmatter, body] = match;
  const result: Record<string, unknown> = { body };

  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1);
        result[key] = value.split(',').map((s) => s.trim().replace(/['"]/g, ''));
      } else {
        result[key] = value.replace(/['"]/g, '');
      }
    }
  }

  return result as {
    name?: string;
    description?: string;
    version?: string;
    author?: string;
    tags?: string[];
    body: string;
  };
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
      getRepository(owner, repo),
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
