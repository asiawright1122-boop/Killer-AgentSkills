import { describe, expect, it } from 'vitest';
import {
  buildDetailRiskChips,
  buildMarketplaceDetailTrust,
  getDetailSourceKind,
  pickDetailTaskChips,
} from './skill-detail-view';

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

describe('buildMarketplaceDetailTrust', () => {
  it('builds install decision trust evidence for detail pages', () => {
    const trust = buildMarketplaceDetailTrust(
      {
        id: 'owner/repo',
        name: 'repo',
        owner: 'owner',
        repo: 'repo',
        description: 'Reviewed installable skill.',
        securityLevel: 'A',
        sourceTrust: 'T2',
        isTrustedRankingEligible: true,
        filePath: '.claude/skills/repo/SKILL.md',
        updatedAt: '2026-07-01T00:00:00.000Z',
        riskFlags: [{ code: 'external_network', severity: 'warning', label: 'external network call' }],
        skillMd: {
          name: 'repo',
          description: 'Reviewed installable skill.',
          bodyPreview: 'Reviewed installable skill source.',
        },
      } as any,
      { locale: 'en', routePath: 'owner/repo', now: new Date('2026-07-07T00:00:00.000Z') },
    );

    expect(trust.reviewStatus).toBe('admitted');
    expect(trust.rows.map((row) => row.label)).toContain('Risk flags');
    expect(trust.rows.map((row) => row.label)).toContain('Source repository');
    expect(trust.rows.map((row) => row.label)).toContain('Install path');
    expect(trust.rows.find((row) => row.label === 'Source repository')?.value).toBe('owner/repo');
    expect(trust.rows.find((row) => row.label === 'Install path')?.value).toBe('owner/repo');
    expect(trust.riskLabels).toEqual(['Network access']);
    expect(trust.whyListed).toContain('T2');
  });
});
