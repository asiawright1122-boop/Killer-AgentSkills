/**
 * Shared GitHub API utilities.
 * Centralizes constants and helpers used across submit.ts, files.ts, etc.
 */

export const GITHUB_API_BASE = 'https://api.github.com';

export const COMMON_BRANCHES = ['main', 'master', 'canary', 'develop'];

/**
 * Common SKILL.md search paths for skill discovery.
 * @param repo - Repository name (used for repo-specific sub-skill paths)
 */
export function getSkillMdPaths(repo: string): string[] {
  return [
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
}

/** Typed subset of GitHub REST API /repos/:owner/:repo response */
export interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  html_url: string;
  topics?: string[];
  owner: {
    login: string;
    avatar_url: string;
  };
}

/** Normalized repository info returned by getRepository */
export interface RepoInfo {
  name: string;
  repoPath: string;
  description: string;
  stars: number;
  forks: number;
  updatedAt: string;
  owner: string;
  ownerAvatar: string;
  topics: string[];
  htmlUrl: string;
}

/**
 * Fetch repository info from GitHub API and normalize it.
 * Shared across submit.ts and skill detail endpoints.
 */
export async function getRepository(owner: string, repo: string): Promise<RepoInfo | null> {
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

export function getGitHubHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Killer-Skills-App',
  };
}
