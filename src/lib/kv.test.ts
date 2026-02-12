import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getKV, setKV, getSkillsFromKV, getSkillsKV, getSitemapSkillsFromKV, type Env } from './kv';

// Prevent dev-mode fallback to local data/skills-cache.json during tests
const originalDev = import.meta.env.DEV;
beforeEach(() => {
    // @ts-ignore — vitest allows mutating import.meta.env
    import.meta.env.DEV = false;
});
afterEach(() => {
    // @ts-ignore
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
        put: vi.fn(async (key: string, value: string, opts?: any) => {
            store.set(key, value);
        }),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;
}

// Helper to create a mock Env
function createMockEnv(overrides: Partial<Env> = {}): Env {
    return {
        TRANSLATIONS: createMockKV(),
        SKILLS_CACHE: createMockKV(),
        AI: {},
        ASSETS: {} as Fetcher,
        ...overrides,
    };
}

describe('Env interface', () => {
    it('should accept all required and optional fields', () => {
        const env: Env = {
            TRANSLATIONS: createMockKV(),
            SKILLS_CACHE: createMockKV(),
            AI: { run: vi.fn() },
            ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
            ADMIN_USER: 'admin',
            ADMIN_PASSWORD: 'secret',
            NVIDIA_API_KEY: 'key1',
            NVIDIA_API_KEYS: 'key1,key2',
            NVIDIA_API_KEYS_2: 'key3',
            NVIDIA_API_KEYS_3: 'key4',
        };
        expect(env.AI).toBeDefined();
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
            AI: {},
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
        const env = { SKILLS_CACHE: createMockKV(), AI: {}, ASSETS: {} as Fetcher } as unknown as Env;
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
        const env = { SKILLS_CACHE: createMockKV(), AI: {}, ASSETS: {} as Fetcher } as unknown as Env;
        // Should not throw
        await setKV(env, 'key', 'value');
    });
});

describe('getSkillsFromKV', () => {
    it('should read all skills from SKILLS_CACHE', async () => {
        const skills = [{ id: '1', name: 'skill-1' }, { id: '2', name: 'skill-2' }];
        const store = new Map([['all-skills', JSON.stringify(skills)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

        const result = await getSkillsFromKV(env);
        expect(result).toEqual(skills);
        expect(env.SKILLS_CACHE.get).toHaveBeenCalledWith('all-skills', 'json');
    });

    it('should return empty array when SKILLS_CACHE binding is unavailable', async () => {
        const env = { TRANSLATIONS: createMockKV(), AI: {}, ASSETS: {} as Fetcher } as unknown as Env;
        const result = await getSkillsFromKV(env);
        expect(result).toEqual([]);
    });

    it('should return empty array when env is null/undefined', async () => {
        const result = await getSkillsFromKV(null as unknown as Env);
        expect(result).toEqual([]);
    });

    it('should return empty array when all-skills key does not exist', async () => {
        const env = createMockEnv();
        const result = await getSkillsFromKV(env);
        expect(result).toEqual([]);
    });

    it('should return empty array on KV read error', async () => {
        const mockKV = createMockKV();
        (mockKV.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('KV timeout'));
        const env = createMockEnv({ SKILLS_CACHE: mockKV });

        const result = await getSkillsFromKV(env);
        expect(result).toEqual([]);
    });
});

describe('getSkillsKV', () => {
    it('should read a specific key from SKILLS_CACHE as JSON', async () => {
        const skillData = { id: '1', name: 'test-skill', stars: 42 };
        const store = new Map([['skill:owner/repo', JSON.stringify(skillData)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

        const result = await getSkillsKV(env, 'skill:owner/repo');
        expect(result).toEqual(skillData);
        expect(env.SKILLS_CACHE.get).toHaveBeenCalledWith('skill:owner/repo', 'json');
    });

    it('should return null when SKILLS_CACHE binding is unavailable', async () => {
        const env = { TRANSLATIONS: createMockKV(), AI: {}, ASSETS: {} as Fetcher } as unknown as Env;
        const result = await getSkillsKV(env, 'some-key');
        expect(result).toBeNull();
    });

    it('should return null when env is null/undefined', async () => {
        const result = await getSkillsKV(null as unknown as Env, 'some-key');
        expect(result).toBeNull();
    });

    it('should return null when key does not exist', async () => {
        const env = createMockEnv();
        const result = await getSkillsKV(env, 'nonexistent');
        expect(result).toBeNull();
    });

    it('should return null on KV read error', async () => {
        const mockKV = createMockKV();
        (mockKV.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('KV timeout'));
        const env = createMockEnv({ SKILLS_CACHE: mockKV });

        const result = await getSkillsKV(env, 'some-key');
        expect(result).toBeNull();
    });

    it('should handle array data from KV', async () => {
        const arrayData = [1, 2, 3];
        const store = new Map([['array-key', JSON.stringify(arrayData)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

        const result = await getSkillsKV(env, 'array-key');
        expect(result).toEqual([1, 2, 3]);
    });
});

describe('getSitemapSkillsFromKV', () => {
    it('should read valid sitemap skills from SKILLS_CACHE', async () => {
        const sitemapData = [
            { owner: 'anthropics', repo: 'skills' },
            { owner: 'vercel', repo: 'next.js' },
        ];
        const store = new Map([['sitemap-skills', JSON.stringify(sitemapData)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

        const result = await getSitemapSkillsFromKV(env);
        expect(result).toEqual(sitemapData);
        expect(result).toHaveLength(2);
    });

    it('should filter out entries with missing owner', async () => {
        const sitemapData = [
            { owner: 'anthropics', repo: 'skills' },
            { owner: '', repo: 'bad-repo' },
            { owner: undefined, repo: 'another' },
            { repo: 'no-owner' },
        ];
        const store = new Map([['sitemap-skills', JSON.stringify(sitemapData)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

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
        const store = new Map([['sitemap-skills', JSON.stringify(sitemapData)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

        const result = await getSitemapSkillsFromKV(env);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ owner: 'valid', repo: 'data' });
    });

    it('should filter out null entries', async () => {
        const sitemapData = [
            { owner: 'valid', repo: 'data' },
            null,
            undefined,
        ];
        const store = new Map([['sitemap-skills', JSON.stringify(sitemapData)]]);
        const env = createMockEnv({ SKILLS_CACHE: createMockKV(store) });

        const result = await getSitemapSkillsFromKV(env);
        expect(result).toHaveLength(1);
    });

    it('should return empty array when SKILLS_CACHE binding is unavailable', async () => {
        const env = { TRANSLATIONS: createMockKV(), AI: {}, ASSETS: {} as Fetcher } as unknown as Env;
        const result = await getSitemapSkillsFromKV(env);
        expect(result).toEqual([]);
    });

    it('should return empty array when sitemap-skills key does not exist', async () => {
        const env = createMockEnv();
        const result = await getSitemapSkillsFromKV(env);
        expect(result).toEqual([]);
    });

    it('should return empty array on KV read error', async () => {
        const mockKV = createMockKV();
        (mockKV.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('KV timeout'));
        const env = createMockEnv({ SKILLS_CACHE: mockKV });

        const result = await getSitemapSkillsFromKV(env);
        expect(result).toEqual([]);
    });
});
