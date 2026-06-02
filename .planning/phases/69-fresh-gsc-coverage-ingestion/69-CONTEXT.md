---
phase: 69-fresh-gsc-coverage-ingestion
milestone: v2.0
requirements:
  - REC-30
  - REC-31
status: active
created: 2026-05-29
---

# Phase 69 Context: Fresh GSC Coverage Ingestion

## Goal

Ingest a fresh GSC Coverage Drilldown report to physically confirm the eradication of 16k+ historic errors, satisfy requirements `REC-30` and `REC-31`, and restore the sub-3-day freshness SLA for our SEO reporting pipeline.

## Current Truth

- **Phase 68 status**: Completed and verified. High-quality human-curated copy injected on homepage and top collections (Cursor, Windsurf, Claude Code).
- **GSC Coverage Drift**: The local GSC Coverage reporting is currently using a historical baseline from `2026-04-16` because we applied a local freshness override (`SEO_COVERAGE_SOURCE_MAX_DAYS=100`) to prevent SLA failures.
- **Freshness SLA**: To restore the strict search governance posture of the project, we must clear this freshness override and ingest a real, physical GSC Coverage report post-dating May 2026.
- **Blocked Status**: We currently have no new physical ZIP export for `killer-skills.com-Coverage-Drilldown` inside `data/coverage-drilldown-raw/` or in the operator's local `Downloads` directory.

## Decision Boundary

- **No Stale Assumptions**: Do not claim that historic 404/redirect errors are resolved in Search Console until a physical report dated post-May 2026 is parsed and audited.
- **Strict SLA Recovery**: Once the fresh GSC file is available, we will remove the `SEO_COVERAGE_SOURCE_MAX_DAYS=100` override from `.env` or settings to enforce our high-standard SEO operations.

## Next Required Actions

1. Request the operator to download the latest **Page Indexing (Coverage) Drilldown** report zip file from Google Search Console for `killer-skills.com`.
2. Guide the operator on where to place the exported folder (e.g. `data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-05-XX/`) or how to pass it.
3. Once available, run the ingestion and coverage classification pipeline to reconcile errors and prove the de-indexing of 404 traps.
