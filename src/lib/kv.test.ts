import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getKV,
  setKV,
  getSkillsFromKV,
  getSkillsKV,
  getMarketplaceSkillsListingPage,
  getSkillsListingTop,
  getSitemapSkillsFromKV,
  _clearSitemapSkillsCacheForTest,
  type Env,
} from './kv';

// Set test environment to disable local file fallback in kv.ts
process.env.NODE_ENV = 'test';
process.env.DISABLE_LOCAL_SITEMAP_FALLBACK = '1';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const isLocalSkillsSnapshotPath = (pathLike: unknown) =>
    typeof pathLike === 'string' && pathLike.replace(/\\/g, '/').endsWith('/src/lib/local-skills-snapshot.json');

  return {
    ...actual,
    existsSync: vi.fn((pathLike) => (isLocalSkillsSnapshotPath(pathLike) ? actual.existsSync(pathLike) : false)),
    readFileSync: vi.fn((pathLike, options) => {
      if (isLocalSkillsSnapshotPath(pathLike)) {
        return actual.readFileSync(pathLike, options);
      }
      return '';
    }),
  };
});

// Prevent dev-mode fallback to local data/skills-cache.json during tests
const originalDev = import.meta.env.DEV;
beforeEach(() => {
  // @ts-ignore -- vitest allows mutating import.meta.env
  import.meta.env.DEV = false;
  // Clear sitemap cache to prevent test cross-contamination
  _clearSitemapSkillsCacheForTest();
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

function silenceExpectedKVLogs() {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  return {
    warn,
    error,
    restore() {
      warn.mockRestore();
      error.mockRestore();
    },
  };
}

function expectLocalSnapshotFallback(result: any[]) {
  expect(result.length).toBeGreaterThan(1000);
  expect(result[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      owner: expect.any(String),
      repo: expect.any(String),
    }),
  );
}

const INDEXABLE_BODY_PREVIEW = '# Skill README\n\n' + 'x'.repeat(400);
/**
 * Test fixture helper: adds an indexable README body AND the fields required
 * to pass the Tier 1 sitemap gate (stars >= 50, qualityScore >= 55, full
 * agentAnalysis). Tests that exercise the Tier 1 boundary conditions should
 * override these defaults explicitly.
 */
const withIndexableBody = <T extends Record<string, any>>(entry: T): T => ({
  ...entry,
  stars: entry.stars ?? 60,
  qualityScore: entry.qualityScore ?? 60,
  verified: entry.verified ?? false,
  agentAnalysis: entry.agentAnalysis ?? {
    suitability: 'Best for coding agents that need prompt refinement before running high-risk repository changes.',
    recommendation: 'Killer-Skills recommends this skill for workflow automation and code review cycles.',
    useCases: ['Code review automation', 'Workflow integration'],
    limitations: ['Requires Node.js 18+'],
  },
  skillMd: {
    ...(entry.skillMd || {}),
    bodyPreview: entry.skillMd?.bodyPreview || INDEXABLE_BODY_PREVIEW,
  },
});

function createMockEnv(overrides: Partial<Env> = {}, skills: any[] = []): Env {
  // Create D1 mock based on `skills` array for testing getSkillsFromKV/getSkillsKV
  const mockDB = {
    prepare: vi.fn((sql: string) => {
      const sortedSkills = () =>
        skills
          .filter(Boolean)
          .sort(
            (a, b) =>
              (b.rankScore || b.qualityScore || 0) - (a.rankScore || a.qualityScore || 0) ||
              (b.stars || 0) - (a.stars || 0),
          );
      const toListingRow = (s: any) => ({
        id: s.id,
        owner: s.owner,
        repo: s.repo,
        name: s.name,
        category: s.category,
        stars: s.stars,
        quality_score: s.qualityScore,
        security_level: s.securityLevel,
        source_trust: s.sourceTrust,
        rank_score: s.rankScore,
        last_audited_at: s.lastAuditedAt,
        updated_at: s.updatedAt,
        skillName: s.skillName,
        description: typeof s.description === 'string' ? s.description : JSON.stringify(s.description || ''),
        topics: JSON.stringify(s.topics || []),
        source: s.source || 'cache',
        qualityScore: s.qualityScore,
        securityScore: s.securityScore,
        sourceScore: s.sourceScore,
        isTrustedRankingEligible: s.isTrustedRankingEligible,
        riskFlags: JSON.stringify(s.riskFlags || []),
        securityBrief: s.securityBrief,
        primaryTrustReason: s.primaryTrustReason,
        filePath: s.filePath,
        seoDefinition: s.seo?.definition ? JSON.stringify(s.seo.definition) : undefined,
      });
      const executeAll = () => {
        if (sql.includes('SELECT data_json FROM skills')) {
          return { success: true, results: sortedSkills().map((s) => ({ data_json: JSON.stringify(s) })) };
        }
        if (sql.includes('WHERE owner IS NOT NULL') || sql.includes('WHERE length(json_extract')) {
          return {
            success: true,
            results: skills
              .filter((s) => s && typeof s === 'object' && s.owner && s.repo)
              .map((s) => ({
                id: s.id,
                owner: s.owner,
                repo: s.repo,
                updatedAt: s.updatedAt,
                skillBody: s.skillBody ?? s.skillMd?.body,
                skillBodyPreview: s.skillBodyPreview ?? s.skillMd?.bodyPreview,
                skillName: s.skillName ?? s.name,
                descriptionEn: s.descriptionEn ?? (typeof s.description === 'object' ? s.description?.en : undefined),
                descriptionRaw: s.descriptionRaw ?? s.description,
                seoDefinitionEn:
                  s.seoDefinitionEn ?? (typeof s.seo?.definition === 'object' ? s.seo?.definition?.en : undefined),
                seoDefinitionRaw: s.seoDefinitionRaw ?? s.seo?.definition,
                topicsRaw: s.topicsRaw ?? s.topics,
                category: s.category,
                filePath: s.filePath,
                stars: s.stars,
                qualityScore: s.qualityScore,
                verified: s.verified,
                agentAnalysis: s.agentAnalysis,
                seo: s.seo,
              })),
          };
        }
        if (sql.includes('FROM skills') && sql.includes('json_extract(data_json')) {
          return { success: true, results: sortedSkills().map(toListingRow) };
        }
        return { success: true, results: [] };
      };

      return {
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
          all: vi.fn(async () => executeAll()),
        })),
        all: vi.fn(async () => executeAll()),
      };
    }),
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
    const logs = silenceExpectedKVLogs();
    const env = { SKILLS_CACHE: createMockKV(), DB: {} as D1Database, ASSETS: {} as Fetcher } as unknown as Env;
    try {
      const result = await getKV(env, 'key');
      expect(result).toBeNull();
      expect(logs.warn).toHaveBeenCalledWith('[KV] No TRANSLATIONS binding found. Using local mock.');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
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
    const logs = silenceExpectedKVLogs();
    const env = { SKILLS_CACHE: createMockKV(), DB: {} as D1Database, ASSETS: {} as Fetcher } as unknown as Env;
    try {
      // Should not throw
      await setKV(env, 'key', 'value');
      expect(logs.warn).toHaveBeenCalledWith('[KV] Mock Write: key');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
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

  it('should fallback to local snapshot when DB binding is unavailable', async () => {
    const logs = silenceExpectedKVLogs();
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;
    try {
      const result = await getSkillsFromKV(env);
      expectLocalSnapshotFallback(result);
      expect(logs.warn).toHaveBeenCalledWith('[D1] No DB binding found, falling back to local file array');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('should fallback to local snapshot when env is null/undefined', async () => {
    const logs = silenceExpectedKVLogs();
    try {
      const result = await getSkillsFromKV(null as unknown as Env);
      expectLocalSnapshotFallback(result);
      expect(logs.warn).toHaveBeenCalledWith('[D1] No DB binding found, falling back to local file array');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('should return empty array when no skills exist in D1', async () => {
    const env = createMockEnv({}, []);
    const result = await getSkillsFromKV(env);
    expect(result).toEqual([]);
  });

  it('should fallback to local snapshot on D1 read error', async () => {
    const logs = silenceExpectedKVLogs();
    const env = createMockEnv({}, []);
    env.DB!.prepare = vi.fn().mockImplementation(() => {
      throw new Error('DB timeout');
    });

    try {
      const result = await getSkillsFromKV(env);
      expectLocalSnapshotFallback(result);
      expect(logs.warn).toHaveBeenCalledWith('[D1] Query failed, falling back to KV:', expect.any(Error));
      expect(logs.warn).toHaveBeenCalledWith('[D1] No DB binding found, falling back to local file array');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
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
    const logs = silenceExpectedKVLogs();
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;
    try {
      const result = await getSkillsKV(env, 'some-key');
      expect(result).toBeNull();
      expect(logs.warn).toHaveBeenCalledWith('[D1] No DB binding for specific key lookup some-key, using local cache');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('should return null when env is null/undefined', async () => {
    const logs = silenceExpectedKVLogs();
    try {
      const result = await getSkillsKV(null as unknown as Env, 'some-key');
      expect(result).toBeNull();
      expect(logs.warn).toHaveBeenCalledWith('[D1] No DB binding for specific key lookup some-key, using local cache');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('should return null when key does not exist', async () => {
    const env = createMockEnv({}, []);
    const result = await getSkillsKV(env, 'nonexistent');
    expect(result).toBeNull();
  });

  it('should return null on D1 read error', async () => {
    const logs = silenceExpectedKVLogs();
    const env = createMockEnv({}, []);
    env.DB!.prepare = vi.fn().mockImplementation(() => {
      throw new Error('DB timeout');
    });

    try {
      const result = await getSkillsKV(env, 'some-key');
      expect(result).toBeNull();
      expect(logs.error).toHaveBeenCalledWith('[D1] Error querying skill key "some-key":', expect.any(Error));
      expect(logs.warn).toHaveBeenCalledWith('[D1] Falling back to local skills cache for some-key');
    } finally {
      logs.restore();
    }
  });

  it('should handle array data (unsupported in D1 lookup, returns null)', async () => {
    // Arrays were supported in KV for indices, but D1 lookups by ID return a single object or null
    const env = createMockEnv({}, []);

    const result = await getSkillsKV(env, 'array-key');
    expect(result).toBeNull();
  });
});

describe('getSkillsListingTop', () => {
  it('maps trust and ranking fields from D1 listing rows', async () => {
    const env = createMockEnv({}, [
      {
        id: 'trusted/skill',
        name: 'trusted-skill',
        owner: 'trusted',
        repo: 'skill',
        description: { en: 'Trusted skill' },
        category: 'developer',
        topics: ['agent-skills'],
        stars: 10,
        qualityScore: 55,
        securityLevel: 'S',
        sourceTrust: 'T2',
        securityScore: 88,
        sourceScore: 75,
        rankScore: 87,
        isTrustedRankingEligible: true,
        riskFlags: [{ code: 'file_write', severity: 'info', label: 'local file write' }],
        securityBrief: 'S security: local file write.',
        primaryTrustReason: 'Public source with visible maintenance signals',
        lastAuditedAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-04T00:00:00.000Z',
        source: 'cache',
      },
    ]);

    const [skill] = await getSkillsListingTop(env, 1);

    expect(skill.securityLevel).toBe('S');
    expect(skill.sourceTrust).toBe('T2');
    expect(skill.rankScore).toBe(87);
    expect(skill.isTrustedRankingEligible).toBe(true);
    expect(skill.riskFlags?.[0]?.code).toBe('file_write');
    expect(skill.securityBrief).toBe('S security: local file write.');
  });
});

describe('getMarketplaceSkillsListingPage', () => {
  it('uses admitted COUNT plus LIMIT/OFFSET over admitted rows', async () => {
    const sqlLog: string[] = [];
    const pageRows = [
      {
        id: 'owner/admitted-1',
        owner: 'owner',
        repo: 'admitted-1',
        name: 'Admitted One',
        category: 'developer',
        stars: 50,
        quality_score: 40,
        security_level: 'A',
        source_trust: 'T2',
        rank_score: 90,
        last_audited_at: '2026-07-05T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
        skillName: 'Admitted One',
        description: JSON.stringify({ en: 'Admitted one' }),
        topics: JSON.stringify(['agent']),
        source: 'cache',
        qualityScore: 40,
        securityScore: 80,
        sourceScore: 70,
        isTrustedRankingEligible: true,
        riskFlags: JSON.stringify([]),
        securityBrief: 'Clean',
        primaryTrustReason: 'Reviewed',
        filePath: '.claude/skills/admitted-1/SKILL.md',
        seoDefinition: JSON.stringify({ en: 'Admitted one' }),
      },
      {
        id: 'owner/admitted-2',
        owner: 'owner',
        repo: 'admitted-2',
        name: 'Admitted Two',
        category: 'developer',
        stars: 49,
        quality_score: 39,
        security_level: 'A',
        source_trust: 'T1',
        rank_score: 89,
        last_audited_at: '2026-07-05T00:00:00.000Z',
        updated_at: '2026-07-04T00:00:00.000Z',
        skillName: 'Admitted Two',
        description: JSON.stringify({ en: 'Admitted two' }),
        topics: JSON.stringify(['agent']),
        source: 'cache',
        qualityScore: 39,
        securityScore: 79,
        sourceScore: 69,
        isTrustedRankingEligible: true,
        riskFlags: JSON.stringify([]),
        securityBrief: 'Clean',
        primaryTrustReason: 'Reviewed',
        filePath: '.claude/skills/admitted-2/SKILL.md',
        seoDefinition: JSON.stringify({ en: 'Admitted two' }),
      },
    ];

    const env = createMockEnv({
      DB: {
        prepare: vi.fn((sql: string) => {
          sqlLog.push(sql);
          return {
            bind: vi.fn((...args: any[]) => ({
              first: vi.fn(async () => {
                expect(args).toEqual([]);
                return { total: 3 };
              }),
              all: vi.fn(async () => {
                expect(args).toEqual([2, 0]);
                return { success: true, results: pageRows };
              }),
            })),
            first: vi.fn(async () => ({ total: 3 })),
            all: vi.fn(async () => ({ success: true, results: pageRows })),
          };
        }),
      } as unknown as D1Database,
    });

    const result = await getMarketplaceSkillsListingPage(env, 1, 2);

    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item) => item.name)).toEqual(['Admitted One', 'Admitted Two']);

    const countSql = sqlLog.find((sql) => sql.includes('COUNT(*) as total'));
    expect(countSql).toContain('FROM skills');
    expect(countSql).toContain("json_extract(data_json, '$.securityLevel')");
    expect(countSql).toContain("json_extract(data_json, '$.sourceTrust')");
    expect(countSql).toContain("json_extract(data_json, '$.isTrustedRankingEligible')");
    expect(countSql).toContain("json_each(COALESCE(json_extract(data_json, '$.riskFlags'), '[]'))");

    const pageSql = sqlLog.find((sql) => sql.includes('LIMIT ?1 OFFSET ?2'));
    expect(pageSql).toContain('FROM skills');
    expect(pageSql).toContain("json_extract(data_json, '$.skillName') as skillName");
    expect(pageSql).toContain("json_extract(data_json, '$.securityLevel')");
    expect(pageSql).toContain('as security_level');
    expect(pageSql).toContain("json_extract(data_json, '$.sourceTrust')");
    expect(pageSql).toContain('as source_trust');
    expect(pageSql).toContain("json_extract(data_json, '$.riskFlags') as riskFlags");
    expect(pageSql).toContain('ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC');
  });

  it('uses the local fallback only when D1 is unavailable and filters to admitted rows before slicing', async () => {
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;

    const result = await getMarketplaceSkillsListingPage(env, 1, 3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
    expect(result.items.length).toBeLessThanOrEqual(3);
    expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    expect(result.items.every((item) => item.securityLevel !== 'D')).toBe(true);
    expect(result.items.every((item) => ['T1', 'T2'].includes(String(item.sourceTrust)))).toBe(true);
    expect(
      result.items.every(
        (item) =>
          !item.riskFlags?.some(
            (flag) =>
              String(flag.severity || '')
                .trim()
                .toLowerCase() === 'blocker',
          ),
      ),
    ).toBe(true);
    expect(
      result.items.every(
        (item) => !['0', 'false'].includes(String(item.isTrustedRankingEligible).trim().toLowerCase()),
      ),
    ).toBe(true);
  });
});

describe('getSitemapSkillsFromKV', () => {
  it('should read valid sitemap skills from D1', async () => {
    const sitemapData = [
      withIndexableBody({ id: 'anthropics/skills/algorithmic-art', owner: 'anthropics', repo: 'skills' }),
      withIndexableBody({ id: 'vercel/nextjs', owner: 'vercel', repo: 'nextjs' }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([
      { owner: 'anthropics', repo: 'skills', routePath: 'skills/algorithmic-art' },
      { owner: 'vercel', repo: 'nextjs', routePath: 'nextjs' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('should dedupe identical route paths and keep the latest updatedAt', async () => {
    const sitemapData = [
      withIndexableBody({
        id: 'anthropics/skills/algorithmic-art',
        owner: 'anthropics',
        repo: 'skills',
        updatedAt: '2026-03-01T00:00:00.000Z',
      }),
      withIndexableBody({
        id: 'Anthropics/skills/algorithmic-art',
        owner: 'Anthropics',
        repo: 'skills',
        updatedAt: '2026-03-10T00:00:00.000Z',
      }),
      withIndexableBody({
        id: 'vercel/nextjs',
        owner: 'vercel',
        repo: 'nextjs',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      owner: 'Anthropics',
      repo: 'skills',
      routePath: 'skills/algorithmic-art',
      updatedAt: '2026-03-10T00:00:00.000Z',
    });
  });

  it('should filter out invalid GitHub owner/repo formats', async () => {
    const sitemapData = [
      withIndexableBody({ id: 'valid-owner/valid_repo/my-skill', owner: 'valid-owner', repo: 'valid_repo' }),
      withIndexableBody({ id: 'bad owner/repo/my-skill', owner: 'bad owner', repo: 'repo' }),
      withIndexableBody({ id: 'owner/bad/repo/my-skill', owner: 'owner', repo: 'bad/repo' }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'valid-owner', repo: 'valid_repo', routePath: 'valid_repo/my-skill' }]);
  });

  it('should filter out entries with missing owner', async () => {
    const sitemapData = [
      withIndexableBody({ id: 'anthropics/skills/algorithmic-art', owner: 'anthropics', repo: 'skills' }),
      withIndexableBody({ id: 'skills/bad-repo', owner: '', repo: 'bad-repo' }),
      withIndexableBody({ id: 'another/repo', owner: undefined, repo: 'another' }),
      withIndexableBody({ id: 'no-owner/repo', repo: 'no-owner' }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ owner: 'anthropics', repo: 'skills', routePath: 'skills/algorithmic-art' });
  });

  it('should filter out entries with missing repo', async () => {
    const sitemapData = [
      withIndexableBody({ id: 'valid/data/data-workflow', owner: 'valid', repo: 'data' }),
      withIndexableBody({ id: 'has-owner/empty', owner: 'has-owner', repo: '' }),
      withIndexableBody({ id: 'has-owner/undefined', owner: 'has-owner', repo: undefined }),
      withIndexableBody({ id: 'has-owner/missing', owner: 'has-owner' }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ owner: 'valid', repo: 'data', routePath: 'data/data-workflow' });
  });

  it('should filter out null entries', async () => {
    const sitemapData = [withIndexableBody({ owner: 'valid', repo: 'data' }), null, undefined];
    const env = createMockEnv({}, sitemapData as any[]);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toHaveLength(1);
  });

  it('should filter out thin readme entries from sitemap', async () => {
    const sitemapData = [
      withIndexableBody({ id: 'valid-owner/valid-repo/valid-skill', owner: 'valid-owner', repo: 'valid-repo' }),
      {
        id: 'thin-owner/thin-repo/thin-skill',
        owner: 'thin-owner',
        repo: 'thin-repo',
        skillMd: { bodyPreview: 'tiny readme' },
      },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'valid-owner', repo: 'valid-repo', routePath: 'valid-repo/valid-skill' }]);
  });

  it('should filter out non-public skills even when readme content is indexable', async () => {
    const sitemapData = [
      withIndexableBody({
        id: 'anthropics/skills/algorithmic-art',
        owner: 'anthropics',
        repo: 'skills',
        description: { en: 'Procedural p5.js art skill for Claude Code workflows.' },
        topics: ['claude', 'agent skill'],
        category: 'official',
      }),
      withIndexableBody({
        id: 'marswangyang/Roger/resume-latex-pdf-generator',
        owner: 'marswangyang',
        repo: 'Roger',
        name: 'resume-latex-pdf-generator',
        description: { en: 'Generates and compiles a single-page US Letter LaTeX resume.' },
        topics: ['latex', 'resume'],
        category: 'community',
      }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'anthropics', repo: 'skills', routePath: 'skills/algorithmic-art' }]);
  });

  it('should keep skills when only localized summary boilerplate contains resume', async () => {
    const sitemapData = [
      withIndexableBody({
        id: 'eannnnnn/taptik-labs/gh',
        owner: 'eannnnnn',
        repo: 'taptik-labs',
        name: 'gh',
        description: {
          en: 'GitHub CLI automation skill for AI agent repository workflows.',
          fr: 'Resume localise : GitHub CLI automation skill for AI agent repository workflows.',
        },
        topics: ['claude', 'mcp'],
        category: 'community',
      }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'eannnnnn', repo: 'taptik-labs', routePath: 'taptik-labs/gh' }]);
  });

  it('should keep thin-readme entries when fallback description is indexable', async () => {
    const sitemapData = [
      {
        id: 'fallback-owner/fallback-repo/fallback-skill',
        owner: 'fallback-owner',
        repo: 'fallback-repo',
        stars: 60,
        qualityScore: 60,
        agentAnalysis: {
          suitability:
            'Best for coding agents that need prompt refinement before running high-risk repository changes.',
          recommendation: 'Killer-Skills recommends this skill for workflow automation and code review cycles.',
          useCases: ['Code review automation', 'Workflow integration'],
          limitations: ['Requires Node.js 18+'],
        },
        skillMd: { bodyPreview: 'tiny' },
        description: { en: 'y'.repeat(240) },
      },
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([
      { owner: 'fallback-owner', repo: 'fallback-repo', routePath: 'fallback-repo/fallback-skill' },
    ]);
  });

  it('should map README root skills back to the repo root route path', async () => {
    const sitemapData = [
      withIndexableBody({
        id: 'neondatabase/mcp-server-neon/README.md',
        owner: 'neondatabase',
        repo: 'mcp-server-neon',
        name: 'README.md',
        description: {
          en: 'Neon MCP Server skill for managing Neon Postgres databases with natural language.',
        },
        topics: ['mcp', 'llm'],
        category: 'official',
      }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'neondatabase', repo: 'mcp-server-neon', routePath: 'mcp-server-neon' }]);
  });

  it('should filter out non-routeable multi-level skill ids', async () => {
    const sitemapData = [
      withIndexableBody({ id: 'owner/repo/valid-skill', owner: 'owner', repo: 'repo' }),
      withIndexableBody({ id: 'owner/repo/nested/skill', owner: 'owner', repo: 'repo' }),
    ];
    const env = createMockEnv({}, sitemapData);

    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([{ owner: 'owner', repo: 'repo', routePath: 'repo/valid-skill' }]);
  });

  it('should return empty array when DB binding is unavailable in production (no local fallback)', async () => {
    const logs = silenceExpectedKVLogs();
    const env = { TRANSLATIONS: createMockKV(), ASSETS: {} as Fetcher } as unknown as Env;
    try {
      const result = await getSitemapSkillsFromKV(env);
      expect(result).toEqual([]);
      expect(logs.warn).toHaveBeenCalledWith('[Sitemap] No data source available for sitemap');
      expect(logs.error).not.toHaveBeenCalled();
    } finally {
      logs.restore();
    }
  });

  it('should return empty array when no data exists in D1', async () => {
    const env = createMockEnv({}, []);
    const result = await getSitemapSkillsFromKV(env);
    expect(result).toEqual([]);
  });

  it('should return empty array on D1 read error', async () => {
    const logs = silenceExpectedKVLogs();
    const env = createMockEnv({}, []);
    env.DB!.prepare = vi.fn().mockImplementation(() => {
      throw new Error('DB timeout');
    });

    try {
      const result = await getSitemapSkillsFromKV(env);
      expect(result).toEqual([]);
      expect(logs.error).toHaveBeenCalledWith('[D1] Error reading sitemap skills from D1:', expect.any(Error));
      expect(logs.warn).toHaveBeenCalledWith('[Sitemap] No data source available for sitemap');
    } finally {
      logs.restore();
    }
  });
});
