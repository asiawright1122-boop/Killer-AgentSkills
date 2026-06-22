import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../src/lib/api-test-utils';
import type { UnifiedSkill } from '../../../src/lib/public-skill-catalog';

const mockGetAllSkills = vi.fn<() => Promise<UnifiedSkill[]>>();

vi.mock('../../../src/lib/public-skill-catalog', async () => {
  const actual =
    await vi.importActual<typeof import('../../../src/lib/public-skill-catalog')>(
      '../../../src/lib/public-skill-catalog',
    );
  return {
    ...actual,
    getAllSkills: mockGetAllSkills,
  };
});

describe('GET /api/badge', () => {
  let GET: typeof import('../../../src/pages/api/badge').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockGetAllSkills.mockReset();
    ({ GET } = await import('../../../src/pages/api/badge'));
  });

  it('returns a skills badge with public API noindex headers', async () => {
    mockGetAllSkills.mockResolvedValue([{} as UnifiedSkill, {} as UnifiedSkill]);

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/badge?type=skills',
        env: createMockEnv(),
      }) as any,
    );
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(svg).toContain('skills on');
    expect(svg).toContain('2+');
  });

  it('returns an install badge variant', async () => {
    mockGetAllSkills.mockResolvedValue([]);

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/badge?type=installs',
        env: createMockEnv(),
      }) as any,
    );
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(svg).toContain('install via');
    expect(svg).toContain('killer-skills');
  });

  it('keeps fallback badge responses noindexed', async () => {
    mockGetAllSkills.mockRejectedValueOnce(new Error('DB unavailable'));

    const response = await GET(
      createAPIContext({
        url: 'http://localhost/api/badge?type=skills',
        env: createMockEnv(),
      }) as any,
    );
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(svg).toContain('3,400+');
  });
});
