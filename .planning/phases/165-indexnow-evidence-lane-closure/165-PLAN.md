# Phase 165: IndexNow Evidence & Lane Closure (IDX-01, CLOSE-01, CLOSE-02)

**Status:** Complete
**Milestone:** v5.3 IndexNow Evidence & Lane Closure
**Requirements:** IDX-01, CLOSE-01, CLOSE-02

## Goal

Add IndexNow submission evidence tracking, fix the structural defect in `ai-search-and-indexnow-evidence` lane (no `pass` path), and add `pass` path to `canonical-redirect-signal-consistency` lane.

## Deliverables

### D1: IndexNow Evidence Tracker (IDX-01)

- Created `scripts/seo-indexnow-evidence.ts` — generates `reports/seo/latest-indexnow-evidence.{json,md}`
- Evidence type: `IndexNowEvidenceJson` with `keyFilePresent`, `fresh` (≤7d), `freshnessDays`, `lastSubmission`
- Reads proof window and authority scorecard for last CI timestamp
- Added `report:seo:indexnow-evidence` npm script
- Added "Build IndexNow Evidence" step to `seo-monitoring.yml`

### D2: Fix ai-search-and-indexnow-evidence Lane (CLOSE-01)

- Added `indexNowEvidence` input to `SearchComplianceInputs` and `SearchComplianceFileOptions`
- Added `IndexNowEvidenceJson` type
- New verdict logic:
  - `indexNowFresh` (keyFilePresent + fresh) → `pass`
  - `promotionOpen || automationOpen` → `watch`
  - else → `unavailable`
- Added IndexNow evidence as 3rd project evidence entry
- Updated rationale and nextAction for all 3 verdict states
- **Result: lane now reaches `pass`** — confirmed in regenerated matrix (fresh=1d, keyFile=present)

### D3: Fix canonical-redirect-signal-consistency Lane (CLOSE-01)

- Added `canonicalizationOpportunityCount` computation from opportunity board
- Added opportunity board as 3rd project evidence entry
- New verdict logic:
  - `coverageFreshness === 'blocking'` → `block`
  - `canonicalizationOpportunityCount === 0` → `pass`
  - else → `watch`
- Currently: 9 canonicalization opportunities exist → `watch`
- Will reach `pass` after REMOV-01 clears these from GSC

### D4: Compliance Matrix Verification (CLOSE-02)

- Regenerated compliance matrix with IndexNow evidence and updated lane logic
- Result: **6 pass, 2 watch, 0 block, 0 unavailable**
- `ai-search-and-indexnow-evidence` → **pass** ✅ (first time ever!)
- `ctr-search-appearance` → watch (1 P0 item: atondwal/config, will auto-clear next cycle)
- `canonical-redirect-signal-consistency` → watch (9 canonicalization opportunities, needs REMOV-01)

## Tests Added

5 new tests in `scripts/lib/search-compliance-matrix.test.ts`:
1. passes ai-search-and-indexnow-evidence when IndexNow evidence is fresh
2. watches ai-search-and-indexnow-evidence when IndexNow evidence is stale
3. marks ai-search-and-indexnow-evidence unavailable when no promotion and no evidence and automation locked
4. passes canonical-redirect-signal-consistency when zero canonicalization opportunities
5. watches canonical-redirect-signal-consistency when canonicalization opportunities exist

## Compliance Matrix Evolution

| Milestone | pass | watch | block | unavailable |
|---|---|---|---|---|
| v5.0 start | 0 | 4 | 3 | 1 |
| v5.1 end | 5 | 3 | 0 | 0 |
| v5.2 end | 5 | 3 | 0 | 0 |
| **v5.3 (Phase 165)** | **6** | **2** | 0 | 0 |

## Files Modified/Created

| File | Action | Scope |
|------|--------|-------|
| `scripts/seo-indexnow-evidence.ts` | Create | IndexNow evidence tracker script |
| `scripts/lib/search-compliance-matrix.ts` | Modify | Added IndexNowEvidenceJson type + 2 lane fixes |
| `scripts/lib/search-compliance-matrix.test.ts` | Modify | 5 new tests |
| `package.json` | Modify | Added `report:seo:indexnow-evidence` script |
| `.github/workflows/seo-monitoring.yml` | Modify | Added IndexNow evidence step |
