import { describe, expect, it } from 'vitest';
import {
  buildRecoveryScorecardReport,
  parseGscCtrReportMarkdown,
  parseGscMonitoringSkippedMarkdown,
  renderRecoveryScorecardReport,
} from './recovery-scorecard';

describe('parseGscCtrReportMarkdown', () => {
  it('extracts summary fields from the generated markdown report', () => {
    const report = parseGscCtrReportMarkdown(`# GSC CTR Report

## Summary

- Generated: 2026-04-09T05:00:00.000Z
- Status: clear
- Source mode: live-api
- Site: sc-domain:killer-skills.com
- Current period: 2026-04-02 to 2026-04-08
- Previous period: 2026-03-26 to 2026-04-01
- Query rows: 120
- Page rows: 90
- Priority query opportunities: 15
- Priority page opportunities: 12
- Query precision risks: 3
`);

    expect(report.generatedAt).toBe('2026-04-09T05:00:00.000Z');
    expect(report.status).toBe('clear');
    expect(report.sourceMode).toBe('live-api');
    expect(report.site).toBe('sc-domain:killer-skills.com');
    expect(report.currentPeriod).toEqual({ start: '2026-04-02', end: '2026-04-08' });
    expect(report.previousPeriod).toEqual({ start: '2026-03-26', end: '2026-04-01' });
    expect(report.queryRows).toBe(120);
    expect(report.pageRows).toBe(90);
    expect(report.queryPrecisionRisks).toBe(3);
  });
});

describe('parseGscMonitoringSkippedMarkdown', () => {
  it('normalizes workflow skip markdown into a blocking traffic summary', () => {
    const report = parseGscMonitoringSkippedMarkdown(`# SEO Monitoring Skipped

Missing one or more required secrets:
- \`GSC_CLIENT_EMAIL\`
- \`GSC_PRIVATE_KEY\`
- \`GSC_SITE_URL\`

Add the Search Console service account to the property, then rerun this workflow.
`);

    expect(report.status).toBe('blocking');
    expect(report.sourceMode).toBe('missing-config');
    expect(report.failureReason).toContain('GSC_CLIENT_EMAIL');
    expect(report.nextStep).toContain('rerun this workflow');
  });
});

describe('buildRecoveryScorecardReport', () => {
  it('marks technical recovery clear while blocking business recovery when traffic is missing', () => {
    const report = buildRecoveryScorecardReport({
      now: '2026-04-09T12:00:00.000Z',
      crawlHealthReport: {
        generatedAt: '2026-04-09T04:52:24.060Z',
        totals: { sitemapFilesDiscovered: 20, pageUrlsDiscovered: 29280, pageUrlsChecked: 1650 },
        statusSummary: { status2xx: 1650, status3xx: 0, status4xx: 0, status5xx: 0, statusOther: 0 },
        cloudflare1102: [],
      },
      coverageDrilldownReport: {
        generatedAt: '2026-04-09T04:10:28.523Z',
        directories: ['/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-03'],
        issueCount: 1,
        totalAffectedPages: 5449,
        sourceFreshnessStatus: 'warning',
        sourceFreshnessDate: '2026-04-03',
        sourceFreshnessDays: 6,
        sourcePreferredWindowDays: 3,
        sourceMaxWindowDays: 7,
        clusterPriorities: [{ cluster: 'trailing_slash', estimatedAffected: 3451.2 }],
        issueSummaries: [{ issueName: '服务器错误 (5xx)', affectedPages: 5449 }],
      },
      indexDriftReport: {
        generatedAt: '2026-04-08T06:49:41.377Z',
        counts: { onlyInSitemap: 0, onlyInIndexableCache: 0 },
      },
      aiProviderHealthReport: {
        generatedAt: '2026-04-09T04:13:12.663Z',
        alertSummary: { total: 1, highestSeverity: 'warning', status: 'soft warning' },
        alerts: [
          {
            severity: 'warning',
            code: 'probe_access_issues',
            title: 'Direct provider probe observed auth or billing issues',
          },
        ],
        telemetry: { mode: { workersAi: 'free-only', fallbackPolicy: 'cold' } },
        latestSnapshot: {
          workersAi: {
            maxCallsPerRun: 60,
            maxCallsPerDay: 60,
            dailyCalls: 1,
            dailyRemaining: 59,
            runRemaining: 60,
          },
        },
      },
      trafficReport: null,
    });

    expect(report.crawl.status).toBe('clear');
    expect(report.coverage.status).toBe('warning');
    expect(report.coverage.metrics.sourceFreshnessStatus).toBe('warning');
    expect(report.index.status).toBe('clear');
    expect(report.traffic.status).toBe('blocking');
    expect(report.aiPosture.status).toBe('warning');
    expect(report.technicalRecoveryStatus).toBe('clear');
    expect(report.businessRecoveryStatus).toBe('blocking');
    expect(report.overallStatus).toBe('blocking');
    expect(report.headline).toContain('Technical recovery on the main domain is stable.');
    expect(report.headline).toContain('Business recovery still cannot be validated');
  });

  it('clears traffic visibility when a fresh Search Console summary exists', () => {
    const report = buildRecoveryScorecardReport({
      now: '2026-04-09T12:00:00.000Z',
      crawlHealthReport: {
        generatedAt: '2026-04-09T04:52:24.060Z',
        totals: { pageUrlsChecked: 1650 },
        statusSummary: { status2xx: 1650, status4xx: 0, status5xx: 0, statusOther: 0 },
        cloudflare1102: [],
      },
      coverageDrilldownReport: {
        generatedAt: '2026-04-09T04:10:28.523Z',
        directories: ['/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-08'],
        issueCount: 0,
        totalAffectedPages: 0,
        sourceFreshnessStatus: 'fresh',
        sourceFreshnessDate: '2026-04-08',
        sourceFreshnessDays: 1,
        clusterPriorities: [],
        issueSummaries: [],
      },
      indexDriftReport: {
        generatedAt: '2026-04-09T06:49:41.377Z',
        counts: { onlyInSitemap: 0, onlyInIndexableCache: 0 },
      },
      trafficReport: {
        generatedAt: '2026-04-09T06:00:00.000Z',
        status: 'clear',
        sourceMode: 'live-api',
        site: 'sc-domain:killer-skills.com',
        currentPeriod: { start: '2026-04-02', end: '2026-04-08' },
        previousPeriod: { start: '2026-03-26', end: '2026-04-01' },
        queryRows: 120,
        pageRows: 95,
        priorityQueryOpportunities: 15,
        priorityPageOpportunities: 12,
        queryPrecisionRisks: 3,
        failureReason: null,
        nextStep: null,
      },
      aiProviderHealthReport: {
        generatedAt: '2026-04-09T04:13:12.663Z',
        alertSummary: { total: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
        telemetry: { mode: { workersAi: 'free-only', fallbackPolicy: 'cold' } },
        latestSnapshot: {
          workersAi: {
            maxCallsPerRun: 60,
            maxCallsPerDay: 60,
            dailyCalls: 1,
            dailyRemaining: 59,
            runRemaining: 60,
          },
        },
      },
    });

    expect(report.coverage.status).toBe('clear');
    expect(report.traffic.status).toBe('clear');
    expect(report.businessRecoveryStatus).toBe('clear');
    expect(renderRecoveryScorecardReport(report)).toContain('Traffic Visibility');
  });

  it('keeps traffic visibility blocking when the report is a standardized missing-config artifact', () => {
    const report = buildRecoveryScorecardReport({
      now: '2026-04-09T12:00:00.000Z',
      crawlHealthReport: {
        generatedAt: '2026-04-09T04:52:24.060Z',
        totals: { pageUrlsChecked: 1650 },
        statusSummary: { status2xx: 1650, status4xx: 0, status5xx: 0, statusOther: 0 },
        cloudflare1102: [],
      },
      coverageDrilldownReport: {
        generatedAt: '2026-04-09T04:10:28.523Z',
        directories: ['/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-08'],
        issueCount: 0,
        totalAffectedPages: 0,
        sourceFreshnessStatus: 'fresh',
        sourceFreshnessDate: '2026-04-08',
        sourceFreshnessDays: 1,
        clusterPriorities: [],
        issueSummaries: [],
      },
      indexDriftReport: {
        generatedAt: '2026-04-09T06:49:41.377Z',
        counts: { onlyInSitemap: 0, onlyInIndexableCache: 0 },
      },
      trafficReport: {
        generatedAt: '2026-04-09T08:00:00.000Z',
        status: 'blocking',
        sourceMode: 'missing-config',
        site: null,
        currentPeriod: null,
        previousPeriod: null,
        queryRows: null,
        pageRows: null,
        priorityQueryOpportunities: null,
        priorityPageOpportunities: null,
        queryPrecisionRisks: null,
        failureReason:
          'Missing one or more required Search Console settings: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL.',
        nextStep:
          'Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_SITE_URL, then rerun `npx tsx scripts/gsc-fetch-report.ts`.',
      },
      aiProviderHealthReport: {
        generatedAt: '2026-04-09T04:13:12.663Z',
        alertSummary: { total: 0, highestSeverity: 'none', status: 'clear' },
        alerts: [],
        telemetry: { mode: { workersAi: 'free-only', fallbackPolicy: 'cold' } },
        latestSnapshot: {
          workersAi: {
            maxCallsPerRun: 60,
            maxCallsPerDay: 60,
            dailyCalls: 1,
            dailyRemaining: 59,
            runRemaining: 60,
          },
        },
      },
    });

    expect(report.traffic.status).toBe('blocking');
    expect(report.traffic.metrics.sourceMode).toBe('missing-config');
    expect(report.nextActions.join(' ')).toContain('GSC_CLIENT_EMAIL');
  });
});
