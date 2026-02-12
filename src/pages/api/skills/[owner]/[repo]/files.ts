import type { APIRoute } from 'astro';
import type { Env } from '../../../../../lib/kv';
import { GITHUB_API_BASE, COMMON_BRANCHES, getGitHubHeaders, getSkillMdPaths } from '../../../../../lib/github';

export const prerender = false;

interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'dir';
}

/**
 * Detect the default branch and SKILL.md path for a repository.
 * Tries common branches and skill directory patterns.
 */
async function detectRepoMetadata(
  owner: string,
  repo: string
): Promise<{ defaultBranch: string; skillMdPath: string | null } | null> {
  const commonPaths = getSkillMdPaths(repo);

  for (const branch of COMMON_BRANCHES) {
    const results = await Promise.all(
      commonPaths.map(async (path) => {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            return { branch, path };
          }
        } catch {
          // ignore
        }
        return null;
      })
    );

    const found = results.find((r) => r !== null);
    if (found) {
      return {
        defaultBranch: found.branch,
        skillMdPath: found.path,
      };
    }
  }

  // Fallback: use GitHub API to get default branch
  try {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
    const response = await fetch(url, { headers: getGitHubHeaders() });
    if (response.ok) {
      const data = (await response.json()) as { default_branch?: string };
      return {
        defaultBranch: data.default_branch || 'main',
        skillMdPath: null,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Find the skill directory by looking up featured-skills data or probing the repo.
 */
async function findSkillDirectory(
  owner: string,
  repo: string,
  env?: Env
): Promise<string | null> {
  // 1. Try to find from KV featured-skills data
  if (env?.SKILLS_CACHE) {
    try {
      const allSkills = await env.SKILLS_CACHE.get('all-skills', 'json') as any[] | null;
      if (allSkills) {
        const targetRepo = `${owner}/${repo}`.toLowerCase();
        const found = allSkills.find(
          (s: any) =>
            `${s.owner}/${s.repo}`.toLowerCase() === targetRepo && s.filePath
        );
        if (found?.filePath) {
          // filePath might point to SKILL.md, extract directory
          if (found.filePath.endsWith('SKILL.md')) {
            const lastSlash = found.filePath.lastIndexOf('/');
            return lastSlash > 0 ? found.filePath.substring(0, lastSlash) : '';
          }
          return found.filePath;
        }
      }
    } catch (e) {
      console.warn('Failed to lookup skills from KV:', e);
    }
  }

  // 2. Probe the repo for SKILL.md location
  const metadata = await detectRepoMetadata(owner, repo);
  if (metadata?.skillMdPath) {
    const lastSlash = metadata.skillMdPath.lastIndexOf('/');
    return lastSlash > 0 ? metadata.skillMdPath.substring(0, lastSlash) : '';
  }

  return null;
}

/**
 * Get directory contents from GitHub API, filtered to relevant file types.
 */
async function getDirectoryContents(
  owner: string,
  repo: string,
  path: string
): Promise<FileInfo[]> {
  const url = path
    ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`
    : `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents`;

  try {
    const response = await fetch(url, { headers: getGitHubHeaders() });

    if (!response.ok) {
      console.error(`[Files API] GitHub API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as Array<{
      name: string;
      path: string;
      size?: number;
      type: string;
    }>;

    if (!Array.isArray(data)) {
      console.warn('[Files API] Unexpected response format: not an array');
      return [];
    }

    // Filter to relevant file types
    return data
      .filter((item) => {
        const name = item.name.toLowerCase();
        return (
          name.endsWith('.md') ||
          name.endsWith('.txt') ||
          name.endsWith('.json') ||
          name.endsWith('.yaml') ||
          name.endsWith('.yml') ||
          item.type === 'dir'
        );
      })
      .map(
        (item): FileInfo => ({
          name: item.name,
          path: item.path,
          size: item.size || 0,
          type: (item.type === 'dir' ? 'dir' : 'file') as 'file' | 'dir',
        })
      )
      .sort((a, b) => {
        // SKILL.md last
        if (a.name === 'SKILL.md') return 1;
        if (b.name === 'SKILL.md') return -1;
        // Directories first
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error('Error fetching directory contents:', error);
    return [];
  }
}

/**
 * GET /api/skills/[owner]/[repo]/files
 * Returns the file list for a skill repository.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const { owner, repo } = params;

  if (!owner || !repo) {
    return new Response(JSON.stringify({ error: 'Missing owner or repo parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const specifiedPath = url.searchParams.get('path');

  try {
    const env = (locals as any).runtime?.env as Env | undefined;

    let skillDir: string | null;

    if (specifiedPath) {
      // Use the specified path directly
      skillDir = specifiedPath;
    } else {
      // Auto-detect skill directory
      skillDir = await findSkillDirectory(owner, repo, env);
    }

    if (skillDir === null) {
      return new Response(
        JSON.stringify({ error: 'Unable to find skill directory', files: [] }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const files = await getDirectoryContents(owner, repo, skillDir);

    return new Response(
      JSON.stringify({
        directory: skillDir || '/',
        files,
        total: files.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Files API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch file list', files: [] }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
