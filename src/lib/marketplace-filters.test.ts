import { describe, expect, it } from 'vitest';
import type { UnifiedSkill } from './skills';
import {
  getMarketplaceSkills,
  getSkillSourceKind,
  isMarketplaceApprovedSkill,
  sortSkillsLatest,
  sortSkillsPopular,
} from './marketplace-filters';

const skill = (overrides: Partial<UnifiedSkill>): UnifiedSkill =>
  ({
    id: overrides.id || `${overrides.owner || 'owner'}/${overrides.repo || 'repo'}`,
    name: overrides.name || 'skill',
    skillName: overrides.skillName || overrides.name || 'skill',
    owner: overrides.owner || 'owner',
    repo: overrides.repo || 'repo',
    description: overrides.description || 'Useful agent skill',
    category: overrides.category || 'developer',
    topics: overrides.topics || [],
    stars: overrides.stars ?? 0,
    source: overrides.source || 'cache',
    updatedAt: overrides.updatedAt || '2026-07-01T00:00:00.000Z',
    ...overrides,
  }) as UnifiedSkill;

describe('marketplace filters', () => {
  it('excludes baseline safety failures from public marketplace lists', () => {
    const approved = skill({ name: 'approved', securityLevel: 'A', isTrustedRankingEligible: true });
    const failed = skill({ name: 'failed', securityLevel: 'D', isTrustedRankingEligible: false });

    expect(isMarketplaceApprovedSkill(approved)).toBe(true);
    expect(isMarketplaceApprovedSkill(failed)).toBe(false);
    expect(getMarketplaceSkills([failed, approved]).map((item) => item.name)).toEqual(['approved']);
  });

  it('treats verified official repos as source kind official', () => {
    expect(getSkillSourceKind(skill({ owner: 'anthropics', repo: 'skills' }))).toBe('official');
    expect(getSkillSourceKind(skill({ owner: 'community', repo: 'toolkit' }))).toBe('community');
  });

  it('sorts popular by rank score before stars', () => {
    const trusted = skill({ name: 'trusted', rankScore: 91, stars: 5 });
    const starred = skill({ name: 'starred', rankScore: 40, stars: 5000 });

    expect(sortSkillsPopular([starred, trusted]).map((item) => item.name)).toEqual(['trusted', 'starred']);
  });

  it('sorts popular by quality score when rank score ties', () => {
    const higherQuality = skill({ name: 'higher-quality', rankScore: 88, qualityScore: 77, stars: 5 });
    const higherStars = skill({ name: 'higher-stars', rankScore: 88, qualityScore: 60, stars: 500 });

    expect(sortSkillsPopular([higherStars, higherQuality]).map((item) => item.name)).toEqual([
      'higher-quality',
      'higher-stars',
    ]);
  });

  it('sorts latest by updatedAt descending', () => {
    const older = skill({ name: 'older', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = skill({ name: 'newer', updatedAt: '2026-07-01T00:00:00.000Z' });

    expect(sortSkillsLatest([older, newer]).map((item) => item.name)).toEqual(['newer', 'older']);
  });

  it('sorts latest ties by popular order', () => {
    const alpha = skill({
      name: 'alpha',
      rankScore: 91,
      qualityScore: 70,
      stars: 40,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    const beta = skill({
      name: 'beta',
      rankScore: 91,
      qualityScore: 70,
      stars: 120,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    const gamma = skill({
      name: 'gamma',
      rankScore: 91,
      qualityScore: 70,
      stars: 120,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(sortSkillsLatest([gamma, alpha, beta]).map((item) => item.name)).toEqual(['beta', 'gamma', 'alpha']);
  });
});
