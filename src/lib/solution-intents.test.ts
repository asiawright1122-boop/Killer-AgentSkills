import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n';
import type { UnifiedSkill } from './skills';
import { getSolutionIntentBySlug, matchSkillsForIntent } from './solution-intents';

const EN_LOCALE = 'en' as Locale;

function createSkill(overrides: Partial<UnifiedSkill> & Pick<UnifiedSkill, 'id'>): UnifiedSkill {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    skillName: overrides.skillName ?? overrides.id,
    owner: overrides.owner ?? 'test-owner',
    repo: overrides.repo ?? overrides.id.split('/').pop() ?? 'test-repo',
    description: overrides.description ?? { en: 'Test skill description' },
    category: overrides.category ?? 'developer',
    topics: overrides.topics ?? [],
    stars: overrides.stars ?? 0,
    source: overrides.source ?? 'cache',
    updatedAt: overrides.updatedAt ?? '2026-03-14T00:00:00.000Z',
    qualityScore: overrides.qualityScore,
    filePath: overrides.filePath,
    skillMd: overrides.skillMd,
    lastSynced: overrides.lastSynced,
    forks: overrides.forks,
    seo: overrides.seo,
    agentAnalysis: overrides.agentAnalysis,
  };
}

describe('matchSkillsForIntent', () => {
  it('filters out low-relevance noise for workflow automation', () => {
    const intent = getSolutionIntentBySlug(EN_LOCALE, 'workflow-automation');
    expect(intent).toBeTruthy();

    const skills: UnifiedSkill[] = [
      createSkill({
        id: 'official/workflow-operator',
        category: 'productivity',
        topics: ['workflow automation', 'agent workflow'],
        description: {
          en: 'Automates multi-step workflow automation with reusable execution chains for AI agent operations.',
        },
      }),
      createSkill({
        id: 'community/framer-animations',
        category: 'design',
        topics: ['framer animation', 'performance optimization'],
        description: {
          en: 'UI motion and static asset optimization patterns for polished animation-heavy landing pages.',
        },
        stars: 9500,
      }),
    ];

    const result = matchSkillsForIntent(skills, intent!, EN_LOCALE, 20).map((item) => item.id);
    expect(result).toContain('official/workflow-operator');
    expect(result).not.toContain('community/framer-animations');
  });

  it('keeps browser-aligned skills and rejects unrelated high-star skills', () => {
    const intent = getSolutionIntentBySlug(EN_LOCALE, 'browser-automation');
    expect(intent).toBeTruthy();

    const skills: UnifiedSkill[] = [
      createSkill({
        id: 'official/browser-actions',
        category: 'browser',
        topics: ['playwright', 'web automation'],
        description: {
          en: 'Browser automation toolkit for web actions, scraping flows, and repeatable website operations.',
        },
      }),
      createSkill({
        id: 'community/perf-polish-kit',
        category: 'developer',
        topics: ['asset optimization', 'framer'],
        description: {
          en: 'Optimize frontend asset performance and animation smoothness for product pages.',
        },
        stars: 15000,
      }),
    ];

    const result = matchSkillsForIntent(skills, intent!, EN_LOCALE, 20).map((item) => item.id);
    expect(result).toContain('official/browser-actions');
    expect(result).not.toContain('community/perf-polish-kit');
  });

  it('does not backfill with generic top-star skills when intent signal is missing', () => {
    const intent = getSolutionIntentBySlug(EN_LOCALE, 'agent-workflows');
    expect(intent).toBeTruthy();

    const skills: UnifiedSkill[] = [
      createSkill({
        id: 'official/agent-playbook',
        category: 'developer',
        topics: ['agent workflow', 'claude code skills'],
        description: {
          en: 'Agent workflow playbooks for Claude Code and Cursor with repeatable execution patterns.',
        },
      }),
      createSkill({
        id: 'community/ultra-star-ui-kit',
        category: 'developer',
        topics: ['framer animation', 'static asset optimization'],
        description: {
          en: 'UI kit focused on animation polish and static asset optimization for marketing pages.',
        },
        stars: 18000,
      }),
    ];

    const result = matchSkillsForIntent(skills, intent!, EN_LOCALE, 20).map((item) => item.id);
    expect(result).toContain('official/agent-playbook');
    expect(result).not.toContain('community/ultra-star-ui-kit');
  });
});
