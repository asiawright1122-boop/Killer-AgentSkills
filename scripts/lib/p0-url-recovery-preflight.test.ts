import { describe, expect, it } from 'vitest';
import { buildP0UrlRecoveryPreflightReport } from './p0-url-recovery-preflight';

describe('buildP0UrlRecoveryPreflightReport', () => {
  it('blocks ready P0 batches when Coverage freshness is outside the executable gate', () => {
    const report = buildP0UrlRecoveryPreflightReport({
      generatedAt: '2026-05-06T00:00:00.000Z',
      coverage: {
        sourceFreshnessStatus: 'blocking',
        sourceFreshnessDate: '2026-04-16',
        sourceFreshnessDays: 20,
        sourceMaxWindowDays: 7,
      },
      executionQueue: {
        items: [
          {
            id: 'cluster-other',
            title: 'Issue cluster: other',
            priority: 'P0',
            queueStatus: 'ready',
            lane: 'triage',
            intervention: 'removal-execution',
            action: 'Execute the other-cluster batch.',
            successSignal: 'Next Coverage export shrinks other cluster.',
            evidence: ['otherRows=514'],
          },
        ],
      },
      otherAudit: {
        totalRows: 514,
        actionSummary: [
          { action: 'gone_410', count: 488 },
          { action: 'redirect_301', count: 20 },
          { action: 'observe', count: 6 },
        ],
        executionSummary: {
          exactRemoval410Count: 488,
          exactRemovalCoveredByRuntimeCount: 488,
          redirectValidationCount: 20,
          redirectCoveredByRuntimeCount: 20,
          observeCount: 6,
        },
      },
      missingClusterAudit: {
        totalRows: 211,
        summary: { keep410: 211 },
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.batches).toHaveLength(1);
    expect(report.batches[0]?.counts).toMatchObject({
      totalRows: 514,
      gone_410: 488,
      redirect_301: 20,
      observe: 6,
      missingClusterKeep410: 211,
    });
    expect(report.blockers.join(' ')).toContain('Coverage freshness is blocking');
  });

  it('is ready when Coverage is executable and P0 batches are present', () => {
    const report = buildP0UrlRecoveryPreflightReport({
      coverage: {
        sourceFreshnessStatus: 'warning',
        sourceFreshnessDate: '2026-05-04',
        sourceFreshnessDays: 2,
        sourceMaxWindowDays: 7,
      },
      executionQueue: {
        items: [
          {
            id: 'cluster-trailing_slash',
            title: 'Issue cluster: trailing_slash',
            priority: 'P0',
            queueStatus: 'ready',
            lane: 'canonicalization',
            intervention: 'canonical-fix',
          },
        ],
      },
    });

    expect(report.status).toBe('ready');
    expect(report.coverageGate.canExecute).toBe(true);
  });
});
