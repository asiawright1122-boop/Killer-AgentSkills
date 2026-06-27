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

  it('passes coverage-freshness-before-claims when URL Inspection sweep is fresh even if drilldown is stale', () => {
    const report = buildSearchComplianceMatrixReport({
      crawlHealth: {
        totals: { sitemapFilesDiscovered: 6, pageUrlsDiscovered: 1546, pageUrlsChecked: 721 },
        statusSummary: { status2xx: 721, status3xx: 0, status4xx: 0, status5xx: 0, statusOther: 0 },
        sitemapErrors: [],
        onPageSeoErrors: [],
        duplicates: [],
      },
      coverage: {
        issueCount: 1,
        totalAffectedPages: 5000,
        sourceFreshnessStatus: 'blocking',
        sourceFreshnessDate: '2026-05-01',
        sourceFreshnessDays: 25,
        sourceMaxWindowDays: 7,
      },
      // Fresh sweep — overrides stale drilldown
      urlInspectionSweep: {
        generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        sourceMode: 'p0-only',
        totalSampled: 80,
        overallPassRate: 0.75,
        clustersInspected: 8,
      },
    });

    const coverageItem = report.items.find((item) => item.id === 'coverage-freshness-before-claims')!;
    expect(coverageItem.verdict).toBe('pass');
    expect(coverageItem.rationale).toContain('inspection-sweep');
    // Evidence should include both drilldown and sweep
    expect(coverageItem.projectEvidence.length).toBe(2);
  });

  it('blocks coverage-freshness-before-claims when both drilldown and sweep are stale', () => {
    const report = buildSearchComplianceMatrixReport({
      coverage: {
        issueCount: 1,
        totalAffectedPages: 5000,
        sourceFreshnessStatus: 'blocking',
        sourceFreshnessDate: '2026-04-01',
        sourceFreshnessDays: 55,
        sourceMaxWindowDays: 7,
      },
      urlInspectionSweep: {
        generatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
        sourceMode: 'p0-only',
        totalSampled: 80,
        overallPassRate: 0.5,
      },
    });

    const coverageItem = report.items.find((item) => item.id === 'coverage-freshness-before-claims')!;
    expect(coverageItem.verdict).toBe('block');
  });

  it('passes coverage-freshness-before-claims when drilldown is fresh (no sweep needed)', () => {
    const report = buildSearchComplianceMatrixReport({
      coverage: {
        issueCount: 1,
        totalAffectedPages: 500,
        sourceFreshnessStatus: 'fresh',
        sourceFreshnessDate: '2026-06-25',
        sourceFreshnessDays: 2,
        sourceMaxWindowDays: 7,
      },
    });

    const coverageItem = report.items.find((item) => item.id === 'coverage-freshness-before-claims')!;
    expect(coverageItem.verdict).toBe('pass');
    expect(coverageItem.rationale).toContain('drilldown-export');
  });

  it('blocks coverage-freshness-before-claims when sweep has < 10 sampled URLs', () => {
    const report = buildSearchComplianceMatrixReport({
      coverage: {
        sourceFreshnessStatus: 'blocking',
        sourceFreshnessDays: 25,
        sourceMaxWindowDays: 7,
      },
      urlInspectionSweep: {
        generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        totalSampled: 5, // below threshold
      },
    });

    const coverageItem = report.items.find((item) => item.id === 'coverage-freshness-before-claims')!;
    expect(coverageItem.verdict).toBe('block');
  });

  it('blocks coverage-freshness-before-claims when no coverage or sweep data exists', () => {
    const report = buildSearchComplianceMatrixReport({});

    const coverageItem = report.items.find((item) => item.id === 'coverage-freshness-before-claims')!;
    expect(coverageItem.verdict).toBe('block');
  });
});
