import { describe, expect, it } from 'vitest';
import {
  buildManualReviewDetails,
  describeManualReviewWorkstream,
  summarizeManualReviewWorkstreams,
} from './seo-404-missing-cluster-audit';

describe('buildManualReviewDetails', () => {
  it('explains noindex-target manual reviews as quality-promotion work', () => {
    const result = buildManualReviewDetails({
      classification: 'manual_review_target_noindex',
      candidateSignals: [
        {
          routePath: 'opentabs/build-plugin',
          routeBucket: 'noindex',
          canonicalLocale: 'en',
          canonicalUrl: 'https://killer-skills.com/en/skills/opentabs-dev/opentabs/build-plugin',
          eligibleLocales: ['en'],
          publishedLocales: ['en'],
          indexabilityMode: 'reference_only',
          isIndexable: false,
          qualityScore: 28,
          blockers: ['quality_below_review_floor'],
        },
      ],
    });

    expect(result.manualWorkstream).toBe('promote_noindex_target');
    expect(result.manualNextStep).toContain('opentabs/build-plugin');
    expect(result.manualNextStep).toContain('reference_only');
    expect(result.manualNextStep).toContain('quality_below_review_floor');
  });

  it('explains multi-skill repo roots as keep-410 until a public target exists', () => {
    const result = buildManualReviewDetails({
      classification: 'manual_review_multi_raw_skills',
      candidateSignals: [
        {
          routePath: 'pstrack/drizzle',
          routeBucket: null,
          canonicalLocale: null,
          canonicalUrl: null,
          eligibleLocales: [],
          publishedLocales: [],
          indexabilityMode: null,
          isIndexable: null,
          qualityScore: null,
          blockers: [],
        },
        {
          routePath: 'pstrack/zustand',
          routeBucket: null,
          canonicalLocale: null,
          canonicalUrl: null,
          eligibleLocales: [],
          publishedLocales: [],
          indexabilityMode: null,
          isIndexable: null,
          qualityScore: null,
          blockers: [],
        },
      ],
    });

    expect(result.manualWorkstream).toBe('resolve_multi_skill_repo_root');
    expect(result.manualNextStep).toContain('多个 raw 候选');
    expect(result.manualNextStep).toContain('继续 410');
  });
});

describe('manual review breakdown', () => {
  it('summarizes manual-review rows into stable workstreams', () => {
    const rows = [
      { manualWorkstream: 'promote_noindex_target' },
      { manualWorkstream: 'promote_noindex_target' },
      { manualWorkstream: 'resolve_route_mismatch' },
      { manualWorkstream: null },
    ] as any[];

    const summary = summarizeManualReviewWorkstreams(rows as any);
    expect(summary).toEqual([
      {
        workstream: 'promote_noindex_target',
        count: 2,
        summary: describeManualReviewWorkstream('promote_noindex_target'),
      },
      {
        workstream: 'resolve_route_mismatch',
        count: 1,
        summary: describeManualReviewWorkstream('resolve_route_mismatch'),
      },
    ]);
  });
});
