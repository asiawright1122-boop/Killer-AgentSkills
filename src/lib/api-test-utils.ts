import type { APIContext } from 'astro';
import { vi } from 'vitest';
import type { Env } from './kv';

export function createMockKV(store: Map<string, unknown> = new Map()): KVNamespace {
  return {
    get: vi.fn(async (key: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return typeof value === 'string' ? value : JSON.stringify(value);
    }),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => {
      const keys: Array<{ name: string }> = [];
      for (const key of store.keys()) {
        if (!prefix || key.startsWith(prefix)) {
          keys.push({ name: key });
        }
      }
      return {
        keys,
        list_complete: true,
        cacheStatus: 'reserved',
      };
    }),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

export function createMockD1(results: unknown[] = [], total?: number) {
  const prepared = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => {
      if (results.length === 0) return null;
      return { total: total ?? results.length };
    }),
    all: vi.fn(async () => ({
      success: true,
      results: results as Record<string, unknown>[],
      meta: {},
    })),
  };
  return {
    prepare: vi.fn(() => prepared),
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
}

export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    TRANSLATIONS: createMockKV(),
    SKILLS_CACHE: createMockKV(),
    ASSETS: {} as Fetcher,
    ...overrides,
  };
}

export function createAPIContext(options: {
  url?: string;
  env?: Env;
  body?: unknown;
  headers?: Record<string, string>;
}): APIContext<Record<string, any>, Record<string, string | undefined>> {
  const url = new URL(options.url || 'http://localhost/api/test');
  return {
    request: new Request(url.toString(), {
      method: options.body !== undefined ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }),
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
  } as unknown as APIContext<Record<string, any>, Record<string, string | undefined>>;
}

export function mockGitHubRepo(owner: string, repo: string, data?: Record<string, unknown>) {
  const repoData = data || {
    owner: { login: owner },
    name: repo,
    full_name: `${owner}/${repo}`,
    description: `Test repo ${owner}/${repo}`,
    html_url: `https://github.com/${owner}/${repo}`,
    stargazers_count: 100,
    default_branch: 'main',
    topics: ['test', 'ai'],
    language: 'TypeScript',
  };
  return new Response(JSON.stringify(repoData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function mockGitHubRaw(content: string, status = 200) {
  return new Response(content, { status });
}
