import { describe, expect, it } from 'vitest';
import {
  buildRemovalPrefixScope,
  buildBlockedRepoKeySet,
  buildPublicRepoKeySet,
  parseSkillRepoPrefix,
  PREFIX_ELIGIBLE_CATEGORIES,
  renderRemovalPrefixStrategyMarkdown,
  summarizeRemovalPrefixStrategy,
} from './gsc-removal-prefixes';

describe('gsc removal prefixes', () => {
  it('parses locale/owner/repo prefixes from skill urls', () => {
    const result = parseSkillRepoPrefix('https://killer-skills.com/en/skills/affaan-m/everything-claude-code/postgres-patterns');

    expect(result).toEqual({
      prefixUrl: 'https://killer-skills.com/en/skills/affaan-m/everything-claude-code',
      locale: 'en',
      owner: 'affaan-m',
      repo: 'everything-claude-code',
      repoKey: 'affaan-m/everything-claude-code',
    });
  });

  it('builds normalized public and blocked repo sets', () => {
    const publicRepos = buildPublicRepoKeySet([
      { owner: 'parcadei', routePath: 'Continuous-Claude-v3/slash-commands' },
      { owner: 'vercel', routePath: 'next.js/flags' },
    ]);
    const blockedRepos = buildBlockedRepoKeySet({
      rules: {
        excludeRepo: ['affaan-m/everything-claude-code'],
      },
    });

    expect(publicRepos.has('parcadei/continuous-claude-v3')).toBe(true);
    expect(blockedRepos.has('affaan-m/everything-claude-code')).toBe(true);
  });

  it('derives high and medium confidence prefix candidates conservatively', () => {
    const strategy = summarizeRemovalPrefixStrategy(
      [
        {
          url: 'https://killer-skills.com/en/skills/affaan-m/everything-claude-code/api-design',
          category: 'skill_blocklisted',
        },
        {
          url: 'https://killer-skills.com/en/skills/affaan-m/everything-claude-code/postgres-patterns',
          category: 'skill_blocklisted',
        },
        {
          url: 'https://killer-skills.com/pt/skills/kindfi-org/kindfi/ecosystem.md/',
          category: 'source_file',
        },
        {
          url: 'https://killer-skills.com/pt/skills/kindfi-org/kindfi/contracts.md/',
          category: 'source_file',
        },
        {
          url: 'https://killer-skills.com/en/skills/remotion-dev/skills/rules/lottie.md',
          category: 'source_file',
        },
        {
          url: 'https://killer-skills.com/en/skills/remotion-dev/skills/rules/measuring-dom-nodes.md',
          category: 'source_file',
        },
      ],
      {
        publicRepoKeys: new Set(['remotion-dev/skills']),
        blockedRepoKeys: new Set(['affaan-m/everything-claude-code']),
      },
    );

    expect(strategy.highConfidenceCandidates).toHaveLength(1);
    expect(strategy.highConfidenceCandidates[0].prefixUrl).toBe(
      'https://killer-skills.com/en/skills/affaan-m/everything-claude-code',
    );
    expect(strategy.mediumConfidenceCandidates).toHaveLength(1);
    expect(strategy.mediumConfidenceCandidates[0].prefixUrl).toBe('https://killer-skills.com/pt/skills/kindfi-org/kindfi');
    expect(strategy.exactOnlyCoverage).toBe(2);
  });

  it('summarizes analyzed vs excluded removal scope', () => {
    const scope = buildRemovalPrefixScope({
      totalRemovalSafeUrls: 14,
      categoryCounts: [
        { category: 'source_file', count: 6 },
        { category: 'skill_blocklisted', count: 2 },
        { category: 'trailing_slash', count: 4 },
        { category: 'docs_legacy_slug', count: 2 },
      ],
      analyzedCategories: PREFIX_ELIGIBLE_CATEGORIES,
    });

    expect(scope.analyzedRows).toBe(8);
    expect(scope.excludedCoverage).toBe(6);
    expect(scope.excludedCategoryCounts).toEqual([
      { category: 'trailing_slash', count: 4 },
      { category: 'docs_legacy_slug', count: 2 },
    ]);
  });

  it('renders a readable markdown report', () => {
    const markdown = renderRemovalPrefixStrategyMarkdown(
      {
        totalRows: 10,
        highConfidenceCoverage: 4,
        mediumConfidenceCoverage: 2,
        exactOnlyCoverage: 4,
        highConfidenceCandidates: [
          {
            prefixUrl: 'https://killer-skills.com/en/skills/affaan-m/everything-claude-code',
            locale: 'en',
            owner: 'affaan-m',
            repo: 'everything-claude-code',
            repoKey: 'affaan-m/everything-claude-code',
            categories: ['skill_blocklisted'],
            confidence: 'high',
            count: 4,
            rationale: 'Repo is already blocklisted.',
            sampleUrls: ['https://killer-skills.com/en/skills/affaan-m/everything-claude-code/api-design'],
          },
        ],
        mediumConfidenceCandidates: [],
      },
      '2026-04-19T00:00:00.000Z',
      {
        totalRemovalSafeUrls: 16,
        analyzedRows: 10,
        analyzedCategories: ['deep_path', 'skill_blocklisted', 'skill_missing_or_unpublished', 'source_file'],
        excludedCoverage: 6,
        excludedCategoryCounts: [{ category: 'trailing_slash', count: 6 }],
      },
    );

    expect(markdown).toContain('# GSC Removal Prefix Strategy');
    expect(markdown).toContain('Total removal-safe URLs available: 16');
    expect(markdown).toContain('Exact-only or non-prefix URLs excluded from prefix analysis: 6');
    expect(markdown).toContain('Repo-prefix-eligible removal-safe URLs reviewed: 10');
    expect(markdown).toContain('High-confidence literal prefixes: 1 prefixes covering 4 URLs');
    expect(markdown).toContain('https://killer-skills.com/en/skills/affaan-m/everything-claude-code');
  });
});
