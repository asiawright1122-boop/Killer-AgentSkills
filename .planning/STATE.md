---
gsd_state_version: 1.0
milestone: v5.1
milestone_name: First Impression & Coverage Closure
status: planned
last_updated: "2026-06-27T08:10:00.000Z"
last_activity: 2026-06-27
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
---

# Current Position

Phase: 159 (planned — REMOV-01 Completion & Second-Pass Submission)
Plan: 0/3 plans
Status: Milestone v5.1 initialized. Three phases planned: (1) complete REMOV-01 submission cycle and measure coverage reduction, (2) earn first measurable impressions on P0 surfaces and execute editorial queue, (3) harden SEO CI pipeline with structured data validation, credential alerting, and blocklisted-URL detection.
Last activity: 2026-06-27

## v5.1 Context: First Impression & Coverage Closure

v5.0 delivered the automation foundation: coverage freshness pipeline (closing REC-24), P0 title/description optimization, IndexNow P0 extension, relatedCollections cross-linking, and structured data validation tooling. However, two fundamental gaps remain:

1. **No measurable organic traffic**: All 34 promote-ready surfaces show 0 impressions / 0 clicks. Title/description optimizations are deployed but search demand has not been activated.
2. **Coverage anomalies persist**: 10,783 affected pages remain (REMOV-01 unsubmitted). The single biggest lever (975-URL removal addressing ~9,177 anomalies) has not been pulled.

v5.1 shifts from "automation readiness" to "organic proof" — earning the first measurable impressions and closing the coverage gap.

## Active Requirements

- **COV-01**: Complete REMOV-01 submission cycle + second-pass batch → coverage affected pages < 5,000
- **IMPR-01**: Earn first measurable impressions/clicks on ≥2 P0 surfaces, resolve issue #20, execute editorial queue
- **PIPE-01**: Wire structured-data-validate into CI, add credential rotation alerting, blocklisted-URL-in-GSC detection

## Phase Plan

### Phase 159: REMOV-01 Completion & Second-Pass Submission
- **Status:** Planned
- **Scope:** Operator submits REMOV-01 batch, run verification + delta, submit second-pass batch
- **Depends on:** Operator action (GitHub issue #19)

### Phase 160: First Impression Earners
- **Status:** Planned
- **Scope:** Resolve issue #20, run structured-data-validate against production, execute 5 editorial queue items
- **Depends on:** CI pipeline operational

### Phase 161: Pipeline & Compliance Hardening
- **Status:** Planned
- **Scope:** Wire structured-data-validate into CI, add credential rotation alerts, blocklisted-URL detection, trailing-slash canonicalization
- **Depends on:** Structured data validation script (built in v5.0)

## Carry-Forward from v5.0

- REMOV-01: 975-URL GSC removal batch (0/975 submitted, GitHub issue #19) → COV-01
- Second-pass batch: 191 URLs ready → COV-01
- Zero impressions on 34 promote surfaces → IMPR-01
- Structured data validation pending production run → IMPR-01
- GSC API credential rotation silently skips sweep → PIPE-01
- Structured-data-validate not in CI → PIPE-01
- Issue #20: scraped content takedown → IMPR-01
