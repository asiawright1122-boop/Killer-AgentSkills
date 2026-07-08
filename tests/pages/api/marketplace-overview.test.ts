import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../src/lib/api-test-utils';

vi.mock('../../../src/lib/public-skill-catalog', () => ({
  getLightweightSkills: vi.fn(),
  getLightweightSkillsCategorySummary: vi.fn(),
}));

type MarketplaceOverviewResponseBody = {
  success: boolean;
  overview: {
    locale: string;
    totalSkillCount: number;
    categories: Array<{
      id: string;
      label: string;
      count: number;
      href: string;
      icon: string;
      seoDescription: string;
    }>;
    featuredRoutes: Array<{ href: string }>;
    featuredCollections: unknown[];
    solutionEntries: unknown[];
  };
};

describe('GET /api/marketplace/overview', () => {
  let GET: typeof import('../../../src/pages/api/marketplace/overview').GET;
  let getLightweightSkillsCategorySummary: typeof import('../../../src/lib/public-skill-catalog').getLightweightSkillsCategorySummary;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ getLightweightSkillsCategorySummary } = await import('../../../src/lib/public-skill-catalog'));
    ({ GET } = await import('../../../src/pages/api/marketplace/overview'));
  });

  it('returns the normalized marketplace overview for the requested locale', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 9,
      categories: [
        { category: 'development', count: 4 },
        { category: 'database', count: 2 },
      ],
    });

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/marketplace/overview?locale=zh',
        env: createMockEnv(),
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const body = (await response.json()) as MarketplaceOverviewResponseBody;
    expect(body.success).toBe(true);
    expect(body.overview.locale).toBe('zh');
    expect(body.overview.totalSkillCount).toBe(9);
    expect(body.overview.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'developer',
          label: '开发者工具',
          count: 4,
          href: '/zh/categories/developer',
          icon: 'code',
          seoDescription: expect.stringContaining('开发工具技能'),
        }),
        expect.objectContaining({
          id: 'data',
          label: '数据',
          count: 2,
          href: '/zh/categories/data',
          icon: 'bar-chart',
          seoDescription: expect.stringContaining('数据技能'),
        }),
      ]),
    );
    expect(body.overview.featuredRoutes.map((route: { href: string }) => route.href)).toEqual(
      expect.arrayContaining([
        '/zh',
        '/zh/skills',
        '/zh/popular',
        '/zh/occupations',
        '/zh/collections',
        '/zh/docs/installation',
      ]),
    );
    expect(body.overview.featuredRoutes).toHaveLength(6);
    expect(body.overview.featuredCollections).toEqual([]);
    expect(body.overview.solutionEntries).toEqual([]);
  });
});
