import { describe, expect, it } from 'vitest';
import {
  buildRemovalReadinessReport,
  buildRemovalSummaryMarkdown,
  categorizeRemovalUrl,
  classifyRemovalEligibleIssue,
  renderRemovalReadinessMarkdown,
  renderRemovalInvestigationMarkdown,
  renderCanonicalizeFollowupMarkdown,
  isRemovalSubmissionCategory,
  shouldIncludeCanonicalizeFollowup,
  type CoverageSourceCandidate,
  type RemovalSemanticSignal,
  type RemovalSummaryCategoryEntry,
} from './gsc-removal-list';

function makeSource(overrides: Partial<CoverageSourceCandidate> = {}): CoverageSourceCandidate {
  return {
    directory: '/tmp/killer-skills.com-Coverage-Drilldown-2026-04-19',
    folderName: 'killer-skills.com-Coverage-Drilldown-2026-04-19',
    issueName: '未找到 (404)',
    sourceLabel: 'Google systems',
    ...overrides,
  };
}

describe('gsc removal list helpers', () => {
  const blocklistedSignal: RemovalSemanticSignal = {
    kind: 'skill_blocklisted',
    action: 'keep410',
    targetUrl: null,
    reason: 'Skill path is blocklisted or repo-suppressed and should remain out of the public index.',
  };

  const repoRootRedirectSignal: RemovalSemanticSignal = {
    kind: 'skill_repo_root_single_target',
    action: 'canonicalize',
    targetUrl: 'https://killer-skills.com/en/skills/Agents2AgentsAI/ata/babysit-pr',
    reason: "Repo-root URL should resolve to the repo's single public skill route.",
  };

  const docsLegacyRedirectSignal: RemovalSemanticSignal = {
    kind: 'docs_legacy_slug',
    action: 'canonicalize',
    targetUrl: 'https://killer-skills.com/en/docs/creating-skills',
    reason: 'Docs page uses a legacy slug and should redirect to the canonical docs URL.',
  };

  describe('classifyRemovalEligibleIssue', () => {
    it('accepts Chinese 404 coverage issues', () => {
      expect(classifyRemovalEligibleIssue('未找到 (404)')).toBe(true);
    });

    it('accepts English 404 coverage issues', () => {
      expect(classifyRemovalEligibleIssue('Submitted URL not found (404)')).toBe(true);
    });

    it('rejects non-404 coverage issues', () => {
      expect(classifyRemovalEligibleIssue('服务器错误 (5xx)')).toBe(false);
      expect(classifyRemovalEligibleIssue('已发现 - 尚未编入索引')).toBe(false);
    });
  });

  describe('categorizeRemovalUrl', () => {
    it('classifies trailing-slash skill urls', () => {
      expect(categorizeRemovalUrl('https://killer-skills.com/en/skills/vercel-labs/skills/find-skills/')).toBe(
        'trailing_slash',
      );
    });

    it('keeps dotted repo names out of source-file classification', () => {
      expect(categorizeRemovalUrl('https://killer-skills.com/en/skills/vercel/next.js')).toBe('other');
    });

    it('classifies source file paths under skills', () => {
      expect(
        categorizeRemovalUrl('https://killer-skills.com/en/skills/vercel-labs/skills/references/README.md'),
      ).toBe('source_file');
    });

    it('classifies deep skill crawl traps', () => {
      expect(
        categorizeRemovalUrl('https://killer-skills.com/en/skills/acme/repo/extra/deeper/final'),
      ).toBe('deep_path');
    });

    it('classifies parameterized pages and legacy html urls', () => {
      expect(categorizeRemovalUrl('https://killer-skills.com/en/skills?owner=acme')).toBe('query_param');
      expect(categorizeRemovalUrl('https://killer-skills.com/en/legacy/page.html')).toBe('legacy_html');
    });

    it('falls back to other for invalid absolute urls', () => {
      expect(categorizeRemovalUrl('/en/skills/acme/repo')).toBe('other');
    });

    it('reclassifies heuristic-other urls via semantic signals', () => {
      expect(categorizeRemovalUrl('https://killer-skills.com/ar/skills/Arvmor/xByte', { semanticSignal: blocklistedSignal })).toBe(
        'skill_blocklisted',
      );
      expect(
        categorizeRemovalUrl('https://killer-skills.com/en/docs/development/create-skill', {
          semanticSignal: docsLegacyRedirectSignal,
        }),
      ).toBe('docs_legacy_slug');
    });
  });

  describe('buildRemovalReadinessReport', () => {
    it('blocks when no coverage sources are available', () => {
      const report = buildRemovalReadinessReport({
        generatedAt: '2026-04-19T00:00:00.000Z',
        sources: [],
      });

      expect(report.status).toBe('blocked');
      expect(report.reason).toContain('No Coverage Drilldown sources found');
      expect(report.eligibleDirectories).toEqual([]);
    });

    it('blocks when only non-404 sources are available', () => {
      const report = buildRemovalReadinessReport({
        generatedAt: '2026-04-19T00:00:00.000Z',
        sources: [makeSource({ issueName: '服务器错误 (5xx)' })],
      });

      expect(report.status).toBe('blocked');
      expect(report.reason).toContain('未找到 (404)');
      expect(report.eligibleIssueNames).toEqual([]);
    });

    it('turns ready when a 404 source is available', () => {
      const report = buildRemovalReadinessReport({
        generatedAt: '2026-04-19T00:00:00.000Z',
        sources: [makeSource()],
      });

      expect(report.status).toBe('ready');
      expect(report.reason).toContain('enabled');
      expect(report.eligibleDirectories).toEqual(['/tmp/killer-skills.com-Coverage-Drilldown-2026-04-19']);
    });
  });

  describe('renderRemovalReadinessMarkdown', () => {
    it('includes the blocked guardrail note only when readiness is blocked', () => {
      const blocked = renderRemovalReadinessMarkdown(
        buildRemovalReadinessReport({
          generatedAt: '2026-04-19T00:00:00.000Z',
          sources: [makeSource({ issueName: '服务器错误 (5xx)' })],
        }),
      );
      const ready = renderRemovalReadinessMarkdown(
        buildRemovalReadinessReport({
          generatedAt: '2026-04-19T00:00:00.000Z',
          sources: [makeSource()],
        }),
      );

      expect(blocked).toContain('Ignore any previously generated dated `gsc-removal-*.txt` files');
      expect(ready).not.toContain('Ignore any previously generated dated `gsc-removal-*.txt` files');
      expect(ready).toContain('Generate removal lists only from `未找到 (404)` Coverage Drilldown exports.');
    });
  });

  describe('buildRemovalSummaryMarkdown', () => {
    it('keeps trailing-slash instructions on exact urls and literal prefixes only', () => {
      const categoryCounts: RemovalSummaryCategoryEntry[] = [
        { category: 'trailing_slash', count: 12 },
        { category: 'source_file', count: 8 },
        { category: 'deep_path', count: 4 },
        { category: 'docs_legacy_slug', count: 3 },
        { category: 'skill_blocklisted', count: 20 },
        { category: 'skill_repo_root_single_target', count: 3 },
      ];

      const summary = buildRemovalSummaryMarkdown({
        generatedAt: '2026-04-19T00:00:00.000Z',
        timestamp: '2026-04-19',
        reviewedUrlCount: 27,
        removableUrlCount: 24,
        priorityUrlCount: 24,
        canonicalizeFollowupCount: 3,
        investigationCount: 1,
        prefixCompressionSummary: {
          totalRemovalSafeUrls: 24,
          analyzedUrlCount: 18,
          excludedUrlCount: 6,
          highConfidencePrefixCount: 2,
          highConfidenceCoverage: 7,
          mediumConfidencePrefixCount: 3,
          mediumConfidenceCoverage: 5,
          exactOnlyCoverage: 6,
          reportFileName: 'gsc-removal-prefix-strategy-2026-04-19.md',
        },
        categoryCounts,
      });

      expect(summary).toContain('Do **not** use a wildcard prefix like `https://killer-skills.com/*/`');
      expect(summary).toContain('Preferred input: `gsc-removal-trailing_slash-2026-04-19.txt`');
      expect(summary).toContain('derive a **literal** prefix only when every URL under that exact prefix is a stale trailing-slash variant');
      expect(summary).toContain('Use **Temporary Removals** with exact URLs from the generated `.txt` files');
      expect(summary).toContain('## Semantic Reclassification');
      expect(summary).toContain('## Prefix Compression Snapshot');
      expect(summary).toContain('Prefix-eligible skill URLs analyzed: 18 of 24 removal-safe URLs');
      expect(summary).toContain('Detailed prefix candidates: `gsc-removal-prefix-strategy-2026-04-19.md`');
      expect(summary).toContain('`gsc-removal-prefix-strategy-2026-04-19.md` - Repo-prefix compression candidates');
      expect(summary).toContain('`gsc-removal-canonicalize-followup-2026-04-19.md`');
      expect(summary).toContain('Verify the repo-root URL 301s to the single governed skill detail page');
      expect(summary).toContain('Verify the legacy docs slug 301s to the canonical docs URL');
      expect(summary).toContain('Coverage URLs reviewed: 27');
      expect(summary).toContain('URLs safe to submit for removal: 24');
      expect(summary).toContain('Do **not** submit URLs from `gsc-removal-investigate-2026-04-19.md`');
    });
  });

  describe('canonicalize follow-up helpers', () => {
    it('includes only semantic canonicalization categories in the follow-up queue', () => {
      expect(shouldIncludeCanonicalizeFollowup('skill_repo_root_single_target', repoRootRedirectSignal)).toBe(true);
      expect(shouldIncludeCanonicalizeFollowup('docs_legacy_slug', docsLegacyRedirectSignal)).toBe(true);
      expect(shouldIncludeCanonicalizeFollowup('skill_blocklisted', blocklistedSignal)).toBe(false);
      expect(shouldIncludeCanonicalizeFollowup('trailing_slash', repoRootRedirectSignal)).toBe(false);
    });

    it('renders a canonicalize follow-up markdown list', () => {
      const markdown = renderCanonicalizeFollowupMarkdown({
        generatedAt: '2026-04-19T00:00:00.000Z',
        entries: [
          {
            sourceUrl: 'https://killer-skills.com/en/skills/Agents2AgentsAI/ata',
            targetUrl: 'https://killer-skills.com/en/skills/Agents2AgentsAI/ata/babysit-pr',
            category: 'skill_repo_root_single_target',
            reason: repoRootRedirectSignal.reason,
          },
        ],
      });

      expect(markdown).toContain('# GSC Canonicalize Follow-up');
      expect(markdown).toContain('https://killer-skills.com/en/skills/Agents2AgentsAI/ata/babysit-pr');
      expect(markdown).toContain('skill_repo_root_single_target');
    });

    it('marks canonical_keep as investigate-only rather than removable', () => {
      expect(isRemovalSubmissionCategory('canonical_keep')).toBe(false);
      expect(isRemovalSubmissionCategory('skill_blocklisted')).toBe(true);
    });

    it('renders an investigation markdown list for canonical urls', () => {
      const markdown = renderRemovalInvestigationMarkdown({
        generatedAt: '2026-04-19T00:00:00.000Z',
        entries: [
          {
            sourceUrl: 'https://killer-skills.com/en/skills/parcadei/Continuous-Claude-v3/slash-commands',
            category: 'canonical_keep',
            reason: 'Skill URL already matches the current canonical route and locale contract.',
          },
        ],
      });

      expect(markdown).toContain('# GSC Removal Investigation Queue');
      expect(markdown).toContain('canonical_keep');
      expect(markdown).toContain('should not be submitted as temporary removals');
    });
  });
});
