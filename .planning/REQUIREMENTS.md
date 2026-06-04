# Requirements: v3.3 Manual Recovery Execution & Fresh Ingestion

## Overview

Ingest fresh Google Search Console (GSC) Coverage data to resolve SLA warnings, execute P0 manual recovery batches, and assess post-intervention recovery signals using the technical scorecard.

## v3.3 Requirements

- [x] **AIOPS-18**: Ingest fresh GSC Coverage Drilldown data (dated within the 7-day SLA freshness requirement) and ensure the build-time freshness gate passes.
- [x] **AIOPS-19**: Execute manual recovery enrichment batches for high-priority directory surfaces (such as collection directories and localized skill catalogs).
- [x] **AIOPS-20**: Recalculate the technical recovery scorecard metrics based on the fresh inputs and output an updated `RecoveryScorecardReport`.

## Scope

### 1. GSC Coverage Fresh Ingestion (Phase 97)
- **Problem**: The current local GSC Coverage Drilldown export is dated `2026-04-16`, failing the 7-day SLA freshness validation rule.
- **Requirement**:
  - Replace the legacy GSC Coverage data source file with a fresh export (e.g. dated `2026-06-04`).
  - Verify that the ingestion scripts run cleanly and the build-time validation succeeds without SLA freshness warnings.
- **Verification**: Ingestion command output shows successful file loading and 0 SLA validation logs.

### 2. P0 Manual Recovery Execution (Phase 98)
- **Problem**: Stale indexation recovery blocks auto-rollouts on the experiment ladder. We must execute manual recovery steps for P0 surfaces.
- **Requirement**:
  - Run the manual recovery enrichment pipeline on priority collection pages.
  - Regenerate locales, index metadata, and semantic internal navigation.
- **Verification**: Target directories are updated with regenerated JSON assets.

### 3. Technical Scorecard Recalculation (Phase 99)
- **Problem**: Stale scorecards prevent accurate assessment of technical and business recovery status.
- **Requirement**:
  - Re-run the technical recovery evaluation script using the fresh coverage inputs.
  - Regenerate the technical scorecard report and determine if the status can transition to `clear`.
- **Verification**: Technical recovery scorecard completes, updating the local scorecard metrics and outputting `RecoveryScorecardReport`.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIOPS-18 | Phase 97 | Satisfied |
| AIOPS-19 | Phase 98 | Satisfied |
| AIOPS-20 | Phase 99 | Satisfied |

**Coverage:**
- v3.3 requirements: 3 total
- Mapped to phases: 3
- Unmapped: 0

---

*Last updated: 2026-06-04 during initialization of v3.3 Manual Recovery Execution & Fresh Ingestion*
