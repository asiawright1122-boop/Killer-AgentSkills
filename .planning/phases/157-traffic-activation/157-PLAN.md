# Plan: Traffic Activation — Title/Description/Structured-Data Optimization

This phase targets TRAF-01 by optimizing P0 authority surfaces for measurable search impressions through title/description rewrites, structured data gaps, IndexNow expansion, and internal link reinforcement.

- **Wave:** 1
- **Depends on:** Phase 153 (editorial uplift — complete)
- **Requirements:** TRAF-01
- **Autonomous:** full

## Context

- 34 authority surfaces are promote-ready but 0 have measurable GSC impressions.
- 8 P0 surfaces identified in the authority surface program.
- Blog SEO titles/descriptions lack MetaOverride entries for 2 P0 blog posts.
- IndexNow only pings skill detail URLs — P0 surfaces are excluded.
- `relatedCollections` on skill detail pages is empty, breaking internal link flow.
- Structured data compliance is "watch" — no validation pipeline exists.

## Phase Scope

1. Title/description audit + optimized rewrites for all 8 P0 surfaces (10 locales)
2. HowTo JSON-LD on skill detail pages
3. IndexNow P0 surface URL extension
4. `relatedCollections` population on skill detail pages
5. Structured data validation script

## Tasks

(See approved plan for full task details)

## Success Criteria

- [ ] All 8 P0 surfaces have unique, descriptive titles and meta descriptions (no templates)
- [ ] Structured data validates clean on all 8 P0 surfaces
- [ ] IndexNow pings P0 surface URLs on deploy
- [ ] ≥3 internal inbound links per P0 surface (via relatedCollections)
- [ ] 0 regressions (1088+ tests pass, crawl health CLEAR)
