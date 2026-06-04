# Roadmap: Killer-Skills Agent Directory

## Overview

`v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation` shipped on `2026-06-04` and is now archived.

This milestone focused on establishing project-wide type safety, aligning compiler configurations, and introducing scripts typecheck CI gates.

## Immediate Next Actions

- Run `/gsd-plan-phase 97` to start planning for the first phase of the milestone.

## Current Milestone: v3.3 Manual Recovery Execution & Fresh Ingestion

**Goal:** Ingest fresh Google Search Console (GSC) Coverage data to resolve SLA warnings, execute P0 manual recovery batches, and assess post-intervention recovery signals using the technical scorecard.

**Requirements:**
- **AIOPS-18**: GSC Coverage Fresh Ingestion
- **AIOPS-19**: P0 Manual Recovery Execution
- **AIOPS-20**: Technical Scorecard Recalculation
**Phase range:** Phase 97 - Phase 99

### Phase 97: GSC Coverage Fresh Ingestion

(Complete: [summary](./phases/97-GSC%20Coverage%20Fresh%20Ingestion/97-01-SUMMARY.md), [verification](./phases/97-GSC%20Coverage%20Fresh%20Ingestion/97-VERIFICATION.md))

- Ingest fresh GSC export data and resolve the freshness SLA warning gate.

### Phase 98: P0 Manual Recovery Execution

(Complete: [summary](./phases/98-P0%20Manual%20Recovery%20Execution/98-01-SUMMARY.md), [verification](./phases/98-P0%20Manual%20Recovery%20Execution/98-VERIFICATION.md))

- Execute manual enrichment and validation loops on target priority surfaces.

### Phase 99: Technical Scorecard Recalculation

(Complete: [summary](./phases/99-Technical%20Scorecard%20Recalculation/99-01-SUMMARY.md), [verification](./phases/99-Technical%20Scorecard%20Recalculation/99-VERIFICATION.md))

- Recalculate the recovery metrics and update the scorecard report.

## Milestones

- ⏳ **v3.3 Manual Recovery Execution & Fresh Ingestion** — phases 97-99 (active; [requirements](./REQUIREMENTS.md))
- ✅ **v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation** — phases 94-96 (shipped 2026-06-04; [archive](./milestones/v3.2-ROADMAP.md), [requirements](./milestones/v3.2-REQUIREMENTS.md), [audit](./v3.2-MILESTONE-AUDIT.md))
- ✅ **v3.1 AIOps Smart Gateway & Profile Hardening** — phases 91-93 (shipped 2026-06-03; [archive](./milestones/v3.1-ROADMAP.md), [requirements](./milestones/v3.1-REQUIREMENTS.md), [audit](./milestones/v3.1-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.1-BOOTSTRAP.md), [closeout](./milestones/v3.1-CLOSEOUT.md))
- ✅ **v3.0 Advanced Search Engine Optimization** — phases 88-90 (shipped 2026-06-03; [archive](./milestones/v3.0-ROADMAP.md), [requirements](./milestones/v3.0-REQUIREMENTS.md), [audit](./milestones/v3.0-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.0-BOOTSTRAP.md), [closeout](./milestones/v3.0-CLOSEOUT.md))
- ✅ **v2.9 Coverage Data Ingestion & Post-Intervention Automation** — phases 85-87 (shipped 2026-06-03; [audit](./milestones/v2.9-MILESTONE-AUDIT.md))
- ✅ **v2.8 Growth, Telemetry & UX Expansion** — phases 81-84 (shipped 2026-06-03; [audit](./milestones/v2.8-MILESTONE-AUDIT.md))
- ✅ **v2.7 Operator Profiles and Fresh Ingestion** — phase 80 (shipped 2026-06-03; [archive](./milestones/v2.7-ROADMAP.md), [requirements](./milestones/v2.7-REQUIREMENTS.md), [audit](./milestones/v2.7-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.7-BOOTSTRAP.md), [closeout](./milestones/v2.7-CLOSEOUT.md))
- ✅ **v2.6 Index Alignment and AI Posture Hardening** — phase 79 (shipped 2026-06-03; [archive](./milestones/v2.6-ROADMAP.md), [requirements](./milestones/v2.6-REQUIREMENTS.md), [audit](./milestones/v2.6-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.6-BOOTSTRAP.md), [closeout](./milestones/v2.6-CLOSEOUT.md))
- ✅ **v2.5 Directory Automation Escalation and Post-Rollout Analytics** — phase 78 (shipped 2026-06-03; [archive](./milestones/v2.5-ROADMAP.md), [requirements](./milestones/v2.5-REQUIREMENTS.md), [audit](./milestones/v2.5-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.5-BOOTSTRAP.md), [closeout](./milestones/v2.5-CLOSEOUT.md))
- ✅ **v2.4 Directory Continuous Monitoring and CTR Optimization** — phase 77 (shipped 2026-06-03; [archive](./milestones/v2.4-ROADMAP.md), [requirements](./milestones/v2.4-REQUIREMENTS.md), [audit](./milestones/v2.4-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.4-BOOTSTRAP.md), [closeout](./milestones/v2.4-CLOSEOUT.md))
- ✅ **v2.3 Directory Rollout Monitoring and Optimization** — phase 76 (shipped 2026-06-03; [archive](./milestones/v2.3-ROADMAP.md), [requirements](./milestones/v2.3-REQUIREMENTS.md), [audit](./milestones/v2.3-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.3-BOOTSTRAP.md), [closeout](./milestones/v2.3-CLOSEOUT.md))
- ✅ **v2.2 Directory Automated Expansion and Full Rollout** — phases 74-75 (shipped 2026-06-03; [archive](./milestones/v2.2-ROADMAP.md), [requirements](./milestones/v2.2-REQUIREMENTS.md), [audit](./milestones/v2.2-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.2-BOOTSTRAP.md), [closeout](./milestones/v2.2-CLOSEOUT.md))
- ✅ **v2.1 Directory Auto-Expansion and Verification** — phases 72-73 (shipped 2026-06-03; [archive](./milestones/v2.1-ROADMAP.md), [requirements](./milestones/v2.1-REQUIREMENTS.md), [audit](./milestones/v2.1-MILESTONE-AUDIT.md), [bootstrap](./milestones/v2.1-BOOTSTRAP.md), [closeout](./milestones/v2.1-CLOSEOUT.md))
- ✅ **v2.0 Helpful Content Injection and Authority Unlock** — phases 68-71 (shipped 2026-06-03; [archive](./milestones/v2.0-ROADMAP.md), [requirements](./milestones/v2.0-REQUIREMENTS.md), [audit](./milestones/v2.0-MILESTONE-AUDIT.md))
- ✅ **v1.9 Search Compliance Recovery Execution and Proof** — phases 64-67 (shipped 2026-05-29; [archive](./milestones/v1.9-ROADMAP.md), [requirements](./milestones/v1.9-REQUIREMENTS.md), [audit](./milestones/v1.9-MILESTONE-AUDIT.md), [closeout](./milestones/v1.9-CLOSEOUT.md), [traceability](./milestones/v1.9-TRACEABILITY.md))
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
| v3.3 Manual Recovery Execution & Fresh Ingestion | 97-99 | 3/3 | Active | - |
| v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation | 94-96 | 3/3 | Complete | 2026-06-04 |
| v3.1 AIOps Smart Gateway & Profile Hardening | 91-93 | 3/3 | Complete | 2026-06-03 |
| v3.0 Advanced Search Engine Optimization | 88-90 | 3/3 | Complete | 2026-06-03 |
| v2.9 Coverage Data Ingestion & Post-Intervention Automation | 85-87 | 3/3 | Complete | 2026-06-03 |
| v2.8 Growth, Telemetry & UX Expansion | 81-84 | 4/4 | Complete | 2026-06-03 |
| v2.7 Operator Profiles and Fresh Ingestion | 80 | 1/1 | Complete | 2026-06-03 |
| v2.6 Index Alignment and AI Posture Hardening | 79 | 1/1 | Complete | 2026-06-03 |
| v2.5 Directory Automation Escalation and Post-Rollout Analytics | 78 | 1/1 | Complete | 2026-06-03 |
| v2.4 Directory Continuous Monitoring and CTR Optimization | 77 | 1/1 | Complete | 2026-06-03 |
| v2.3 Directory Rollout Monitoring and Optimization | 76 | 1/1 | Complete | 2026-06-03 |
| v2.2 Directory Automated Expansion and Full Rollout | 74-75 | 2/2 | Complete | 2026-06-03 |
| v2.1 Directory Auto-Expansion and Verification | 72-73 | 2/2 | Complete | 2026-06-03 |
| v2.0 Helpful Content Injection and Authority Unlock | 68-71 | 2/4 | Complete | 2026-06-03 |
| v1.9 Search Compliance Recovery Execution and Proof | 64-67 | 4/4 | Complete | 2026-05-29 |
| v1.8 Fresh Recovery Inputs and Comparable Proof Refresh | 61-63 | 3/3 | Complete | 2026-05-06 |
| v1.7 Public Trust Surface and Copy Boundary Hardening | 58-60 | 3/3 | Complete | 2026-04-23 |
| v1.6 Post-Governance Recovery Proof and Authority Lift | 54-57 | 4/4 | Complete | 2026-04-16 |
| v1.5 Traffic Recovery Proof and Demand Restart | 46-53 | 8/8 | Complete | 2026-04-16 |
| v1.4 Traffic Recovery Closure | 43-45 | 3/3 | Complete | 2026-04-09 |
| v1.3 Adaptive Provider Control and Escalation Automation | 39-42 | 4/4 | Complete | 2026-04-07 |
| v1.2 Operator Automation and Runtime Convergence | 35-38 | 4/4 | Complete | 2026-04-07 |
| v1.1 Observability and Governance Hardening | 31-34 | 4/4 | Complete | 2026-04-06 |
| v1.0 Reliability and Growth Operations | 1-30 | 18/18 | Complete | 2026-04-06 |

---

_Last updated: 2026-06-04 after shipping v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation._
