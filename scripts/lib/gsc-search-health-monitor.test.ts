import { describe, expect, it } from 'vitest';
import { analyzeSearchHealth } from '../gsc-search-health-monitor';

describe('GSC Search Health Monitor Tests', () => {
  it('should return clear status and zero alerts under healthy conditions', () => {
    const mockCtr = {
      clicksDropRate: 0.05,
    };
    const mockCoverage = {
      sourceFreshnessDays: 5,
      crawlErrorsCount: 10,
      unexpectedClusterCount: 15,
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage);

    expect(result.status).toBe('clear');
    expect(result.alerts).toHaveLength(0);
    expect(result.metrics.coverageAgeDays).toBe(5);
    expect(result.metrics.clicksDropRate).toBe(0.05);
    expect(result.metrics.crawlErrorsCount).toBe(10);
    expect(result.metrics.unexpectedClusterCount).toBe(15);
  });

  it('should return warning status when warnings trigger but no criticals', () => {
    const mockCtr = {
      clicksDropRate: 0.2, // > 15% but < 30%
    };
    const mockCoverage = {
      sourceFreshnessDays: 20, // > 15 but < 30 days
      crawlErrorsCount: 80, // > 50 but < 150 pages
      unexpectedClusterCount: 60, // > 50 but < 200 pages
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage);

    expect(result.status).toBe('warning');
    expect(result.alerts).toHaveLength(4);
    expect(result.alerts.map((a) => a.code)).toEqual([
      'gsc_freshness_sla_warning',
      'gsc_clicks_drop_warning',
      'gsc_crawl_error_warning',
      'gsc_unexpected_cluster_warning',
    ]);
    expect(result.alerts.every((a) => a.severity === 'warning')).toBe(true);
  });

  it('should return blocking status when at least one critical alert triggers', () => {
    // 1. Freshness SLA Breach
    const r1 = analyzeSearchHealth({ clicksDropRate: 0 }, { sourceFreshnessDays: 31 });
    expect(r1.status).toBe('blocking');
    expect(r1.alerts[0].code).toBe('gsc_freshness_sla_breach');

    // 2. Click collapse
    const r2 = analyzeSearchHealth({ clicksDropRate: 0.35 }, { sourceFreshnessDays: 5 });
    expect(r2.status).toBe('blocking');
    expect(r2.alerts[0].code).toBe('gsc_clicks_collapse');

    // 3. Crawl errors spike
    const r3 = analyzeSearchHealth({ clicksDropRate: 0 }, { sourceFreshnessDays: 5, crawlErrorsCount: 160 });
    expect(r3.status).toBe('blocking');
    expect(r3.alerts[0].code).toBe('gsc_crawl_error_spike');

    // 4. Unexpected other cluster spike
    const r4 = analyzeSearchHealth({ clicksDropRate: 0 }, { sourceFreshnessDays: 5, unexpectedClusterCount: 220 });
    expect(r4.status).toBe('blocking');
    expect(r4.alerts[0].code).toBe('gsc_unexpected_cluster_spike');
  });

  it('should parse real coverage drilldown JSON summaries correctly', () => {
    const mockCoverage = {
      sourceFreshnessDays: 12,
      issueSummaries: [
        {
          issueName: '服务器错误 (5xx)',
          affectedPages: 35,
        },
        {
          issueName: '未找到 (404)',
          affectedPages: 1000,
        },
      ],
      clusterPriorities: [
        {
          cluster: 'other',
          estimatedAffected: 45,
        },
      ],
    };

    const result = analyzeSearchHealth({ clicksDropRate: 0.02 }, mockCoverage);

    expect(result.status).toBe('clear'); // 12 days old, 35 errors (5xx), 45 other -> all below warning limits
    expect(result.metrics.crawlErrorsCount).toBe(35);
    expect(result.metrics.unexpectedClusterCount).toBe(45);
  });

  // --- Sweep-aware freshness tests ---

  it('should suppress drilldown freshness alerts when sweep is fresh', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 31 }; // 31 days → would be critical without sweep
    const freshSweep = {
      generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      totalSampled: 80,
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, freshSweep);

    expect(result.status).toBe('clear');
    expect(result.metrics.sweepFresh).toBe(true);
    expect(result.metrics.sweepAgeDays).toBe(2);
    // No freshness SLA breach alert should fire because sweep is fresh
    expect(result.alerts.find((a) => a.code === 'gsc_freshness_sla_breach')).toBeUndefined();
    expect(result.alerts.find((a) => a.code === 'gsc_freshness_sla_warning')).toBeUndefined();
  });

  it('should emit freshness breach when both drilldown and sweep are stale', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 40 };
    const staleSweep = {
      generatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      totalSampled: 80,
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, staleSweep);

    expect(result.metrics.sweepFresh).toBe(false);
    expect(result.alerts.find((a) => a.code === 'gsc_freshness_sla_breach')).toBeDefined();
    expect(result.alerts.find((a) => a.code === 'gsc_freshness_sla_inspection_sweep_stale')).toBeDefined();
  });

  it('should suppress drilldown freshness warning when sweep is fresh (drilldown 20 days)', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 20 }; // 20 days → would be warning without sweep
    const freshSweep = {
      generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      totalSampled: 50,
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, freshSweep);

    expect(result.status).toBe('clear');
    expect(result.metrics.sweepFresh).toBe(true);
    expect(result.alerts.find((a) => a.code === 'gsc_freshness_sla_warning')).toBeUndefined();
  });

  it('should emit inspection sweep stale alert when sweep exists but is >7 days old', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };
    const staleSweep = {
      generatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      totalSampled: 80,
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, staleSweep);

    expect(result.metrics.sweepFresh).toBe(false);
    expect(result.metrics.sweepAgeDays).toBe(10);
    const sweepAlert = result.alerts.find((a) => a.code === 'gsc_freshness_sla_inspection_sweep_stale');
    expect(sweepAlert).toBeDefined();
    expect(sweepAlert?.severity).toBe('warning');
  });

  it('should not consider sweep fresh when sampled < 10 URLs', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 40 }; // stale drilldown
    const smallSweep = {
      generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      totalSampled: 5, // below threshold
    };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, smallSweep);

    expect(result.metrics.sweepFresh).toBe(false);
    // Drilldown staleness alert should NOT be suppressed
    expect(result.alerts.find((a) => a.code === 'gsc_freshness_sla_breach')).toBeDefined();
  });

  it('should handle missing sweep data gracefully', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };

    const result = analyzeSearchHealth(mockCtr, mockCoverage); // no sweep arg
    expect(result.metrics.sweepAgeDays).toBeNull();
    expect(result.metrics.sweepFresh).toBe(false);
    expect(result.status).toBe('clear');
  });

  it('should handle malformed sweep data gracefully', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };
    const badSweep = { generatedAt: 'not-a-date' }; // invalid date

    const result = analyzeSearchHealth(mockCtr, mockCoverage, badSweep);
    expect(result.metrics.sweepFresh).toBe(false);
    expect(result.status).toBe('clear');
  });

  // --- Credential presence tests (D2) ---

  it('should emit credential missing alert when credentials not present', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, undefined, {
      credentialsPresent: false,
    });

    expect(result.status).toBe('blocking');
    const credAlert = result.alerts.find((a) => a.code === 'gsc_credential_missing');
    expect(credAlert).toBeDefined();
    expect(credAlert?.severity).toBe('critical');
    expect(credAlert?.title).toContain('Credentials Missing');
  });

  it('should not emit credential missing alert when credentials are present', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, undefined, {
      credentialsPresent: true,
    });

    expect(result.alerts.find((a) => a.code === 'gsc_credential_missing')).toBeUndefined();
    expect(result.status).toBe('clear');
  });

  // --- Blocklisted URL detection tests (D3) ---

  it('should emit blocklisted URLs critical alert when > 50 blocklisted URLs found in GSC', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, undefined, {
      blocklistedInGscCount: 75,
    });

    expect(result.status).toBe('blocking');
    const alert = result.alerts.find((a) => a.code === 'gsc_blocklisted_urls_in_index');
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe('critical');
    expect(result.metrics.blocklistedInGscCount).toBe(75);
  });

  it('should emit blocklisted URLs warning when > 10 blocklisted URLs found', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, undefined, {
      blocklistedInGscCount: 25,
    });

    expect(result.status).toBe('warning');
    const alert = result.alerts.find((a) => a.code === 'gsc_blocklisted_urls_warning');
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe('warning');
    // No critical alert should fire
    expect(result.alerts.find((a) => a.code === 'gsc_blocklisted_urls_in_index')).toBeUndefined();
  });

  it('should not emit blocklisted alert when count is ≤ 10', () => {
    const mockCtr = { clicksDropRate: 0 };
    const mockCoverage = { sourceFreshnessDays: 5 };

    const result = analyzeSearchHealth(mockCtr, mockCoverage, undefined, {
      blocklistedInGscCount: 8,
    });

    expect(result.alerts.find((a) => a.code === 'gsc_blocklisted_urls_warning')).toBeUndefined();
    expect(result.alerts.find((a) => a.code === 'gsc_blocklisted_urls_in_index')).toBeUndefined();
    expect(result.status).toBe('clear');
    expect(result.metrics.blocklistedInGscCount).toBe(8);
  });
});
