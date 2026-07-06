import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockD1, createMockEnv } from '../../../src/lib/api-test-utils';
import { findHiddenReasoningPublicOutputMatches } from '../../../src/lib/public-ai-output';
import type { UnifiedSkill } from '../../../src/lib/public-skill-catalog';

const mockGetLightweightSkills = vi.fn<() => Promise<UnifiedSkill[]>>();
const mockSearchSkills = vi.fn<(skills: UnifiedSkill[], query: string, locale?: string) => UnifiedSkill[]>();

vi.mock('../../../src/lib/public-skill-catalog', async () => {
  const actual =
    await vi.importActual<typeof import('../../../src/lib/public-skill-catalog')>(
      '../../../src/lib/public-skill-catalog',
    );
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

    const res = await GET(
      createAPIContext({ url: 'http://localhost/api/search?q=art&locale=en', env: createMockEnv() }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

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
        id: 'langgenius/dify/frontend-code-review',
        owner: 'langgenius',
        repo: 'dify',
        name: '<thinking>private match notes</thinking>Code Review',
        stars: 10,
        category: 'Private analysis:\ninternal category\n\ndocumentation',
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
        id: 'langgenius/dify/frontend-code-review',
        name: 'Code Review',
        category: 'documentation',
        routePath: 'dify/frontend-code-review',
        detailLocale: 'en',
        href: '/en/skills/langgenius/dify/frontend-code-review',
      }),
    ]);
  });

  it('returns noindex headers for empty query errors', async () => {
    const res = await GET(createAPIContext({ url: 'http://localhost/api/search', env: createMockEnv() }));

    expect(res.status).toBe(400);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('sanitizes hidden reasoning from search error responses', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetLightweightSkills.mockRejectedValueOnce(
      new Error('<reasoning>private search notes</reasoning>Public failure'),
    );

    const res = await GET(createAPIContext({ url: 'http://localhost/api/search?q=art', env: createMockEnv() }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(consoleError).toHaveBeenCalledWith('Search API Error:', expect.any(Error));
    expect(body.error).toBe('Internal server error');
    expect(findHiddenReasoningPublicOutputMatches(JSON.stringify(body))).toEqual([]);
  });
});
