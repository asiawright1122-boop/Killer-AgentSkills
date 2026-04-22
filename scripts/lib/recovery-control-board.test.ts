import { describe, expect, it } from 'vitest';
import { buildRecoveryControlBoardReport } from './recovery-control-board';

describe('buildRecoveryControlBoardReport', () => {
  it('surfaces measurement gaps as blocked top priorities when Search Console evidence is unavailable', () => {
    const report = buildRecoveryControlBoardReport({
      scorecard: {
        technicalRecoveryStatus: 'clear',
        businessRecoveryStatus: 'blocking',
        headline: 'Technical recovery is stable but business evidence is blocked.',
        nextActions: ['Configure Search Console access.'],
        traffic: {
          metrics: {
            sourceMode: 'missing-config',
            failureReason:
              'Missing one or more required Search Console settings: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL.',
            nextStep: 'Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_SITE_URL.',
          },
        },
      },
      coverage: {
        sourceFreshnessStatus: 'warning',
        sourceFreshnessDate: '2026-04-03',
        sourceFreshnessSummary: 'Freshest raw export is 2026-04-03 and is older than the preferred freshness window.',
        clusterPriorities: [
          {
            cluster: 'trailing_slash',
            weightedImpact: 6557.3,
            estimatedAffected: 3451.2,
            issueNames: ['服务器错误 (5xx)（P0 可用性）'],
            topSamples: ['https://killer-skills.com/es/skills/example/repo/'],
          },
        ],
      },
      traffic: {
        status: 'blocking',
        sourceMode: 'missing-config',
        failureReason:
          'Missing one or more required Search Console settings: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL.',
        nextStep: 'Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_SITE_URL.',
      },
    });

    expect(report.overallStatus).toBe('blocked');
    expect(report.lenses.find((lens) => lens.lens === 'query')?.status).toBe('blocked');
    expect(report.items[0]?.status).toBe('blocked');
    expect(report.items.some((item) => item.id === 'query-measurement-gap')).toBe(true);
    expect(report.items.some((item) => item.id === 'cluster-trailing_slash')).toBe(true);
  });

  it('builds recoverable query/page/locale priorities when snapshot data exists', () => {
    const report = buildRecoveryControlBoardReport({
      scorecard: {
        technicalRecoveryStatus: 'clear',
        businessRecoveryStatus: 'warning',
        headline: 'Traffic evidence exists and surfaces can now be ranked.',
      },
      coverage: {
        sourceFreshnessStatus: 'fresh',
        sourceFreshnessDate: '2026-04-08',
        sourceFreshnessSummary: 'Fresh raw export is available.',
        clusterPriorities: [
          {
            cluster: 'trailing_slash',
            weightedImpact: 220,
            estimatedAffected: 120,
            issueNames: ['自动重定向（P1 规范化）'],
            topSamples: ['https://killer-skills.com/en/skills/example/repo/'],
          },
        ],
      },
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-02', end: '2026-04-08' },
        previousPeriod: { start: '2026-03-26', end: '2026-04-01' },
      },
      snapshots: {
        currentQueries: [
          { entity: 'mcp server examples', clicks: 12, impressions: 400, ctr: 0.03, position: 5.2 },
          { entity: 'agent workflow tools', clicks: 6, impressions: 180, ctr: 0.033, position: 11.5 },
        ],
        previousQueries: [
          { entity: 'mcp server examples', clicks: 18, impressions: 430, ctr: 0.042, position: 4.8 },
          { entity: 'agent workflow tools', clicks: 8, impressions: 175, ctr: 0.046, position: 10.4 },
        ],
        currentPages: [
          {
            entity: 'https://killer-skills.com/en/skills/example/repo',
            clicks: 20,
            impressions: 500,
            ctr: 0.04,
            position: 6.3,
          },
          {
            entity: 'https://killer-skills.com/zh/skills/example/repo',
            clicks: 4,
            impressions: 220,
            ctr: 0.018,
            position: 9.8,
          },
        ],
        previousPages: [
          {
            entity: 'https://killer-skills.com/en/skills/example/repo',
            clicks: 27,
            impressions: 520,
            ctr: 0.052,
            position: 5.9,
          },
          {
            entity: 'https://killer-skills.com/zh/skills/example/repo',
            clicks: 8,
            impressions: 240,
            ctr: 0.033,
            position: 8.9,
          },
        ],
      },
    });

    expect(report.overallStatus).toBe('recoverable');
    expect(report.lenses.find((lens) => lens.lens === 'query')?.status).toBe('recoverable');
    expect(report.lenses.find((lens) => lens.lens === 'locale')?.status).toBe('recoverable');
    expect(report.items.some((item) => item.lens === 'query')).toBe(true);
    expect(report.items.some((item) => item.lens === 'page')).toBe(true);
    expect(report.items.some((item) => item.lens === 'locale')).toBe(true);
    expect(report.items.some((item) => item.id === 'query-measurement-gap')).toBe(false);
  });

  it('treats the mixed other cluster as recoverable once technical recovery is clear', () => {
    const report = buildRecoveryControlBoardReport({
      scorecard: {
        technicalRecoveryStatus: 'clear',
        businessRecoveryStatus: 'warning',
        headline: 'Technical recovery is stable and the remaining work is cleanup plus demand recovery.',
      },
      coverage: {
        sourceFreshnessStatus: 'fresh',
        sourceFreshnessDate: '2026-04-16',
        sourceFreshnessSummary: 'Fresh raw export is available.',
        clusterPriorities: [
          {
            cluster: 'other',
            weightedImpact: 13066.5,
            estimatedAffected: 7460.5,
            issueNames: ['未找到 (404)（P0 索引损耗）', '服务器错误 (5xx)（P0 可用性）'],
            topSamples: ['https://killer-skills.com/ja/skills/example/repo'],
          },
        ],
      },
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-09', end: '2026-04-15' },
        previousPeriod: { start: '2026-04-02', end: '2026-04-08' },
      },
      snapshots: {
        currentQueries: [{ entity: 'agent workflow tools', clicks: 6, impressions: 180, ctr: 0.033, position: 11.5 }],
        previousQueries: [{ entity: 'agent workflow tools', clicks: 8, impressions: 175, ctr: 0.046, position: 10.4 }],
        currentPages: [
          {
            entity: 'https://killer-skills.com/en/skills/example/repo',
            clicks: 20,
            impressions: 500,
            ctr: 0.04,
            position: 6.3,
          },
        ],
        previousPages: [
          {
            entity: 'https://killer-skills.com/en/skills/example/repo',
            clicks: 27,
            impressions: 520,
            ctr: 0.052,
            position: 5.9,
          },
        ],
      },
    });

    expect(report.overallStatus).toBe('recoverable');
    expect(report.items.find((item) => item.id === 'cluster-other')?.status).toBe('recoverable');
    expect(report.items.find((item) => item.id === 'cluster-other')?.actions[0]).toContain('missing-cluster split');
  });
});
