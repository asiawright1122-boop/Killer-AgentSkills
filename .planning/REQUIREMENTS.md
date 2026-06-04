# Requirements: v3.5 Post-Intervention Recovery Verification & GEO/CTR Promotion

## Overview

Assess post-intervention recovery metrics using real-world data from D1 and GSC, resolve residual exclusion roadblocks to aim for a 95%+ recovery rate, and refresh organic CTR performance data to transition business recovery out of its blocking state.

## v3.5 Requirements

- [ ] **AIOPS-24**: Verify remote database GSC coverage records via automated tooling and generate the post-intervention recovery scorecard.
- [ ] **AIOPS-25**: Remediate residual search exclusion patterns (e.g. invalid 404 skill pages, noindex parameters) to drive the technical recovery rate towards the 95% threshold.
- [ ] **AIOPS-26**: Refresh live GSC search console stats, track organic click trends, and verify if the business recovery status can transition out of `blocking`.

## Scope

### 1. Remote Database Recovery Proof Verification (Phase 103)
- **Problem**: The recovery rate has only been validated locally/mocked. Real production recovery evidence depends on D1 records.
- **Requirement**:
  - Run wrangler D1 execution via `verify-recovery-proof.ts`.
  - Output `.planning/dashboards/recovery-scorecard.md` to display live recovery percentage.
- **Verification**: `recovery-scorecard.md` is populated with remote database statistics.

### 2. Residual Exclusion Reasons Remediation (Phase 104)
- **Problem**: GSC excluded pages or residual redirect issues keep the recovery rate below the 95% threshold required to unlock automation.
- **Requirement**:
  - Analyze the reasons listed in D1 for excluded pages.
  - Implement remediations (e.g., correct redirect mappings, adjust page headers, clean up stale sitemap links).
- **Verification**: Re-running the recovery verification shows an indexation rate improvement towards 95%+.

### 3. Traffic and CTR Visibility Refresh (Phase 105)
- **Problem**: Business recovery status is marked as `blocking` because live organic search performance metrics haven't been fetched/analyzed.
- **Requirement**:
  - Execute live GSC search performance fetches using the API tools.
  - Analyze organic CTR data and evaluate if the business recovery gate can be cleared.
- **Verification**: GSC live reports are generated and scorecard business recovery status is evaluated based on live clicks.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIOPS-24 | Phase 103 | Pending |
| AIOPS-25 | Phase 104 | Pending |
| AIOPS-26 | Phase 105 | Pending |

**Coverage:**
- v3.5 requirements: 3 total
- Mapped to phases: 3
- Unmapped: 0

---

*Last updated: 2026-06-04 during initialization of v3.5 Post-Intervention Recovery Verification & GEO/CTR Promotion*
