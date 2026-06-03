# Roadmap: Killer-Skills Agent Directory

## Overview

`v3.0 Advanced Search Engine Optimization` shipped on `2026-06-03` and is now archived.

This milestone focused on schema structured data, automated search indexing triggers, and semantic internal linking to build a premium, highly rankable directory surface.

## Immediate Next Actions

- Plan and execute Phase 91 (Run `/gsd-plan-phase 91`).

## Current Milestone: v3.1 AIOps Smart Gateway & Profile Hardening

**Goal:** Promote workload-aware provider policy into operator-managed profiles with environment-specific defaults, and harden config compliance guards.

**Requirements:**
- **Environment Profiles:** Parse dynamically based on Node/Cloudflare environment and workload class.
- **Config Guard:** Strict schema and billing compliance validation in pre-build scripts.
- **Degradation Tests:** Simulate provider fallback and 429 recovery scenarios in unit tests.
**Phase range:** 91-93

### Phase 91: Environment-Specific Profiles Integration

**Goal:** Establish profile schemas resolving provider overrides by workload class and current environment.
**Depends on:** Shipped v3.0.
**Requirements:** Environment-Specific Profiles Integration
**Success Criteria:** Runtime router correctly selects profile provider across dev, test, and prod.

Plans:
- [ ] `91-01`: Integrate environment-specific profile loading into routing pipeline.

### Phase 92: Config Guard Hardening

**Goal:** Assert schema compliance and free-only budget lockouts in build-time configuration guards.
**Depends on:** Phase 91.
**Requirements:** Config Guard Hardening
**Success Criteria:** Build-time script fails with explicit diagnostics on invalid profile configs.

Plans:
- [ ] `92-01`: Harden ai-config-guard validation rules.

### Phase 93: Smart Fallback & Degradation Verification

**Goal:** Verify fallback routing logic under simulated provider key loss or 429 timeouts.
**Depends on:** Phase 92.
**Requirements:** Smart Fallback & Degradation Verification
**Success Criteria:** Vitest test suite covers routing fallback paths with mock degradation cases.

Plans:
- [ ] `93-01`: Write degradation routing test cases.

## Milestones

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
| v3.1 AIOps Smart Gateway & Profile Hardening | 91-93 | 0/3 | Planning | - |
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
