import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllSkills,
  getSkillByOwnerRepo,
  getFeaturedSkills,
  getFeaturedSkillsDirect,
  getLightweightSkills,
  getOfficialSkillCounts,
  getRelatedSkills,
  getLocalizedDescription,
  _resetSkillsCache,
  type UnifiedSkill,
} from './skills';
import type { Env } from './kv';

// Prevent dev-mode fallback to local data/skills-cache.json during tests
const originalDev = import.meta.env.DEV;
beforeEach(() => {
  // @ts-ignore -- vitest allows mutating import.meta.env
  import.meta.env.DEV = false;
  _resetSkillsCache();
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
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(async (options?: { prefix?: string }) => ({
      keys: Array.from(store.keys())
        .filter((name) => !options?.prefix || name.startsWith(options.prefix))
        .map((name) => ({ name })),
      list_complete: true,
      cursor: undefined,
    })),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function createMockEnv(skills: UnifiedSkill[] = [], extraKV: Map<string, any> = new Map()): Env {
  const skillEntries = skills.map((skill) => [`skill:${skill.id}`, JSON.stringify(skill)] as const);
  const store = new Map<string, any>([['all-skills', JSON.stringify(skills)], ...skillEntries, ...extraKV]);

  const toD1Row = (s: UnifiedSkill) => ({
    id: s.id,
    owner: s.owner,
    repo: s.repo,
    name: s.name,
    category: s.category,
    stars: s.stars,
    quality_score: s.qualityScore ?? 0,
    updated_at: s.updatedAt,
    skillName: s.skillName,
    description: JSON.stringify(s.description),
    topics: JSON.stringify(s.topics),
    source: s.source,
    qualityScore: s.qualityScore ?? 0,
    filePath: s.filePath || '',
    seoDefinition: s.seo ? JSON.stringify(s.seo.definition) : null,
    data_json: JSON.stringify(s),
  });

  // Create D1 mock that supports the SQL queries used by getSkillsFromKV and getSkillsListing
  const mockDB = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: any[]) => ({
        all: vi.fn(async () => {
          // Handle GROUP BY owner
          if (sql.includes('GROUP BY owner')) {
            const owners = args.slice(0, -1); // last arg is LIMIT
            const grouped: Record<string, number> = {};
            skills
              .filter((s) => owners.includes(s.owner))
              .forEach((s) => {
                grouped[s.owner] = (grouped[s.owner] || 0) + 1;
              });
            return {
              success: true,
              results: Object.entries(grouped)
                .sort((a, b) => b[1] - a[1])
                .map(([owner, count]) => ({ owner, count })),
            };
          }
          if (sql.includes('WHERE category = ?1')) {
            const [category, currentId, currentOwner, currentRepo, limit] = args;
            return {
              success: true,
              results: skills
                .filter(
                  (skill) =>
                    skill.category === category &&
                    skill.id !== currentId &&
                    !(skill.owner === currentOwner && skill.repo === currentRepo),
                )
                .sort((a, b) => (b.stars || 0) - (a.stars || 0))
                .slice(0, Number(limit))
                .map(toD1Row),
            };
          }
          if (sql.includes('WHERE id != ?1')) {
            const [currentId, currentOwner, currentRepo, limit] = args;
            return {
              success: true,
              results: skills
                .filter(
                  (skill) => skill.id !== currentId && !(skill.owner === currentOwner && skill.repo === currentRepo),
                )
                .sort((a, b) => (b.stars || 0) - (a.stars || 0))
                .slice(0, Number(limit))
                .map(toD1Row),
            };
          }
          // Handle "SELECT data_json FROM skills ORDER BY stars DESC" and lightweight listing
          if (sql.includes('ORDER BY stars DESC') || sql.includes('skills')) {
            const limit = args[0] || skills.length;
            const sorted = [...skills].sort((a, b) => (b.stars || 0) - (a.stars || 0));
            return {
              success: true,
              results: sorted.slice(0, limit).map(toD1Row),
            };
          }
          return { success: true, results: [] };
        }),
        first: vi.fn(async () => {
          // Handle exact ID match
          if (sql.includes('WHERE id = ?')) {
            const id = args[0];
            const match = skills.find((s) => s.id === id || `${s.owner}/${s.repo}` === id);
            return match ? toD1Row(match) : null;
          }
          // Handle LIKE match
          if (sql.includes('LIKE ?')) {
            const pattern = args[0]?.replace(/%/g, '');
            const match = skills.find((s) => `${s.owner}/${s.repo}`.startsWith(pattern));
            return match ? toD1Row(match) : null;
          }
          // Handle owner + repo match
          if (sql.includes('WHERE owner = ? AND repo = ?')) {
            const [owner, repo] = args;
            const match = skills.find((s) => s.owner === owner && s.repo === repo);
            return match ? toD1Row(match) : null;
          }
          return null;
        }),
      })),
      all: vi.fn(async () => {
        const sorted = [...skills].sort((a, b) => (b.stars || 0) - (a.stars || 0));
        return {
          success: true,
          results: sorted.map(toD1Row),
        };
      }),
    })),
  };

  return {
    TRANSLATIONS: createMockKV(),
    SKILLS_CACHE: createMockKV(store),
    DB: mockDB as unknown as D1Database,
    ASSETS: {} as Fetcher,
  };
}

const sampleSkills: UnifiedSkill[] = [
  {
    id: '1',
    name: 'Anthropic Skills',
    skillName: 'anthropic-skills',
    owner: 'anthropics',
    repo: 'skills',
    description: 'Official Claude Agent Skills',
    category: 'ai',
    topics: ['claude', 'agent'],
    stars: 52000,
    source: 'verified',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Vercel Skills',
    skillName: 'vercel-skills',
    owner: 'vercel-labs',
    repo: 'skills',
    description: { en: 'Vercel official skills', zh: 'Vercel 官方技能' },
    category: 'development',
    topics: ['vercel', 'nextjs'],
    stars: 1200,
    source: 'official' as any,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Test Skill',
    skillName: 'test-skill',
    owner: 'test-owner',
    repo: 'test-repo',
    description: 'A test skill for testing',
    category: 'testing',
    topics: ['test'],
    stars: 100,
    source: 'cache',
    updatedAt: '2020-01-01T00:00:00Z',
  },
];

const pollutedSkill: UnifiedSkill = {
  id: '4',
  name: 'PM Interview Copilot',
  skillName: 'pm-interview-copilot',
  owner: 'noisy-owner',
  repo: 'pm-interview-copilot',
  description: 'Product manager interview preparation and MVP builder workflow.',
  category: 'productivity',
  topics: ['product manager', 'interview'],
  stars: 88,
  source: 'cache',
  updatedAt: new Date().toISOString(),
  skillMd: {
    name: 'PM Interview Copilot',
    description: 'Product manager interview preparation and MVP builder workflow.',
    bodyPreview: 'Interview prep workflow for product management roles.',
  },
};

describe('getLocalizedDescription', () => {
  it('should return empty string for undefined description', () => {
    expect(getLocalizedDescription(undefined, 'en')).toBe('');
  });

  it('should return string description as-is', () => {
    expect(getLocalizedDescription('Hello world', 'en')).toBe('Hello world');
  });

  it('should strip hidden reasoning from localized descriptions', () => {
    expect(getLocalizedDescription('Chain of thought:\nprivate notes\n\nPublic description', 'en')).toBe(
      'Public description',
    );
    expect(
      getLocalizedDescription(
        {
          en: '<thinking>private notes</thinking>English description',
          zh: '内部思考：不要展示\n\n中文描述',
        },
        'zh',
      ),
    ).toBe('中文描述');
  });

  it('should return the requested locale from a Record description', () => {
    const desc = { en: 'English', zh: '中文' };
    expect(getLocalizedDescription(desc, 'zh')).toBe('中文');
  });

  it('should fall back to English when requested locale is missing', () => {
    const desc = { en: 'English', zh: '中文' };
    expect(getLocalizedDescription(desc, 'ja')).toBe('English');
  });

  it('should fall back to Chinese when English is also missing', () => {
    const desc = { zh: '中文' };
    expect(getLocalizedDescription(desc, 'ja')).toBe('中文');
  });

  it('should fall back to first available value', () => {
    const desc = { fr: 'Français' };
    expect(getLocalizedDescription(desc, 'ja')).toBe('Français');
  });

  it('should return empty string for empty Record', () => {
    expect(getLocalizedDescription({}, 'en')).toBe('');
  });
});

describe('getAllSkills', () => {
  it('should return all skills from KV', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getAllSkills(env);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Anthropic Skills');
  });

  it('should filter non-target skills from public results', async () => {
    const env = createMockEnv([...sampleSkills, pollutedSkill]);
    const result = await getAllSkills(env);
    expect(result.some((skill) => skill.id === pollutedSkill.id)).toBe(false);
  });

  it('should sanitize hidden reasoning from public skill records', async () => {
    const leakingSkill: UnifiedSkill = {
      id: 'leaky/design-skill',
      name: 'Design Skill',
      skillName: 'design-skill',
      owner: 'leaky',
      repo: 'design-skill',
      description: { en: '<thinking>private notes</thinking>Public description' },
      category: 'design',
      topics: ['design'],
      stars: 1,
      source: 'cache',
      updatedAt: new Date().toISOString(),
      seo: {
        definition: { en: 'Scratchpad:\nprivate notes\n\nPublic definition' },
        features: { en: ['<analysis>private notes</analysis>Public feature'] },
        keywords: { en: ['AI agent skill'] },
      },
      agentAnalysis: {
        suitability: { en: 'Private analysis:\nprivate notes\n\nPublic suitability' },
        recommendation: { en: '<reasoning>private notes</reasoning>Public recommendation' },
        useCases: { en: ['Chain-of-thought:\nprivate notes\n\nPublic use case'] },
        limitations: { en: ['Public limitation'] },
      },
      skillMd: {
        name: 'Design Skill',
        description: '<thinking>private notes</thinking>Public markdown description',
        bodyPreview: '思考链：不要展示\n\nPublic body preview',
      },
    };

    const env = createMockEnv([leakingSkill]);
    const [skill] = await getAllSkills(env);

    expect(getLocalizedDescription(skill.description, 'en')).toBe('Public description');
    expect(skill.seo?.definition.en).toBe('Public definition');
    expect(skill.seo?.features.en).toEqual(['Public feature']);
    expect((skill.agentAnalysis?.suitability as Record<string, string>).en).toBe('Public suitability');
    expect((skill.agentAnalysis?.recommendation as Record<string, string>).en).toBe('Public recommendation');
    expect((skill.agentAnalysis?.useCases as Record<string, string[]>).en).toEqual(['Public use case']);
    expect(skill.skillMd?.description).toBe('Public markdown description');
    expect(skill.skillMd?.bodyPreview).toBe('Public body preview');
  });

  it('should return empty array when KV is empty', async () => {
    const env = createMockEnv([]);
    const result = await getAllSkills(env);
    expect(result).toEqual([]);
  });

  it('should return empty array when SKILLS_CACHE binding is unavailable', async () => {
    const env = {
      TRANSLATIONS: createMockKV(),
      DB: {
        prepare: vi.fn(() => ({
          all: vi.fn(async () => ({ success: true, results: [] })),
        })),
      } as unknown as D1Database,
      ASSETS: {} as Fetcher,
    } as unknown as Env;
    const result = await getAllSkills(env);
    expect(result).toEqual([]);
  });
});

describe('getSkillByOwnerRepo', () => {
  it('should find a skill by owner and repo via direct KV lookup', async () => {
    const skill = sampleSkills[0];
    const extraKV = new Map([[`skill:${skill.owner}/${skill.repo}`, JSON.stringify(skill)]]);
    const env = createMockEnv(sampleSkills, extraKV);

    const result = await getSkillByOwnerRepo(env, 'anthropics', 'skills');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Anthropic Skills');
  });

  it('should fall back to scanning all skills when direct lookup misses', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getSkillByOwnerRepo(env, 'test-owner', 'test-repo');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test Skill');
  });

  it('should return null when skill is not found', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getSkillByOwnerRepo(env, 'nonexistent', 'repo');
    expect(result).toBeNull();
  });

  it('should return null for non-target public skills', async () => {
    const extraKV = new Map([[`skill:${pollutedSkill.owner}/${pollutedSkill.repo}`, JSON.stringify(pollutedSkill)]]);
    const env = createMockEnv([...sampleSkills, pollutedSkill], extraKV);
    const result = await getSkillByOwnerRepo(env, pollutedSkill.owner, pollutedSkill.repo);
    expect(result).toBeNull();
  });

  it('should sanitize hidden reasoning from direct skill lookups', async () => {
    const skill: UnifiedSkill = {
      id: 'leaky/detail-skill',
      name: 'Detail Skill',
      skillName: 'detail-skill',
      owner: 'leaky',
      repo: 'detail-skill',
      description: '<thinking>private notes</thinking>Public detail description',
      category: 'development',
      topics: ['development'],
      stars: 1,
      source: 'cache',
      updatedAt: new Date().toISOString(),
      skillMd: {
        name: 'Detail Skill',
        description: 'Scratchpad:\nprivate notes\n\nPublic detail markdown',
        bodyPreview: 'Public detail body',
      },
    };
    const env = createMockEnv([skill]);

    const result = await getSkillByOwnerRepo(env, 'leaky', 'detail-skill');

    expect(result).not.toBeNull();
    expect(result?.description).toBe('Public detail description');
    expect(result?.skillMd?.description).toBe('Public detail markdown');
  });
});

describe('getFeaturedSkills', () => {
  it('should return skills sorted by stars descending', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getFeaturedSkills(env);
    expect(result[0].stars).toBe(52000);
    expect(result[1].stars).toBe(1200);
    expect(result[2].stars).toBe(100);
  });

  it('should respect the limit parameter', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getFeaturedSkills(env, 2);
    expect(result).toHaveLength(2);
    expect(result[0].stars).toBe(52000);
  });

  it('should default to limit of 10', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getFeaturedSkills(env);
    expect(result).toHaveLength(3); // only 3 skills available
  });
});

describe('getRelatedSkills', () => {
  const relatedSkills: UnifiedSkill[] = [
    ...sampleSkills,
    {
      id: '4',
      name: 'Another AI Skill',
      skillName: 'another-ai',
      owner: 'other',
      repo: 'ai-tool',
      description: 'Another AI tool',
      category: 'ai',
      topics: ['claude', 'llm'],
      stars: 500,
      source: 'verified',
      updatedAt: new Date().toISOString(),
    },
    {
      id: '5',
      name: 'Unrelated Skill',
      skillName: 'unrelated',
      owner: 'someone',
      repo: 'unrelated',
      description: 'Unrelated skill',
      category: 'other',
      topics: ['random'],
      stars: 50,
      source: 'cache',
      updatedAt: new Date().toISOString(),
    },
  ];

  it('should return related skills from the same category', async () => {
    const env = createMockEnv(relatedSkills);
    const current = relatedSkills[0]; // category: 'ai'
    const result = await getRelatedSkills(env, current, 5);
    // Should include the other 'ai' category skill but not 'testing' or 'other'
    expect(result.every((s) => s.id !== current.id)).toBe(true);
    expect(result.some((s) => s.id === '4')).toBe(true);
    expect(result.every((s) => s.category === 'ai')).toBe(true);
  });

  it('should exclude the current skill', async () => {
    const env = createMockEnv(relatedSkills);
    const current = relatedSkills[0];
    const result = await getRelatedSkills(env, current);
    expect(result.find((s) => s.id === current.id)).toBeUndefined();
  });

  it('should respect the limit parameter', async () => {
    const env = createMockEnv(relatedSkills);
    const current = relatedSkills[0];
    const result = await getRelatedSkills(env, current, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('should prioritize skills with overlapping topics', async () => {
    const env = createMockEnv([
      ...relatedSkills,
      {
        ...relatedSkills[0],
        id: 'high-stars-no-topic-match',
        owner: 'popular',
        repo: 'popular-tool',
        topics: ['random'],
        stars: 50000,
      },
      {
        ...relatedSkills[0],
        id: 'low-stars-topic-match',
        owner: 'focused',
        repo: 'focused-tool',
        topics: ['claude'],
        stars: 10,
      },
    ]);
    const current = relatedSkills[0]; // topics: ['claude', 'agent']
    const result = await getRelatedSkills(env, current, 5);
    const lowStarsTopicMatchIndex = result.findIndex((skill) => skill.id === 'low-stars-topic-match');
    const highStarsNoTopicMatchIndex = result.findIndex((skill) => skill.id === 'high-stars-no-topic-match');
    expect(lowStarsTopicMatchIndex).toBeGreaterThanOrEqual(0);
    expect(lowStarsTopicMatchIndex).toBeLessThan(highStarsNoTopicMatchIndex);
  });

  it('should query a bounded category candidate set instead of loading the full catalog', async () => {
    const env = createMockEnv(relatedSkills);
    const current = relatedSkills[0];

    await getRelatedSkills(env, current, 4);

    const prepare = vi.mocked(env.DB!.prepare);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(String(prepare.mock.calls[0]?.[0])).toContain('WHERE category = ?1');
    expect(String(prepare.mock.calls[0]?.[0])).toContain('LIMIT ?5');
    expect(String(prepare.mock.calls[0]?.[0])).toContain('owner = ?3');
    expect(String(prepare.mock.calls[0]?.[0])).toContain('repo = ?4');
    expect(vi.mocked(prepare.mock.results[0]?.value.bind)).toHaveBeenCalledWith('ai', '1', 'anthropics', 'skills', 16);
  });

  it('should use a bounded all-category query when the current skill has no category', async () => {
    const env = createMockEnv(relatedSkills);
    const current = { ...relatedSkills[0], category: '' };

    await getRelatedSkills(env, current, 4);

    const prepare = vi.mocked(env.DB!.prepare);
    expect(String(prepare.mock.calls[0]?.[0])).toContain('WHERE id != ?1');
    expect(String(prepare.mock.calls[0]?.[0])).not.toContain('WHERE category = ?1');
    expect(vi.mocked(prepare.mock.results[0]?.value.bind)).toHaveBeenCalledWith('1', 'anthropics', 'skills', 16);
  });
});

describe('getFeaturedSkillsDirect', () => {
  it('should return skills sorted by stars from D1', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getFeaturedSkillsDirect(env, 2);
    expect(result).toHaveLength(2);
    expect(result[0].stars).toBeGreaterThanOrEqual(result[1].stars);
  });

  it('should fallback to getFeaturedSkills when DB is unavailable', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = createMockEnv(sampleSkills);
    (env as any).DB = undefined;
    try {
      const result = await getFeaturedSkillsDirect(env, 2);
      // Without DB, getAllSkills falls back to KV/local data which may be empty in test
      expect(Array.isArray(result)).toBe(true);
      expect(consoleWarn).toHaveBeenCalledWith('[D1] No DB binding, falling back to getAllSkills');
    } finally {
      consoleWarn.mockRestore();
    }
  });
});

describe('getOfficialSkillCounts', () => {
  it('should return skill counts grouped by owner from D1', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getOfficialSkillCounts(env, ['anthropics', 'vercel-labs']);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('owner');
    expect(result[0]).toHaveProperty('count');
  });

  it('should return empty array for empty owners list', async () => {
    const env = createMockEnv(sampleSkills);
    (env as any).DB = undefined;
    const result = await getOfficialSkillCounts(env, []);
    expect(result).toEqual([]);
  });
});

describe('getLightweightSkills', () => {
  it('should return skills from D1 listing', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getLightweightSkills(env);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should exclude non-target skills from lightweight listings', async () => {
    const env = createMockEnv([...sampleSkills, pollutedSkill]);
    const result = await getLightweightSkills(env);
    expect(result.some((skill) => skill.id === pollutedSkill.id)).toBe(false);
  });

  it('should use module cache on subsequent calls', async () => {
    const env = createMockEnv(sampleSkills);
    const first = await getLightweightSkills(env);
    const second = await getLightweightSkills(env);
    // Should return same reference from cache
    expect(first).toBe(second);
  });
});
