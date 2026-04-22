import { describe, expect, it } from 'vitest';
import { buildRecoveryProofWindowReport } from './recovery-proof-window';

describe('buildRecoveryProofWindowReport', () => {
  it('seeds a baseline when none exists and keeps blocking freshness visible', () => {
    const report = buildRecoveryProofWindowReport({
      generatedAt: '2026-04-16T00:00:00.000Z',
      trafficReport: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-09', end: '2026-04-15' },
        queryRows: 20,
        pageRows: 179,
      },
      coverageReport: {
        totalAffectedPages: 5449,
        sourceFreshnessStatus: 'blocking',
        sourceFreshnessDate: '2026-04-03',
        sourceFreshnessDays: 13,
      },
      scorecardReport: {
        technicalRecoveryStatus: 'clear',
        businessRecoveryStatus: 'warning',
      },
      controlBoardReport: {
        overallStatus: 'blocked',
      },
      executionQueueReport: {
        overallStatus: 'active',
        readyCount: 5,
        blockedCount: 2,
      },
      authorityProgramReport: {
        summary: {
          primarySurfaces: 16,
          editorialQueueItems: 5,
        },
      },
    });

    expect(report.baselineSeeded).toBe(true);
    expect(report.trustVerdict).toBe('blocking');
    expect(report.metrics.coverageSourceAgeDays).toBe(13);
    expect(report.comparisons.every((item) => item.delta === 0 || item.delta === null)).toBe(true);
    expect(report.blockers.some((item) => item.includes('Coverage Drilldown raw inputs'))).toBe(true);
  });

  it('compares current metrics against an existing baseline', () => {
    const report = buildRecoveryProofWindowReport({
      generatedAt: '2026-04-23T00:00:00.000Z',
      baseline: {
        seededAt: '2026-04-16T00:00:00.000Z',
        label: 'Seeded from v1.5 closeout-aligned latest artifacts',
        milestone: 'v1.5',
        metrics: {
          trafficQueryRows: 20,
          trafficPageRows: 179,
          coverageAffectedPages: 5449,
          coverageSourceAgeDays: 13,
          executionReadyCount: 5,
          executionBlockedCount: 2,
          authorityPrimarySurfaces: 16,
          authorityEditorialQueueItems: 5,
        },
      },
      trafficReport: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-16', end: '2026-04-22' },
        queryRows: 25,
        pageRows: 200,
      },
      coverageReport: {
        totalAffectedPages: 5000,
        sourceFreshnessStatus: 'clear',
        sourceFreshnessDate: '2026-04-21',
        sourceFreshnessDays: 2,
      },
      scorecardReport: {
        technicalRecoveryStatus: 'clear',
        businessRecoveryStatus: 'clear',
      },
      controlBoardReport: {
        overallStatus: 'recoverable',
      },
      executionQueueReport: {
        overallStatus: 'active',
        readyCount: 6,
        blockedCount: 1,
      },
      authorityProgramReport: {
        summary: {
          primarySurfaces: 17,
          editorialQueueItems: 4,
        },
      },
    });

    expect(report.baselineSeeded).toBe(false);
    expect(report.trustVerdict).toBe('ready');
    expect(report.comparisons.find((item) => item.id === 'trafficQueryRows')?.trend).toBe('better');
    expect(report.comparisons.find((item) => item.id === 'coverageSourceAgeDays')?.trend).toBe('better');
    expect(report.comparisons.find((item) => item.id === 'executionBlockedCount')?.trend).toBe('better');
  });

  it('keeps business-proof warning without calling fresh coverage stale', () => {
    const report = buildRecoveryProofWindowReport({
      generatedAt: '2026-04-16T00:00:00.000Z',
      baseline: {
        seededAt: '2026-04-09T00:00:00.000Z',
        label: 'Seed baseline',
        milestone: 'v1.5',
        metrics: {
          trafficQueryRows: 20,
          trafficPageRows: 179,
          coverageAffectedPages: 5449,
          coverageSourceAgeDays: 13,
          executionReadyCount: 5,
          executionBlockedCount: 2,
          authorityPrimarySurfaces: 16,
          authorityEditorialQueueItems: 5,
        },
      },
      trafficReport: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-09', end: '2026-04-15' },
        queryRows: 20,
        pageRows: 179,
      },
      coverageReport: {
        totalAffectedPages: 16232,
        sourceFreshnessStatus: 'fresh',
        sourceFreshnessDate: '2026-04-16',
        sourceFreshnessDays: 0,
      },
      scorecardReport: {
        technicalRecoveryStatus: 'clear',
        businessRecoveryStatus: 'warning',
      },
      controlBoardReport: {
        overallStatus: 'blocked',
      },
      executionQueueReport: {
        overallStatus: 'active',
        readyCount: 7,
        blockedCount: 1,
      },
      authorityProgramReport: {
        summary: {
          primarySurfaces: 16,
          editorialQueueItems: 5,
        },
      },
    });

    expect(report.trustVerdict).toBe('warning');
    expect(report.blockers.some((item) => item.includes('too stale'))).toBe(false);
    expect(report.nextActions.some((item) => item.includes('fresher Coverage Drilldown'))).toBe(false);
  });
});
