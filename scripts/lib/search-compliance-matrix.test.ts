import { describe, expect, it } from 'vitest';
import { buildSearchComplianceMatrixReport } from './search-compliance-matrix';

describe('buildSearchComplianceMatrixReport', () => {
  it('blocks recovery claims when Coverage is stale even if crawl and GSC are available', () => {
    const report = buildSearchComplianceMatrixReport({
      generatedAt: '2026-05-06T00:00:00.000Z',
      guidelineResearchExists: true,
      crawlHealth: {
        totals: { sitemapFilesDiscovered: 6, pageUrlsDiscovered: 1546, pageUrlsChecked: 721 },
        statusSummary: { status2xx: 721, status3xx: 0, status4xx: 0, status5xx: 0, statusOther: 0 },
        sitemapErrors: [],
        onPageSeoErrors: [],
        duplicates: [],
      },
      coverage: {
        issueCount: 2,
        totalAffectedPages: 16232,
        sourceFreshnessStatus: 'blocking',
        sourceFreshnessDate: '2026-04-16',
        sourceFreshnessDays: 18,
        sourceMaxWindowDays: 7,
        clusterPriorities: [{ cluster: 'other', estimatedAffected: 7460.5, weightedImpact: 13066.5 }],
      },
      traffic: {
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-08', end: '2026-05-05' },
        queryRows: 26,
        pageRows: 507,
        priorityQueryOpportunities: 0,
        priorityPageOpportunities: 0,
        queryPrecisionRisks: 2,
      },
      proofWindow: {
        trustVerdict: 'blocking',
        sourceSummary: {
          technicalRecoveryStatus: 'clear',
          businessRecoveryStatus: 'blocking',
          coverageFreshnessStatus: 'blocking',
        },
        blockers: ['Coverage Drilldown raw inputs are stale.'],
        nextActions: ['Import a fresher Coverage Drilldown raw export.'],
      },
      authority: {
        expansionBoundary: 'closed',
        counts: { promote: 0, hold: 31, stop: 1 },
      },
      experimentLadder: {
        automationPolicy: 'locked',
        summary: { limitedRollout: 0, automationCandidate: 0 },
      },
    });

    expect(report.overallVerdict).toBe('block');
    expect(report.counts.block).toBeGreaterThan(0);
    expect(report.items.find((item) => item.id === 'crawl-index-eligibility')?.verdict).toBe('pass');
    expect(report.items.find((item) => item.id === 'coverage-freshness-before-claims')?.verdict).toBe('block');
    expect(report.items.find((item) => item.id === 'proof-before-expansion')?.verdict).toBe('block');
  });

  it('marks AI-search evidence unavailable instead of inventing proof when no surface is promotable', () => {
    const report = buildSearchComplianceMatrixReport({
      authority: {
        expansionBoundary: 'closed',
        counts: { promote: 0, hold: 31, stop: 1 },
      },
      experimentLadder: {
        automationPolicy: 'locked',
        summary: { limitedRollout: 0, automationCandidate: 0 },
      },
    });

    expect(report.items.find((item) => item.id === 'ai-search-and-indexnow-evidence')?.verdict).toBe('unavailable');
    expect(report.nextActions.join(' ')).toContain('Bing AI Performance / IndexNow evidence');
  });
});
