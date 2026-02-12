import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllSkills,
  getSkillByOwnerRepo,
  getSkillsByCategory,
  getFeaturedSkills,
  getLocalizedDescription,
  type UnifiedSkill,
} from './skills';
import type { Env } from './kv';

// Prevent dev-mode fallback to local data/skills-cache.json during tests
const originalDev = import.meta.env.DEV;
beforeEach(() => {
  // @ts-ignore
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
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function createMockEnv(skills: UnifiedSkill[] = [], extraKV: Map<string, any> = new Map()): Env {
  const store = new Map<string, any>([
    ['all-skills', JSON.stringify(skills)],
    ...extraKV,
  ]);
  return {
    TRANSLATIONS: createMockKV(),
    SKILLS_CACHE: createMockKV(store),
    AI: {},
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

describe('getLocalizedDescription', () => {
  it('should return empty string for undefined description', () => {
    expect(getLocalizedDescription(undefined, 'en')).toBe('');
  });

  it('should return string description as-is', () => {
    expect(getLocalizedDescription('Hello world', 'en')).toBe('Hello world');
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

  it('should return empty array when KV is empty', async () => {
    const env = createMockEnv([]);
    const result = await getAllSkills(env);
    expect(result).toEqual([]);
  });

  it('should return empty array when SKILLS_CACHE binding is unavailable', async () => {
    const env = { TRANSLATIONS: createMockKV(), AI: {}, ASSETS: {} as Fetcher } as unknown as Env;
    const result = await getAllSkills(env);
    expect(result).toEqual([]);
  });
});

describe('getSkillByOwnerRepo', () => {
  it('should find a skill by owner and repo via direct KV lookup', async () => {
    const skill = sampleSkills[0];
    const extraKV = new Map([
      [`skill:${skill.owner}/${skill.repo}`, JSON.stringify(skill)],
    ]);
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
});

describe('getSkillsByCategory', () => {
  it('should filter skills by category', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getSkillsByCategory(env, 'ai');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Anthropic Skills');
  });

  it('should return empty array for non-matching category', async () => {
    const env = createMockEnv(sampleSkills);
    const result = await getSkillsByCategory(env, 'nonexistent');
    expect(result).toEqual([]);
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
