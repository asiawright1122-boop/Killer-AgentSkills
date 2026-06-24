import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../../src/lib/api-test-utils';
import type { UnifiedSkill } from '../../../../src/lib/public-skill-catalog';

const mockGetLightweightSkills = vi.fn<() => Promise<UnifiedSkill[]>>();

vi.mock('../../../../src/lib/public-skill-catalog', async () => {
  const actual =
    await vi.importActual<typeof import('../../../../src/lib/public-skill-catalog')>(
      '../../../../src/lib/public-skill-catalog',
    );
  return {
    ...actual,
    getLightweightSkills: mockGetLightweightSkills,
  };
});

describe('GET /api/stats/growth', () => {
  let GET: typeof import('../../../../src/pages/api/stats/growth').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockGetLightweightSkills.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ({ GET } = await import('../../../../src/pages/api/stats/growth'));
  });

  it('returns growth totals with public API noindex headers', async () => {
    mockGetLightweightSkills.mockResolvedValue([
      {
        id: '1',
        owner: 'test',
        repo: 'verified-skill',
        name: 'Verified Skill',
        skillName: 'Verified Skill',
        description: { en: 'Public description' },
        category: 'productivity',
        topics: [],
        stars: 10,
        source: 'verified',
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        owner: 'test',
        repo: 'cache-skill',
        name: 'Cache Skill',
        skillName: 'Cache Skill',
        description: { en: 'Public description' },
        category: 'ai',
        topics: [],
        stars: 5,
        source: 'cache',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/stats/growth',
        env: createMockEnv(),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(body).toMatchObject({
      totalSkills: 2,
      totalCategories: 2,
      totalStars: 15,
      sources: { verified: 1, featured: 0, cache: 1 },
      recentSkills: 1,
    });
  });

  it('keeps growth errors noindexed', async () => {
    mockGetLightweightSkills.mockRejectedValueOnce(new Error('DB unavailable'));

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/stats/growth',
        env: createMockEnv(),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(body).toEqual({ error: 'Failed to fetch growth stats' });
  });
});
