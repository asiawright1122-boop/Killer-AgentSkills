import { describe, expect, it } from 'vitest';
import { buildDetailRiskChips, getDetailSourceKind, pickDetailTaskChips } from './skill-detail-view';

describe('pickDetailTaskChips', () => {
  it('prefers use cases, then features, then topics, and deduplicates labels', () => {
    expect(
      pickDetailTaskChips({
        useCases: ['Generate reports', 'Generate reports'],
        features: ['Read Markdown'],
        topics: ['markdown', 'automation'],
        limit: 3,
      }),
    ).toEqual(['Generate reports', 'Read Markdown', 'markdown']);
  });

  it('drops empty labels and respects the limit', () => {
    expect(
      pickDetailTaskChips({
        useCases: ['', '  ', 'Deploy'],
        features: ['Review'],
        topics: ['Audit'],
        limit: 2,
      }),
    ).toEqual(['Deploy', 'Review']);
  });
});

describe('getDetailSourceKind', () => {
  it('treats verified skills as official when source kind is missing', () => {
    expect(getDetailSourceKind({ isVerified: true })).toBe('official');
  });

  it('keeps explicit community source kind', () => {
    expect(getDetailSourceKind({ isVerified: true, sourceKind: 'community' })).toBe('community');
  });
});

describe('buildDetailRiskChips', () => {
  it('uses visible review labels first and deduplicates risk flag labels', () => {
    expect(
      buildDetailRiskChips({
        visibleRiskLabels: ['Token', 'Network'],
        riskFlags: [{ label: 'Network' }, { label: 'File write' }],
      }),
    ).toEqual(['Token', 'Network', 'File write']);
  });

  it('returns an empty list when no risks exist', () => {
    expect(buildDetailRiskChips({ visibleRiskLabels: [], riskFlags: [] })).toEqual([]);
  });

  it('keeps detail risk chips concise for visible decision panels', () => {
    expect(
      buildDetailRiskChips({
        visibleRiskLabels: ['Token', 'Network', 'File write', 'Thin source'],
        riskFlags: [{ label: 'Network' }, { label: 'Stale source' }],
      }).slice(0, 4),
    ).toEqual(['Token', 'Network', 'File write', 'Thin source']);
  });
});
