import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockD1, createMockEnv } from '../../../src/lib/api-test-utils';
import { findHiddenReasoningPublicOutputMatches } from '../../../src/lib/public-ai-output';
import type { UnifiedSkill } from '../../../src/lib/public-skill-catalog';

const { mockGetLightweightSkills, mockSearchSkills } = vi.hoisted(() => ({
  mockGetLightweightSkills: vi.fn<() => Promise<UnifiedSkill[]>>(),
  mockSearchSkills: vi.fn<(skills: UnifiedSkill[], query: string, locale?: string) => UnifiedSkill[]>(),
}));

vi.mock('../../../src/lib/public-skill-catalog', async () => {
  const actual = await vi.importActual<typeof import('../../../src/lib/public-skill-catalog')>(
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
        sourceTrust: 'T1',
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

  it('fallback path excludes D and trusted-ranking-ineligible skills before search results return', async () => {
    const allowed: UnifiedSkill = {
      id: 'owner/allowed',
      owner: 'owner',
      repo: 'allowed',
      name: 'Allowed',
      skillName: 'Allowed',
      description: { en: 'Allowed skill' },
      category: 'dev',
      topics: ['allowed'],
      stars: 10,
      rankScore: 80,
      qualityScore: 70,
      securityLevel: 'A',
      sourceTrust: 'T1',
      isTrustedRankingEligible: true,
      source: 'cache',
      updatedAt: '2026-04-19T00:00:00.000Z',
    };
    const blockedBySecurity: UnifiedSkill = {
      ...allowed,
      id: 'owner/blocked-security',
      repo: 'blocked-security',
      name: 'Blocked Security',
      securityLevel: 'D',
    };
    const blockedByEligibility: UnifiedSkill = {
      ...allowed,
      id: 'owner/blocked-eligibility',
      repo: 'blocked-eligibility',
      name: 'Blocked Eligibility',
      isTrustedRankingEligible: 'false' as never,
    };

    mockGetLightweightSkills.mockResolvedValue([allowed, blockedBySecurity, blockedByEligibility]);
    mockSearchSkills.mockImplementation((items) => items);

    const res = await GET(
      createAPIContext({ url: 'http://localhost/api/search?q=allowed&locale=en', env: createMockEnv() }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ name: string }> };
    expect(body.results.map((result) => result.name)).toEqual(['Allowed']);
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
        sourceTrust: 'T1',
        securityLevel: 'A',
        isTrustedRankingEligible: true,
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

  it('filters D1 keyword matches when trusted-ranking metadata is false-ish', async () => {
    const mockDB = createMockD1([
      {
        id: 'allowed/skill',
        owner: 'allowed',
        repo: 'skill',
        name: 'Allowed Skill',
        stars: 10,
        category: 'documentation',
        source: 'cache',
        rankScore: 60,
        qualityScore: 50,
        securityLevel: 'A',
        sourceTrust: 'T1',
        isTrustedRankingEligible: true,
      },
      {
        id: 'blocked/skill',
        owner: 'blocked',
        repo: 'skill',
        name: 'Blocked Skill',
        stars: 999,
        category: 'documentation',
        source: 'cache',
        rankScore: 99,
        qualityScore: 99,
        securityLevel: 'A',
        sourceTrust: 'T1',
        isTrustedRankingEligible: 'false',
      },
    ]);

    const res = await GET(
      createAPIContext({
        url: 'http://localhost/api/search?q=skill&locale=en',
        env: createMockEnv({ DB: mockDB as unknown as D1Database }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ name: string }> };
    expect(body.results.map((result) => result.name)).toEqual(['Allowed Skill']);
  });

  it('filters Vectorize metadata matches when security or trusted-ranking metadata is false-ish', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async () => ({ data: [[0.1, 0.2, 0.3]] })),
      },
      VECTORIZE: {
        query: vi.fn(async () => ({
          matches: [
            {
              id: 'blocked-security',
              metadata: {
                owner: 'blocked',
                repo: 'security',
                name: 'Blocked Security',
                securityLevel: 'D',
                sourceTrust: 'T1',
              },
            },
            {
              id: 'blocked-eligibility',
              metadata: {
                owner: 'blocked',
                repo: 'eligibility',
                name: 'Blocked Eligibility',
                securityLevel: 'A',
                sourceTrust: 'T1',
                isTrustedRankingEligible: '0',
              },
            },
            {
              id: 'missing-admission',
              metadata: {
                owner: 'missing',
                repo: 'admission',
                name: 'Missing Admission',
                stars: 999,
                rankScore: 99,
              },
            },
            {
              id: 'allowed',
              metadata: {
                owner: 'allowed',
                repo: 'skill',
                name: 'Allowed Skill',
                securityLevel: 'A',
                sourceTrust: 'T1',
                isTrustedRankingEligible: true,
                stars: 12,
                rankScore: 77,
              },
            },
          ],
        })),
      } as unknown as VectorizeIndex,
    });

    const res = await GET(createAPIContext({ url: 'http://localhost/api/search?q=skill&locale=en', env }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ name: string }> };
    expect(body.results.map((result) => result.name)).toEqual(['Allowed Skill']);
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
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(500);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(consoleError).toHaveBeenCalledWith('Search API Error:', expect.any(Error));
    expect(body.error).toBe('Internal server error');
    expect(findHiddenReasoningPublicOutputMatches(JSON.stringify(body))).toEqual([]);
  });
});
