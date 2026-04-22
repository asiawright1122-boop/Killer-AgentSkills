import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockD1, createMockEnv } from '../../../src/lib/api-test-utils';
import type { UnifiedSkill } from '../../../src/lib/skills';

const mockGetLightweightSkills = vi.fn<() => Promise<UnifiedSkill[]>>();
const mockSearchSkills = vi.fn<(skills: UnifiedSkill[], query: string, locale?: string) => UnifiedSkill[]>();

vi.mock('../../../src/lib/skills', async () => {
  const actual = await vi.importActual<typeof import('../../../src/lib/skills')>('../../../src/lib/skills');
  return {
    ...actual,
    getLightweightSkills: mockGetLightweightSkills,
  };
});

vi.mock('../../../src/lib/search', async () => {
  const actual = await vi.importActual<typeof import('../../../src/lib/search')>('../../../src/lib/search');
  return {
    ...actual,
    searchSkills: mockSearchSkills,
  };
});

describe('GET /api/search', () => {
  let GET: typeof import('../../../src/pages/api/search').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockGetLightweightSkills.mockReset();
    mockSearchSkills.mockReset();
    GET = (await import('../../../src/pages/api/search')).GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns canonical subskill hrefs in the fallback path', async () => {
    const skills: UnifiedSkill[] = [
      {
        id: 'anthropics/skills/algorithmic-art',
        owner: 'anthropics',
        repo: 'skills',
        name: 'Algorithmic Art',
        skillName: 'Algorithmic Art',
        description: { en: 'Generative art utilities' },
        category: 'design',
        topics: ['art'],
        stars: 42,
        source: 'cache',
        updatedAt: '2026-04-19T00:00:00.000Z',
      },
    ];

    mockGetLightweightSkills.mockResolvedValue(skills);
    mockSearchSkills.mockImplementation((items) => items);

    const res = await GET(createAPIContext({ url: 'http://localhost/api/search?q=art&locale=en', env: createMockEnv() }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toEqual([
      expect.objectContaining({
        id: 'anthropics/skills/algorithmic-art',
        owner: 'anthropics',
        repo: 'skills',
        routePath: 'skills/algorithmic-art',
        detailLocale: 'en',
        href: '/en/skills/anthropics/skills/algorithmic-art',
      }),
    ]);
  });

  it('uses locale governance when building hrefs from D1 keyword matches', async () => {
    const mockDB = createMockD1([
      {
        id: '0boluan0/Notes_on_Economic_Statistics/today',
        owner: '0boluan0',
        repo: 'Notes_on_Economic_Statistics',
        name: 'Today',
        stars: 10,
        category: 'documentation',
        source: 'cache',
      },
    ]);

    const res = await GET(
      createAPIContext({
        url: 'http://localhost/api/search?q=today&locale=ja',
        env: createMockEnv({ DB: mockDB as unknown as D1Database }),
      }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toEqual([
      expect.objectContaining({
        id: '0boluan0/Notes_on_Economic_Statistics/today',
        routePath: 'Notes_on_Economic_Statistics/today',
        detailLocale: 'en',
        href: '/en/skills/0boluan0/Notes_on_Economic_Statistics/today',
      }),
    ]);
  });
});
