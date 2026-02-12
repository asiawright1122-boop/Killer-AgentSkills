/**
 * Unit tests for Skills API routes:
 * - GET /api/skills/[owner]/[repo] (index.ts) — skill details
 * - GET /api/skills/[owner]/[repo]/files (files.ts) — file list
 * - GET /api/skills/[owner]/[repo]/file (file.ts) — file content
 *
 * These tests verify the API route handlers directly by calling the exported
 * GET functions with mock Astro APIContext objects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../../../../../lib/kv';

// ─── Mock helpers ───────────────────────────────────────────────────────────

function createMockKV(store: Map<string, any> = new Map()): KVNamespace {
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      if (type === 'json') return JSON.parse(value);
      return value;
    }),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    TRANSLATIONS: createMockKV(),
    SKILLS_CACHE: createMockKV(),
    AI: {},
    ASSETS: {} as Fetcher,
    ...overrides,
  };
}

/**
 * Build a minimal Astro APIContext-like object for testing route handlers.
 */
function createAPIContext(options: {
  params?: Record<string, string | undefined>;
  url?: string;
  env?: Env;
}) {
  const url = new URL(options.url || 'http://localhost/api/skills/test-owner/test-repo');
  return {
    params: options.params || {},
    request: new Request(url.toString()),
    url,
    locals: {
      runtime: {
        env: options.env || createMockEnv(),
      },
    },
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
    },
    redirect: vi.fn(),
  };
}

// ─── Tests for GET /api/skills/[owner]/[repo] (index.ts) ───────────────────

describe('GET /api/skills/[owner]/[repo] (index.ts)', () => {
  let GET: any;

  beforeEach(async () => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
    // Dynamic import to get fresh module
    const mod = await import('./index');
    GET = mod.GET;
  });

  it('should export prerender = false', async () => {
    const mod = await import('./index');
    expect(mod.prerender).toBe(false);
  });

  it('should return 400 when owner is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: undefined, repo: 'test-repo' },
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should return 400 when repo is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: undefined },
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should return skill details for killer-skills/manager (mock repo)', async () => {
    // The index.ts has a special mock for killer-skills/manager
    // We need to mock the SKILL.md fetch to return null so it doesn't hang
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      // Return 404 for all GitHub raw content requests (SKILL.md probing)
      if (urlStr.includes('raw.githubusercontent.com')) {
        return new Response('Not Found', { status: 404 });
      }
      // Return 404 for GitHub API requests
      if (urlStr.includes('api.github.com')) {
        return new Response('Not Found', { status: 404 });
      }
      return originalFetch(url as any);
    }) as any;

    const ctx = createAPIContext({
      params: { owner: 'killer-skills', repo: 'manager' },
      url: 'http://localhost/api/skills/killer-skills/manager',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.owner).toBe('killer-skills');
    expect(body.name).toBe('manager');

    globalThis.fetch = originalFetch;
  });

  it('should return 404 when repo is not found and no KV data', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    }) as any;

    const env = createMockEnv();
    const ctx = createAPIContext({
      params: { owner: 'nonexistent', repo: 'nonexistent' },
      url: 'http://localhost/api/skills/nonexistent/nonexistent',
      env,
    });

    const response = await GET(ctx);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it('should return JSON content type', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    }) as any;

    const ctx = createAPIContext({
      params: { owner: 'killer-skills', repo: 'manager' },
      url: 'http://localhost/api/skills/killer-skills/manager',
    });

    const response = await GET(ctx);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    globalThis.fetch = originalFetch;
  });

  it('should access KV via context.locals.runtime.env', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    }) as any;

    const skillData = {
      id: '1',
      name: 'Test Skill',
      owner: 'test-owner',
      repo: 'test-repo',
      description: 'A test skill',
      category: 'testing',
      stars: 100,
    };
    const store = new Map([
      ['skill:test-owner/test-repo', JSON.stringify(skillData)],
      ['all-skills', JSON.stringify([skillData])],
    ]);
    const env = createMockEnv({
      SKILLS_CACHE: createMockKV(store),
    });

    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo',
      env,
    });

    const response = await GET(ctx);
    expect(response.status).toBe(200);

    const body = await response.json();
    // KV skill data is merged into the response; the route overrides `name`
    // with repoInfo?.name ?? repo when no skillPath is provided.
    // Since repoInfo is null (fetch returns 404), it falls back to the repo param.
    expect(body.name).toBe('test-repo');
    expect(body.description).toBe('A test skill');
    expect(body.category).toBe('testing');
    expect(body.stars).toBe(100);

    // Verify KV was accessed
    expect(env.SKILLS_CACHE.get).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });
});

// ─── Tests for GET /api/skills/[owner]/[repo]/files (files.ts) ──────────────

describe('GET /api/skills/[owner]/[repo]/files (files.ts)', () => {
  let GET: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import('./files');
    GET = mod.GET;
  });

  it('should export prerender = false', async () => {
    const mod = await import('./files');
    expect(mod.prerender).toBe(false);
  });

  it('should return 400 when owner is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: undefined, repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/files',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should return 400 when repo is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: undefined },
      url: 'http://localhost/api/skills/test-owner/test-repo/files',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should use specified path query parameter', async () => {
    const originalFetch = globalThis.fetch;
    const mockFiles = [
      { name: 'SKILL.md', path: 'skills/SKILL.md', size: 1024, type: 'file' },
      { name: 'README.md', path: 'skills/README.md', size: 512, type: 'file' },
    ];

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('api.github.com/repos') && urlStr.includes('/contents/')) {
        return new Response(JSON.stringify(mockFiles), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/files?path=skills',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.directory).toBe('skills');
    expect(body.files).toBeDefined();
    expect(Array.isArray(body.files)).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it('should return 404 when skill directory cannot be found', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    }) as any;

    const env = createMockEnv();
    const ctx = createAPIContext({
      params: { owner: 'nonexistent', repo: 'nonexistent' },
      url: 'http://localhost/api/skills/nonexistent/nonexistent/files',
      env,
    });

    const response = await GET(ctx);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it('should return JSON content type', async () => {
    const ctx = createAPIContext({
      params: { owner: undefined, repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/files',
    });

    const response = await GET(ctx);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should look up skill directory from KV when path not specified', async () => {
    const originalFetch = globalThis.fetch;
    const mockFiles = [
      { name: 'SKILL.md', path: '.agent/skills/SKILL.md', size: 1024, type: 'file' },
    ];

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('api.github.com/repos') && urlStr.includes('/contents/')) {
        return new Response(JSON.stringify(mockFiles), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    const skills = [
      {
        id: '1',
        owner: 'test-owner',
        repo: 'test-repo',
        filePath: '.agent/skills/SKILL.md',
      },
    ];
    const store = new Map([['all-skills', JSON.stringify(skills)]]);
    const env = createMockEnv({
      SKILLS_CACHE: createMockKV(store),
    });

    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/files',
      env,
    });

    const response = await GET(ctx);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.directory).toBe('.agent/skills');

    // Verify KV was accessed
    expect(env.SKILLS_CACHE.get).toHaveBeenCalledWith('all-skills', 'json');

    globalThis.fetch = originalFetch;
  });
});

// ─── Tests for GET /api/skills/[owner]/[repo]/file (file.ts) ────────────────

describe('GET /api/skills/[owner]/[repo]/file (file.ts)', () => {
  let GET: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import('./file');
    GET = mod.GET;
  });

  it('should export prerender = false', async () => {
    const mod = await import('./file');
    expect(mod.prerender).toBe(false);
  });

  it('should return 400 when owner is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: undefined, repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/file?path=SKILL.md',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should return 400 when repo is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: undefined },
      url: 'http://localhost/api/skills/test-owner/test-repo/file?path=SKILL.md',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should return 400 when path query parameter is missing', async () => {
    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/file',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('path');
  });

  it('should return file content when file exists', async () => {
    const originalFetch = globalThis.fetch;
    const fileContent = '# SKILL.md\n\nThis is a test skill.';

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('raw.githubusercontent.com') && urlStr.includes('SKILL.md')) {
        return new Response(fileContent, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/file?path=SKILL.md',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe(fileContent);
    expect(body.path).toBe('SKILL.md');
    expect(body.name).toBe('SKILL.md');
    expect(body.type).toBe('markdown');
    expect(body.size).toBe(fileContent.length);

    globalThis.fetch = originalFetch;
  });

  it('should return 404 when file is not found on any branch', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404 });
    }) as any;

    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/file?path=nonexistent.md',
    });

    const response = await GET(ctx);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toContain('nonexistent.md');

    globalThis.fetch = originalFetch;
  });

  it('should detect file type correctly for different extensions', async () => {
    const originalFetch = globalThis.fetch;

    const testCases = [
      { path: 'README.md', expectedType: 'markdown' },
      { path: 'config.json', expectedType: 'json' },
      { path: 'config.yaml', expectedType: 'yaml' },
      { path: 'config.yml', expectedType: 'yaml' },
      { path: 'notes.txt', expectedType: 'text' },
    ];

    for (const { path, expectedType } of testCases) {
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        if (urlStr.includes('raw.githubusercontent.com')) {
          return new Response('content', { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      }) as any;

      const ctx = createAPIContext({
        params: { owner: 'test-owner', repo: 'test-repo' },
        url: `http://localhost/api/skills/test-owner/test-repo/file?path=${path}`,
      });

      const response = await GET(ctx);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.type).toBe(expectedType);
    }

    globalThis.fetch = originalFetch;
  });

  it('should return JSON content type', async () => {
    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/file',
    });

    const response = await GET(ctx);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should try to get preferred branch from KV metadata', async () => {
    const originalFetch = globalThis.fetch;
    const fileContent = 'test content';

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('raw.githubusercontent.com') && urlStr.includes('/develop/')) {
        return new Response(fileContent, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    const store = new Map([
      ['meta:test-owner/test-repo', JSON.stringify({ defaultBranch: 'develop' })],
    ]);
    const env = createMockEnv({
      SKILLS_CACHE: createMockKV(store),
    });

    const ctx = createAPIContext({
      params: { owner: 'test-owner', repo: 'test-repo' },
      url: 'http://localhost/api/skills/test-owner/test-repo/file?path=SKILL.md',
      env,
    });

    const response = await GET(ctx);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe(fileContent);

    // Verify KV was accessed for metadata
    expect(env.SKILLS_CACHE.get).toHaveBeenCalledWith('meta:test-owner/test-repo', 'json');

    globalThis.fetch = originalFetch;
  });
});
