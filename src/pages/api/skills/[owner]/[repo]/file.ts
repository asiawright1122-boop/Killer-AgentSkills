import type { APIRoute } from 'astro';
import type { Env } from '../../../../../lib/kv';

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
  preferredBranch?: string
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
    return new Response(JSON.stringify({ error: 'Missing owner or repo parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return new Response(
      JSON.stringify({ error: 'Missing file path parameter. Use ?path=<filePath>' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Access env via context.locals.runtime.env (Cloudflare Workers runtime)
    const env = (locals as any).runtime?.env as Env | undefined;

    // Try to detect the preferred branch from KV metadata if available
    let preferredBranch: string | undefined;
    if (env?.SKILLS_CACHE) {
      try {
        const meta = await env.SKILLS_CACHE.get(`meta:${owner}/${repo}`, 'json') as {
          defaultBranch?: string;
        } | null;
        if (meta?.defaultBranch) {
          preferredBranch = meta.defaultBranch;
        }
      } catch {
        // ignore KV errors, will try all branches
      }
    }

    const content = await fetchFileContent(owner, repo, filePath, preferredBranch);

    if (content === null) {
      return new Response(
        JSON.stringify({ error: `File not found: ${filePath}` }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
      }
    );
  } catch (error) {
    console.error('File content API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch file content' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
