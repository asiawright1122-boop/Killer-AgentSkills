# Roadmap: Killer-Skills Agent Directory

## Overview

`v1.8 Fresh Recovery Inputs and Comparable Proof Refresh` shipped on `2026-05-06` and is now archived.

`v1.9 Search Compliance Recovery Execution and Proof` is now active.

This milestone turns the concrete blocker stack surfaced by `v1.8` into search-engine-compliant recovery execution: fresh Coverage Drilldown export ingestion, P0 manual recovery batch execution, priority authority-surface CTR/GEO review, and a new trustworthy proof window after interventions have enough time to appear in search evidence.

## Immediate Next Actions

- Phase `64` should start by turning official Google, Bing, IndexNow, and Yandex guidance into a project-specific compliance checklist and importing a fresh Coverage Drilldown export.
- Phase `65` should execute the P0 URL recovery queue and verify canonical/redirect behavior against fresh evidence.
- Keep discovery expansion closed and automation locked until Phase `67` produces a trustworthy proof window.

## Current Milestone: v1.9 Search Compliance Recovery Execution and Proof

**Goal:** Execute the known recovery blockers against official search-engine guidance, improve priority click surfaces only where evidence supports it, and produce a post-intervention proof window without overstating recovery.

**Requirements:** `SEO-15`, `REC-26`, `REC-27`, `REC-28`, `CTR-02`, `GEO-04`, `REC-29`
**Phase range:** 64-67

### Phase 64: search-guidelines-compliance-baseline-and-fresh-coverage

**Goal:** Establish the official search-guideline compliance baseline and refresh Coverage Drilldown evidence before executing recovery claims.
**Depends on:** Archived `v1.8`, current recovery reports, and official search-engine guidance research.
**Requirements:** `SEO-15`, `REC-26`
**Success Criteria** (what must be TRUE):
1. Operators can inspect a repo-local compliance matrix that maps Google, Bing, IndexNow, and Yandex guidance to the project's crawl, index, canonical, content, CTR, and AI-search lanes.
2. A fresh Coverage Drilldown raw export inside the hard SLA is imported or the absence of such an export is explicitly recorded as a blocker.
3. Recovery reports are regenerated from the selected Coverage source and expose freshness status before any intervention claim is made.
**Plans:** 0/1 complete

Plans:
- [ ] `64-01`: Build the search compliance matrix, import fresh Coverage evidence, and regenerate freshness-aware recovery reports.

### Phase 65: p0-url-recovery-batches-and-canonical-proof

**Goal:** Execute the highest-priority URL recovery batches and prove canonical, redirect, and sitemap signals agree.
**Depends on:** Phase 64
**Requirements:** `REC-27`, `REC-28`
**Success Criteria** (what must be TRUE):
1. P0 other-cluster and source-file recovery items have explicit keep-410, redirect-validation, recrawl-watch, or defer outcomes.
2. Trailing-slash, query-parameter, repeated-segment, and deep-skill-path canonicalization are verified against fresh Coverage evidence.
3. Sitemap, canonical, redirect, middleware, and sampled live-response evidence do not conflict for the remediated URL classes.
**Plans:** 0/1 complete

Plans:
- [ ] `65-01`: Execute P0 URL recovery batches and verify canonical/redirect proof across reports and live samples.

### Phase 66: priority-surface-ctr-and-ai-search-visibility

**Goal:** Improve click-facing priority authority surfaces and capture AI-search visibility evidence without adding manipulative or internal-facing copy.
**Depends on:** Phase 65
**Requirements:** `CTR-02`, `GEO-04`
**Success Criteria** (what must be TRUE):
1. Priority authority surfaces are selected from GSC, authority scorecard, and recovery evidence rather than intuition.
2. Title, description, heading, internal-link, and structured-data changes are limited to accurate user-facing improvements that comply with helpful-content and snippet guidance.
3. Bing AI Performance, IndexNow, or AI-search evidence is captured when available; unavailable access is recorded honestly without synthetic citation claims.
**Plans:** 0/1 complete

Plans:
- [ ] `66-01`: Review priority authority surfaces for CTR/GEO improvement and capture measurable search/AI visibility evidence.

### Phase 67: post-intervention-proof-window-and-promotion-gate

**Goal:** Produce the post-intervention proof window and decide whether recovery, promotion, or automation gates can change.
**Depends on:** Phase 66
**Requirements:** `REC-29`
**Success Criteria** (what must be TRUE):
1. The proof window separates technical crawl health, Coverage movement, GSC demand, CTR movement, authority promotion readiness, and automation readiness.
2. Recovery remains `blocking` unless fresh evidence shows trustworthy movement across the required lanes.
3. Discovery expansion and automation remain closed unless the scorecard and experiment ladder satisfy their existing gates.
**Plans:** 0/1 complete

Plans:
- [ ] `67-01`: Generate the post-intervention proof window and update promotion, expansion, and automation gates from evidence.

## Milestones

- 🚧 **v1.9 Search Compliance Recovery Execution and Proof** — phases 64-67 (active)
- ✅ **v1.8 Fresh Recovery Inputs and Comparable Proof Refresh** — phases 61-63 (shipped 2026-05-06; [archive](./milestones/v1.8-ROADMAP.md), [requirements](./milestones/v1.8-REQUIREMENTS.md), [audit](./milestones/v1.8-MILESTONE-AUDIT.md), [closeout](./milestones/v1.8-CLOSEOUT.md), [traceability](./milestones/v1.8-TRACEABILITY.md))
- ✅ **v1.7 Public Trust Surface and Copy Boundary Hardening** — phases 58-60 (shipped 2026-04-23; [archive](./milestones/v1.7-ROADMAP.md), [requirements](./milestones/v1.7-REQUIREMENTS.md), [audit](./milestones/v1.7-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.7-BOOTSTRAP.md), [closeout](./milestones/v1.7-CLOSEOUT.md), [traceability](./milestones/v1.7-TRACEABILITY.md))
- ✅ **v1.6 Post-Governance Recovery Proof and Authority Lift** — phases 54-57 (shipped 2026-04-16; [archive](./milestones/v1.6-ROADMAP.md), [requirements](./milestones/v1.6-REQUIREMENTS.md), [audit](./milestones/v1.6-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.6-BOOTSTRAP.md), [closeout](./milestones/v1.6-CLOSEOUT.md), [traceability](./milestones/v1.6-TRACEABILITY.md))
- ✅ **v1.5 Traffic Recovery Proof and Demand Restart** — phases 46-53 (shipped 2026-04-16; [archive](./milestones/v1.5-ROADMAP.md), [requirements](./milestones/v1.5-REQUIREMENTS.md), [audit](./milestones/v1.5-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.5-BOOTSTRAP.md), [closeout](./milestones/v1.5-CLOSEOUT.md), [traceability](./milestones/v1.5-TRACEABILITY.md))
- ✅ **v1.4 Traffic Recovery Closure** — phases 43-45 (shipped 2026-04-09; [archive](./milestones/v1.4-ROADMAP.md), [requirements](./milestones/v1.4-REQUIREMENTS.md), [audit](./milestones/v1.4-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.4-BOOTSTRAP.md), [closeout](./milestones/v1.4-CLOSEOUT.md))
- ✅ **v1.3 Adaptive Provider Control and Escalation Automation** — phases 39-42 (shipped 2026-04-07; [archive](./milestones/v1.3-ROADMAP.md), [requirements](./milestones/v1.3-REQUIREMENTS.md), [audit](./milestones/v1.3-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.3-BOOTSTRAP.md), [closeout](./milestones/v1.3-CLOSEOUT.md))
- ✅ **v1.2 Operator Automation and Runtime Convergence** — phases 35-38 (shipped 2026-04-07; [archive](./milestones/v1.2-ROADMAP.md), [requirements](./milestones/v1.2-REQUIREMENTS.md), [audit](./milestones/v1.2-MILESTONE-AUDIT.md), [bootstrap](./milestones/v1.2-BOOTSTRAP.md), [closeout](./milestones/v1.2-CLOSEOUT.md))
- ✅ **v1.1 Observability and Governance Hardening** — phases 31-34 (shipped 2026-04-06; [archive](./milestones/v1.1-ROADMAP.md), [requirements](./milestones/v1.1-REQUIREMENTS.md), [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- ✅ **v1.0 Reliability and Growth Operations** — phases 1-30 (shipped 2026-04-06; [archive](./milestones/v1.0-ROADMAP.md), [requirements](./milestones/v1.0-REQUIREMENTS.md), [audit](./milestones/v1.0-MILESTONE-AUDIT.md))

## Carry-Forward Themes

- **Measurement freshness first:** recovery claims must wait for a fresh Coverage Drilldown export and regenerated reports.
- **Manual proof before expansion:** P0 recovery batches should be executed and observed before any authority-surface promotion.
- **Authority depth before breadth:** existing authority surfaces must earn promotion before new surfaces or broad directory expansion reopen.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.
- **Public trust guardrails stay in force:** public entry surfaces should continue to read like product guidance, not internal planning notes.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.9 Search Compliance Recovery Execution and Proof | 64-67 | 0/4 | Active | — |
| v1.8 Fresh Recovery Inputs and Comparable Proof Refresh | 61-63 | 3/3 | Complete | 2026-05-06 |
| v1.7 Public Trust Surface and Copy Boundary Hardening | 58-60 | 3/3 | Complete | 2026-04-23 |
| v1.6 Post-Governance Recovery Proof and Authority Lift | 54-57 | 4/4 | Complete | 2026-04-16 |
| v1.5 Traffic Recovery Proof and Demand Restart | 46-53 | 8/8 | Complete | 2026-04-16 |
| v1.4 Traffic Recovery Closure | 43-45 | 3/3 | Complete | 2026-04-09 |
| v1.3 Adaptive Provider Control and Escalation Automation | 39-42 | 4/4 | Complete | 2026-04-07 |
| v1.2 Operator Automation and Runtime Convergence | 35-38 | 4/4 | Complete | 2026-04-07 |
| v1.1 Observability and Governance Hardening | 31-34 | 4/4 | Complete | 2026-04-06 |
| v1.0 Reliability and Growth Operations | 1-30 | 18/18 | Complete | 2026-04-06 |
