# Roadmap: Killer-Skills Agent Directory

## Overview

`v3.8 Backlog Content Enrichment Automation` is now the active milestone.

This milestone focuses on scale content enrichment. We will build and run an automated pipeline that can batch-upgrade thin/low-quality descriptions on backlog authority surfaces (which are currently stuck at `hold` status due to thin content warnings), enforce strict CJK translation parity, and verify their readiness to transition to `promote` status on the scorecard.

## Immediate Next Actions

- Plan Phase 114: Content Enrichment Pipeline Integration (`/gsd-plan-phase 114`).

## Current Milestone: v3.8 Backlog Content Enrichment Automation

**Goal:** Build and run an automated pipeline to batch-upgrade thin/low-quality content on hold backlog authority surfaces to satisfy SEO quality gates.

**Requirements:**
- [ ] AIOPS-35: Integrate the content enrichment validation report with an automated LLM rewrite pipeline.
- [ ] AIOPS-36: Execute batch enrichment on all currently thin or hold collections.
- [ ] AIOPS-37: Enforce strict CJK translation parity and trailing punctuation validation checks.
- [ ] AIOPS-38: Validate promoted surfaces using scorecard reports.

### Phase 114: Content Enrichment Pipeline Integration
- **Requirements:** AIOPS-35
- **Scope:** Build/extend scripts to consume diagnostics and integrate with LLM pipeline for localized generation.
- **Status:** Pending

### Phase 115: Batch Backlog Content Enrichment
- **Requirements:** AIOPS-36
- **Scope:** Execute the batch pipeline across all thin/hold collections and update JSON metadata.
- **Status:** Pending

### Phase 116: Translation Parity & Punctuation Guardrails
- **Requirements:** AIOPS-37
- **Scope:** Implement validation checks for CJK translation parity and trailing punctuation check.
- **Status:** Pending

### Phase 117: Scorecard Promotion Verification
- **Requirements:** AIOPS-38
- **Scope:** Run scorecard reports and verify that the enriched pages transition to `promote`.
- **Status:** Pending

## Milestones

- 🔄 **v3.8 Backlog Content Enrichment Automation** — phases 114-117 (active)
- ✅ **v3.7 Authority Expansion & Content Depth Acceleration** — phases 109-113 (shipped 2026-06-05; [archive](./milestones/v3.7-ROADMAP.md), [requirements](./milestones/v3.7-REQUIREMENTS.md), [audit](./milestones/v3.7-MILESTONE-AUDIT.md))
- ✅ **v3.6 Authority Surfaces Promotion** — phases 106-108 (shipped 2026-06-04; [archive](./milestones/v3.6-ROADMAP.md), [requirements](./milestones/v3.6-REQUIREMENTS.md), [audit](./v3.6-MILESTONE-AUDIT.md))
- ✅ **v3.5 Post-Intervention Recovery Verification & GEO/CTR Promotion** — phases 103-105 (shipped 2026-06-04; [archive](./milestones/v3.5-ROADMAP.md), [requirements](./milestones/v3.5-REQUIREMENTS.md), [audit](./v3.5-MILESTONE-AUDIT.md))
- ✅ **v3.4 Coverage Cluster Remediation & AI Telemetry Refresh** — phases 100-102 (shipped 2026-06-04; [archive](./milestones/v3.4-ROADMAP.md), [requirements](./milestones/v3.4-REQUIREMENTS.md), [audit](./v3.4-MILESTONE-AUDIT.md))
- ✅ **v3.3 Manual Recovery Execution & Fresh Ingestion** — phases 97-99 (shipped 2026-06-04; [archive](./milestones/v3.3-ROADMAP.md), [requirements](./milestones/v3.3-REQUIREMENTS.md), [audit](./v3.3-MILESTONE-AUDIT.md))
- ✅ **v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation** — phases 94-96 (shipped 2026-06-04; [archive](./milestones/v3.2-ROADMAP.md), [requirements](./milestones/v3.2-REQUIREMENTS.md), [audit](./milestones/v3.2-MILESTONE-AUDIT.md))
- ✅ **v3.1 AIOps Smart Gateway & Profile Hardening** — phases 91-93 (shipped 2026-06-03; [archive](./milestones/v3.1-ROADMAP.md), [requirements](./milestones/v3.1-REQUIREMENTS.md), [audit](./milestones/v3.1-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.1-BOOTSTRAP.md), [closeout](./milestones/v3.1-CLOSEOUT.md))
- ✅ **v3.0 Advanced Search Engine Optimization** — phases 88-90 (shipped 2026-06-03; [archive](./milestones/v3.0-ROADMAP.md), [requirements](./milestones/v3.0-REQUIREMENTS.md), [audit](./milestones/v3.0-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.0-BOOTSTRAP.md), [closeout](./milestones/v3.0-CLOSEOUT.md))
- ✅ **v2.9 Coverage Data Ingestion & Post-Intervention Automation** — phases 85-87 (shipped 2026-06-03; [audit](./milestones/v2.9-MILESTONE-AUDIT.md))
- ✅ **v2.8 Growth, Telemetry & UX Expansion** — phases 81-84 (shipped 2026-06-03; [audit](./milestones/v2.8-MILESTONE-AUDIT.md))
- ✅ **v2.7 Operator Profiles and Fresh Ingestion** — phase 80 (shipped 2026-06-03; [audit](./milestones/v2.7-MILESTONE-AUDIT.md))
- ✅ **v2.6 Index Alignment and AI Posture Hardening** — phase 79 (shipped 2026-06-03; [audit](./milestones/v2.6-MILESTONE-AUDIT.md))
- ✅ **v2.5 Directory Automation Escalation and Post-Rollout Analytics** — phase 78 (shipped 2026-06-03; [audit](./milestones/v2.5-MILESTONE-AUDIT.md))
- ✅ **v2.4 Directory Continuous Monitoring and CTR Optimization** — phase 77 (shipped 2026-06-03; [audit](./milestones/v2.4-MILESTONE-AUDIT.md))
- ✅ **v2.3 Directory Rollout Monitoring and Optimization** — phase 76 (shipped 2026-06-03; [audit](./milestones/v2.3-MILESTONE-AUDIT.md))
- ✅ **v2.2 Directory Automated Expansion and Full Rollout** — phases 74-75 (shipped 2026-06-03; [audit](./milestones/v2.2-MILESTONE-AUDIT.md))
- ✅ **v2.1 Directory Auto-Expansion and Verification** — phases 72-73 (shipped 2026-06-03; [audit](./milestones/v2.1-MILESTONE-AUDIT.md))
- ✅ **v2.0 Helpful Content Injection and Authority Unlock** — phases 68-71 (shipped 2026-06-03; [audit](./milestones/v2.0-MILESTONE-AUDIT.md))
- ✅ **v1.9 Search Compliance Recovery Execution and Proof** — phases 64-67 (shipped 2026-05-29; [audit](./milestones/v1.9-MILESTONE-AUDIT.md))
- ✅ **v1.8 Fresh Recovery Inputs and Comparable Proof Refresh** — phases 61-63 (shipped 2026-05-06; [audit](./milestones/v1.8-MILESTONE-AUDIT.md))
- ✅ **v1.7 Public Trust Surface and Copy Boundary Hardening** — phases 58-60 (shipped 2026-04-23; [audit](./milestones/v1.7-MILESTONE-AUDIT.md))
- ✅ **v1.6 Post-Governance Recovery Proof and Authority Lift** — phases 54-57 (shipped 2026-04-16; [audit](./milestones/v1.6-MILESTONE-AUDIT.md))
- ✅ **v1.5 Traffic Recovery Proof and Demand Restart** — phases 46-53 (shipped 2026-04-16; [audit](./milestones/v1.5-MILESTONE-AUDIT.md))
- ✅ **v1.4 Traffic Recovery Closure** — phases 43-45 (shipped 2026-04-09; [audit](./milestones/v1.4-MILESTONE-AUDIT.md))
- ✅ **v1.3 Adaptive Provider Control and Escalation Automation** — phases 39-42 (shipped 2026-04-07; [audit](./milestones/v1.3-MILESTONE-AUDIT.md))
- ✅ **v1.2 Operator Automation and Runtime Convergence** — phases 35-38 (shipped 2026-04-07; [audit](./milestones/v1.2-MILESTONE-AUDIT.md))
- ✅ **v1.1 Observability and Governance Hardening** — phases 31-34 (shipped 2026-04-06; [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- ✅ **v1.0 Reliability and Growth Operations** — phases 1-30 (shipped 2026-04-06; [audit](./milestones/v1.0-MILESTONE-AUDIT.md))

## Carry-Forward Themes

- **Measurement freshness first:** recovery claims must wait for a fresh Coverage Drilldown export and regenerated reports.
- **Manual proof before expansion:** P0 recovery batches should be executed and observed before any authority-surface promotion.
- **Authority depth before breadth:** existing authority surfaces must earn promotion before new surfaces or broad directory expansion reopen.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.
- **Public trust guardrails stay in force:** public entry surfaces should continue to read like product guidance, not internal planning notes.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v3.8 Backlog Content Enrichment Automation | 114-117 | 0/4 | Active | — |
| v3.7 Authority Expansion & Content Depth Acceleration | 109-113 | 5/5 | Complete | 2026-06-05 |
| v3.6 Authority Surfaces Promotion | 106-108 | 3/3 | Complete | 2026-06-04 |
| v3.5 Post-Intervention Recovery Verification & GEO/CTR Promotion | 103-105 | 3/3 | Complete | 2026-06-04 |
| v3.4 Coverage Cluster Remediation & AI Telemetry Refresh | 100-102 | 3/3 | Complete | 2026-06-04 |
| v3.3 Manual Recovery Execution & Fresh Ingestion | 97-99 | 3/3 | Complete | 2026-06-04 |
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

_Last updated: 2026-06-09 after completing Phase 113 of v3.7 Authority Expansion & Content Depth Acceleration._
