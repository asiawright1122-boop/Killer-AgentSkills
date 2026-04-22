import { describe, expect, it } from 'vitest';
import type { GscRow } from '../../src/lib/gsc-report';
import { buildAuthorityUpliftScorecardReport } from './authority-uplift-scorecard';
import type { RecoveryDeltaBoardReport } from './recovery-delta-board';

function createDeltaBoard(overrides: Partial<RecoveryDeltaBoardReport> = {}): RecoveryDeltaBoardReport {
  return {
    generatedAt: '2026-04-16T04:38:44.983Z',
    headline: 'Delta board headline',
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
      authorityPrimarySurfaces: 2,
      authorityEditorialQueueItems: 2,
    },
    blockers: ['Coverage Drilldown raw inputs are still too stale for confident cluster-level proof.'],
    nextActions: ['Collect another comparable proof window before approving authority-surface expansion.'],
    statusSummary: {
      improving: 0,
      flat: 1,
      noisy: 1,
      blocked: 1,
      deepen: 0,
      hold: 2,
      avoid: 1,
    },
    sections: {
      authoritySurfaceGroups: [
        {
          id: 'authority-group-hub',
          cohortType: 'authority-surface-group',
          label: 'Authority hubs',
          state: 'noisy',
          confidence: 'low',
          disposition: 'hold',
          comparisonPresence: 'both',
          rank: 1,
          summary: 'Hubs are stable but not ready.',
          evidence: [],
          blockers: [],
          nextActions: [],
          relatedSurfaceIds: ['home-root'],
          metrics: {
            baselineCount: 1,
            currentCount: 1,
            deltaCount: 0,
            baselineScore: null,
            currentScore: null,
            deltaScore: null,
            baselineQueueCount: 0,
            currentQueueCount: 0,
            deltaQueueCount: 0,
            baselinePrimaryCount: 1,
            currentPrimaryCount: 1,
            deltaPrimaryCount: 0,
            coverageSourceAgeDays: 13,
          },
        },
      ],
      governedCorpusCohorts: [],
      localeCohorts: [],
      issueClusterCohorts: [],
    },
    phase56Handoff: {
      deepen: [],
      hold: [
        {
          surfaceId: 'home-root',
          label: 'Homepage Root Hub',
          surfaceClass: 'hub',
          tier: 'P0',
          priority: 'now',
          disposition: 'hold',
          reason: 'Need more proof.',
          relatedCohortIds: ['authority-group-hub'],
        },
        {
          surfaceId: 'collection-official-trusted-tools',
          label: 'Official AI Skills & Trusted Tools',
          surfaceClass: 'collection',
          tier: 'P0',
          priority: 'now',
          disposition: 'hold',
          reason: 'Need more proof.',
          relatedCohortIds: ['authority-group-collection'],
        },
      ],
      avoid: [
        {
          surfaceId: 'skills-directory',
          label: 'Full Skills Directory',
          surfaceClass: 'directory',
          tier: 'P3',
          priority: null,
          disposition: 'avoid',
          reason: 'Supporting only.',
          relatedCohortIds: ['authority-group-directory'],
        },
      ],
      notes: ['No surface should be promoted yet because the current proof window is still seeded or blocked.'],
    },
    ...overrides,
  };
}

function createAuthorityProgram() {
  return {
    surfaces: [
      {
        id: 'home-root',
        role: 'primary',
        tier: 'P0',
        surfaceClass: 'hub',
        href: '/{locale}',
        title: { en: 'Homepage Root Hub' },
        placements: ['report', 'home', 'skills'],
      },
      {
        id: 'collection-official-trusted-tools',
        role: 'primary',
        tier: 'P0',
        surfaceClass: 'collection',
        href: '/{locale}/collections/top-official-ai-skills-trusted-tools',
        title: { en: 'Official AI Skills & Trusted Tools' },
        placements: ['home', 'skills', 'collections', 'solutions'],
      },
      {
        id: 'skills-directory',
        role: 'supporting',
        tier: 'P3',
        surfaceClass: 'directory',
        href: '/{locale}/skills',
        title: { en: 'Full Skills Directory' },
        placements: ['home'],
      },
    ],
    editorialQueue: [
      {
        id: 'home-proof',
        surfaceId: 'home-root',
        priority: 'now',
      },
      {
        id: 'collection-proof',
        surfaceId: 'collection-official-trusted-tools',
        priority: 'now',
      },
    ],
  };
}

function createTrafficRows(currentHomeImpressions = 2, currentCollectionImpressions = 0): { current: GscRow[]; previous: GscRow[] } {
  return {
    current: [
      {
        entity: 'https://killer-skills.com/en',
        clicks: currentHomeImpressions > 2 ? 1 : 0,
        impressions: currentHomeImpressions,
        ctr: currentHomeImpressions > 2 ? 1 / currentHomeImpressions : 0,
        position: 4,
      },
      {
        entity: 'https://killer-skills.com/en/collections/top-official-ai-skills-trusted-tools',
        clicks: currentCollectionImpressions > 2 ? 1 : 0,
        impressions: currentCollectionImpressions,
        ctr: currentCollectionImpressions > 2 ? 1 / currentCollectionImpressions : 0,
        position: 6,
      },
    ],
    previous: [
      {
        entity: 'https://killer-skills.com/en',
        clicks: 0,
        impressions: 1,
        ctr: 0,
        position: 7,
      },
      {
        entity: 'https://killer-skills.com/en/collections/top-official-ai-skills-trusted-tools',
        clicks: 0,
        impressions: 1,
        ctr: 0,
        position: 8,
      },
    ],
  };
}

describe('buildAuthorityUpliftScorecardReport', () => {
  it('keeps primary surfaces on hold while proof is still blocking and stops the supporting directory', () => {
    const traffic = createTrafficRows(2, 0);
    const report = buildAuthorityUpliftScorecardReport({
      recoveryDeltaBoardReport: createDeltaBoard(),
      authorityProgramReport: createAuthorityProgram(),
      authoritySurfacesData: createAuthorityProgram(),
      trafficReport: {
        generatedAt: '2026-04-16T03:38:08.005Z',
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-09', end: '2026-04-15' },
        previousPeriod: { start: '2026-04-02', end: '2026-04-08' },
      },
      currentPageRows: traffic.current,
      previousPageRows: traffic.previous,
    });

    expect(report.decisions.promote).toHaveLength(0);
    expect(report.decisions.hold.some((item) => item.surfaceId === 'home-root')).toBe(true);
    expect(report.decisions.stop.some((item) => item.surfaceId === 'skills-directory')).toBe(true);
    expect(report.expansionBoundary.status).toBe('closed');
  });

  it('promotes primary surfaces and opens the discovery gate when proof and metrics both clear the thresholds', () => {
    const traffic = createTrafficRows(4, 5);
    const report = buildAuthorityUpliftScorecardReport({
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
          authorityPrimarySurfaces: 2,
          authorityEditorialQueueItems: 2,
        },
        phase56Handoff: {
          deepen: [
            {
              surfaceId: 'home-root',
              label: 'Homepage Root Hub',
              surfaceClass: 'hub',
              tier: 'P0',
              priority: 'now',
              disposition: 'deepen',
              reason: 'Ready to deepen.',
              relatedCohortIds: ['authority-group-hub'],
            },
            {
              surfaceId: 'collection-official-trusted-tools',
              label: 'Official AI Skills & Trusted Tools',
              surfaceClass: 'collection',
              tier: 'P0',
              priority: 'now',
              disposition: 'deepen',
              reason: 'Ready to deepen.',
              relatedCohortIds: ['authority-group-collection'],
            },
          ],
          hold: [],
          avoid: [
            {
              surfaceId: 'skills-directory',
              label: 'Full Skills Directory',
              surfaceClass: 'directory',
              tier: 'P3',
              priority: null,
              disposition: 'avoid',
              reason: 'Supporting only.',
              relatedCohortIds: ['authority-group-directory'],
            },
          ],
          notes: [],
        },
      }),
      authorityProgramReport: createAuthorityProgram(),
      authoritySurfacesData: createAuthorityProgram(),
      trafficReport: {
        generatedAt: '2026-04-23T03:38:08.005Z',
        status: 'clear',
        sourceMode: 'live-api',
        currentPeriod: { start: '2026-04-16', end: '2026-04-22' },
        previousPeriod: { start: '2026-04-09', end: '2026-04-15' },
      },
      currentPageRows: traffic.current,
      previousPageRows: traffic.previous,
    });

    expect(report.decisions.promote.some((item) => item.surfaceId === 'home-root')).toBe(true);
    expect(report.decisions.promote.some((item) => item.surfaceId === 'collection-official-trusted-tools')).toBe(true);
    expect(report.expansionBoundary.status).toBe('open');
    expect(report.decisions.stop.some((item) => item.surfaceId === 'skills-directory')).toBe(true);
  });
});
