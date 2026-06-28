# Milestone v5.3 Requirements — IndexNow Evidence & Lane Closure

## 1. Active Requirements

### IndexNow Evidence (IDX)
- [x] **IDX-01**: Create an IndexNow submission evidence tracker that records when URLs are submitted, how many were submitted, and the API response status. Generate a `reports/seo/latest-indexnow-evidence.json` artifact. Wire into the compliance matrix so the `ai-search-and-indexnow-evidence` lane can reach `pass` when IndexNow submissions are confirmed and recent (≤7 days old).

### Lane Closure (CLOSE)
- [x] **CLOSE-01**: Fix the `ai-search-and-indexnow-evidence` compliance matrix lane to add a `pass` verdict path. Current logic has no `pass` condition (only `watch` and `unavailable`). Add: when IndexNow evidence exists AND submission is recent AND promotion is open → `pass`. Apply same fix to `canonical-redirect-signal-consistency` lane: when zero canonicalization-lane opportunities exist in GSC data → `pass` instead of `watch`.
- [x] **CLOSE-02**: Confirm `ctr-search-appearance` lane reaches `pass` after next GSC data cycle removes the atondwal/config P0 item. Run compliance matrix after the next CI cycle to verify.

### Carry-Forward (unchanged)
- [ ] **COVP-01**: Complete REMOV-01 submission when operator access available (from v5.1/v5.2, blocked on issue #19).
- [ ] **TRAFF-01**: Verify first measurable impressions (from v5.2, needs next GSC cycle).

## 2. Out of Scope

- **REMOV-01 manual submission**: operator action (issue #19)
- **Bulk skill-detail re-expansion**: stays off until TRAFF-01 confirms impressions
- **Bing AI Performance evidence**: no public API; defer until access exists

## 3. Traceability Matrix

| Req ID | Mapped Phase | Verification File | Status |
|---|---|---|---|
| IDX-01 | Phase 165 | reports/seo/latest-indexnow-evidence.json | [x] |
| CLOSE-01 | Phase 165 | reports/seo/latest-search-compliance-matrix.json | [x] |
| CLOSE-02 | Phase 165 | reports/seo/latest-search-compliance-matrix.json | [x] |
| COVP-01 | Phase 162 | reports/seo/latest-gsc-removal-tracker.md | [ ] |
| TRAFF-01 | Phase 163 | reports/gsc/latest-ctr-report.json | [ ] |

## 4. Carry-Forward from v5.2

| Carry Item | v5.3 Mapping |
|---|---|
| REMOV-01 manual submission (0/975 URLs, issue #19) | COVP-01 (unchanged) |
| GSC impressions/clicks verification | TRAFF-01 (unchanged) |
| ai-search-and-indexnow-evidence lane has no `pass` path | CLOSE-01 |
| ctr-search-appearance pending atondwal/config GSC clearance | CLOSE-02 |
