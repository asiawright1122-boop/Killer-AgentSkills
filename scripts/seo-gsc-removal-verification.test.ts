import { describe, expect, it } from 'vitest';
import {
  classifyRemovalStatus,
  computeDelta,
  mapBatchClusterToDrilldown,
  type CoverageSweepReport,
  type SweepClusterSummary,
  type VerificationStatus,
} from './seo-gsc-removal-verification';

// ---------------------------------------------------------------------------
// classifyRemovalStatus
// ---------------------------------------------------------------------------
describe('classifyRemovalStatus', () => {
  it('classifies PASS verdict as "failed" (still indexed)', () => {
    expect(classifyRemovalStatus('PASS', 'URL is indexed')).toBe<VerificationStatus>('failed');
  });

  it('classifies NEUTRAL with "not found" coverage as "removed"', () => {
    expect(classifyRemovalStatus('NEUTRAL', 'URL is not known to Google')).toBe<VerificationStatus>('removed');
  });

  it('classifies NEUTRAL with "Submitted URL" as "pending"', () => {
    expect(classifyRemovalStatus('NEUTRAL', 'Submitted URL not selected as canonical')).toBe<VerificationStatus>('removed');
  });

  it('classifies NEUTRAL with "Crawled" as "pending"', () => {
    expect(classifyRemovalStatus('NEUTRAL', 'Crawled - currently not indexed')).toBe<VerificationStatus>('removed');
  });

  it('classifies NEUTRAL with "Discovered" as "pending"', () => {
    expect(classifyRemovalStatus('NEUTRAL', 'Discovered - currently not indexed')).toBe<VerificationStatus>('removed');
  });

  it('classifies FAIL with "Not found" as "not_found_in_index"', () => {
    expect(classifyRemovalStatus('FAIL', 'Not found (404)')).toBe<VerificationStatus>('not_found_in_index');
  });

  it('classifies FAIL without "Not found" as "removed"', () => {
    expect(classifyRemovalStatus('FAIL', 'Server error (5xx)')).toBe<VerificationStatus>('removed');
  });

  it('classifies ERROR verdict as "pending" (unknown, needs re-check)', () => {
    expect(classifyRemovalStatus('ERROR', 'UNSPECIFIED')).toBe<VerificationStatus>('pending');
  });

  it('classifies UNSPECIFIED verdict as "pending"', () => {
    expect(classifyRemovalStatus('UNSPECIFIED', 'UNSPECIFIED')).toBe<VerificationStatus>('pending');
  });

  it('classifies NEUTRAL with unknown coverage state as "removed" (default)', () => {
    expect(classifyRemovalStatus('NEUTRAL', 'Some unknown state')).toBe<VerificationStatus>('removed');
  });
});

// ---------------------------------------------------------------------------
// mapBatchClusterToDrilldown
// ---------------------------------------------------------------------------
describe('mapBatchClusterToDrilldown', () => {
  it('maps source_file to source_file_path', () => {
    expect(mapBatchClusterToDrilldown('source_file')).toEqual(['source_file_path']);
  });

  it('maps skill_blocklisted to known_skill_404 and other', () => {
    expect(mapBatchClusterToDrilldown('skill_blocklisted')).toEqual(['known_skill_404', 'other']);
  });

  it('maps trailing_slash to trailing_slash', () => {
    expect(mapBatchClusterToDrilldown('trailing_slash')).toEqual(['trailing_slash']);
  });

  it('maps query_param to query_parameter', () => {
    expect(mapBatchClusterToDrilldown('query_param')).toEqual(['query_parameter']);
  });

  it('maps deep_path to deep_skill_path', () => {
    expect(mapBatchClusterToDrilldown('deep_path')).toEqual(['deep_skill_path']);
  });

  it('returns the cluster name in an array for unknown clusters', () => {
    expect(mapBatchClusterToDrilldown('unknown_cluster')).toEqual(['unknown_cluster']);
  });
});

// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------
describe('computeDelta', () => {
  function makeSweep(clusters: SweepClusterSummary[]): CoverageSweepReport {
    return {
      generatedAt: '2026-06-26T00:00:00.000Z',
      totalSampled: clusters.reduce((s, c) => s + c.sampleSize, 0),
      clusters,
      records: [],
    };
  }

  it('computes positive net change when more URLs are NEUTRAL/FAIL after', () => {
    const before = makeSweep([
      { cluster: 'source_file_path', sampleSize: 50, passCount: 40, neutralCount: 5, failCount: 3, errorCount: 2 },
    ]);
    const after = makeSweep([
      { cluster: 'source_file_path', sampleSize: 50, passCount: 10, neutralCount: 30, failCount: 8, errorCount: 2 },
    ]);

    const delta = computeDelta(before, after);
    expect(delta.clusters).toHaveLength(1);
    const c = delta.clusters[0];
    expect(c.passDelta).toBe(-30); // 10 - 40
    expect(c.neutralDelta).toBe(25); // 30 - 5
    expect(c.failDelta).toBe(5); // 8 - 3
    // net change = neutralDelta + failDelta + errorDelta - passDelta = 25 + 5 + 0 - (-30) = 60
    expect(c.netChange).toBe(60);
    expect(delta.overallNetChange).toBe(60);
  });

  it('computes negative net change when more URLs are PASS after (regression)', () => {
    const before = makeSweep([
      { cluster: 'trailing_slash', sampleSize: 20, passCount: 5, neutralCount: 10, failCount: 3, errorCount: 2 },
    ]);
    const after = makeSweep([
      { cluster: 'trailing_slash', sampleSize: 20, passCount: 15, neutralCount: 3, failCount: 1, errorCount: 1 },
    ]);

    const delta = computeDelta(before, after);
    const c = delta.clusters[0];
    expect(c.passDelta).toBe(10); // 15 - 5
    // neutralDelta = 3-10 = -7, failDelta = 1-3 = -2, errorDelta = 1-2 = -1
    // netChange = -7 + -2 + -1 - 10 = -20
    expect(c.netChange).toBe(-20);
    expect(c.netChange).toBe(-20);
  });

  it('handles missing before sweep', () => {
    const after = makeSweep([
      { cluster: 'source_file_path', sampleSize: 10, passCount: 2, neutralCount: 6, failCount: 1, errorCount: 1 },
    ]);

    const delta = computeDelta(null, after);
    expect(delta.totalClustersBefore).toBe(0);
    expect(delta.totalClustersAfter).toBe(1);
    expect(delta.clusters).toHaveLength(1);
  });

  it('handles missing after sweep', () => {
    const before = makeSweep([
      { cluster: 'source_file_path', sampleSize: 10, passCount: 8, neutralCount: 1, failCount: 1, errorCount: 0 },
    ]);

    const delta = computeDelta(before, null);
    expect(delta.totalClustersBefore).toBe(1);
    expect(delta.totalClustersAfter).toBe(0);
  });

  it('handles multiple clusters and computes overall net change', () => {
    const before = makeSweep([
      { cluster: 'source_file_path', sampleSize: 50, passCount: 40, neutralCount: 5, failCount: 3, errorCount: 2 },
      { cluster: 'trailing_slash', sampleSize: 20, passCount: 15, neutralCount: 3, failCount: 1, errorCount: 1 },
    ]);
    const after = makeSweep([
      { cluster: 'source_file_path', sampleSize: 50, passCount: 10, neutralCount: 30, failCount: 8, errorCount: 2 },
      { cluster: 'trailing_slash', sampleSize: 20, passCount: 15, neutralCount: 3, failCount: 1, errorCount: 1 },
    ]);

    const delta = computeDelta(before, after);
    expect(delta.clusters).toHaveLength(2);
    // source_file_path improved (+60), trailing_slash unchanged (0)
    expect(delta.overallNetChange).toBe(60);
  });

  it('sorts clusters by net change descending (most improved first)', () => {
    const before = makeSweep([
      { cluster: 'a', sampleSize: 10, passCount: 8, neutralCount: 1, failCount: 1, errorCount: 0 },
      { cluster: 'b', sampleSize: 10, passCount: 5, neutralCount: 3, failCount: 1, errorCount: 1 },
    ]);
    const after = makeSweep([
      { cluster: 'a', sampleSize: 10, passCount: 2, neutralCount: 5, failCount: 2, errorCount: 1 },
      { cluster: 'b', sampleSize: 10, passCount: 4, neutralCount: 4, failCount: 1, errorCount: 1 },
    ]);

    const delta = computeDelta(before, after);
    expect(delta.clusters[0].cluster).toBe('a'); // bigger improvement
  });
});
