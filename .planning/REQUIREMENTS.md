# Milestone v5.4 Requirements — Verification & De-index Confirmation

## 1. Active Requirements

### Verification (VER)
- [ ] **VER-01**: Confirm `ctr-search-appearance` lane reaches `pass` after atondwal/config drops from GSC data. Re-run compliance matrix after next CI cycle. Target: 0 P0/P1 opportunities with live GSC data.
- [ ] **VER-02**: Confirm `canonical-redirect-signal-consistency` lane canonicalization count decreases as GSC de-indexes 410 Gone URLs. Track canonicalization opportunity count across CI cycles.

### Carry-Forward (unchanged since v5.1)
- [ ] **COVP-01**: Complete REMOV-01 submission when operator access available (GitHub issue #19).
- [ ] **TRAFF-01**: Verify first measurable impressions/clicks on ≥2 P0 surfaces from GSC data.

## 2. Out of Scope

- Any code changes to compliance matrix lanes (all lane logic is correct)
- REMOV-01 manual submission (operator action)
- New feature development until traffic verification confirms demand

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| VER-01 | Phase 166 | reports/seo/latest-search-compliance-matrix.json | [ ] |
| VER-02 | Phase 166 | reports/seo/latest-search-compliance-matrix.json | [ ] |
| COVP-01 | Phase 162 | reports/seo/latest-gsc-removal-tracker.md | [ ] |
| TRAFF-01 | Phase 163 | reports/gsc/latest-ctr-report.json | [ ] |
