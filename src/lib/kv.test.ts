import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getKV, setKV, getSkillsFromKV, getSkillsKV, getSitemapSkillsFromKV, type Env } from './kv';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
  };
});

// Prevent dev-mode fallback to local data/skills-cache.json during tests
const originalDev = import.meta.env.DEV;
beforeEach(() => {
  // @ts-ignore -- vitest allows mutating import.meta.env
  import.meta.env.DEV = false;
});
afterEach(() => {
  // @ts-ignore -- restore original DEV value
  import.meta.env.DEV = originalDev;
});

// Helper to create a mock KVNamespace
function createMockKV(store: Map<string, any> = new Map()): KVNamespace {
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      if (type === 'json') return JSON.parse(value);
      return value;
    }),
    put: vi.fn(async (key: string, value: string, _opts?: any) => {
      store.set(key, value);
    }),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function createMockEnv(overrides: Partial<Env> = {}, skills: any[] = []): Env {
  // Create D1 mock based on `skills` array for testing getSkillsFromKV/getSkillsKV
  const mockDB = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: any[]) => ({
        first: vi.fn(async () => {
          if (sql.includes('WHERE id = ?')) {
            const match = skills.find((s) => s.id === args[0]);
            return match ? { data_json: JSON.stringify(match) } : null;
          }
          if (sql.includes('LIKE ?')) {
            const pattern = args[0]?.replace(/%/g, '');
            const match = skills.find((s) => `${s.owner}/${s.repo}`.startsWith(pattern));
            return match ? { data_json: JSON.stringify(match) } : null;
          }
          if (sql.includes('WHERE owner = ? AND repo = ?')) {
            const match = skills.find((s) => s.owner === args[0] && s.repo === args[1]);
            return match ? { data_json: JSON.stringify(match) } : null;
          }
          return null;
        }),
        all: vi.fn(async () => {
          return { success: true, results: [] };
        }),
      })),
      all: vi.fn(async () => {
        if (sql.includes('ORDER BY stars DESC')) {
          const sorted = [...skills].sort((a, b) => (b.stars || 0) - (a.stars || 0));
          return { success: true, results: sorted.map((s) => ({ data_json: JSON.stringify(s) })) };
        }
        if (sql.includes('sitemap')) {
          // It's the sitemap query: SELECT owner, repo, updated_at as updatedAt
          return {
            success: true,
            results: skills.map((s) => ({ owner: s.owner, repo: s.repo, updatedAt: s.updatedAt })),
          };
        }
        if (sql.includes('WHERE owner IS NOT NULL AND repo IS NOT NULL')) {
          return {
            success: true,
            results: skills
              .filter((s) => s && typeof s === 'object' && s.owner && s.repo)
              .map((s) => ({ owner: s.owner, repo: s.repo, updatedAt: s.updatedAt })),
          };
        }
        return { success: true, results: [] };
      }),
    })),
  };

  return {
    TRANSLATIONS: createMockKV(),
    SKILLS_CACHE: createMockKV(), // Still needed for fallback or related features
    DB: mockDB as unknown as D1Database,
    ASSETS: {} as Fetcher,
    ...overrides,
  };
}

describe('Env interface', () => {
  it('should accept all required and optional fields', () => {
    const env: Env = {
      TRANSLATIONS: createMockKV(),
      SKILLS_CACHE: createMockKV(),
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      NVIDIA_API_KEY: 'key1',
      NVIDIA_API_KEYS: 'key1,key2',
      NVIDIA_API_KEYS_2: 'key3',
      NVIDIA_API_KEYS_3: 'key4',
    };
    expect(env.ASSETS).toBeDefined();
    expect(env.ADMIN_USER).toBe('admin');
    expect(env.ADMIN_PASSWORD).toBe('secret');
    expect(env.NVIDIA_API_KEY).toBe('key1');
    expect(env.NVIDIA_API_KEYS).toBe('key1,key2');
    expect(env.NVIDIA_API_KEYS_2).toBe('key3');
    expect(env.NVIDIA_API_KEYS_3).toBe('key4');
  });

  it('should allow optional fields to be undefined', () => {
    const env: Env = {
      TRANSLATIONS: createMockKV(),
      SKILLS_CACHE: createMockKV(),
      ASSETS: {} as Fetcher,
    };
    expect(env.ADMIN_USER).toBeUndefined();
    expect(env.ADMIN_PASSWORD).toBeUndefined();
    expect(env.NVIDIA_API_KEY).toBeUndefined();
    expect(env.NVIDIA_API_KEYS).toBeUndefined();
  });
});

describe('getKV', () => {
  it('should read from TRANSLATIONS namespace', async () => {
    const store = new Map([['test-key', 'test-value']]);
    const env = createMockEnv({ TRANSLATIONS: createMockKV(store) });
    const result = await getKV(env, 'test-key');
    expect(result).toBe('test-value');
  });

  it('should return null for missing keys', async () => {
    const env = createMockEnv();
    const result = await getKV(env, 'nonexistent');
    expect(result).toBeNull();
  });

  it('should fallback to local mock when TRANSLATIONS binding is unavailable', async () => {
    const env = { SKILLS_CACHE: createMockKV(), DB: {} as D1Database, ASSETS: {} as Fetcher } as unknown as Env;
    const result = await getKV(env, 'key');
    expect(result).toBeNull();
  });
});

describe('setKV', () => {
  it('should write to TRANSLATIONS namespace with default TTL', async () => {
    const env = createMockEnv();
    await setKV(env, 'key', 'value');
    expect(env.TRANSLATIONS.put).toHaveBeenCalledWith('key', 'value', { expirationTtl: 31536000 });
  });

  it('should write with custom TTL', async () => {
    const env = createMockEnv();
    await setKV(env, 'key', 'value', 3600);
    expect(env.TRANSLATIONS.put).toHaveBeenCalledWith('key', 'value', { expirationTtl: 3600 });
  });

  it('should fallback to local mock when TRANSLATIONS binding is unavailable', async () => {
    const env = { SKILLS_CACHE: createMockKV(), DB: {} as D1Database, ASSETS: {} as Fetcher } as unknown as Env;
    // Should not throw
    await setKV(env, 'key', 'value');
  });
});

describe('getSkillsFromKV', () => {
  it('should read all skills from D1', async () => {
    const skills = [
      { id: '1', name: 'skill-1' },
      { id: '2', name: 'skill-2' },
    ];
    const env = createMockEnv({}, skills);

    const result = await getSkillsFromKV(env);
    expect(result).toEqual(skills);
  });

  it('should return empty array when DB binding is unavailable', async () => {
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;
    const result = await getSkillsFromKV(env);
    expect(result).toEqual([]);
  });

  it('should return empty array when env is null/undefined', async () => {
    const result = await getSkillsFromKV(null as unknown as Env);
    expect(result).toEqual([]);
  });

  it('should return empty array when no skills exist in D1', async () => {
    const env = createMockEnv({}, []);
    const result = await getSkillsFromKV(env);
    expect(result).toEqual([]);
  });

  it('should return empty array on D1 read error', async () => {
    const env = createMockEnv({}, []);
    env.DB!.prepare = vi.fn().mockImplementation(() => {
      throw new Error('DB timeout');
    });

    const result = await getSkillsFromKV(env);
    expect(result).toEqual([]);
  });
});

describe('getSkillsKV', () => {
  it('should read a specific key from D1 as JSON', async () => {
    const skillData = { id: '1', name: 'test-skill', stars: 42, owner: 'owner', repo: 'repo' };
    const env = createMockEnv({}, [skillData]);

    const result = await getSkillsKV(env, 'skill:1');
    expect(result).toEqual(skillData);
  });

  it('should fallback to owner/repo for two-segment IDs when exact ID is missing', async () => {
    const skills = [
      {
        id: 'anthropics/skills/algorithmic-art',
        name: 'algorithmic-art',
        owner: 'anthropics',
        repo: 'skills',
      },
    ];
    const env = createMockEnv({}, skills);

    const result = await getSkillsKV(env, 'skill:anthropics/skills');
    expect(result).toEqual(skills[0]);
  });

  it('should not fallback to owner/repo for missing sub-skill IDs', async () => {
    const skills = [
      {
        id: 'anthropics/skills/algorithmic-art',
        name: 'algorithmic-art',
        owner: 'anthropics',
        repo: 'skills',
      },
      {
        id: 'anthropics/skills/mcp-builder',
        name: 'mcp-builder',
        owner: 'anthropics',
        repo: 'skills',
      },
    ];
    const env = createMockEnv({}, skills);

    const result = await getSkillsKV(env, 'skill:anthropics/skills/non-existent-sub-skill');
    expect(result).toBeNull();
  });

  it('should return null when DB binding is unavailable', async () => {
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;
    const result = await getSkillsKV(env, 'some-key');
    expect(result).toBeNull();
  });

  it('should return null when env is null/undefined', async () => {
    const result = await getSkillsKV(null as unknown as Env, 'some-key');
    expect(result).toBeNull();
  });

  it('should return null when key does not exist', async () => {
    const env = createMockEnv({}, []);
    const result = await getSkillsKV(env, 'nonexistent');
    expect(result).toBeNull();
  });

  it('should return null on D1 read error', async () => {
    const env = createMockEnv({}, []);
    env.DB!.prepare = vi.fn().mockImplementation(() => {
      throw new Error('DB timeout');
    });

    const result = await getSkillsKV(env, 'some-key');
    expect(result).toBeNull();
  });

  it('should handle array data (unsupported in D1 lookup, returns null)', async () => {
    // Arrays were supported in KV for indices, but D1 lookups by ID return a single object or null
    const env = createMockEnv({}, []);

    const result = await getSkillsKV(env, 'array-key');
    expect(result).toBeNull();
  });
});

describe('getSitemapSkillsFromKV', () => {
  it('should read valid sitemap skills from D1', async () => {
    const sitemapData = [
      { owner: 'anthropics', repo: 'skills' },
      { owner: 'vercel', repo: 'next.js' },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual(sitemapData);
    expect(result).toHaveLength(2);
  });

  it('should dedupe owner/repo entries and keep the latest updatedAt', async () => {
    const sitemapData = [
      { owner: 'anthropics', repo: 'skills', updatedAt: '2026-03-01T00:00:00.000Z' },
      { owner: 'Anthropics', repo: 'skills', updatedAt: '2026-03-10T00:00:00.000Z' },
      { owner: 'vercel', repo: 'next.js', updatedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ owner: 'Anthropics', repo: 'skills', updatedAt: '2026-03-10T00:00:00.000Z' });
  });

  it('should filter out invalid GitHub owner/repo formats', async () => {
    const sitemapData = [
      { owner: 'valid-owner', repo: 'valid_repo' },
      { owner: 'bad owner', repo: 'repo' },
      { owner: 'owner', repo: 'bad/repo' },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'valid-owner', repo: 'valid_repo' }]);
  });

  it('should filter out entries with missing owner', async () => {
    const sitemapData = [
      { owner: 'anthropics', repo: 'skills' },
      { owner: '', repo: 'bad-repo' },
      { owner: undefined, repo: 'another' },
      { repo: 'no-owner' },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ owner: 'anthropics', repo: 'skills' });
  });

  it('should filter out entries with missing repo', async () => {
    const sitemapData = [
      { owner: 'valid', repo: 'data' },
      { owner: 'has-owner', repo: '' },
      { owner: 'has-owner', repo: undefined },
      { owner: 'has-owner' },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ owner: 'valid', repo: 'data' });
  });

  it('should filter out null entries', async () => {
    const sitemapData = [{ owner: 'valid', repo: 'data' }, null, undefined];
    const env = createMockEnv({}, sitemapData as any[]);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(1);
  });

  it('should return empty array when DB binding is unavailable in production (no local fallback)', async () => {
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;
    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([]);
  });

  it('should return empty array when no data exists in D1', async () => {
    const env = createMockEnv({}, []);
    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([]);
  });

  it('should return empty array on D1 read error', async () => {
    const env = createMockEnv({}, []);
    env.DB!.prepare = vi.fn().mockImplementation(() => {
      throw new Error('DB timeout');
    });

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([]);
  });
});
