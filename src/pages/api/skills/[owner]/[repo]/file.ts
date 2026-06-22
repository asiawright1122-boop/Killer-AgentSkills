import type { APIRoute } from 'astro';
import type { Env } from '../../../../../lib/kv';
import { validationError, notFoundError, errorResponse, jsonResponse } from '../../../../../lib/api-utils';
import { COMMON_BRANCHES } from '../../../../../lib/github';
import { withPublicApiHeaders } from '../../../../../lib/public-skill-api';
import { sanitizePublicAIOutput } from '../../../../../lib/public-ai-output';
import { getPublicSkillRepoMetadata } from '../../../../../lib/public-skill-catalog';
import { getRuntimeEnv } from '../../../../../lib/runtime-env';

export const prerender = false;

const MAX_FILE_BYTES = 512 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set(['md', 'txt', 'json', 'yaml', 'yml', 'js', 'ts', 'py', 'sh']);

type FetchFileContentResult =
  | { status: 'found'; content: string }
  | { status: 'too_large'; maxBytes: number }
  | { status: 'not_found' };

function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}

function isAllowedFilePath(path: string): boolean {
  const filename = path.split('/').pop() || path;
  return ALLOWED_FILE_EXTENSIONS.has(getFileExtension(filename));
}

/**
 * Fetch file raw content from GitHub.
 * Tries common branches in order, preferring the detected default branch.
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  preferredBranch?: string,
): Promise<FetchFileContentResult> {
  const branchesToTry = preferredBranch
    ? [preferredBranch, ...COMMON_BRANCHES.filter((b) => b !== preferredBranch)]
    : COMMON_BRANCHES;

  for (const branch of branchesToTry) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const contentLength = Number(response.headers.get('content-length') || '0');
        if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
          return { status: 'too_large', maxBytes: MAX_FILE_BYTES };
        }

        const content = await response.text();
        if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) {
          return { status: 'too_large', maxBytes: MAX_FILE_BYTES };
        }

        return { status: 'found', content };
      }
    } catch {
      continue;
    }
  }

  return { status: 'not_found' };
}

/**
 * Determine file type from filename extension.
 */
function getFileType(filename: string): string {
  const ext = getFileExtension(filename);

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

  if (!isAllowedFilePath(filePath)) {
    return validationError('Unsupported file type');
  }

  try {
    const env = await getRuntimeEnv<Env>(locals);

    // Try to detect the preferred branch from D1 skill data if available
    let preferredBranch: string | undefined;
    if (env) {
      try {
        preferredBranch = (await getPublicSkillRepoMetadata(env, owner, repo))?.defaultBranch;
      } catch {
        // ignore DB errors, will try all branches
      }
    }

    const result = await fetchFileContent(owner, repo, filePath, preferredBranch);

    if (result.status === 'not_found') {
      return notFoundError(`File not found: ${filePath}`);
    }

    if (result.status === 'too_large') {
      return jsonResponse({ success: false, error: `File exceeds ${result.maxBytes} byte limit` }, 413);
    }

    const filename = filePath.split('/').pop() || filePath;
    const fileType = getFileType(filename);
    const publicContent = sanitizePublicAIOutput(result.content);

    return new Response(
      JSON.stringify({
        path: filePath,
        name: filename,
        type: fileType,
        content: publicContent,
        size: publicContent.length,
      }),
      {
        status: 200,
        headers: withPublicApiHeaders({ 'Content-Type': 'application/json' }),
      },
    );
  } catch (error) {
    console.error('File content API error:', error);
    return errorResponse(error);
  }
};
