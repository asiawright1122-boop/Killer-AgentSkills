# Requirements: v3.8 Backlog Content Enrichment Automation

## Overview

With the groundwork for automated content enrichment laid in v3.7 (specifically the creation of the validation report script `seo-content-enrichment-report.ts`), Milestone v3.8 focuses on scaling content enrichment. The goal is to build an automated pipeline that can batch-upgrade thin or low-quality descriptions on backlog authority surfaces (which are currently stuck at `hold` status due to thin content warnings), enforce strict punctuation and CJK locale rules, and verify their readiness to transition to `promote` status on the scorecard.

## v3.8 Requirements

- [ ] **AIOPS-35**: Integrate the content enrichment validation report with an automated LLM rewrite pipeline (content-generator script).
- [ ] **AIOPS-36**: Execute batch enrichment on all currently thin or hold collections under `src/content/collections/`.
- [ ] **AIOPS-37**: Enforce strict CJK translation parity and trailing punctuation validation checks on all upgraded pages.
- [ ] **AIOPS-38**: Validate promoted surfaces using scorecard reports under production-like configs.

## Scope

### 1. Integrate content enrichment validation with LLM rewrite pipeline (Phase 114)
- **Problem**: We need a script that consumes the diagnostics from `seo-content-enrichment-report.ts` and uses LLM routing to automatically generate enriched Descriptions for any thin surfaces.
- **Requirement**:
  - Build/extend a script (e.g. `scripts/enrich-collections-batch.ts`) to read report output.
  - Integrate with the internal AI provider to generate enriched descriptions in all 10 locales.
  - Handle rate limits and implement dry-run modes.
- **Verification**: Script is functional and successfully processes a single test case.

### 2. Execute batch enrichment on backlog collections (Phase 115)
- **Problem**: 20+ authority pages and collections are marked as `hold` because their description length is too thin or they have formatting drift.
- **Requirement**:
  - Run the batch pipeline across all flagged collections.
  - Inject the generated metadata back into the source JSON files.
- **Verification**: Zero thin surfaces remaining according to the content enrichment report.

### 3. Enforce strict CJK parity and punctuation checks (Phase 116)
- **Problem**: Machine-generated translations often drop final punctuation (e.g. `.` or `。`) or exhibit language drift, failing the unit tests.
- **Requirement**:
  - Implement strict linting/validation gates to check that all translation keys have parity.
  - Guarantee that every `seoDescription` ends with valid punctuation.
- **Verification**: `npm run typecheck` and `vitest` tests pass cleanly.

### 4. Scorecard verification and promotion (Phase 117)
- **Problem**: Enriched surfaces need to be verified against the scorecard using production configurations.
- **Requirement**:
  - Run the authority scorecard and operator queue reports.
  - Verify that the enriched pages transition to `promote`.
- **Verification**: Updated scorecards generated in `reports/seo/`.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIOPS-35 | Phase 114 | Pending |
| AIOPS-36 | Phase 115 | Pending |
| AIOPS-37 | Phase 116 | Pending |
| AIOPS-38 | Phase 117 | Pending |

**Coverage:**
- v3.8 requirements: 4 total
- Mapped to phases: 4
- Unmapped: 0

---

*Last updated: 2026-06-09 during initialization of v3.8 Backlog Content Enrichment Automation*
