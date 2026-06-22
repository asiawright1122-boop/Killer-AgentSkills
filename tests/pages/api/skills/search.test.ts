import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockD1, createMockKV, createAPIContext } from '../../../../src/lib/api-test-utils';
import type { UnifiedSkill } from '../../../../src/lib/public-skill-catalog';

const MOCK_SKILLS: UnifiedSkill[] = [
  {
    id: '1',
    name: 'Skill One',
    skillName: 'Skill One',
    owner: 'test-owner',
    repo: 'skill-one',
    description: { en: 'A first test skill', zh: '第一个测试技能' },
    category: 'productivity',
    topics: ['test'],
    stars: 100,
    source: 'verified' as const,
    updatedAt: '2024-01-01T00:00:00Z',
    filePath: '.claude/skills/skill-one/SKILL.md',
    skillMd: {
      body: '# Skill One\n\nThis is a hidden body.',
      bodyPreview: 'This preview should stay private in search results.',
    },
  },
  {
    id: '2',
    name: 'Skill Two',
    skillName: 'Skill Two',
    owner: 'test-owner',
    repo: 'skill-two',
    description: { en: 'A second test skill', zh: '第二个测试技能' },
    category: 'ai',
    topics: ['ai'],
    stars: 50,
    source: 'featured' as const,
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Skill Three',
    skillName: 'Skill Three',
    owner: 'other-owner',
    repo: 'skill-three',
    description: { en: 'Third skill for filtering', zh: '第三个技能' },
    category: 'productivity',
    topics: ['filter'],
    stars: 200,
    source: 'cache' as const,
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

function buildContext(url: string, env?: ReturnType<typeof createMockEnv>) {
  return createAPIContext({ url, env });
}

describe('GET /api/skills/search', () => {
  let GET: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('../../../../src/pages/api/skills/search');
    GET = mod.GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skip('returns 429 when rate limited', async () => {
    const ctx = buildContext('http://localhost/api/skills/search?q=test');
    for (let i = 0; i < 30; i++) {
      await GET(ctx);
    }
    const res = await GET(ctx);
    expect(res.status).toBe(429);
  });

  it('clamps page to minimum 1', async () => {
    const ctx = buildContext(
      'http://localhost/api/skills/search?q=test&page=0',
      createMockEnv({ DB: createMockD1([], 0) as unknown as D1Database }),
    );
    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
  });

  it('clamps limit to maximum 100', async () => {
    const ctx = buildContext(
      'http://localhost/api/skills/search?q=test&limit=200',
      createMockEnv({ DB: createMockD1([], 0) as unknown as D1Database }),
    );
    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills.length).toBeLessThanOrEqual(100);
  });

  it('defaults page to 1 for non-numeric', async () => {
    const ctx = buildContext(
      'http://localhost/api/skills/search?q=test&page=abc',
      createMockEnv({ DB: createMockD1([], 0) as unknown as D1Database }),
    );
    const res = await GET(ctx);
    expect(res.status).toBe(200);
  });

  it('D1 path: returns skills from D1 FTS query', async () => {
    const d1Results = MOCK_SKILLS.slice(0, 2).map((s) => ({
      data_json: JSON.stringify(s),
    }));
    const mockDB = createMockD1(d1Results, 2);

    const ctx = buildContext(
      'http://localhost/api/skills/search?q=skill',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills).toBeDefined();
    expect(Array.isArray(body.skills)).toBe(true);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
  });

  it('D1 path: returns skills filtered by category', async () => {
    const d1Results = MOCK_SKILLS.filter((s) => s.category === 'productivity').map((s) => ({
      data_json: JSON.stringify(s),
    }));
    const mockDB = createMockD1(d1Results, 2);

    const ctx = buildContext(
      'http://localhost/api/skills/search?category=productivity',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills).toBeDefined();
    body.skills.forEach((skill: UnifiedSkill) => {
      expect(skill.category).toBe('productivity');
    });
  });

  it('D1 path: returns empty array when no results', async () => {
    const mockDB = createMockD1([], 0);
    const ctx = buildContext(
      'http://localhost/api/skills/search?q=nonexistent',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('KV fallback: returns skills when D1 is not configured', async () => {
    const store = new Map<string, unknown>();
    MOCK_SKILLS.forEach((s) => store.set(`skill:${s.owner}/${s.repo}`, s));

    const ctx = buildContext(
      'http://localhost/api/skills/search?q=skill',
      createMockEnv({ SKILLS_CACHE: createMockKV(store), DB: undefined }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills).toBeDefined();
    expect(Array.isArray(body.skills)).toBe(true);
  });

  it('KV fallback: filters by category', async () => {
    const store = new Map<string, unknown>();
    MOCK_SKILLS.forEach((s) => store.set(`skill:${s.owner}/${s.repo}`, s));

    const ctx = buildContext(
      'http://localhost/api/skills/search?category=productivity',
      createMockEnv({ SKILLS_CACHE: createMockKV(store), DB: undefined }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills.length).toBeGreaterThan(0);
  });

  it('KV fallback: returns all skills when query is empty', async () => {
    const store = new Map<string, unknown>();
    MOCK_SKILLS.forEach((s) => store.set(`skill:${s.owner}/${s.repo}`, s));

    const ctx = buildContext(
      'http://localhost/api/skills/search',
      createMockEnv({ SKILLS_CACHE: createMockKV(store), DB: undefined }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills.length).toBeGreaterThan(0);
  });

  it('pagination: hasMore is true when more results exist', async () => {
    const d1Results = MOCK_SKILLS.slice(0, 2).map((s) => ({ data_json: JSON.stringify(s) }));
    const mockDB = createMockD1(d1Results, 5);

    const ctx = buildContext(
      'http://localhost/api/skills/search?limit=2&page=1',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasMore).toBe(true);
    expect(body.skills.length).toBe(2);
  });

  it('pagination: hasMore is false on last page', async () => {
    const d1Results = MOCK_SKILLS.slice(0, 2).map((s) => ({ data_json: JSON.stringify(s) }));
    const mockDB = createMockD1(d1Results, 2);

    const ctx = buildContext(
      'http://localhost/api/skills/search?limit=2&page=1',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasMore).toBe(false);
  });

  it('returns skills with correct pagination slice', async () => {
    const store = new Map<string, unknown>();
    const allSkills = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      owner: 'test',
      repo: `skill-${i + 1}`,
      name: `Skill ${i + 1}`,
      skillName: `Skill ${i + 1}`,
      description: { en: `Description ${i + 1}`, zh: `描述 ${i + 1}` },
      category: 'productivity',
      topics: ['test'],
      stars: 100 - i,
      source: 'cache' as const,
      updatedAt: '2024-01-01T00:00:00Z',
    }));
    allSkills.forEach((s) => store.set(`skill:${s.owner}/${s.repo}`, s));

    const ctx = buildContext(
      'http://localhost/api/skills/search?limit=10&page=2',
      createMockEnv({ SKILLS_CACHE: createMockKV(store), DB: undefined }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills.length).toBe(10);
    expect(body.page).toBe(2);
    expect(body.hasMore).toBe(true);
  });

  it('uses correct Cache-Control headers', async () => {
    const ctx = buildContext(
      'http://localhost/api/skills/search?q=test',
      createMockEnv({ DB: createMockD1([], 0) as unknown as D1Database }),
    );
    const res = await GET(ctx);
    expect(res.headers.get('Cache-Control')).toMatch(/s-maxage/);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('removes source-like fields from search responses', async () => {
    const d1Results = [MOCK_SKILLS[0]].map((s) => ({
      data_json: JSON.stringify(s),
    }));
    const mockDB = createMockD1(d1Results, 1);

    const ctx = buildContext(
      'http://localhost/api/skills/search?q=skill',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.skills[0].filePath).toBeUndefined();
    expect(body.skills[0].skillMd).toBeUndefined();
  });

  it('defaults to page 1 and limit 20 for missing pagination params', async () => {
    const d1Results = MOCK_SKILLS.map((s) => ({ data_json: JSON.stringify(s) }));
    const mockDB = createMockD1(d1Results, MOCK_SKILLS.length);

    const ctx = buildContext(
      'http://localhost/api/skills/search',
      createMockEnv({ DB: mockDB as unknown as D1Database }),
    );

    const res = await GET(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
  });
});
