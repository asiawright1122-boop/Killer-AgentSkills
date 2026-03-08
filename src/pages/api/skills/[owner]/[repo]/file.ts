import type { APIRoute } from 'astro';
import type { Env } from '../../../../../lib/kv';
import { validationError, notFoundError, errorResponse } from '../../../../../lib/api-utils';

export const prerender = false;

const COMMON_BRANCHES = ['main', 'master', 'canary', 'develop'];

/**
 * Fetch file raw content from GitHub.
 * Tries common branches in order, preferring the detected default branch.
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  preferredBranch?: string,
): Promise<string | null> {
  const branchesToTry = preferredBranch
    ? [preferredBranch, ...COMMON_BRANCHES.filter((b) => b !== preferredBranch)]
    : COMMON_BRANCHES;

  for (const branch of branchesToTry) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Determine file type from filename extension.
 */
function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';

  const typeMap: Record<string, string> = {
    md: 'markdown',
    txt: 'text',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'shell',
  };

  return typeMap[ext] || 'text';
}

/**
 * GET /api/skills/[owner]/[repo]/file?path=<filePath>
 * Returns the content of a specific file from the repository.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const { owner, repo } = params;

  if (!owner || !repo) {
    return validationError('Missing owner or repo parameter');
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return validationError('Missing file path parameter. Use ?path=<filePath>');
  }

  // Sanitize inputs to prevent path traversal and injection
  const safePattern = /^[a-zA-Z0-9\-_.]+$/;
  if (!safePattern.test(owner) || !safePattern.test(repo)) {
    return validationError('Invalid owner or repo format');
  }

  // Block path traversal attempts (../, encoded variants)
  if (filePath.includes('..') || filePath.includes('%2e') || filePath.includes('%2E')) {
    return validationError('Invalid file path');
  }

  try {
    // Access env via context.locals.runtime.env (Cloudflare Workers runtime)
    const env = locals.runtime?.env as Env | undefined;

    // Try to detect the preferred branch from D1 skill data if available
    let preferredBranch: string | undefined;
    if (env?.DB) {
      try {
        const { getSkillsKV } = await import('../../../../../lib/kv');
        const skill = await getSkillsKV(env, `${owner}/${repo}`);
        if (skill?.defaultBranch) {
          preferredBranch = skill.defaultBranch;
        }
      } catch {
        // ignore DB errors, will try all branches
      }
    }

    const content = await fetchFileContent(owner, repo, filePath, preferredBranch);

    if (content === null) {
      return notFoundError(`File not found: ${filePath}`);
    }

    const filename = filePath.split('/').pop() || filePath;
    const fileType = getFileType(filename);

    return new Response(
      JSON.stringify({
        path: filePath,
        name: filename,
        type: fileType,
        content,
        size: content.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('File content API error:', error);
    return errorResponse(error);
  }
};
