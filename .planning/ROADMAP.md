# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v4.5 GSC Crawl & AI Telemetry Hardening is active. Phases 140-143 are defined to resolve indexation coverage alerts, reset telemetry indicators, and clean crawler URL routing drift.

## Immediate Next Actions

- [x] Plan Phase 143: System Integrity & Regression Guard.

## Current Milestone: v4.5 GSC Crawl & AI Telemetry Hardening

**Goal:** Resolve GSC crawl-rate coverage alerts, refresh dated telemetry reports, and reset quarantined primary AI provider labels to clear routing blockages.

**Requirements:**

- [x] REQ-01: **AI Telemetry Hardening**: Reset/refresh quarantined NVIDIA provider labels by clearing stale error telemetry to resolve the AI Posture BLOCKING state.
- [x] REQ-02: **Crawl Coverage Ingestion**: Ingest raw Search Console datasets to refresh the local Coverage Drilldown index and regenerate recovery scorecard inputs.
- [x] REQ-03: **Canonicalization & Blocklist Remediation**: Resolve GSC-flagged URL discrepancy issues (e.g., trailing slash, sitemap-blocklist anomalies) to align edge routing.
- [x] REQ-04: **System Integrity**: Ensure 100% build stability, clean TypeScript compilation, and passing test suites.

### Phase 140: AI Telemetry Cleanup & Posture Hardening

- **Requirements:** REQ-01
- **Scope:** Reset quarantined NVIDIA provider labels in runtime telemetry logs, run active probes to verify 100% primary node health, and resolve the BLOCKING status on the AI Posture gate.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - NVIDIA nodes (N0, N1, N2, N3) successfully removed from quarantine.
  - Telemetry health reports show `AI Runtime Posture` status as CLEAR.
  - No active critical alerts triggered in AI provider monitoring logs.

### Phase 141: GSC Crawl Coverage Ingest & Report Refresh

- **Requirements:** REQ-02
- **Scope:** Ingest raw coverage CSV datasets into local data store, run index-integrity and drift validations, and regenerate recovery scorecard inputs to clear age-warning indicators.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - Coverage drilldown metadata successfully generated with fresh timestamp.
  - Dominant exclusion clusters sub-classified and explained.
  - Recovery Scorecard `Coverage Freshness` gate transitions from WARNING to CLEAR.

### Phase 142: URL Canonicalization & Blocklist Alignment

- **Requirements:** REQ-03
- **Scope:** Clean up trailing-slash URL discrepancies reported in search console and resolve sitemap-blocklist clashes on key detail pages to ensure edge-router compliance.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - Trailing-slash variants consolidated to extensionless paths in routing and sitemap.
  - Sitemap blocklist verified against active routes with no static route conflicts.
  - Integration tests added to prevent URL canonical drift.

### Phase 143: System Integrity & Regression Guard

- **Requirements:** REQ-04
- **Scope:** Run full verification pipelines (lint, format, typecheck, public copy boundaries, and all 1030+ Vitest tests) to guarantee zero regressions for Milestone v4.5 release.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - TypeScript workspace typecheck passes cleanly with 0 errors.
  - Vitest test suite runs and asserts 100% pass on all tests.
  - Astro production bundle compiles successfully without runtime blockages.

## Milestones

- ✅ **v4.5 GSC Crawl & AI Telemetry Hardening** — phases 140-143 (shipped 2026-06-23; [requirements](./REQUIREMENTS.md))

- ✅ **v4.4 GSC Opportunity & Authority Promotion** — phases 137-139 (shipped 2026-06-23; [archive](./milestones/v4.4-ROADMAP.md), [requirements](./milestones/v4.4-REQUIREMENTS.md))
- ✅ **v4.3 Sitemap Purity & Search Coverage Consolidation** — phases 133-136 (shipped 2026-06-23; [archive](./milestones/v4.3-ROADMAP.md), [requirements](./milestones/v4.3-REQUIREMENTS.md), [audit](./milestones/v4.3-MILESTONE-AUDIT.md))
- ✅ **v4.2 Repository Size Reduction & Locale Configuration Normalization** — phases 130-132 (shipped 2026-06-23; [archive](./milestones/v4.2-ROADMAP.md), [requirements](./milestones/v4.2-REQUIREMENTS.md), [audit](./milestones/v4.2-MILESTONE-AUDIT.md))
- ✅ **v4.1 Multi-language Indexability Restructuring & SEO Acceleration** — phases 126-129 (shipped 2026-06-23; [archive](./milestones/v4.1-ROADMAP.md), [requirements](./milestones/v4.1-REQUIREMENTS.md), [audit](./milestones/v4.1-MILESTONE-AUDIT.md))
- ✅ **v4.0 Authority Proof Remediation & Public Trust Hardening** — phases 122-125 (shipped 2026-06-22; [archive](./milestones/v4.0-ROADMAP.md), [requirements](./milestones/v4.0-REQUIREMENTS.md), [audit](./milestones/v4.0-MILESTONE-AUDIT.md), [bootstrap](./milestones/v4.0-BOOTSTRAP.md), [closeout](./milestones/v4.0-CLOSEOUT.md))
- ✅ **v3.9 Promotion Gate Recovery & Public Boundary Assurance** — phases 118-121 (shipped 2026-06-09; [archive](./milestones/v3.9-ROADMAP.md), [requirements](./milestones/v3.9-REQUIREMENTS.md), [audit](./milestones/v3.9-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.9-BOOTSTRAP.md), [closeout](./milestones/v3.9-CLOSEOUT.md))
- ✅ **v3.8 Backlog Content Enrichment Automation** — phases 114-117 (shipped 2026-06-09; [archive](./milestones/v3.8-ROADMAP.md), [requirements](./milestones/v3.8-REQUIREMENTS.md), [audit](./milestones/v3.8-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.8-BOOTSTRAP.md), [closeout](./milestones/v3.8-CLOSEOUT.md))
- ✅ **v3.7 Authority Expansion & Content Depth Acceleration** — phases 109-113 (shipped 2026-06-05; [archive](./milestones/v3.7-ROADMAP.md), [requirements](./milestones/v3.7-REQUIREMENTS.md), [audit](./milestones/v3.7-MILESTONE-AUDIT.md))
- ✅ **v3.6 Authority Surfaces Promotion** — phases 106-108 (shipped 2026-06-04; [archive](./milestones/v3.6-ROADMAP.md), [requirements](./milestones/v3.6-REQUIREMENTS.md), [audit](./v3.6-MILESTONE-AUDIT.md))
- ✅ **v3.5 Post-Intervention Recovery Verification & GEO/CTR Promotion** — phases 103-105 (shipped 2026-06-04; [archive](./milestones/v3.5-ROADMAP.md), [requirements](./milestones/v3.5-REQUIREMENTS.md), [audit](./v3.5-MILESTONE-AUDIT.md))
- ✅ **v3.4 Coverage Cluster Remediation & AI Telemetry Refresh** — phases 100-102 (shipped 2026-06-04; [archive](./milestones/v3.4-ROADMAP.md), [requirements](./milestones/v3.4-REQUIREMENTS.md), [audit](./v3.4-MILESTONE-AUDIT.md))
- ✅ **v3.3 Manual Recovery Execution & Fresh Ingestion** — phases 97-99 (shipped 2026-06-04; [archive](./milestones/v3.3-ROADMAP.md), [requirements](./milestones/v3.3-REQUIREMENTS.md), [audit](./v3.3-MILESTONE-AUDIT.md))
- ✅ **v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation** — phases 94-96 (shipped 2026-06-04; [archive](./milestones/v3.2-ROADMAP.md), [requirements](./milestones/v3.2-REQUIREMENTS.md), [audit](./milestones/v3.2-MILESTONE-AUDIT.md))
- ✅ **v3.1 AIOps Smart Gateway & Profile Hardening** — phases 91-93 (shipped 2026-06-03; [archive](./milestones/v3.1-ROADMAP.md), [requirements](./milestones/v3.1-REQUIREMENTS.md), [audit](./milestones/v3.1-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.1-BOOTSTRAP.md), [closeout](./milestones/v3.1-CLOSEOUT.md))
- ✅ **v3.0 Advanced Search Engine Optimization** — phases 88-90 (shipped 2026-06-03; [archive](./milestones/v3.0-ROADMAP.md), [requirements](./milestones/v3.0-REQUIREMENTS.md), [audit](./milestones/v3.0-MILESTONE-AUDIT.md), [bootstrap](./milestones/v3.0-BOOTSTRAP.md), [closeout](./milestones/v3.0-CLOSEOUT.md))

## Carry-Forward Themes

- **Promotion proof before expansion:** discovery expansion stays closed until at least two primary authority surfaces earn `promote` under fresh evidence.
- **User-facing proof before promotion:** authority surfaces need visible selection criteria, maintained proof, and clear setup handoffs before scorecard emphasis increases.
- **Coverage cleanup before scale:** expected 404s, source-path URLs, and trailing-slash drift should be contained before broadening indexable inventory.
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v4.5 GSC Crawl & AI Telemetry Hardening | 140-143 | 4/4 | Complete | 2026-06-23 |
| v4.4 GSC Opportunity & Authority Promotion | 137-139 | 3/3 | Complete | 2026-06-23 |
| v4.3 Sitemap Purity & Search Coverage Consolidation | 133-136 | 4/4 | Complete | 2026-06-23 |
| v4.2 Repository Size Reduction & Locale Configuration Normalization | 130-132 | 3/3 | Complete | 2026-06-23 |
| v4.1 Multi-language Indexability Restructuring & SEO Acceleration | 126-129 | 4/4 | Complete | 2026-06-23 |
| v4.0 Authority Proof Remediation & Public Trust Hardening | 122-125 | 4/4 | Complete | 2026-06-22 |

---
*Last updated: 2026-06-23 after initializing Milestone v4.5*
