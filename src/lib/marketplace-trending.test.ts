import { describe, expect, it } from 'vitest';
import { sortMarketplaceSkillsPopular } from './marketplace-policy';
import { attachSkillActivity, sortSkillsTrending } from './marketplace-trending';
import type { UnifiedSkill } from './skills';

const makeSkill = (id: string, activity: Partial<UnifiedSkill> = {}): UnifiedSkill => ({
  id,
  name: id,
  skillName: id,
  owner: 'owner',
  repo: id,
  description: `${id} description`,
  category: 'developer',
  topics: [],
  stars: 10,
  forks: 0,
  source: 'verified',
  updatedAt: '2026-07-16T00:00:00.000Z',
  qualityScore: 80,
  securityLevel: 'A',
  sourceTrust: 'T1',
  rankScore: 80,
  isTrustedRankingEligible: true,
  filePath: 'SKILL.md',
  ...activity,
});

describe('sortSkillsTrending', () => {
  it('ranks recent CLI installs above website copies', () => {
    const ranked = sortSkillsTrending([
      makeSkill('copy-heavy', { trendScore: 8, cliInstalls7d: 0 }),
      makeSkill('installed', { trendScore: 12, cliInstalls7d: 1 }),
    ]);

    expect(ranked.map((skill) => skill.id)).toEqual(['installed', 'copy-heavy']);
  });

  it('falls back exactly to Popular when every trend score is zero', () => {
    const skills = [
      makeSkill('lower', { rankScore: 20, stars: 100 }),
      makeSkill('higher', { rankScore: 90, stars: 1 }),
    ];

    expect(sortSkillsTrending(skills).map((skill) => skill.id)).toEqual(
      sortMarketplaceSkillsPopular(skills).map((skill) => skill.id),
    );
  });

  it('removes non-admitted skills before Trending', () => {
    const safeSkill = makeSkill('safe');
    const blockedSkill = makeSkill('blocked', { securityLevel: 'D', trendScore: 999 });

    expect(sortSkillsTrending([safeSkill, blockedSkill]).map((skill) => skill.id)).toEqual(['safe']);
  });
});

describe('attachSkillActivity', () => {
  it('copies canonical activity metrics without mutating skills', () => {
    const skill = makeSkill('owner/repo/skill', { repo: 'repo' });
    const metrics = new Map([
      [
        'owner/repo/skill',
        {
          cliInstalls7d: 2,
          cliInstalls30d: 5,
          installActions7d: 3,
          installActions30d: 9,
          trendScore: 31,
        },
      ],
    ]);

    const [attached] = attachSkillActivity([skill], metrics);

    expect(attached).not.toBe(skill);
    expect(attached).toMatchObject({ cliInstalls7d: 2, installActions7d: 3, trendScore: 31 });
    expect(skill.cliInstalls7d).toBeUndefined();
  });
});
