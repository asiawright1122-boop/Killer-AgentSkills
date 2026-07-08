import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMarketplaceOverview } from './marketplace-overview';
import { getLightweightSkills, getLightweightSkillsCategorySummary } from './public-skill-catalog';

vi.mock('./public-skill-catalog', () => ({
  getLightweightSkills: vi.fn(),
  getLightweightSkillsCategorySummary: vi.fn(),
}));

const t = (key: string) =>
  ({
    'Sidebar.categories.developer': 'Developer Tools',
    'Sidebar.categories.data': 'Data',
    'Sidebar.categories.browser': 'Browser',
  })[key] || key;

describe('getMarketplaceOverview', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds category cards from the public skill catalog summary', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 12,
      categories: [
        { category: 'development', count: 5 },
        { category: 'developer', count: 2 },
        { category: 'database', count: 3 },
      ],
    });

    const overview = await getMarketplaceOverview({} as any, 'en', t);

    expect(getLightweightSkillsCategorySummary).toHaveBeenCalledTimes(1);
    expect(overview.totalSkillCount).toBe(12);
    expect(overview.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'developer',
          label: 'Developer Tools',
          count: 7,
          href: '/en/categories/developer',
        }),
        expect.objectContaining({
          id: 'data',
          label: 'Data',
          count: 3,
          href: '/en/categories/data',
        }),
      ]),
    );
    expect(overview.topCategories[0]).toEqual(expect.objectContaining({ id: 'developer', count: 7 }));
    expect(overview.featuredRoutes.map((route) => route.href)).toEqual(
      expect.arrayContaining([
        '/en',
        '/en/skills',
        '/en/popular',
        '/en/occupations',
        '/en/collections',
        '/en/docs/installation',
      ]),
    );
    expect(overview.featuredRoutes).toHaveLength(6);
    expect(overview.featuredCollections).toEqual([]);
    expect(overview.solutionEntries).toEqual([]);
  });

  it('uses the public catalog fallback when no runtime env is available', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 4,
      categories: [{ category: 'productivity', count: 4 }],
    });

    const overview = await getMarketplaceOverview(undefined, 'zh', t);

    expect(getLightweightSkillsCategorySummary).toHaveBeenCalledTimes(1);
    expect(overview.totalSkillCount).toBe(4);
    expect(overview.categories).toEqual([expect.objectContaining({ id: 'productivity', count: 4 })]);
    expect(overview.featuredRoutes.map((route) => route.href)).toEqual(
      expect.arrayContaining([
        '/zh',
        '/zh/skills',
        '/zh/popular',
        '/zh/occupations',
        '/zh/collections',
        '/zh/docs/installation',
      ]),
    );
    expect(overview.featuredCollections).toEqual([]);
    expect(overview.solutionEntries).toEqual([]);
  });

  it('can expose unmapped categories as an API-only other bucket', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 3,
      categories: [
        { category: 'Scratchpad:\nprivate notes\n\ndevelopment', count: 2 },
        { category: '', count: 1 },
      ],
    });

    const overview = await getMarketplaceOverview({} as any, 'en', t, { includeOtherCategory: true });

    expect(overview.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'developer', count: 2 }),
        expect.objectContaining({ id: 'other', label: 'Other', count: 1, href: '/en/search' }),
      ]),
    );
  });

  it('retries the local catalog fallback in dev when the local D1 binding is empty', async () => {
    vi.mocked(getLightweightSkillsCategorySummary)
      .mockResolvedValueOnce({ total: 0, categories: [] })
      .mockResolvedValueOnce({
        total: 6,
        categories: [{ category: 'browser', count: 6 }],
      });

    const overview = await getMarketplaceOverview({ DB: {} } as any, 'en', t);

    expect(getLightweightSkillsCategorySummary).toHaveBeenCalledTimes(2);
    expect(getLightweightSkillsCategorySummary).toHaveBeenLastCalledWith({});
    expect(overview.totalSkillCount).toBe(6);
    expect(overview.categories).toEqual([expect.objectContaining({ id: 'browser', count: 6 })]);
  });

  it('derives marketplace categories from lightweight skills when the summary only has source buckets', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 3,
      categories: [{ category: 'community', count: 3 }],
    });
    vi.mocked(getLightweightSkills).mockResolvedValue([
      {
        id: 'dev/tool',
        name: 'TypeScript MCP Toolkit',
        category: 'community',
        topics: ['typescript', 'mcp'],
      },
      {
        id: 'browser/tool',
        name: 'Playwright Browser Runner',
        category: 'community',
        topics: ['playwright', 'browser'],
      },
      {
        id: 'docs/tool',
        name: 'Markdown Docs Builder',
        category: 'community',
        topics: ['markdown', 'docs'],
      },
    ] as any);

    const overview = await getMarketplaceOverview({} as any, 'en', t);

    expect(overview.totalSkillCount).toBe(3);
    expect(overview.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'developer', count: 1 }),
        expect.objectContaining({ id: 'browser', count: 1 }),
        expect.objectContaining({ id: 'documentation', count: 1 }),
      ]),
    );
  });
});
