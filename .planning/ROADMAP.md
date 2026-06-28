# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v5.2 Coverage Proof & Compliance Consolidation is active. Phases 162-164 will complete the REMOV-01 submission cycle when operator access becomes available, verify first measurable organic impressions from GSC data, and consolidate the compliance matrix to reflect the pipeline improvements from v5.1.

## Immediate Next Actions

- [x] Plan Phase 164: Compliance Consolidation ✅
- [ ] Plan Phase 163: Traffic Verification (needs next GSC data cycle)
- [ ] Plan Phase 162: REMOV-01 Completion (blocked on operator, issue #19)

## Current Milestone: v5.2 Coverage Proof & Compliance Consolidation

**Goal:** Close the REMOV-01 submission cycle, verify first organic impressions/clicks, and regenerate the compliance matrix to reflect v5.1 pipeline improvements.

**Requirements:**

- [ ] COVP-01: **Coverage Proof**: Complete REMOV-01 submission and second-pass batch to reduce coverage affected pages below 5,000.
- [ ] TRAFF-01: **Traffic Verification**: Verify first measurable organic impressions and clicks on ≥2 P0 authority surfaces. Diagnose if impressions have not materialized.
- [x] COMP-01: **Compliance Consolidation**: Regenerate compliance matrix with fresh artifacts. Target: overall verdict reaches `pass` when `structured-data-validity` and `ctr-search-appearance` lanes clear.

### Phase 162: REMOV-01 Completion & Second-Pass Submission

- **Requirements:** COVP-01
- **Scope:** Operator submits 975-URL REMOV-01 batch (GitHub issue #19), run post-submission verification + delta, submit 191-URL second-pass batch, measure coverage reduction.
- **Status:** Blocked (operator action required)
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - REMOV-01 submission completed (975/975 URLs submitted in GSC UI)
  - Post-submission verification executed (run verify + delta commands)
  - Second-pass batch submitted (191 URLs)
  - Coverage affected pages reduced from 10,783 toward <5,000

### Phase 163: Traffic Verification & Diagnosis

- **Requirements:** TRAFF-01
- **Scope:** Check GSC data for first organic impressions/clicks on P0 surfaces. If no impressions yet, diagnose whether the gap is structural (no search demand) or operational (indexing/canonicalization blocking discovery). Run crawl-health audit + IndexNow resubmission if needed.
- **Status:** Planned (needs next GSC data cycle)
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - ≥2 P0 surfaces show ≥3 impressions + ≥1 click in GSC
  - If impressions are zero, root-cause diagnosis is documented

### Phase 164: Compliance Consolidation

- **Requirements:** COMP-01 ✅
- **Scope:** Regenerate compliance matrix with fresh artifacts; verify lane upgrades; wire into CI.
- **Status:** ✅ Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - [x] Compliance matrix regenerated with all fresh artifacts
  - [x] `structured-data-validity` lane shows `pass` (validation report: 8/8 pass)
  - [x] `coverage-freshness-before-claims` lane shows `pass` (sweep data fresh)
  - [x] Compliance matrix auto-generates in nightly CI
  - [x] All remaining `watch` lanes diagnosed with clear path to `pass`

## Milestones

- 🟩 **v5.2 Coverage Proof & Compliance Consolidation** — phases 162-164 (active)
- ✅ **v5.1 First Impression & Coverage Closure** — phases 159-161 (2/3 automation-delivered 2026-06-28; [archive](./milestones/v5.1-ROADMAP.md), [requirements](./milestones/v5.1-REQUIREMENTS.md), [audit](./milestones/v5.1-MILESTONE-AUDIT.md))
- ✅ **v5.0 Traffic Activation & Index Health Closure** — phases 156-158 (shipped 2026-06-27)
- ✅ **v4.9 Authority Surface Uplift & Coverage Freshness** — phases 153-155 (shipped 2026-06-26)
- ✅ **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (shipped 2026-06-26)
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24)

## Carry-Forward Themes

- **REMOV-01 is the single biggest coverage lever:** 9,177 of 10,783 coverage anomalies are addressed by the first-pass batch. Without submission, the gap persists indefinitely.
- **Traffic verification needs time:** Authority surfaces are structurally ready. Whether Google sends impressions depends on indexing state, query match, and search demand — none of which are fully controllable from code.
- **Compliance matrix reflects pipeline quality:** The v5.1 pipeline improvements (structured-data-validate in CI, credential alerts, blocklisted-URL detection, lane upgrades) are in the code but not yet reflected in stored compliance reports. Regeneration will surface these improvements.
- **Promotion proof before expansion:** Discovery expansion stays open until TRAFF-01 confirms measurable impressions.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v5.2 Coverage Proof & Compliance Consolidation | 162-164 | 1/3 | Active | — |
| v5.1 First Impression & Coverage Closure | 159-161 | 2/3 | Complete (automation) | 2026-06-28 |
| v5.0 Traffic Activation & Index Health Closure | 156-158 | 3/3 | Complete | 2026-06-27 |
| v4.9 Authority Surface Uplift & Coverage Freshness | 153-155 | 3/3 | Complete | 2026-06-26 |
| v4.8 Crawl Remediation & Discovery Expansion | 151-152 | 2/2 | Complete | 2026-06-26 |
| v4.7 Core Web Vitals & Edge Performance Optimization | 148-150 | 3/3 | Complete | 2026-06-24 |

---
*Last updated: 2026-06-28 after archiving v5.1 and initializing v5.2*
