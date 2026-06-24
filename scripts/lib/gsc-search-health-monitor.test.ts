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
});
