---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Traffic Activation & Index Health Closure
status: in_progress
last_updated: "2026-06-27T06:18:00.000Z"
last_activity: 2026-06-27
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
---

# Current Position

Phase: 157 (automation delivered — Traffic Activation)
Plan: Complete (2/3 plans)
Status: Phase 157 automation delivered. P0 titles/descriptions optimized across 8 surfaces. HowTo JSON-LD already exists on skill detail pages. IndexNow extended to ping P0 surface URLs. relatedCollections populated on skill detail pages. Structured data validation script built. 0 regressions.
Last activity: 2026-06-27

## v5.0 Context: Traffic Activation & Index Health Closure

v4.0–v4.9 built structural, editorial, crawl, and compliance foundations. The discovery expansion boundary is `open`, 34 surfaces are `promote`-ready, and the recovery scorecard is `CLEAR`. But traffic signals have *worsened* since baseline (query rows: 20→0, page rows: 179→21), coverage anomalies grew (5,449→10,783), and not a single promote surface has measurable impressions.

v5.0 shifts from structural readiness to measurable traffic and index growth.

## Active Requirements

- **IND-01**: Index Health Closure — close the coverage anomaly gap (10,783 → <2,000), verify REMOV-01 impact, build second-pass batch
- **TRAF-01**: Traffic Activation — earn measurable impressions on P0 surfaces, optimize titles/descriptions/structured data, wire IndexNow
- **FRESH-01**: Coverage Freshness Automation — automate GSC data freshness ≤7d, close REC-24 (unresolved since April)

## Phase Plan

### Phase 156: Index Health Closure
- **Status:** Automation delivered (verification pending operator REMOV-01 submission)
- **Scope:** Coverage anomaly re-analysis, post-submission verification automation, second-pass batch builder
- **Depends on:** Phase 155 automation (complete)

### Phase 157: Traffic Activation
- **Status:** Automation delivered
- **Scope:** P0 title/description audit + rewrite, IndexNow P0 extension, relatedCollections population, structured data validation
- **Depends on:** Phase 153 editorial uplift (complete)
- **Delivered:**
  - P0 titles/descriptions optimized across 8 surfaces (en + removed duplicate brand suffixes in 9 other locales)
  - HowTo JSON-LD already existed on skill detail pages (no change needed)
  - IndexNow extended to ping 80 P0 surface URLs (8 paths × 10 locales) on deploy
  - `relatedCollections` populated via `data/skill-collection-lookup.json` (117 skill refs mapped across 38 collections)
  - `scripts/seo-structured-data-validate.ts` + 17 tests
  - `npm run report:seo:structured-data-validate` npm script wired

### Phase 158: Coverage Freshness Automation
- **Status:** Planned
- **Scope:** GSC API coverage pipeline, Coverage Drilldown auto-refresh, freshness SLA alert, traffic proof dashboard
- **Depends on:** GSC API credentials availability (may require operator setup)

## Carry-Forward from v4.9

- REMOV-01: 975-URL GSC removal batch (0/975 submitted, tracked via GitHub issue #19) → IND-01
- Zero impressions on 34 promote surfaces → TRAF-01
- Coverage Drilldown freshness gap (21+ days, REC-24 unresolved since April) → FRESH-01
