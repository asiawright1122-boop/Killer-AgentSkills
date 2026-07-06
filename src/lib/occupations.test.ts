import { describe, expect, it } from 'vitest';
import type { UnifiedSkill } from './skills';
import { buildOccupationDetail, buildOccupationSummaries, inferSkillOccupationIds } from './occupations';

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
    securityLevel: overrides.securityLevel || 'A',
    isTrustedRankingEligible: overrides.isTrustedRankingEligible ?? true,
    ...overrides,
  }) as UnifiedSkill;

describe('occupations', () => {
  it('infers developer and devops occupations from category and topics', () => {
    expect(inferSkillOccupationIds(skill({ category: 'developer', topics: ['react', 'code-review'] }))).toContain(
      'developer',
    );
    expect(inferSkillOccupationIds(skill({ category: 'devops', topics: ['docker', 'deploy'] }))).toContain('devops');
  });

  it('builds summaries with skill counts and representative skills', () => {
    const summaries = buildOccupationSummaries(
      [
        skill({ name: 'reviewer', category: 'developer', rankScore: 80 }),
        skill({ name: 'deploy', category: 'devops', rankScore: 75 }),
      ],
      'zh',
    );

    expect(summaries.find((item) => item.id === 'developer')?.skillCount).toBeGreaterThan(0);
    expect(summaries.find((item) => item.id === 'developer')?.skills[0].name).toBe('reviewer');
  });

  it('builds occupation detail task clusters', () => {
    const detail = buildOccupationDetail(
      [skill({ name: 'browser-test', category: 'developer', topics: ['testing', 'playwright'] })],
      'qa',
      'en',
    );

    expect(detail?.id).toBe('qa');
    expect(detail?.taskClusters.length).toBeGreaterThan(0);
  });
});
