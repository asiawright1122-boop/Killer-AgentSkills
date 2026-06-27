# Milestone v5.1 Requirements — First Impression & Coverage Closure

## 1. Active Requirements

### Coverage Closure (COV)
- [ ] **COV-01**: Complete the REMOV-01 submission cycle (975 URLs, tracked via GitHub issue #19), run post-submission verification and delta reporting, and submit the 191-URL second-pass batch. Target: reduce coverage affected pages from 10,783 to below 5,000.

### First Impression Earners (IMPR)
- [ ] **IMPR-01**: Earn first measurable organic impressions and clicks on at least 2 P0 primary authority surfaces. Target: ≥3 impressions and ≥1 click per surface within the milestone window. Resolve GitHub issue #20 (takedown for scraped content at `/en/skills/atondwal/config` — the highest-scoring GSC opportunity at 1415.9). Execute the 5 editorial queue items from the authority operator queue. Run structured data production validation.

### Pipeline & Compliance Hardening (PIPE)
- [x] **PIPE-01**: Wire structured data validation into the daily SEO monitoring CI workflow. Add GSC API credential rotation alerting so credential failures surface as issues instead of being silently skipped. Add automated detection for blocklisted URLs appearing in GSC crawl data. Address trailing-slash canonicalization opportunities from the GSC opportunity board. Target: move 2+ compliance matrix lanes from "watch" to "pass".

## 2. Out of Scope

- **Bulk skill-detail re-expansion**: stays off until IMPR-01 shows measurable impressions on P0 surfaces.
- **Paid AI provider expansion**: SiliconFlow/OpenRouter re-enablement is a separate budget decision.
- **Experiment ladder automation promotion**: 0 candidates; wait for IMPR-01 evidence before promoting automation candidates.

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| COV-01 | Phase 159 | reports/seo/latest-gsc-removal-tracker.md, reports/seo/latest-gsc-removal-verification.json, reports/seo/latest-coverage-delta.json, reports/seo/latest-gsc-removal-batch-v2.md | [ ] |
| IMPR-01 | Phase 160 | reports/gsc/latest-ctr-report.json, reports/seo/latest-authority-uplift-scorecard.json, reports/seo/latest-structured-data-validation.md, reports/seo/latest-gsc-opportunity-board.json | [ ] |
| PIPE-01 | Phase 161 | .github/workflows/seo-monitoring.yml, reports/seo/latest-search-compliance-matrix.json | [x] |

## 4. Carry-Forward from v5.0

| Carry Item | v5.1 Mapping |
|---|---|
| REMOV-01 manual GSC removal submission (0/975 URLs, GitHub issue #19) | COV-01 submission + verification |
| Second-pass batch (191 URLs ready) | COV-01 second-pass submission |
| Zero impressions on 34 promote surfaces | IMPR-01 traffic activation |
| Structured data production validation pending | IMPR-01 production run |
| GSC API credential rotation silently skips sweep step | PIPE-01 credential alerting ✅ |
| Structured data validation not in CI | PIPE-01 CI wiring ✅ |
| Blocklisted URLs still in GSC index (issue #20) | IMPR-01 takedown resolution |
