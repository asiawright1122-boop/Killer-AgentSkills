# Milestone v5.2 Requirements — Coverage Proof & Compliance Consolidation

## 1. Active Requirements

### Coverage Proof (COVP)
- [ ] **COVP-01**: Complete the REMOV-01 submission cycle (975 URLs, GitHub issue #19) when operator access is available. Run post-submission verification (`npm run report:seo:gsc-removal-verification -- verify`) and delta reporting. Submit the 191-URL second-pass batch. Target: coverage affected pages < 5,000. *(Carried from v5.1 COV-01)*

### Traffic Verification (TRAFF)
- [ ] **TRAFF-01**: Verify first measurable organic impressions and clicks on ≥2 P0 authority surfaces from GSC data. If impressions have not materialized after one full GSC data cycle, diagnose whether the gap is structural (no search demand for target queries) or operational (indexing/canonicalization issues). Target: ≥3 impressions and ≥1 click per surface.

### Compliance Consolidation (COMP)
- [ ] **COMP-01**: Regenerate the compliance matrix with fresh artifact data (structured-data validation, opportunity board, crawl health) so that the `structured-data-validity` and `ctr-search-appearance` lane upgrades from PIPE-01 are reflected in the stored report. Target: overall compliance verdict upgrades from `watch` to `pass` when both lanes clear.

## 2. Out of Scope

- **Bulk skill-detail re-expansion**: stays off until TRAFF-01 confirms measurable impressions.
- **Paid AI provider expansion**: separate budget decision.
- **Trailing-slash canonicalization in GSC**: already handled by middleware 301s; de-indexing will follow REMOV-01 submission as part of the `trailing_slash` cluster.

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| COVP-01 | Phase 162 | reports/seo/latest-gsc-removal-tracker.md, reports/seo/latest-coverage-delta.json | [ ] |
| TRAFF-01 | Phase 163 | reports/gsc/latest-ctr-report.json, reports/seo/latest-authority-uplift-scorecard.json | [ ] |
| COMP-01 | Phase 164 | reports/seo/latest-search-compliance-matrix.json | [ ] |

## 4. Carry-Forward from v5.1

| Carry Item | v5.2 Mapping |
|---|---|
| REMOV-01 manual GSC removal submission (0/975 URLs, GitHub issue #19) | COVP-01 |
| Second-pass batch (191 URLs ready) | COVP-01 |
| GSC impressions/clicks verification pending next data cycle | TRAFF-01 |
| Compliance matrix lanes stale (not re-run with new artifacts) | COMP-01 |
