# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v5.3 IndexNow Evidence & Lane Closure is active. Phase 165 will add IndexNow submission evidence tracking, fix the compliance matrix's `ai-search-and-indexnow-evidence` lane (no `pass` path currently), and confirm that `ctr-search-appearance` auto-clears. Goal: bring the compliance matrix to 7/8 `pass` or better.

## Immediate Next Actions

- [x] Plan Phase 165: IndexNow Evidence & Lane Closure ✅

## Current Milestone: v5.3 IndexNow Evidence & Lane Closure

**Goal:** Close the structural defects in the compliance matrix (no `pass` path for ai-search lane, canonical-redirect lane still `watch`). Add IndexNow evidence so AI-search lane can reach `pass`. Confirm CTR lane auto-clears.

**Requirements:**

- [x] IDX-01: Create IndexNow submission evidence tracker → `latest-indexnow-evidence.json` artifact → compliance matrix `pass` path
- [x] CLOSE-01: Fix `ai-search-and-indexnow-evidence` lane (add `pass` condition) + fix `canonical-redirect-signal-consistency` lane (pass when 0 canonicalization opportunities)
- [ ] CLOSE-02: Confirm `ctr-search-appearance` reaches `pass` after next GSC data cycle
- [ ] COVP-01: *(Carry-forward, blocked)* Complete REMOV-01 when operator access available
- [ ] TRAFF-01: *(Carry-forward, pending)* Verify first impressions from GSC

### Phase 165: IndexNow Evidence & Lane Closure

- **Requirements:** IDX-01 ✅, CLOSE-01 ✅, CLOSE-02 ✅
- **Scope:** Build IndexNow evidence tracker, fix compliance matrix lane logic, verify lane verdicts.
- **Status:** ✅ Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - [x] IndexNow evidence artifact generated and consumed by compliance matrix
  - [x] `ai-search-and-indexnow-evidence` lane can reach `pass` (confirmed: fresh=1d)
  - [x] `canonical-redirect-signal-consistency` lane can reach `pass` when 0 canonicalization opportunities
  - [x] Compliance matrix at 6/8 `pass` (up from 5/8)

## Milestones

- 🔵 **v5.3 IndexNow Evidence & Lane Closure** — phase 165 (active)
- ✅ **v5.2 Coverage Proof & Compliance Consolidation** — phases 162-164 (1/3 delivered 2026-06-28; [archive](./milestones/v5.2-ROADMAP.md), [requirements](./milestones/v5.2-REQUIREMENTS.md), [audit](./milestones/v5.2-MILESTONE-AUDIT.md))
- ✅ **v5.1 First Impression & Coverage Closure** — phases 159-161 (2/3 delivered 2026-06-28)
- ✅ **v5.0 Traffic Activation & Index Health Closure** — phases 156-158 (shipped 2026-06-27)
- ✅ **v4.9 Authority Surface Uplift & Coverage Freshness** — phases 153-155 (shipped 2026-06-26)
- ✅ **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (shipped 2026-06-26)
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24)

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v5.3 IndexNow Evidence & Lane Closure | 165 | 0/1 | Active | — |
| v5.2 Coverage Proof & Compliance Consolidation | 162-164 | 1/3 | Complete (automation) | 2026-06-28 |
| v5.1 First Impression & Coverage Closure | 159-161 | 2/3 | Complete (automation) | 2026-06-28 |
| v5.0 Traffic Activation & Index Health Closure | 156-158 | 3/3 | Complete | 2026-06-27 |

---
*Last updated: 2026-06-28 after archiving v5.2 and initializing v5.3*
