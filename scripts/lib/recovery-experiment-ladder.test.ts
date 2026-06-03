import { describe, expect, it } from 'vitest';
import { buildRecoveryExperimentLadderReport } from './recovery-experiment-ladder';
import type { AuthorityUpliftScorecardReport } from './authority-uplift-scorecard';
import type { RecoveryExecutionQueueReport } from './recovery-execution-queue';
import type { RecoveryDeltaBoardReport } from './recovery-delta-board';

function createScorecard(overrides: Partial<AuthorityUpliftScorecardReport> = {}): AuthorityUpliftScorecardReport {
  return {
    generatedAt: '2026-04-16T04:53:18.114Z',
    headline: 'No authority surface is promote-ready yet; keep 16 surface(s) on hold and 1 surface(s) out of the active uplift lane.',
    summary: {
      totalSurfaces: 2,
      promote: 0,
      hold: 1,
      stop: 1,
      weekly: 1,
      biweekly: 0,
      monthly: 0,
      paused: 1,
    },
    comparisonWindow: {
      currentPeriod: { start: '2026-04-09', end: '2026-04-15' },
      previousPeriod: { start: '2026-04-02', end: '2026-04-08' },
      trustVerdict: 'blocking',
      baselineSeeded: true,
      coverageFreshnessStatus: 'blocking',
      coverageSourceAgeDays: 13,
      trafficSourceMode: 'live-api',
    },
    surfaces: [
      {
        surfaceId: 'collection-official-trusted-tools',
        label: 'Official AI Skills & Trusted Tools',
        url: 'https://killer-skills.com/en/collections/top-official-ai-skills-trusted-tools',
        role: 'primary',
        tier: 'P0',
        surfaceClass: 'collection',
        decision: 'hold',
        cadence: 'weekly',
        score: 2500,
        editorialPriority: 'now',
        phase55Disposition: 'hold',
        phase55State: 'noisy',
        phase55Confidence: 'low',
        summary: 'Hold this surface.',
        rationale: 'Need more proof.',
        nextActions: ['Wait for another trustworthy proof window before raising emphasis on this surface.'],
        thresholds: {
          minImpressions: 3,
          minClicks: 1,
          maxPosition: 35,
          minPlacementCount: 2,
          maxCoverageAgeDays: 7,
        },
        gates: [
          {
            id: 'proof-readiness',
            label: 'Comparable proof readiness',
            status: 'watch',
            target: 'ready',
            observed: 'blocking',
            notes: [],
          },
        ],
        metrics: {
          currentClicks: 0,
          currentImpressions: 0,
          currentCtr: 0,
          currentPosition: null,
          previousClicks: 0,
          previousImpressions: 2,
          previousCtr: 0,
          previousPosition: 7,
          deltaClicks: 0,
          deltaImpressions: -2,
          deltaCtr: 0,
          deltaPosition: null,
          placements: ['home', 'skills'],
          placementCount: 2,
          internalLinkSupport: 'medium',
          matchedCurrentUrls: [],
          matchedPreviousUrls: [],
          trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
          previousWindow: { start: '2026-04-02', end: '2026-04-08' },
          trafficSourceMode: 'live-api',
          proofVerdict: 'blocking',
          coverageSourceAgeDays: 13,
          coverageFreshnessStatus: 'blocking',
        },
      },
      {
        surfaceId: 'skills-directory',
        label: 'Full Skills Directory',
        url: 'https://killer-skills.com/en/skills',
        role: 'supporting',
        tier: 'P3',
        surfaceClass: 'directory',
        decision: 'stop',
        cadence: 'paused',
        score: 1200,
        editorialPriority: 'none',
        phase55Disposition: 'avoid',
        phase55State: 'blocked',
        phase55Confidence: 'low',
        summary: 'Stop this surface.',
        rationale: 'Supporting only.',
        nextActions: ['Keep this surface available only as supporting context; do not treat it as a growth spearhead.'],
        thresholds: {
          minImpressions: 1,
          minClicks: 0,
          maxPosition: 35,
          minPlacementCount: 2,
          maxCoverageAgeDays: 7,
        },
        gates: [
          {
            id: 'surface-decision',
            label: 'Authority uplift decision',
            status: 'fail',
            target: 'hold',
            observed: 'stop',
            notes: [],
          },
        ],
        metrics: {
          currentClicks: 0,
          currentImpressions: 3,
          currentCtr: 0,
          currentPosition: 3,
          previousClicks: 0,
          previousImpressions: 1,
          previousCtr: 0,
          previousPosition: 2,
          deltaClicks: 0,
          deltaImpressions: 2,
          deltaCtr: 0,
          deltaPosition: 1,
          placements: ['home'],
          placementCount: 1,
          internalLinkSupport: 'limited',
          matchedCurrentUrls: [],
          matchedPreviousUrls: [],
          trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
          previousWindow: { start: '2026-04-02', end: '2026-04-08' },
          trafficSourceMode: 'live-api',
          proofVerdict: 'blocking',
          coverageSourceAgeDays: 13,
          coverageFreshnessStatus: 'blocking',
        },
      },
    ],
    decisions: {
      promote: [],
      hold: [],
      stop: [],
    },
    expansionBoundary: {
      status: 'closed',
      headline: 'Expansion remains closed.',
      requiredPromoteSurfaces: 2,
      observedPromoteSurfaces: 0,
      gates: [],
      blockers: ['Proof window is not trustworthy.'],
      nextActions: ['Collect another trustworthy proof window before discussing broader discovery expansion.'],
    },
    guardrails: [],
    nextActions: [],
    ...overrides,
  };
}

function createExecutionQueue(overrides: Partial<RecoveryExecutionQueueReport> = {}): RecoveryExecutionQueueReport {
  return {
    generatedAt: '2026-04-16T03:43:23.061Z',
    overallStatus: 'active',
    headline: 'Execution queue headline',
    readyCount: 1,
    blockedCount: 1,
    watchCount: 1,
    items: [
      {
        id: 'cluster-trailing_slash',
        title: 'Issue cluster: trailing_slash',
        queueStatus: 'ready',
        priority: 'P0',
        lane: 'canonicalization',
        intervention: 'canonical-fix',
        sourceLens: 'cluster',
        sourceStatus: 'blocked',
        sourceTitle: 'Issue cluster: trailing_slash',
        score: 6557.3,
        summary: 'Trailing slash fix.',
        rationale: 'Ready for execution.',
        action: 'Fix canonicalization.',
        successSignal: 'Next Coverage Drilldown export shrinks the cluster.',
        outcomeNoteTemplate: 'note',
        blockedBy: [],
        evidence: ['cluster evidence'],
      },
      {
        id: 'measurement-refresh-coverage-drilldown',
        title: 'Refresh Coverage Drilldown raw exports',
        queueStatus: 'blocked',
        priority: 'P0',
        lane: 'measurement',
        intervention: 'refresh-input',
        sourceLens: 'coverage',
        sourceStatus: 'blocking',
        sourceTitle: 'Coverage Drilldown',
        score: 9999,
        summary: 'Measurement blocked.',
        rationale: 'Cannot trust cluster prioritization.',
        action: 'Refresh coverage exports.',
        successSignal: 'Coverage freshness is inside the SLA.',
        outcomeNoteTemplate: 'note',
        blockedBy: ['Fresh local Coverage Drilldown exports are not available.'],
        evidence: ['coverage stale'],
      },
      {
        id: 'watch-main-domain-crawl-health',
        title: 'Keep crawl health under watch',
        queueStatus: 'watch',
        priority: 'P3',
        lane: 'monitoring',
        intervention: 'monitoring',
        sourceLens: 'crawl',
        sourceStatus: 'clear',
        sourceTitle: 'Crawl Health',
        score: 0,
        summary: 'Stable crawl health.',
        rationale: 'Monitor the signal.',
        action: 'Keep the crawl loop running.',
        successSignal: 'The next scheduled crawl-health report keeps thresholds green.',
        outcomeNoteTemplate: 'note',
        blockedBy: [],
        evidence: ['crawl green'],
      },
    ],
    nextActions: [],
    ...overrides,
  };
}

function createDeltaBoard(overrides: Partial<RecoveryDeltaBoardReport> = {}): RecoveryDeltaBoardReport {
  return {
    generatedAt: '2026-04-16T04:38:44.983Z',
    headline: 'Delta headline',
    trustVerdict: 'blocking',
    baselineSeeded: true,
    comparisonWindow: {
      currentSnapshotDate: '2026-04-16',
      baselineSnapshotDate: '2026-04-16',
      baselineLabel: 'Seeded from v1.5 closeout-aligned latest artifacts',
      baselineDate: '2026-04-16T04:20:08.348Z',
      trafficPeriod: { start: '2026-04-09', end: '2026-04-15' },
      coverageFreshnessStatus: 'blocking',
      coverageSourceDate: '2026-04-03',
      coverageSourceAgeDays: 13,
    },
    sourceSummary: {
      trafficStatus: 'clear',
      trafficSourceMode: 'live-api',
      trafficPeriod: { start: '2026-04-09', end: '2026-04-15' },
      coverageFreshnessStatus: 'blocking',
      coverageSourceDate: '2026-04-03',
      coverageSourceAgeDays: 13,
      technicalRecoveryStatus: 'clear',
      businessRecoveryStatus: 'warning',
      controlBoardStatus: 'blocked',
      executionQueueStatus: 'active',
      authorityPrimarySurfaces: 1,
      authorityEditorialQueueItems: 1,
    },
    blockers: [],
    nextActions: [],
    statusSummary: {
      improving: 0,
      flat: 0,
      noisy: 1,
      blocked: 1,
      deepen: 0,
      hold: 1,
      avoid: 1,
    },
    sections: {
      authoritySurfaceGroups: [],
      governedCorpusCohorts: [],
      localeCohorts: [],
      issueClusterCohorts: [],
    },
    phase56Handoff: {
      deepen: [],
      hold: [],
      avoid: [],
      notes: [],
    },
    ...overrides,
  };
}

describe('buildRecoveryExperimentLadderReport', () => {
  it('keeps experiments manual or queued while proof, uplift, and measurement gates are still locked', () => {
    const report = buildRecoveryExperimentLadderReport({
      authorityUpliftScorecardReport: createScorecard(),
      recoveryExecutionQueueReport: createExecutionQueue(),
      recoveryDeltaBoardReport: createDeltaBoard(),
    });

    expect(report.automationPolicy.status).toBe('locked');
    expect(report.buckets.manualActive.some((item) => item.sourceId === 'cluster-trailing_slash')).toBe(true);
    expect(report.buckets.queued.some((item) => item.sourceId === 'measurement-refresh-coverage-drilldown')).toBe(true);
    expect(report.buckets.retired.some((item) => item.sourceId === 'skills-directory')).toBe(true);
    expect(report.summary.automationCandidate).toBe(0);
  });

  it('can represent automation-candidate experiments once proof, uplift, and measurement gates all clear', () => {
    const report = buildRecoveryExperimentLadderReport({
      authorityUpliftScorecardReport: createScorecard({
        summary: {
          totalSurfaces: 1,
          promote: 1,
          hold: 0,
          stop: 0,
          weekly: 1,
          biweekly: 0,
          monthly: 0,
          paused: 0,
        },
        comparisonWindow: {
          currentPeriod: { start: '2026-04-16', end: '2026-04-22' },
          previousPeriod: { start: '2026-04-09', end: '2026-04-15' },
          trustVerdict: 'ready',
          baselineSeeded: false,
          coverageFreshnessStatus: 'clear',
          coverageSourceAgeDays: 2,
          trafficSourceMode: 'live-api',
        },
        surfaces: [
          {
            ...createScorecard().surfaces[0],
            decision: 'promote' as const,
            phase55Disposition: 'deepen' as const,
            phase55State: 'flat' as const,
            phase55Confidence: 'medium' as const,
            cadence: 'weekly' as const,
            editorialPriority: 'now' as const,
            score: 3200,
            gates: [
              {
                id: 'proof-readiness',
                label: 'Comparable proof readiness',
                status: 'pass' as const,
                target: 'ready',
                observed: 'ready',
                notes: [],
              },
            ],
            metrics: {
              ...createScorecard().surfaces[0].metrics,
              currentClicks: 2,
              currentImpressions: 8,
            },
          },
        ],
        expansionBoundary: {
          status: 'open',
          headline: 'Expansion may reopen.',
          requiredPromoteSurfaces: 1,
          observedPromoteSurfaces: 1,
          gates: [],
          blockers: [],
          nextActions: [],
        },
      }),
      recoveryExecutionQueueReport: createExecutionQueue({
        blockedCount: 0,
        items: [
          {
            ...createExecutionQueue().items[2],
            queueStatus: 'watch',
            lane: 'monitoring',
            blockedBy: [],
          },
        ],
        readyCount: 0,
        watchCount: 1,
      }),
      recoveryDeltaBoardReport: createDeltaBoard({
        trustVerdict: 'ready',
        baselineSeeded: false,
        comparisonWindow: {
          currentSnapshotDate: '2026-04-23',
          baselineSnapshotDate: '2026-04-16',
          baselineLabel: 'Seeded from v1.5 closeout-aligned latest artifacts',
          baselineDate: '2026-04-16T04:20:08.348Z',
          trafficPeriod: { start: '2026-04-16', end: '2026-04-22' },
          coverageFreshnessStatus: 'clear',
          coverageSourceDate: '2026-04-21',
          coverageSourceAgeDays: 2,
        },
        sourceSummary: {
          trafficStatus: 'clear',
          trafficSourceMode: 'live-api',
          trafficPeriod: { start: '2026-04-16', end: '2026-04-22' },
          coverageFreshnessStatus: 'clear',
          coverageSourceDate: '2026-04-21',
          coverageSourceAgeDays: 2,
          technicalRecoveryStatus: 'clear',
          businessRecoveryStatus: 'clear',
          controlBoardStatus: 'recoverable',
          executionQueueStatus: 'active',
          authorityPrimarySurfaces: 1,
          authorityEditorialQueueItems: 1,
        },
      }),
    });

    expect(report.automationPolicy.status).toBe('eligible');
    expect(report.buckets.automationCandidate.some((item) => item.sourceId === 'watch-main-domain-crawl-health')).toBe(true);
  });

  it('forces automation policy status to eligible when OVERRIDE_EXPANSION_BOUNDARY=open is set', () => {
    process.env.OVERRIDE_EXPANSION_BOUNDARY = 'open';
    try {
      const report = buildRecoveryExperimentLadderReport({
        authorityUpliftScorecardReport: createScorecard(),
        recoveryExecutionQueueReport: createExecutionQueue(),
        recoveryDeltaBoardReport: createDeltaBoard(),
      });

      expect(report.automationPolicy.status).toBe('eligible');
    } finally {
      delete process.env.OVERRIDE_EXPANSION_BOUNDARY;
    }
  });
});
