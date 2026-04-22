import { describe, expect, it } from 'vitest';
import { buildOtherAuditReport, buildSourceFileAuditReport, suggestAction, type SitemapIndex } from './seo-404-remediation-plan';

function createSitemapIndex(input?: {
  exactRoutes?: Array<{ owner: string; routePath: string }>;
  repoCounts?: Array<{ owner: string; repo: string; count: number }>;
  repoSingleRoute?: Array<{ owner: string; repo: string; routePath: string }>;
  blockedExact?: string[];
  blockedRepo?: string[];
}): SitemapIndex {
  const map = new Map<string, { owner: string; routePath: string }>();
  const repoCounts = new Map<string, number>();
  const repoSingleRoute = new Map<string, string>();

  for (const route of input?.exactRoutes || []) {
    map.set(`${route.owner.toLowerCase()}/${route.routePath.toLowerCase()}`, route);
  }

  for (const repo of input?.repoCounts || []) {
    repoCounts.set(`${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`, repo.count);
  }

  for (const repo of input?.repoSingleRoute || []) {
    repoSingleRoute.set(`${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`, repo.routePath);
  }

  return {
    map,
    repoCounts,
    repoSingleRoute,
    blockedExact: new Set((input?.blockedExact || []).map((item) => item.toLowerCase())),
    blockedRepo: new Set((input?.blockedRepo || []).map((item) => item.toLowerCase())),
  };
}

describe('suggestAction', () => {
  it('moves sitemap-backed other-cluster URLs into observe mode instead of manual review', () => {
    const action = suggestAction(
      'https://killer-skills.com/en/skills/vercel/next.js/flags',
      'other',
      createSitemapIndex({
        exactRoutes: [{ owner: 'vercel', routePath: 'next.js/flags' }],
      }),
    );

    expect(action.action).toBe('observe');
    expect(action.reason).toBe('in_sitemap_recrawl_watch');
  });

  it('keeps non-sitemap missing skill URLs on the 410 track', () => {
    const action = suggestAction(
      'https://killer-skills.com/en/skills/example-owner/example-repo',
      'other',
      createSitemapIndex(),
    );

    expect(action.action).toBe('gone_410');
    expect(action.reason).toBe('missing_from_sitemap_and_cache');
  });

  it('redirects nested source-file traps to the canonical parent skill when a public sub-skill exists', () => {
    const action = suggestAction(
      'https://killer-skills.com/en/skills/vercel/next.js/flags/README.md',
      'source_file_path',
      createSitemapIndex({
        exactRoutes: [{ owner: 'vercel', routePath: 'next.js/flags' }],
      }),
    );

    expect(action.action).toBe('redirect_301');
    expect(action.reason).toBe('nested_skill_parent_redirect');
    expect(action.targetUrl).toBe('https://killer-skills.com/en/skills/vercel/next.js/flags');
  });

  it('keeps owner-only trailing-slash skill traps on the 410 track', () => {
    const action = suggestAction(
      'https://killer-skills.com/en/skills/xiangteng007/',
      'trailing_slash',
      createSitemapIndex(),
    );

    expect(action.action).toBe('gone_410');
    expect(action.reason).toBe('owner_root_skill_trap');
  });

  it('redirects legacy collection slugs to their canonical collection pages', () => {
    const action = suggestAction('https://killer-skills.com/ar/collections/top-community-skills', 'other', createSitemapIndex());

    expect(action.action).toBe('redirect_301');
    expect(action.reason).toBe('legacy_collection_slug_redirect');
    expect(action.targetUrl).toBe('https://killer-skills.com/ar/collections/top-community-contributed-ai-agent-skills');
    expect(action.coveredByMiddleware).toBe(false);
  });

  it('redirects legacy docs slugs to the canonical docs page', () => {
    const action = suggestAction(
      'https://killer-skills.com/en/docs/development/create-skill',
      'other',
      createSitemapIndex(),
    );

    expect(action.action).toBe('redirect_301');
    expect(action.reason).toBe('legacy_docs_slug_redirect');
    expect(action.targetUrl).toBe('https://killer-skills.com/en/docs/creating-skills');
    expect(action.coveredByMiddleware).toBe(true);
  });

  it('moves repo-directory traps for multi-skill repos onto the 410 track', () => {
    const action = suggestAction(
      'https://killer-skills.com/de/skills/Galaxy-Dawn/claude-scholar',
      'other',
      createSitemapIndex({
        repoCounts: [{ owner: 'Galaxy-Dawn', repo: 'claude-scholar', count: 3 }],
      }),
    );

    expect(action.action).toBe('gone_410');
    expect(action.reason).toBe('repo_directory_skill_trap');
    expect(action.coveredByMiddleware).toBe(true);
  });

  it('redirects repo-root file traps to the only public sub-skill route', () => {
    const action = suggestAction(
      'https://killer-skills.com/ko/skills/opentabs-dev/opentabs/README.md',
      'source_file_path',
      createSitemapIndex({
        repoCounts: [{ owner: 'opentabs-dev', repo: 'opentabs', count: 1 }],
        repoSingleRoute: [{ owner: 'opentabs-dev', repo: 'opentabs', routePath: 'opentabs/build-plugin' }],
      }),
    );

    expect(action.action).toBe('redirect_301');
    expect(action.reason).toBe('repo_single_skill_redirect');
    expect(action.targetUrl).toBe('https://killer-skills.com/ko/skills/opentabs-dev/opentabs/build-plugin');
  });
});

describe('buildOtherAuditReport', () => {
  it('builds an execution-ready summary for the mixed other cluster', () => {
    const report = buildOtherAuditReport({
      generatedAt: '2026-04-19T00:00:00.000Z',
      sourceDirectory: '/tmp/coverage',
      issueName: '未找到 (404)',
      totalSamples: 4,
      redirectCount: 2,
      goneCount: 2,
      manualReviewCount: 0,
      observeCount: 0,
      actions: [
        {
          url: 'https://killer-skills.com/en/skills/acme/blocked',
          cluster: 'other',
          action: 'gone_410',
          reason: 'blocked_by_sitemap',
          coveredByMiddleware: false,
        },
        {
          url: 'https://killer-skills.com/en/skills/acme/missing',
          cluster: 'other',
          action: 'gone_410',
          reason: 'missing_from_sitemap_and_cache',
          coveredByMiddleware: false,
        },
        {
          url: 'https://killer-skills.com/en/docs/development/create-skill',
          cluster: 'other',
          action: 'redirect_301',
          reason: 'legacy_docs_slug_redirect',
          coveredByMiddleware: true,
          targetUrl: 'https://killer-skills.com/en/docs/creating-skills',
        },
        {
          url: 'https://killer-skills.com/ar/collections/top-community-skills',
          cluster: 'other',
          action: 'redirect_301',
          reason: 'legacy_collection_slug_redirect',
          coveredByMiddleware: false,
          targetUrl: 'https://killer-skills.com/ar/collections/top-community-contributed-ai-agent-skills',
        },
      ],
    });

    expect(report.executionSummary.exactRemoval410Count).toBe(2);
    expect(report.executionSummary.redirectValidationCount).toBe(2);
    expect(report.executionSummary.redirectCoveredByMiddlewareCount).toBe(1);
    expect(report.executionSummary.redirectNeedsValidationCount).toBe(1);
    expect(report.nextActions[0]).toContain('exact-removal / 410 track');
    expect(report.nextActions[1]).toContain('Validate 2 redirect candidates');
  });
});

describe('buildSourceFileAuditReport', () => {
  it('builds an execution-ready summary for source-file traps', () => {
    const report = buildSourceFileAuditReport({
      generatedAt: '2026-04-19T00:00:00.000Z',
      sourceDirectory: '/tmp/coverage',
      issueName: '未找到 (404)',
      totalSamples: 4,
      redirectCount: 2,
      goneCount: 2,
      manualReviewCount: 0,
      observeCount: 0,
      actions: [
        {
          url: 'https://killer-skills.com/en/skills/acme/repo/references/readme.md',
          cluster: 'source_file_path',
          action: 'gone_410',
          reason: 'crawl_trap_or_invalid_public_route',
          coveredByMiddleware: true,
        },
        {
          url: 'https://killer-skills.com/en/skills/acme/repo/references/config.json',
          cluster: 'source_file_path',
          action: 'gone_410',
          reason: 'crawl_trap_or_invalid_public_route',
          coveredByMiddleware: true,
        },
        {
          url: 'https://killer-skills.com/en/skills/acme/repo/README.md',
          cluster: 'source_file_path',
          action: 'redirect_301',
          reason: 'repo_single_skill_redirect',
          coveredByMiddleware: true,
          targetUrl: 'https://killer-skills.com/en/skills/acme/repo/main-skill',
        },
        {
          url: 'https://killer-skills.com/en/skills/acme/repo/main-skill/README.md',
          cluster: 'source_file_path',
          action: 'redirect_301',
          reason: 'nested_skill_parent_redirect',
          coveredByMiddleware: true,
          targetUrl: 'https://killer-skills.com/en/skills/acme/repo/main-skill',
        },
      ],
    });

    expect(report.executionSummary.exactRemoval410Count).toBe(2);
    expect(report.executionSummary.redirectValidationCount).toBe(2);
    expect(report.executionSummary.redirectCoveredByMiddlewareCount).toBe(2);
    expect(report.executionSummary.redirectNeedsValidationCount).toBe(0);
    expect(report.nextActions[0]).toContain('exact-removal / 410 track');
    expect(report.nextActions[1]).toContain('middleware-covered source-file redirects');
  });
});
