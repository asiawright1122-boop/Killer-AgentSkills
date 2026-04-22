import { describe, expect, it } from 'vitest';
import { buildAuthorityOperatorQueueReport } from './authority-operator-queue';

describe('buildAuthorityOperatorQueueReport', () => {
  it('builds a focused operator queue for the five authority surfaces', () => {
    const report = buildAuthorityOperatorQueueReport({
      scorecard: {
        generatedAt: '2026-04-19T00:00:00.000Z',
        headline: 'scorecard',
        summary: {
          promote: 0,
          hold: 5,
          stop: 0,
        },
        comparisonWindow: {
          currentPeriod: { start: '2026-04-09', end: '2026-04-15' },
          previousPeriod: { start: '2026-04-02', end: '2026-04-08' },
          trustVerdict: 'warning',
          baselineSeeded: false,
          coverageFreshnessStatus: 'fresh',
          coverageSourceAgeDays: 0,
          trafficSourceMode: 'live-api',
        },
        expansionBoundary: {
          status: 'closed',
          headline: 'blocked',
          blockers: ['Proof window is trustworthy: trust=warning, baselineSeeded=no'],
          nextActions: ['Collect another trustworthy proof window.'],
        },
        surfaces: [
          {
            surfaceId: 'home-root',
            label: 'Homepage Root Hub',
            url: 'https://killer-skills.com/en',
            role: 'primary',
            tier: 'P0',
            surfaceClass: 'hub',
            decision: 'hold',
            cadence: 'weekly',
            editorialPriority: 'now',
            summary: 'hold',
            nextActions: ['Rewrite homepage authority copy.'],
            thresholds: {
              minImpressions: 3,
              minClicks: 1,
              maxPosition: 20,
              minPlacementCount: 3,
            },
            gates: [
              {
                id: 'proof-readiness',
                label: 'Comparable proof readiness',
                status: 'fail',
                target: 'ready',
                observed: 'trust=warning',
              },
              {
                id: 'internal-link-support',
                label: 'Internal-link support',
                status: 'fail',
                target: '>=3 placements',
                observed: '1 placement',
              },
            ],
            metrics: {
              currentClicks: 0,
              currentImpressions: 0,
              currentPosition: null,
              placementCount: 1,
              placements: ['report'],
              proofVerdict: 'warning',
              coverageFreshnessStatus: 'fresh',
              trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
            },
          },
          {
            surfaceId: 'collections-hub',
            label: 'Collections Hub',
            url: 'https://killer-skills.com/en/collections',
            role: 'primary',
            tier: 'P0',
            surfaceClass: 'hub',
            decision: 'hold',
            cadence: 'weekly',
            editorialPriority: 'now',
            summary: 'hold',
            nextActions: ['Clarify curated-path positioning.'],
            thresholds: {
              minImpressions: 3,
              minClicks: 1,
              maxPosition: 20,
              minPlacementCount: 3,
            },
            gates: [
              {
                id: 'proof-readiness',
                label: 'Comparable proof readiness',
                status: 'fail',
                target: 'ready',
                observed: 'trust=warning',
              },
              {
                id: 'visibility',
                label: 'Surface visibility',
                status: 'fail',
                target: '>=3 impressions',
                observed: '0 clicks, 0 impressions',
              },
            ],
            metrics: {
              currentClicks: 0,
              currentImpressions: 0,
              currentPosition: null,
              placementCount: 4,
              placements: ['home', 'skills', 'collections', 'solutions'],
              proofVerdict: 'warning',
              coverageFreshnessStatus: 'fresh',
              trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
            },
          },
          {
            surfaceId: 'collection-official-trusted-tools',
            label: 'Official AI Skills & Trusted Tools',
            url: 'https://killer-skills.com/en/collections/top-official-ai-skills-trusted-tools',
            role: 'primary',
            tier: 'P0',
            surfaceClass: 'collection',
            decision: 'hold',
            cadence: 'weekly',
            editorialPriority: 'now',
            summary: 'hold',
            nextActions: ['Strengthen trusted collection proof.'],
            thresholds: {
              minImpressions: 3,
              minClicks: 1,
              maxPosition: 35,
              minPlacementCount: 2,
            },
            gates: [],
            metrics: {
              currentClicks: 0,
              currentImpressions: 0,
              currentPosition: null,
              placementCount: 4,
              placements: ['home', 'skills', 'collections', 'solutions'],
              proofVerdict: 'warning',
              coverageFreshnessStatus: 'fresh',
              trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
            },
          },
          {
            surfaceId: 'collection-agent-workflows',
            label: 'Agent Workflow Building Tools',
            url: 'https://killer-skills.com/en/collections/top-agent-workflow-building-tools',
            role: 'primary',
            tier: 'P0',
            surfaceClass: 'collection',
            decision: 'hold',
            cadence: 'weekly',
            editorialPriority: 'now',
            summary: 'hold',
            nextActions: ['Strengthen workflow proof.'],
            thresholds: {
              minImpressions: 3,
              minClicks: 1,
              maxPosition: 35,
              minPlacementCount: 2,
            },
            gates: [],
            metrics: {
              currentClicks: 0,
              currentImpressions: 0,
              currentPosition: null,
              placementCount: 4,
              placements: ['home', 'skills', 'collections', 'solutions'],
              proofVerdict: 'warning',
              coverageFreshnessStatus: 'fresh',
              trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
            },
          },
          {
            surfaceId: 'docs-installation',
            label: 'Installation Docs',
            url: 'https://killer-skills.com/en/docs/installation',
            role: 'primary',
            tier: 'P0',
            surfaceClass: 'guide',
            decision: 'hold',
            cadence: 'weekly',
            editorialPriority: 'now',
            summary: 'hold',
            nextActions: ['Strengthen install bridge.'],
            thresholds: {
              minImpressions: 3,
              minClicks: 1,
              maxPosition: 25,
              minPlacementCount: 2,
            },
            gates: [],
            metrics: {
              currentClicks: 0,
              currentImpressions: 0,
              currentPosition: null,
              placementCount: 4,
              placements: ['home', 'skills', 'collections', 'solutions'],
              proofVerdict: 'warning',
              coverageFreshnessStatus: 'fresh',
              trafficWindow: { start: '2026-04-09', end: '2026-04-15' },
            },
          },
        ],
      },
      deltaBoard: {
        generatedAt: '2026-04-19T00:00:00.000Z',
        blockers: ['Business recovery remains unproven.'],
        sections: {
          issueClusterCohorts: [
            {
              id: 'cluster-other',
              label: 'Issue cluster: other',
              state: 'blocked',
              disposition: 'avoid',
              rank: 100,
              summary: 'Largest cluster.',
              blockers: ['Largest structural noise source.'],
              nextActions: ['Execute removal workflow.'],
              metrics: {
                currentScore: 100,
              },
            },
          ],
        },
      },
      authoritySurfaces: {
        editorialQueue: [
          {
            id: 'home-root-curated-paths',
            surfaceId: 'home-root',
            priority: 'now',
            action: {
              en: 'Reframe the homepage around curated paths.',
            },
            why: {
              en: 'Homepage cannot read like a raw directory.',
            },
          },
        ],
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.summary.focusSurfaces).toBe(5);
    expect(report.sitewideBlockers.some((blocker) => blocker.label === 'Issue cluster: other')).toBe(true);
    expect(report.entries[0]?.queuePriority).toBe('now');
    expect(report.entries.find((entry) => entry.surfaceId === 'home-root')?.actions).toContain(
      'Reframe the homepage around curated paths.',
    );
  });
});
