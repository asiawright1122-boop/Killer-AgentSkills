# Roadmap: Killer-Skills Agent Directory

## Overview

`v1.7 Public Trust Surface and Copy Boundary Hardening` shipped on `2026-04-23` and is now archived.

`v1.8 Fresh Recovery Inputs and Comparable Proof Refresh` is now active.

This milestone returns the project to the recovery-proof lane. The goal is to replace stale local inputs with dated fresh evidence, produce another trustworthy comparable proof window, and use that refreshed proof to reassess authority-surface promotion and manual intervention readiness without reopening expansion prematurely.

## Immediate Next Actions

- Phase `63` is complete; prepare the v1.8 closeout/audit from the refreshed proof, authority, and experiment evidence.
- Keep discovery expansion closed because Phase `62` found `0 promote / 31 hold / 1 stop`.
- Keep automation locked until a fresh Coverage Drilldown export and a trustworthy proof window make at least one manual intervention repeatable.

## Current Milestone: v1.8 Fresh Recovery Inputs and Comparable Proof Refresh

**Goal:** Refresh stale recovery inputs, generate another trustworthy comparable proof window, and reassess promotion and intervention readiness from current evidence.

**Target features:**

- Restore dated Coverage Drilldown freshness so cluster-level recovery truth is no longer blocked by stale local exports.
- Capture a second trustworthy proof window that can be compared honestly against the seeded baseline.
- Reassess authority-surface promotion posture and manual intervention repeatability from the refreshed proof set.

## Active Milestone

### v1.8 Fresh Recovery Inputs and Comparable Proof Refresh

**Goal:** Refresh stale recovery inputs, generate another trustworthy comparable proof window, and reassess promotion and intervention readiness from current evidence.
**Requirements:** `REC-24`, `REC-25`, `UX-EXP-03`, `GEO-03`
**Phase range:** 61-63

### Phase 61: coverage-drilldown-input-refresh-and-freshness-contract

**Goal:** Restore fresh Coverage Drilldown inputs and preserve dated freshness evidence before any new recovery claim is made.
**Depends on:** Shipped `v1.7`, current recovery reports, and the stale local Coverage Drilldown export dated `2026-04-03`.
**Requirements:** `REC-24`
**Success Criteria** (what must be TRUE):
1. Operators can ingest fresh Coverage Drilldown raw inputs and prove the dated freshness state from repository-local artifacts.
2. Recovery reports stop relying on the stale `2026-04-03` local export as the current proof input.
3. The repo exposes one durable freshness contract that downstream proof and promotion work can trust.
**Plans:** 1/1 complete

Plans:
- [x] `61-01`: Harden the freshness contract around Coverage Drilldown raw input selection, ingest evidence, and operator-facing freshness reporting.

**Delivered details:**

- Confirmed the repo-local raw Coverage archive now includes `2026-04-16` and that the ingest lane selects it as the latest archived source instead of inheriting `2026-04-03` as the freshest input.
- Regenerated the ingest and coverage reports so operators now have dated machine-readable and Markdown evidence for raw-source selection, freshness status, and blocker posture.
- Verified the freshest Coverage source is now `warning` rather than `blocking`: inside the hard 7-day SLA, but still outside the preferred 3-day window that Phase `62` should improve upon.

### Phase 62: comparable-proof-window-refresh-and-delta-revalidation

**Goal:** Generate another trustworthy post-governance proof window and compare it honestly against the seeded baseline.
**Depends on:** Phase 61
**Requirements:** `REC-25`
**Success Criteria** (what must be TRUE):
1. Operators can produce a second comparable proof window from refreshed inputs without relying on stale local evidence.
2. The refreshed proof window makes trust status, blockers, and comparability against the seeded baseline explicit.
3. Recovery delta outputs are revalidated against the refreshed proof substrate instead of older baseline-only assumptions.
**Plans:** 1/1 complete

Plans:
- [x] `62-01`: Refresh the comparable proof window and delta board from current demand, crawl, coverage, and authority evidence.

**Delivered details:**

- Regenerated the `2026-05-06` recovery proof window against the `2026-05-04` baseline without reseeding the baseline.
- Confirmed the production sitemap crawl lane is clear: `6` sitemap files, `1546` discovered page URLs, `721` sampled URLs checked, and `0` sitemap fetch errors.
- Confirmed GSC demand evidence is available from `live-api` for `2026-04-08` to `2026-05-05`, but demand remains too thin for expansion: `26` query rows, `507` page rows, and `0` priority opportunities.
- Revalidated the delta board and authority scorecard with a conservative verdict: proof trust `blocking`, `0` deepen, `8` hold, `9` avoid, and authority expansion closed at `0 promote / 31 hold / 1 stop`.
- Identified the next hard blocker as stale Coverage Drilldown evidence (`2026-04-16`, age `18` day(s) in the refreshed proof window), not live sitemap availability.

### Phase 63: authority-and-intervention-readiness-reassessment

**Goal:** Reassess authority-surface promotion and manual intervention repeatability from the refreshed proof set while keeping expansion and automation gated.
**Depends on:** Phase 62
**Requirements:** `UX-EXP-03`, `GEO-03`
**Success Criteria** (what must be TRUE):
1. The authority uplift posture is re-evaluated from refreshed proof inputs before any discovery expansion is reconsidered.
2. Manual recovery interventions are re-scored for repeatability from the refreshed evidence before limited rollout or automation is reconsidered.
3. The repo makes it explicit whether promotion and automation remain closed or whether any narrow candidate has genuinely earned review.
**Plans:** 1/1 complete

Plans:
- [x] `63-01`: Reassess authority-surface promotion and intervention repeatability from the refreshed Phase `62` proof set.

**Delivered details:**

- Reconfirmed authority promotion remains closed: `0 promote / 31 hold / 1 stop`.
- Reconfirmed discovery expansion remains `closed` because proof trust is `blocking`, Coverage freshness is outside SLA, and no primary surface qualifies for promotion.
- Reconfirmed recovery execution remains manual: `6` ready interventions, `4` blocked prerequisites, and `1` watch item.
- Reconfirmed automation remains locked: `19` experiments, `11` manual-active, `3` review, `0` limited-rollout, `0` automation-candidate, `1` retired.
- Identified the next operating posture: refresh Coverage Drilldown raw exports, execute P0 manual recovery batches, then collect another trustworthy proof window before any expansion or automation decision.

## Milestones

- 🚧 **v1.8 Fresh Recovery Inputs and Comparable Proof Refresh** — phases 61-63 (active)
- ✅ **v1.7 Public Trust Surface and Copy Boundary Hardening** — shipped 2026-04-23 ([archive](./milestones/v1.7-ROADMAP.md), [requirements](./milestones/v1.7-REQUIREMENTS.md), [audit](./milestones/v1.7-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.7-BOOTSTRAP.md), [closeout](./milestones/v1.7-CLOSEOUT.md), [traceability](./milestones/v1.7-TRACEABILITY.md))
- ✅ **v1.6 Post-Governance Recovery Proof and Authority Lift** — shipped 2026-04-16 ([archive](./milestones/v1.6-ROADMAP.md), [requirements](./milestones/v1.6-REQUIREMENTS.md), [audit](./milestones/v1.6-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.6-BOOTSTRAP.md), [closeout](./milestones/v1.6-CLOSEOUT.md), [traceability](./milestones/v1.6-TRACEABILITY.md))
- ✅ **v1.5 Traffic Recovery Proof and Demand Restart** — shipped 2026-04-16 ([archive](./milestones/v1.5-ROADMAP.md), [requirements](./milestones/v1.5-REQUIREMENTS.md), [audit](./milestones/v1.5-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.5-BOOTSTRAP.md), [closeout](./milestones/v1.5-CLOSEOUT.md), [traceability](./milestones/v1.5-TRACEABILITY.md))
- ✅ **v1.4 Traffic Recovery Closure** — shipped and archived ([archive](./milestones/v1.4-ROADMAP.md), [requirements](./milestones/v1.4-REQUIREMENTS.md), [audit](./milestones/v1.4-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.4-BOOTSTRAP.md), [closeout](./milestones/v1.4-CLOSEOUT.md))
- ✅ **v1.3 Adaptive Provider Control and Escalation Automation** — shipped and archived ([archive](./milestones/v1.3-ROADMAP.md), [requirements](./milestones/v1.3-REQUIREMENTS.md), [audit](./milestones/v1.3-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.3-BOOTSTRAP.md), [closeout](./milestones/v1.3-CLOSEOUT.md))
- ✅ **v1.2 Operator Automation and Runtime Convergence** — shipped and archived ([archive](./milestones/v1.2-ROADMAP.md), [requirements](./milestones/v1.2-REQUIREMENTS.md), [audit](./milestones/v1.2-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.2-BOOTSTRAP.md), [closeout](./milestones/v1.2-CLOSEOUT.md))
- ✅ **v1.1 Observability and Governance Hardening** — shipped and archived ([archive](./milestones/v1.1-ROADMAP.md), [requirements](./milestones/v1.1-REQUIREMENTS.md), [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- ✅ **v1.0 Reliability and Growth Operations** — shipped and archived ([archive](./milestones/v1.0-ROADMAP.md), [requirements](./milestones/v1.0-REQUIREMENTS.md))

## Carry-Forward Themes

- **Proof inputs before expansion:** refresh stale recovery inputs and gather another trustworthy comparable window before reopening growth work.
- **Authority depth before breadth:** deepen only the surfaces that show measurable movement.
- **Automation after repeatability:** formalize experimentation only after the manual loops prove trustworthy.
- **Public trust guardrails stay in force:** public entry surfaces should continue to read like product guidance, not internal planning notes.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 61. coverage-drilldown-input-refresh-and-freshness-contract | v1.8 | 1/1 | Complete | 2026-04-23 |
| 62. comparable-proof-window-refresh-and-delta-revalidation | v1.8 | 1/1 | Complete | 2026-05-06 |
| 63. authority-and-intervention-readiness-reassessment | v1.8 | 1/1 | Complete | 2026-05-06 |
