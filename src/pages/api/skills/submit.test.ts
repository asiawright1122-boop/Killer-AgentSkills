import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockEnv,
  createMockKV,
  createAPIContext,
  mockGitHubRepo,
  mockGitHubRaw,
  mockGitHubContents,
} from '../../../lib/api-test-utils';

const VALID_SKILL_MD = `---
name: Test Skill
description: A test skill for unit testing
version: 1.0.0
author: Test Author
tags:
  - test
  - unit
---

# Test Skill

This is a test skill.
`;

describe('POST /api/skills/submit', () => {
  let POST: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();

    vi.mock('../../../lib/kv', async () => {
      const actual = await vi.importActual('../../../lib/kv');
      return {
        ...actual,
        getSkillsKV: vi.fn(async (_env: unknown, key: string) => {
          const repoPath = key.startsWith('submission:') ? key.substring(11) : key;
          if (repoPath === 'test/repo') {
            return { owner: 'test', repo: 'repo', name: 'Existing Skill' };
          }
          return null;
        }),
      };
    });

    const mod = await import('./submit');
    POST = mod.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildContext(body: unknown, env?: ReturnType<typeof createMockEnv>) {
    return createAPIContext({
      url: 'http://localhost/api/skills/submit',
      body,
      env,
    });
  }

  it('returns 429 when rate limited', async () => {
    const ctx = buildContext({ repoUrl: 'https://github.com/test/repo' });
    for (let i = 0; i < 5; i++) {
      await POST(ctx);
    }
    const res = await POST(ctx);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit|too many/i);
  });

  it('returns 400 for invalid JSON body', async () => {
    const ctx = {
      ...createAPIContext({ url: 'http://localhost/api/skills/submit' }),
      request: new Request('http://localhost/api/skills/submit', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
    };
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it('returns 400 when repoUrl is missing', async () => {
    const ctx = buildContext({});
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when repoUrl is not a valid URL', async () => {
    const ctx = buildContext({ repoUrl: 'not-a-url' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url|invalid/i);
  });

  it('returns 400 for unsupported repo URL format', async () => {
    const ctx = buildContext({ repoUrl: 'git@github.com:test/repo.git' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when repository does not exist', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return new Response('Not Found', { status: 404 });
      }
      return original(url as any);
    }) as typeof fetch;

    const ctx = buildContext({ repoUrl: 'https://github.com/nonexistent/repo' });
    const res = await POST(ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not exist|not accessible/i);

    globalThis.fetch = original;
  });

  it('returns 400 when repository has no SKILL.md', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return mockGitHubRepo('test', 'repo');
      }
      if (urlStr.includes('raw.githubusercontent.com')) {
        return new Response('Not Found', { status: 404 });
      }
      return original(url as any);
    }) as typeof fetch;

    const ctx = buildContext({ repoUrl: 'https://github.com/test/repo' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/skill\.md/i);

    globalThis.fetch = original;
  });

  it('returns 409 when skill already exists (duplicate)', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return mockGitHubRepo('test', 'repo');
      }
      if (urlStr.includes('raw.githubusercontent.com')) {
        return mockGitHubRaw(VALID_SKILL_MD);
      }
      return original(url as any);
    }) as typeof fetch;

    const existingSkill = {
      owner: 'test',
      repo: 'repo',
      name: 'Test Skill',
      description: 'A test skill',
      category: 'testing',
      stars: 10,
    };
    const store = new Map([['skill:test/repo', JSON.stringify(existingSkill)]]);
    const ctx = buildContext(
      { repoUrl: 'https://github.com/test/repo' },
      createMockEnv({ SKILLS_CACHE: createMockKV(store) }),
    );

    const res = await POST(ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);

    globalThis.fetch = original;
  });

  it('returns 200 and skill data on successful submission', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return mockGitHubRepo('new-owner', 'new-repo');
      }
      if (urlStr.includes('raw.githubusercontent.com')) {
        return mockGitHubRaw(VALID_SKILL_MD);
      }
      return original(url as any);
    }) as typeof fetch;

    const ctx = buildContext({ repoUrl: 'https://github.com/new-owner/new-repo' }, createMockEnv());

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.skill).toBeDefined();
    expect(body.skill.frontmatter).toBeDefined();
    expect(body.skill.frontmatter.name).toBe('Test Skill');
    expect(body.skill.frontmatter.description).toBe('A test skill for unit testing');

    globalThis.fetch = original;
  });

  it('still returns 200 even when KV write fails', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return mockGitHubRepo('new-repo', 'owner');
      }
      if (urlStr.includes('raw.githubusercontent.com')) {
        return mockGitHubRaw(VALID_SKILL_MD);
      }
      return original(url as any);
    }) as typeof fetch;

    const failingKV = createMockKV();
    failingKV.put = vi.fn(async () => {
      throw new Error('KV write failed');
    });
    const ctx = buildContext(
      { repoUrl: 'https://github.com/new-repo/owner' },
      createMockEnv({ SKILLS_CACHE: failingKV }),
    );

    const res = await POST(ctx);
    expect(res.status).toBe(200);

    globalThis.fetch = original;
  });
});

describe('GET /api/skills/submit', () => {
  let GET: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./submit');
    GET = mod.GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildGetContext(url: string) {
    return createAPIContext({ url });
  }

  it('returns 400 when url param is missing', async () => {
    const ctx = buildGetContext('http://localhost/api/skills/submit');
    const res = await GET(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });

  it('returns 400 for invalid repo URL format', async () => {
    const ctx = buildGetContext('http://localhost/api/skills/submit?url=not-a-url');
    const res = await GET(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/format/i);
  });

  it('returns 404 when repository does not exist', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return new Response('Not Found', { status: 404 });
      }
      return original(url as any);
    }) as typeof fetch;

    const ctx = buildGetContext('http://localhost/api/skills/submit?url=https://github.com/nonexistent/repo');
    const res = await GET(ctx);
    expect(res.status).toBe(404);

    globalThis.fetch = original;
  });

  it('returns 400 when repository has no SKILL.md', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return mockGitHubRepo('test', 'repo');
      }
      if (urlStr.includes('raw.githubusercontent.com')) {
        return new Response('Not Found', { status: 404 });
      }
      return original(url as any);
    }) as typeof fetch;

    const ctx = buildGetContext('http://localhost/api/skills/submit?url=https://github.com/test/repo');
    const res = await GET(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/skill\.md/i);

    globalThis.fetch = original;
  });

  it('returns 200 with valid skill preview', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr =
        typeof url === 'string' ? (url as string) : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('api.github.com/repos')) {
        return mockGitHubRepo('test', 'repo');
      }
      if (urlStr.includes('raw.githubusercontent.com')) {
        return mockGitHubRaw(VALID_SKILL_MD);
      }
      return original(url as any);
    }) as typeof fetch;

    const ctx = buildGetContext('http://localhost/api/skills/submit?url=https://github.com/test/repo');
    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.hasSkillMd).toBe(true);
    expect(body.skill.frontmatter.name).toBe('Test Skill');

    globalThis.fetch = original;
  });
});
