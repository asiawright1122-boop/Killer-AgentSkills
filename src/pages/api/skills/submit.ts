import type { APIRoute } from 'astro';
import { getSkillsFromKV, type Env } from '../../../lib/kv';
import type { UnifiedSkill } from '../../../lib/skills';
import { GITHUB_API_BASE, COMMON_BRANCHES, getGitHubHeaders, getSkillMdPaths } from '../../../lib/github';

export const prerender = false;

/**
 * Parse a repository URL into owner and repo.
 * Supports multiple formats:
 *   - https://github.com/owner/repo
 *   - github.com/owner/repo
 *   - owner/repo
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\/$/, '');

  const patterns = [
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/,
    /^github\.com\/([^\/]+)\/([^\/]+)/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}

/**
 * Fetch repository info from GitHub API.
 */
async function getRepository(
  owner: string,
  repo: string
): Promise<Record<string, any> | null> {
  try {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
    const response = await fetch(url, { headers: getGitHubHeaders() });

    if (!response.ok) return null;

    const data = (await response.json()) as any;
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
async function getSkillMd(owner: string, repo: string): Promise<string | null> {
  const commonPaths = getSkillMdPaths(repo);

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
 * POST /api/skills/submit
 *
 * Accept a new skill submission.
 * Body: { repoUrl: string }
 *
 * Validates the repository exists and contains a SKILL.md file,
 * checks for duplicates in KV, and stores the submission in KV.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json()) as { repoUrl?: string };
    const { repoUrl } = body;

    if (!repoUrl) {
      return new Response(
        JSON.stringify({ error: 'Please provide a repository URL' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse repository URL
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return new Response(
        JSON.stringify({
          error:
            'Invalid repository URL format. Supported: owner/repo or https://github.com/owner/repo',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { owner, repo } = parsed;

    // Validate repository exists
    const repoInfo = await getRepository(owner, repo);
    if (!repoInfo) {
      return new Response(
        JSON.stringify({
          error: `Repository ${owner}/${repo} does not exist or is not accessible`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch SKILL.md
    const skillMdContent = await getSkillMd(owner, repo);
    if (!skillMdContent) {
      return new Response(
        JSON.stringify({
          error: `Repository ${owner}/${repo} does not have a SKILL.md file`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const parsedSkill = parseSkillMd(skillMdContent);

    // Check for duplicates in KV
    const env = (locals as any).runtime?.env as Env | undefined;
    if (env) {
      const allSkills = await getSkillsFromKV(env);
      const repoPath = `${owner}/${repo}`.toLowerCase();
      const exists = (allSkills as UnifiedSkill[]).some(
        (s) => `${s.owner}/${s.repo}`.toLowerCase() === repoPath
      );

      if (exists) {
        return new Response(
          JSON.stringify({ error: 'This skill already exists', skill: repoInfo }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Store submission in KV for later review
      try {
        const submissionKey = `submission:${owner}/${repo}`;
        const submission = {
          repoPath: `${owner}/${repo}`,
          addedAt: new Date().toISOString(),
          featured: false,
          repoInfo,
          frontmatter: {
            name: parsedSkill.name,
            description: parsedSkill.description,
            version: parsedSkill.version,
            author: parsedSkill.author,
            tags: parsedSkill.tags,
          },
        };
        await env.SKILLS_CACHE.put(submissionKey, JSON.stringify(submission), {
          expirationTtl: 31536000, // 1 year
        });
      } catch (e) {
        console.error('Failed to store submission in KV:', e);
        // Don't fail the request if KV write fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Skill submitted successfully!',
        skill: {
          ...repoInfo,
          frontmatter: {
            name: parsedSkill.name,
            description: parsedSkill.description,
            version: parsedSkill.version,
            author: parsedSkill.author,
            tags: parsedSkill.tags,
          },
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error submitting skill:', error);
    return new Response(
      JSON.stringify({ error: 'Submission failed, please try again later' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * GET /api/skills/submit
 *
 * Validate a skill URL (preview, does not add).
 * Query parameters:
 *   url - Repository URL to validate
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const repoUrl = url.searchParams.get('url');

  if (!repoUrl) {
    return new Response(
      JSON.stringify({ error: 'Please provide a repository URL' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return new Response(
      JSON.stringify({ error: 'Invalid repository URL format' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { owner, repo } = parsed;

  // Validate repository exists
  const repoInfo = await getRepository(owner, repo);
  if (!repoInfo) {
    return new Response(
      JSON.stringify({ error: `Repository ${owner}/${repo} does not exist` }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Fetch SKILL.md
  const skillMdContent = await getSkillMd(owner, repo);
  if (!skillMdContent) {
    return new Response(
      JSON.stringify({
        error: 'This repository does not have a SKILL.md file',
        hasSkillMd: false,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const parsedSkill = parseSkillMd(skillMdContent);

  return new Response(
    JSON.stringify({
      valid: true,
      hasSkillMd: true,
      skill: {
        ...repoInfo,
        frontmatter: {
          name: parsedSkill.name,
          description: parsedSkill.description,
          version: parsedSkill.version,
          author: parsedSkill.author,
          tags: parsedSkill.tags,
        },
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
