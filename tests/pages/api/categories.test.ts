import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../src/lib/api-test-utils';

vi.mock('../../../src/lib/public-skill-catalog', () => ({
  getLightweightSkills: vi.fn(),
  getLightweightSkillsCategorySummary: vi.fn(),
}));

describe('GET /api/categories', () => {
  let GET: typeof import('../../../src/pages/api/categories').GET;
  let getLightweightSkillsCategorySummary: typeof import('../../../src/lib/public-skill-catalog').getLightweightSkillsCategorySummary;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ getLightweightSkillsCategorySummary } = await import('../../../src/lib/public-skill-catalog'));
    ({ GET } = await import('../../../src/pages/api/categories'));
  });

  it('returns lightweight category counts without loading full skill payloads', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 5,
      categories: [
        { category: 'productivity', count: 3 },
        { category: '', count: 2 },
      ],
    });

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/categories',
        env: createMockEnv(),
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(getLightweightSkillsCategorySummary).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body.total).toBe(2);
    expect(body.totalSkillCount).toBe(5);
    expect(body.categories).toEqual([
      expect.objectContaining({
        name: 'productivity',
        id: 'productivity',
        label: 'Productivity',
        count: 3,
        href: '/en/categories/productivity',
        icon: 'zap',
        description: expect.stringContaining('productivity'),
      }),
      expect.objectContaining({
        name: 'other',
        id: 'other',
        label: 'Other',
        count: 2,
        href: '/en/search',
        icon: 'layers',
        description: expect.stringContaining('not yet mapped'),
      }),
    ]);
  });

  it('uses the public catalog fallback when runtime env is unavailable', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 2,
      categories: [{ category: 'developer', count: 2 }],
    });

    const response = await GET({
      ...createAPIContext({ url: 'http://localhost/api/categories' }),
      locals: {},
    } as any);

    expect(response.status).toBe(200);
    expect(getLightweightSkillsCategorySummary).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body.categories).toEqual([
      expect.objectContaining({
        name: 'developer',
        count: 2,
      }),
    ]);
    expect(body.totalSkillCount).toBe(2);
  });

  it('sanitizes hidden reasoning from category names', async () => {
    vi.mocked(getLightweightSkillsCategorySummary).mockResolvedValue({
      total: 1,
      categories: [{ category: 'Scratchpad:\nprivate notes\n\ndevelopment', count: 1 }],
    });

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/categories',
        env: createMockEnv(),
      }) as any,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.categories).toEqual([expect.objectContaining({ name: 'developer', count: 1 })]);
    expect(body.total).toBe(1);
  });
});
