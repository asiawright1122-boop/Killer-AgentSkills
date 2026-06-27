import { describe, expect, it } from 'vitest';
import {
  computeV1Coverage,
  buildV2Batch,
  mapBatchClusterToDrilldown,
  type DrilldownReport,
  type RemediationPlan,
  type V1Batch,
} from './seo-gsc-removal-batch-v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeV1Batch(clusters: Record<string, number>): V1Batch {
  const byCluster: V1Batch['byCluster'] = {};
  const urls: V1Batch['urls'] = [];
  let priority = 1;

  for (const [cluster, count] of Object.entries(clusters)) {
    byCluster[cluster] = { count, sample: [] };
    for (let i = 0; i < count; i++) {
      const url = `https://killer-skills.com/en/skills/owner${i}/repo${i}`;
      urls.push({ url, cluster, priority: priority++ });
      if (byCluster[cluster].sample.length < 5) {
        byCluster[cluster].sample.push(url);
      }
    }
  }

  return {
    generatedAt: '2026-06-25T00:00:00.000Z',
    totalUrls: urls.length,
    byCluster,
    urls,
  };
}

function makeDrilldown(clusterPriorities: Array<{ cluster: string; estimatedAffected: number; weightedImpact: number; sampleCount: number; topSamples?: string[] }>): DrilldownReport {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    totalAffectedPages: 10783,
    clusterPriorities: clusterPriorities.map((cp) => ({
      ...cp,
      topSamples: cp.topSamples || [],
    })),
  };
}

function makeRemediation(actions: Array<{ url: string; cluster: string; action: string; reason: string }>): RemediationPlan {
  return {
    generatedAt: '2026-06-26T00:00:00.000Z',
    issueName: '未找到 (404)',
    totalSamples: actions.length,
    actions: actions.map((a) => ({
      ...a,
      targetUrl: a.action === 'redirect_301' ? a.url + '-canonical' : undefined,
      coveredByRuntime: true,
      runtimeCoverageSource: 'middleware',
    })),
  };
}

// ---------------------------------------------------------------------------
// computeV1Coverage
// ---------------------------------------------------------------------------
describe('computeV1Coverage', () => {
  it('maps v1 batch clusters to drilldown clusters with correct URL counts', () => {
    const v1 = makeV1Batch({ source_file: 301, skill_blocklisted: 258 });
    const coverage = computeV1Coverage(v1);

    expect(coverage.get('source_file_path')?.v1Urls).toBe(301);
    expect(coverage.get('known_skill_404')?.v1Urls).toBe(258);
  });

  it('aggregates multiple v1 clusters mapping to the same drilldown cluster', () => {
    const v1 = makeV1Batch({ skill_blocklisted: 258, skill_missing_or_unpublished: 187 });
    const coverage = computeV1Coverage(v1);

    // Both map to known_skill_404
    expect(coverage.get('known_skill_404')?.v1Urls).toBe(258 + 187);
  });

  it('returns empty map for empty batch', () => {
    const v1 = makeV1Batch({});
    const coverage = computeV1Coverage(v1);
    expect(coverage.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mapBatchClusterToDrilldown
// ---------------------------------------------------------------------------
describe('mapBatchClusterToDrilldown', () => {
  it('maps source_file to source_file_path', () => {
    expect(mapBatchClusterToDrilldown('source_file')).toEqual(['source_file_path']);
  });

  it('maps skill_blocklisted to known_skill_404', () => {
    expect(mapBatchClusterToDrilldown('skill_blocklisted')).toEqual(['known_skill_404']);
  });

  it('maps trailing_slash to trailing_slash', () => {
    expect(mapBatchClusterToDrilldown('trailing_slash')).toEqual(['trailing_slash']);
  });
});

// ---------------------------------------------------------------------------
// buildV2Batch
// ---------------------------------------------------------------------------
describe('buildV2Batch', () => {
  it('excludes v1 URLs from the v2 batch', () => {
    const drilldown = makeDrilldown([
      { cluster: 'known_skill_404', estimatedAffected: 5499, weightedImpact: 9348, sampleCount: 510 },
    ]);
    const remediation = makeRemediation([
      { url: 'https://killer-skills.com/en/skills/owner0/repo0', cluster: 'known_skill_404', action: 'gone_410', reason: 'blocked_by_sitemap' },
      { url: 'https://killer-skills.com/en/skills/owner1/repo1', cluster: 'known_skill_404', action: 'gone_410', reason: 'blocked_by_sitemap' },
    ]);
    const v1 = makeV1Batch({ skill_blocklisted: 1 });
    // Override v1 URLs to include the first remediation URL
    v1.urls[0].url = 'https://killer-skills.com/en/skills/owner0/repo0';

    const batch = buildV2Batch(drilldown, remediation, v1, 1);

    // Only the second remediation URL should be in v2 (first is excluded)
    const v2urls = batch.urls.map((u) => u.url);
    expect(v2urls).not.toContain('https://killer-skills.com/en/skills/owner0/repo0');
    expect(v2urls).toContain('https://killer-skills.com/en/skills/owner1/repo1');
  });

  it('selects the top N clusters by residual weighted impact', () => {
    const drilldown = makeDrilldown([
      { cluster: 'known_skill_404', estimatedAffected: 5499, weightedImpact: 9348, sampleCount: 510 },
      { cluster: 'source_file_path', estimatedAffected: 4011, weightedImpact: 6819, sampleCount: 372 },
      { cluster: 'trailing_slash', estimatedAffected: 971, weightedImpact: 1649, sampleCount: 90 },
    ]);
    const remediation = makeRemediation([]);
    const v1 = null;

    const batch = buildV2Batch(drilldown, remediation, v1, 2);

    expect(batch.targetClusters).toEqual(['known_skill_404', 'source_file_path']);
  });

  it('only includes gone_410 and redirect_301 actionable URLs', () => {
    const drilldown = makeDrilldown([
      { cluster: 'known_skill_404', estimatedAffected: 100, weightedImpact: 170, sampleCount: 10 },
    ]);
    const remediation = makeRemediation([
      { url: 'https://killer-skills.com/en/skills/a/b', cluster: 'known_skill_404', action: 'gone_410', reason: 'test' },
      { url: 'https://killer-skills.com/en/skills/c/d', cluster: 'known_skill_404', action: 'redirect_301', reason: 'test' },
      { url: 'https://killer-skills.com/en/skills/e/f', cluster: 'known_skill_404', action: 'manual_review', reason: 'test' },
      { url: 'https://killer-skills.com/en/skills/g/h', cluster: 'known_skill_404', action: 'observe', reason: 'test' },
    ]);

    const batch = buildV2Batch(drilldown, remediation, null, 1);

    const actions = batch.urls.map((u) => u.action);
    expect(actions).toContain('gone_410');
    expect(actions).toContain('redirect_301');
    expect(actions).not.toContain('manual_review');
    expect(actions).not.toContain('observe');
  });

  it('returns empty batch when no remediation or drilldown data available', () => {
    const drilldown = makeDrilldown([]);
    const batch = buildV2Batch(drilldown, null, null, 3);
    expect(batch.totalUrls).toBe(0);
  });

  it('sorts URLs by priority (gone_410 first)', () => {
    const drilldown = makeDrilldown([
      { cluster: 'trailing_slash', estimatedAffected: 100, weightedImpact: 170, sampleCount: 10 },
    ]);
    const remediation = makeRemediation([
      { url: 'https://killer-skills.com/en/skills/a/b', cluster: 'trailing_slash', action: 'redirect_301', reason: 'trailing' },
      { url: 'https://killer-skills.com/en/skills/c/d', cluster: 'trailing_slash', action: 'gone_410', reason: 'trapping' },
    ]);

    const batch = buildV2Batch(drilldown, remediation, null, 1);

    expect(batch.urls[0].action).toBe('gone_410');
    expect(batch.urls[1].action).toBe('redirect_301');
  });
});
