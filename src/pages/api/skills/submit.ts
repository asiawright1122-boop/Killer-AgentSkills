import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { Env } from '../../../lib/kv';
import { COMMON_BRANCHES, getSkillMdPaths, getRepository } from '../../../lib/github';
import { fetchWithTimeout, jsonResponse } from '../../../lib/api-utils';
import {
  checkRateLimit,
  createRateLimiter,
  getClientIP,
  rateLimitResponse,
  type KVNamespaceLike,
} from '../../../lib/rate-limit';
import { parseSkillMd } from '../../../lib/skill-md-parser';
import { sanitizePublicSkillLikeRecord, withPublicApiHeaders } from '../../../lib/public-skill-api';
import { hasCatalogedSkillRepo } from '../../../lib/public-skill-catalog';
import { getRuntimeEnv } from '../../../lib/runtime-env';

export const prerender = false;

// Stricter limit for submissions (write operation). In-memory fallback;
// prod uses RATE_LIMIT_SUBMIT (wrangler.toml).
const submitLimiterFallback = createRateLimiter({ windowMs: 60_000, max: 5 });

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
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/,
    /^github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/,
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/,
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
 * Fetch SKILL.md content from GitHub raw content.
 * Tries common branches and paths.
 */
async function getSkillMd(owner: string, repo: string): Promise<string | null> {
  const commonPaths = getSkillMdPaths(repo);

  for (const branch of COMMON_BRANCHES) {
    for (const tryPath of commonPaths) {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${tryPath}`;
        const response = await fetchWithTimeout(url, {}, 8_000);
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
const SubmitBodySchema = z.object({
  repoUrl: z
    .string()
    .min(1)
    .max(500)
    .refine((value) => parseRepoUrl(value) !== null, {
      message: 'Invalid repository URL format',
    }),
});

function buildPublicSubmittedSkill(repoInfo: unknown, parsedSkill: ReturnType<typeof parseSkillMd>) {
  return sanitizePublicSkillLikeRecord({
    ...(repoInfo && typeof repoInfo === 'object' ? (repoInfo as Record<string, unknown>) : {}),
    frontmatter: {
      name: parsedSkill.name,
      description: parsedSkill.description,
      version: parsedSkill.version,
      author: parsedSkill.author,
      tags: parsedSkill.tags,
    },
  });
}

function publicJson(body: unknown, status = 200): Response {
  return jsonResponse(body, status, withPublicApiHeaders());
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
  const env = await getRuntimeEnv<Env>(locals);
  const clientIP = getClientIP(request);
  const kv = env?.SKILLS_CACHE as KVNamespaceLike | undefined;
  if (!(await checkRateLimit(kv, { bucket: 'submit', key: clientIP, max: 5, periodSec: 60 }, submitLimiterFallback))) {
    return rateLimitResponse();
  }

  let repoUrl: string;
  try {
    const raw = await request.json();
    const parsed = SubmitBodySchema.safeParse(raw);
    if (!parsed.success) {
      return publicJson(
        {
          error: 'Invalid request body: ' + parsed.error.issues.map((i) => i.message).join(', '),
        },
        400,
      );
    }
    repoUrl = parsed.data.repoUrl;
  } catch {
    return publicJson({ error: 'Invalid JSON in request body' }, 400);
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return publicJson(
      {
        error: 'Invalid repository URL format. Supported: owner/repo or https://github.com/owner/repo',
      },
      400,
    );
  }

  try {
    const { owner, repo } = parsed;

    // Validate repository exists
    const repoInfo = await getRepository(owner, repo);
    if (!repoInfo) {
      return publicJson(
        {
          error: `Repository ${owner}/${repo} does not exist or is not accessible`,
        },
        404,
      );
    }

    // Fetch SKILL.md
    const skillMdContent = await getSkillMd(owner, repo);
    if (!skillMdContent) {
      return publicJson(
        {
          error: `Repository ${owner}/${repo} does not have a SKILL.md file`,
        },
        400,
      );
    }

    const parsedSkill = parseSkillMd(skillMdContent);

    // Check for duplicates via targeted D1 query (O(1) instead of loading entire table)
    if (env) {
      const existing = await hasCatalogedSkillRepo(env, owner, repo);

      if (existing) {
        return publicJson({ error: 'This skill already exists', skill: sanitizePublicSkillLikeRecord(repoInfo) }, 409);
      }

      // Store submission in KV for later review
      try {
        const submissionKey = `submission:${owner}/${repo}`;
        const submission = {
          repoPath: `${owner}/${repo}`,
          addedAt: new Date().toISOString(),
          featured: false,
          repoInfo: sanitizePublicSkillLikeRecord(repoInfo),
          frontmatter: (buildPublicSubmittedSkill({}, parsedSkill) as { frontmatter: unknown }).frontmatter,
        };
        await env.SKILLS_CACHE.put(submissionKey, JSON.stringify(submission), {
          expirationTtl: 31536000, // 1 year
        });

        // Trigger AI Review Workflow in GitHub Actions
        const githubPat = env.GITHUB_PAT || env.GITHUB_TOKEN;
        if (githubPat) {
          const repoOwner = env.GITHUB_OWNER || 'asiawright1122-boop';
          const repoName = env.GITHUB_REPO || 'Killer-AgentSkills';
          try {
            await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`, {
              method: 'POST',
              headers: {
                Accept: 'application/vnd.github.v3+json',
                Authorization: `token ${githubPat}`,
                'User-Agent': 'Killer-Skills-Cloudflare-Worker',
              },
              body: JSON.stringify({
                event_type: 'skill-submission',
                client_payload: {
                  owner,
                  repo,
                },
              }),
            });
            console.log(`Dispatched GitHub workflow 'skill-submission' for ${owner}/${repo}`);
          } catch (dispatchError) {
            console.error('Failed to dispatch GitHub workflow:', dispatchError);
          }
        }
      } catch (e) {
        console.error('Failed to store submission in KV or dispatch event:', e);
        // Don't fail the request if background triggers fail
      }
    }

    return publicJson({
      success: true,
      message: 'Skill submitted successfully!',
      skill: buildPublicSubmittedSkill(repoInfo, parsedSkill),
    });
  } catch (error) {
    console.error('Error submitting skill:', error);
    return publicJson({ error: 'Submission failed, please try again later' }, 500);
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
    return publicJson({ error: 'Please provide a repository URL' }, 400);
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return publicJson({ error: 'Invalid repository URL format' }, 400);
  }

  const { owner, repo } = parsed;

  // Validate repository exists
  const repoInfo = await getRepository(owner, repo);
  if (!repoInfo) {
    return publicJson({ error: `Repository ${owner}/${repo} does not exist` }, 404);
  }

  // Fetch SKILL.md
  const skillMdContent = await getSkillMd(owner, repo);
  if (!skillMdContent) {
    return publicJson(
      {
        error: 'This repository does not have a SKILL.md file',
        hasSkillMd: false,
      },
      400,
    );
  }

  const parsedSkill = parseSkillMd(skillMdContent);

  return publicJson({
    valid: true,
    hasSkillMd: true,
    skill: buildPublicSubmittedSkill(repoInfo, parsedSkill),
  });
};
