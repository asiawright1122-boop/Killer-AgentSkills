# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v5.4 Verification & De-index Confirmation is active. The canonical drift audit (2026-06-30) shows dramatic improvement: 179 → 21 GSC rows (−88%), canonicalization URLs from 56 → 3 (−95%). The remaining 2 `watch` lanes are driven by stale opportunity board data; we expect auto-clearing within 1–2 GSC data cycles after IndexNow de-index submissions take effect.

## Immediate Next Actions

- [x] Run canonical drift audit with latest GSC data → **179 → 21 rows, −88% improvement**
- [x] Submit atondwal/config URLs to IndexNow for de-indexing → **200 OK from Bing + IndexNow**
- [x] Sync KV data keys for bundle optimization → **skill-collection-lookup + related-skills-lookup synced**
- [ ] Wait for next GSC data cycle (2–3 days) for opportunity board refresh
- [ ] Re-run compliance matrix to verify watch lanes auto-clear
- [ ] If both watch lanes clear → overall verdict `pass` 🎉

## Current Milestone: v5.4 Verification & De-index Confirmation

**Goal:** Wait for GSC data cycles to confirm that the atondwal/config 410 Gone takes effect and canonicalization opportunities decrease. Target: compliance matrix overall verdict reaches `pass`.

**Requirements:**

- [ ] VER-01: Confirm ctr-search-appearance reaches `pass` (0 P0/P1 opportunities)
- [ ] VER-02: Confirm canonical-redirect-signal-consistency canonicalization count decreases
- [ ] COVP-01: *(Carry-forward, blocked)* Complete REMOV-01 (issue #19)
- [ ] TRAFF-01: *(Carry-forward, pending)* Verify first impressions

### Phase 166: Verification Cycle

- **Requirements:** VER-01, VER-02
- **Scope:** Run compliance matrix after next GSC data cycle; verify lane auto-clearing
- **Status:** In progress (canonical drift improved −88%, IndexNow de-index submitted, awaiting GSC cycle)
- **Success Criteria:**
  - [ ] `ctr-search-appearance` verdict reaches `pass`
  - [x] `canonical-redirect-signal-consistency` canonicalization opportunity count decreases (179 → 21 rows, −88%)
  - [ ] Overall compliance verdict reaches `pass` (when both lanes clear)
- **Progress (2026-06-30):**
  - Canonical drift audit: 179 → 21 GSC pages (−88%), canonicalize 56 → 3 (−95%), impressions 266 → 72 (−73%)
  - atondwal/config P0: submitted 11 locale variants to IndexNow (Bing 200, IndexNow 200)
  - KV sync: skill-collection-lookup + related-skills-lookup populated in production

## Milestones

- 🔵 **v5.4 Verification & De-index Confirmation** — phase 166 (active, waiting for data)
- ✅ **v5.3 IndexNow Evidence & Lane Closure** — phase 165 (delivered 2026-06-28; 3/3 requirements; [archive](./milestones/v5.3-ROADMAP.md), [audit](./milestones/v5.3-MILESTONE-AUDIT.md))
- ✅ **v5.2 Coverage Proof & Compliance Consolidation** — phases 162-164 (1/3 delivered 2026-06-28)
- ✅ **v5.1 First Impression & Coverage Closure** — phases 159-161 (2/3 delivered 2026-06-28)
- ✅ **v5.0 Traffic Activation & Index Health Closure** — phases 156-158 (shipped 2026-06-27)
- ✅ **v4.9 Authority Surface Uplift & Coverage Freshness** — phases 153-155 (shipped 2026-06-26)
- ✅ **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (shipped 2026-06-26)
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24)

## Compliance Matrix Evolution

| Milestone | pass | watch | block | unavailable |
|---|---|---|---|---|
| v5.0 start | 0 | 4 | 3 | 1 |
| v5.1 end | 5 | 3 | 0 | 0 |
| v5.2 end | 5 | 3 | 0 | 0 |
| v5.3 end | 6 | 2 | 0 | 0 |
| v5.4 mid (2026-06-30) | 6 | 2 | 0 | 0 |
| **v5.4 target** | **8** | **0** | 0 | 0 |

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v5.4 Verification & De-index Confirmation | 166 | 0/1 | Active (drift verified, awaiting GSC cycle) | — |
| v5.3 IndexNow Evidence & Lane Closure | 165 | 1/1 | Complete | 2026-06-28 |
| v5.2 Coverage Proof & Compliance Consolidation | 162-164 | 1/3 | Complete (automation) | 2026-06-28 |
| v5.1 First Impression & Coverage Closure | 159-161 | 2/3 | Complete (automation) | 2026-06-28 |
| v5.0 Traffic Activation & Index Health Closure | 156-158 | 3/3 | Complete | 2026-06-27 |

---
*Last updated: 2026-06-30 after canonical drift audit and IndexNow de-index submission*
