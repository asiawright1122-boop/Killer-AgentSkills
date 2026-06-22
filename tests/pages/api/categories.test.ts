import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../src/lib/api-test-utils';

vi.mock('../../../src/lib/public-skill-catalog', () => ({
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
    await expect(response.json()).resolves.toEqual({
      categories: [
        { name: 'productivity', count: 3 },
        { name: 'other', count: 2 },
      ],
      total: 2,
    });
  });

  it('returns an empty payload when runtime env is unavailable', async () => {
    const response = await GET({
      ...createAPIContext({ url: 'http://localhost/api/categories' }),
      locals: {},
    } as any);

    expect(response.status).toBe(200);
    expect(getLightweightSkillsCategorySummary).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      categories: [],
      total: 0,
    });
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
    await expect(response.json()).resolves.toEqual({
      categories: [{ name: 'development', count: 1 }],
      total: 1,
    });
  });
});
