import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../../src/lib/api-test-utils';
import type { UnifiedSkill } from '../../../../src/lib/public-skill-catalog';

const { mockGetLightweightMarketplaceSkillsPage, mockGetLightweightSkills } = vi.hoisted(() => ({
  mockGetLightweightMarketplaceSkillsPage: vi.fn<
    (_env: unknown, _page: number, _pageSize: number) => Promise<{
      skills: UnifiedSkill[];
      total: number;
      page: number;
      pageSize: number;
    }>
  >(),
  mockGetLightweightSkills: vi.fn<() => Promise<UnifiedSkill[]>>(),
}));

vi.mock('../../../../src/lib/public-skill-catalog', async () => {
  const actual = await vi.importActual<typeof import('../../../../src/lib/public-skill-catalog')>(
    '../../../../src/lib/public-skill-catalog',
  );
  return {
    ...actual,
    getLightweightMarketplaceSkillsPage: mockGetLightweightMarketplaceSkillsPage,
    getLightweightSkills: mockGetLightweightSkills,
  };
});

const skill = (overrides: Partial<UnifiedSkill>): UnifiedSkill =>
  ({
    id: overrides.id || `${overrides.owner || 'owner'}/${overrides.repo || 'repo'}`,
    name: overrides.name || 'Skill',
    skillName: overrides.skillName || overrides.name || 'Skill',
    owner: overrides.owner || 'owner',
    repo: overrides.repo || 'repo',
    description: overrides.description || { en: 'Public description', zh: '公开描述' },
    category: overrides.category || 'developer',
    topics: overrides.topics || ['agent'],
    stars: overrides.stars ?? 10,
    source: overrides.source || 'cache',
    securityLevel: overrides.securityLevel || 'A',
    sourceTrust: overrides.sourceTrust || 'T2',
    isTrustedRankingEligible: overrides.isTrustedRankingEligible ?? true,
    rankScore: overrides.rankScore ?? 50,
    qualityScore: overrides.qualityScore ?? 40,
    updatedAt: overrides.updatedAt || '2026-07-01T00:00:00.000Z',
    filePath: overrides.filePath || '.claude/skills/example/SKILL.md',
    skillMd: overrides.skillMd || {
      name: 'Skill',
      description: 'Public description',
      bodyPreview: 'Reviewed public skill source.',
    },
    ...overrides,
  }) as UnifiedSkill;

describe('GET /api/skills', () => {
  let GET: typeof import('../../../../src/pages/api/skills/index').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockGetLightweightMarketplaceSkillsPage.mockReset();
    mockGetLightweightSkills.mockReset();
    GET = (await import('../../../../src/pages/api/skills/index')).GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the admitted marketplace page from the paged provider without loading the full catalog', async () => {
    mockGetLightweightMarketplaceSkillsPage.mockResolvedValue({
      skills: [
        skill({ id: 'owner/admitted-1', repo: 'admitted-1', name: 'Admitted One' }),
        skill({ id: 'owner/admitted-2', repo: 'admitted-2', name: 'Admitted Two' }),
      ],
      total: 3,
      page: 1,
      pageSize: 2,
    });

    const res = await GET(createAPIContext({ url: 'http://localhost/api/skills?page=1&limit=2', env: createMockEnv() }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      skills: Array<{ name: string }>;
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };

    expect(body.skills.map((entry) => entry.name)).toEqual(['Admitted One', 'Admitted Two']);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
    expect(body.hasMore).toBe(true);
    expect(mockGetLightweightMarketplaceSkillsPage).toHaveBeenCalledWith(expect.any(Object), 1, 2);
    expect(mockGetLightweightSkills).not.toHaveBeenCalled();
  });

  it('computes hasMore from the admitted paged total', async () => {
    mockGetLightweightMarketplaceSkillsPage.mockResolvedValue({
      skills: [skill({ id: 'owner/admitted-2', repo: 'admitted-2', name: 'Admitted Two', description: { en: 'Only admitted row' } })],
      total: 2,
      page: 2,
      pageSize: 1,
    });

    const res = await GET(createAPIContext({ url: 'http://localhost/api/skills?page=2&limit=1', env: createMockEnv() }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      skills: Array<{ name: string }>;
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };

    expect(body.skills.map((entry) => entry.name)).toEqual(['Admitted Two']);
    expect(body.total).toBe(2);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(mockGetLightweightMarketplaceSkillsPage).toHaveBeenCalledWith(expect.any(Object), 2, 1);
    expect(mockGetLightweightSkills).not.toHaveBeenCalled();
  });
});
