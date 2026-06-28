# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v5.4 Verification & De-index Confirmation is active. This is a lightweight verification milestone — no new code changes needed. The compliance matrix logic is correct; we just need to wait for GSC data cycles to confirm that the two remaining `watch` lanes auto-clear.

## Immediate Next Actions

- [ ] Wait for next GSC data cycle (typically 2-3 days)
- [ ] Run compliance matrix after CI cycle to verify lane verdicts
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
- **Status:** Waiting (next GSC data cycle)
- **Success Criteria:**
  - [ ] `ctr-search-appearance` verdict reaches `pass`
  - [ ] `canonical-redirect-signal-consistency` canonicalization opportunity count decreases
  - [ ] Overall compliance verdict reaches `pass` (when both lanes clear)

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
| **v5.4 target** | **8** | **0** | 0 | 0 |

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v5.4 Verification & De-index Confirmation | 166 | 0/1 | Active (waiting) | — |
| v5.3 IndexNow Evidence & Lane Closure | 165 | 1/1 | Complete | 2026-06-28 |
| v5.2 Coverage Proof & Compliance Consolidation | 162-164 | 1/3 | Complete (automation) | 2026-06-28 |
| v5.1 First Impression & Coverage Closure | 159-161 | 2/3 | Complete (automation) | 2026-06-28 |
| v5.0 Traffic Activation & Index Health Closure | 156-158 | 3/3 | Complete | 2026-06-27 |

---
*Last updated: 2026-06-28 after archiving v5.3 and initializing v5.4*
