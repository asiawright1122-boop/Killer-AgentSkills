import { describe, expect, it } from 'vitest';
import { buildRecoveryDeltaBoardReport } from './recovery-delta-board';
import type { RecoveryProofWindowReport } from './recovery-proof-window';
import type { RecoveryControlBoardReport } from './recovery-control-board';

function createProofWindow(overrides: Partial<RecoveryProofWindowReport> = {}): RecoveryProofWindowReport {
  return {
    generatedAt: '2026-04-16T04:20:08.348Z',
    snapshotDate: '2026-04-16',
    snapshotDirectory: 'reports/seo/recovery-proof-windows/2026-04-16',
    baselinePath: 'reports/seo/recovery-proof-windows/baseline.json',
    baselineLabel: 'Seeded from v1.5 closeout-aligned latest artifacts',
    baselineDate: '2026-04-16T04:20:08.348Z',
    baselineSeeded: true,
    trustVerdict: 'blocking',
    headline: 'First comparable proof window is seeded and still blocked by stale coverage freshness.',
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
    comparisons: [],
    blockers: [
      'Coverage Drilldown raw inputs are still too stale for confident cluster-level proof.',
      'Business recovery remains unproven, so this window should not justify expansion by itself.',
    ],
    nextActions: [
      'Import a fresher Coverage Drilldown raw export before trusting cluster-level delta attribution.',
      'Collect another comparable proof window before approving authority-surface expansion.',
    ],
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
      authorityPrimarySurfaces: 16,
      authorityEditorialQueueItems: 5,
    },
    snapshotArtifacts: [],
    ...overrides,
  };
}

function createControlBoard(items: RecoveryControlBoardReport['items'], overrides: Partial<RecoveryControlBoardReport> = {}): RecoveryControlBoardReport {
  return {
    generatedAt: '2026-04-16T03:38:09.677Z',
    overallStatus: 'blocked',
    technicalRecoveryStatus: 'clear',
    businessRecoveryStatus: 'warning',
    trafficSourceMode: 'live-api',
    headline: 'Control board headline',
    lenses: [],
    items,
    nextActions: items.flatMap((item) => item.actions).slice(0, 6),
    ...overrides,
  };
}

function createAuthorityProgram() {
  return {
    generatedAt: '2026-04-16T03:17:31.858Z',
    summary: {
      totalSurfaces: 4,
      primarySurfaces: 3,
      supportingSurfaces: 1,
      editorialQueueItems: 2,
    },
    surfaces: [
      {
        id: 'home-root',
        role: 'primary' as const,
        tier: 'P0' as const,
        surfaceClass: 'hub',
        title: { en: 'Homepage Root Hub' },
      },
      {
        id: 'collection-official-trusted-tools',
        role: 'primary' as const,
        tier: 'P0' as const,
        surfaceClass: 'collection',
        title: { en: 'Official AI Skills & Trusted Tools' },
      },
      {
        id: 'docs-installation',
        role: 'primary' as const,
        tier: 'P0' as const,
        surfaceClass: 'guide',
        title: { en: 'Installation Docs' },
      },
      {
        id: 'skills-directory',
        role: 'supporting' as const,
        tier: 'P3' as const,
        surfaceClass: 'directory',
        title: { en: 'Full Skills Directory' },
      },
    ],
    editorialQueue: [
      {
        id: 'official-collection-proof',
        surfaceId: 'collection-official-trusted-tools',
        priority: 'now' as const,
      },
      {
        id: 'install-guide-bridge',
        surfaceId: 'docs-installation',
        priority: 'now' as const,
      },
    ],
  };
}

describe('buildRecoveryDeltaBoardReport', () => {
  it('keeps authority cohorts on hold when only the seeded blocking proof window exists', () => {
    const localeDeclineJa = {
      id: 'locale-decline-ja',
      lens: 'locale' as const,
      status: 'recoverable' as const,
      score: 32.56,
      title: 'Locale suppression: ja',
      summary: 'Locale ja shows clicks -1 and CTR -100.00% versus the previous period.',
      evidence: ['Current clicks 0', 'Current impressions 29'],
      actions: ['Inspect whether the locale still has enough eligible pages and clean internal links.'],
    };
    const trailingSlash = {
      id: 'cluster-trailing_slash',
      lens: 'cluster' as const,
      status: 'blocked' as const,
      score: 6557.3,
      title: 'Issue cluster: trailing_slash',
      summary: 'Estimated affected pages 3,451 with weighted impact 6,557.',
      evidence: ['服务器错误 (5xx)（P0 可用性）'],
      actions: ['Keep trailing-slash canonicalization at the edge and clean any internal links still ending with `/`.'],
    };

    const report = buildRecoveryDeltaBoardReport({
      proofWindowReport: createProofWindow(),
      currentControlBoardReport: createControlBoard([localeDeclineJa, trailingSlash]),
      baselineControlBoardReport: createControlBoard([localeDeclineJa, trailingSlash]),
      currentAuthorityProgramReport: createAuthorityProgram(),
      baselineAuthorityProgramReport: createAuthorityProgram(),
      authoritySurfacesData: createAuthorityProgram(),
    });

    expect(report.sections.authoritySurfaceGroups.find((item) => item.id === 'authority-group-collection')?.state).toBe('noisy');
    expect(report.sections.governedCorpusCohorts.find((item) => item.id === 'governed-primary-authority-surfaces')?.state).toBe('flat');
    expect(report.sections.issueClusterCohorts.find((item) => item.id === 'cluster-trailing_slash')?.state).toBe('blocked');
    expect(report.sections.localeCohorts.find((item) => item.id === 'locale-decline-ja')?.state).toBe('blocked');
    expect(report.phase56Handoff.deepen).toHaveLength(0);
    expect(report.phase56Handoff.avoid.some((item) => item.surfaceId === 'skills-directory')).toBe(true);
  });

  it('promotes resolved control cohorts and P0 authority surfaces once trustworthy proof exists', () => {
    const baselineLocale = {
      id: 'locale-decline-ja',
      lens: 'locale' as const,
      status: 'recoverable' as const,
      score: 32.56,
      title: 'Locale suppression: ja',
      summary: 'Locale ja shows clicks -1 and CTR -100.00% versus the previous period.',
      evidence: ['Current clicks 0', 'Current impressions 29'],
      actions: ['Inspect whether the locale still has enough eligible pages and clean internal links.'],
    };
    const baselineCluster = {
      id: 'cluster-trailing_slash',
      lens: 'cluster' as const,
      status: 'blocked' as const,
      score: 6557.3,
      title: 'Issue cluster: trailing_slash',
      summary: 'Estimated affected pages 3,451 with weighted impact 6,557.',
      evidence: ['服务器错误 (5xx)（P0 可用性）'],
      actions: ['Keep trailing-slash canonicalization at the edge and clean any internal links still ending with `/`.'],
    };

    const report = buildRecoveryDeltaBoardReport({
      proofWindowReport: createProofWindow({
        generatedAt: '2026-04-23T00:00:00.000Z',
        snapshotDate: '2026-04-23',
        baselineSeeded: false,
        trustVerdict: 'ready',
        blockers: [],
        nextActions: ['Proceed to cohort attribution only if the next window remains trustworthy.'],
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
          authorityPrimarySurfaces: 16,
          authorityEditorialQueueItems: 5,
        },
      }),
      currentControlBoardReport: createControlBoard([], {
        overallStatus: 'recoverable',
        businessRecoveryStatus: 'clear',
      }),
      baselineControlBoardReport: createControlBoard([baselineLocale, baselineCluster]),
      currentAuthorityProgramReport: createAuthorityProgram(),
      baselineAuthorityProgramReport: createAuthorityProgram(),
      authoritySurfacesData: createAuthorityProgram(),
    });

    expect(report.sections.localeCohorts.find((item) => item.id === 'locale-decline-ja')?.state).toBe('improving');
    expect(report.sections.issueClusterCohorts.find((item) => item.id === 'cluster-trailing_slash')?.state).toBe('improving');
    expect(report.sections.authoritySurfaceGroups.find((item) => item.id === 'authority-group-collection')?.disposition).toBe('deepen');
    expect(report.phase56Handoff.deepen.some((item) => item.surfaceId === 'collection-official-trusted-tools')).toBe(true);
    expect(report.phase56Handoff.avoid.some((item) => item.surfaceId === 'skills-directory')).toBe(true);
  });
});
