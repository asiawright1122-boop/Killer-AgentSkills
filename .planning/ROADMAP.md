# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v4.8 Crawl Remediation & Discovery Expansion is active. Phases 151-152 are defined to resolve crawl coverage bottlenecks and prepare for next-stage search discovery expansion.

## Immediate Next Actions

- [ ] Plan Phase 151: Crawl Coverage Remediation.

## Current Milestone: v4.8 Crawl Remediation & Discovery Expansion

**Goal:** Resolve remaining crawl coverage issues, prune legacy 404/redirect anomalies, and prepare the directory surface for discoverability expansion.

**Requirements:**

- [ ] REMED-01: **Coverage Remediation**: Resolve unclassified and pending GSC Coverage anomalies.
- [ ] EXP-01: **Discovery Expansion Preparation**: Audit and prep authority structures for scale-up.

### Phase 151: Crawl Coverage Remediation

- **Requirements:** REMED-01
- **Scope:** 3-tier index slimdown (5,308 → 436 Tier 1 skills), body-locale alignment enforcement, GSC URL removal batches, coverage anomaly reduction.
- **Status:** In Progress
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Tier 1 skill count in 300-500 range. (Currently 436 ✓)
  - Sitemap contains only Tier 1 URLs. (Verified ✓)
  - Non-English non-body-matching pages are noindex.
  - GSC removal batch generated for 10,783 anomalies. (521 URLs batched ✓)
  - Zero regression on existing E2E flows. (1073 tests passing ✓)

### Phase 152: Discovery Expansion Preparation

- **Requirements:** EXP-01
- **Scope:** Complete directory indexing pre-flights.
- **Status:** Not started
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Pre-flight verification logs clean.

## Milestones

- 🟩 **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (active; [requirements](./REQUIREMENTS.md))
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24; [archive](./milestones/v4.7-ROADMAP.md), [requirements](./milestones/v4.7-REQUIREMENTS.md), [audit](./milestones/v4.7-MILESTONE-AUDIT.md))
- ✅ **v4.6 GitHub Workflow SEO & Harvester Hardening** — phases 144-147 (shipped 2026-06-24; [archive](./milestones/v4.6-ROADMAP.md), [requirements](./milestones/v4.6-REQUIREMENTS.md), [audit](./milestones/v4.6-MILESTONE-AUDIT.md))
- ✅ **v4.5 GSC Crawl & AI Telemetry Hardening** — phases 140-143 (shipped 2026-06-23; [archive](./milestones/v4.5-ROADMAP.md), [requirements](./milestones/v4.5-REQUIREMENTS.md), [audit](./milestones/v4.5-MILESTONE-AUDIT.md))
- ✅ **v4.4 GSC Opportunity & Authority Promotion** — phases 137-139 (shipped 2026-06-23; [archive](./milestones/v4.4-ROADMAP.md), [requirements](./milestones/v4.4-REQUIREMENTS.md))
- ✅ **v4.3 Sitemap Purity & Search Coverage Consolidation** — phases 133-136 (shipped 2026-06-23; [archive](./milestones/v4.3-ROADMAP.md), [requirements](./milestones/v4.3-REQUIREMENTS.md), [audit](./milestones/v4.3-MILESTONE-AUDIT.md))
- ✅ **v4.2 Repository Size Reduction & Locale Configuration Normalization** — phases 130-132 (shipped 2026-06-23; [archive](./milestones/v4.2-ROADMAP.md), [requirements](./milestones/v4.2-REQUIREMENTS.md), [audit](./milestones/v4.2-MILESTONE-AUDIT.md))
- ✅ **v4.1 Multi-language Indexability Restructuring & SEO Acceleration** — phases 126-129 (shipped 2026-06-23; [archive](./milestones/v4.1-ROADMAP.md), [requirements](./milestones/v4.1-REQUIREMENTS.md), [audit](./milestones/v4.1-MILESTONE-AUDIT.md))
- ✅ **v4.0 Authority Proof Remediation & Public Trust Hardening** — phases 122-125 (shipped 2026-06-22; [archive](./milestones/v4.0-ROADMAP.md), [requirements](./milestones/v4.0-REQUIREMENTS.md), [audit](./milestones/v4.0-MILESTONE-AUDIT.md), [bootstrap](./milestones/v4.0-BOOTSTRAP.md), [closeout](./milestones/v4.0-CLOSEOUT.md))

## Carry-Forward Themes

- **Promotion proof before expansion:** discovery expansion stays closed until at least two primary authority surfaces earn `promote` under fresh evidence.
- **User-facing proof before promotion:** authority surfaces need visible selection criteria, maintained proof, and clear setup handoffs before scorecard emphasis increases.
- **Coverage cleanup before scale:** expected 404s, source-path URLs, and trailing-slash drift should be contained before broadening indexable inventory.
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v4.8 Crawl Remediation & Discovery Expansion | 151-152 | 0/2 | In Progress | Active |
| v4.7 Core Web Vitals & Edge Performance Optimization | 148-150 | 3/3 | Complete | 2026-06-24 |
| v4.6 GitHub Workflow SEO & Harvester Hardening | 144-147 | 4/4 | Complete | 2026-06-24 |
| v4.5 GSC Crawl & AI Telemetry Hardening | 140-143 | 4/4 | Complete | 2026-06-23 |
| v4.4 GSC Opportunity & Authority Promotion | 137-139 | 3/3 | Complete | 2026-06-23 |
| v4.3 Sitemap Purity & Search Coverage Consolidation | 133-136 | 4/4 | Complete | 2026-06-23 |
| v4.2 Repository Size Reduction & Locale Configuration Normalization | 130-132 | 3/3 | Complete | 2026-06-23 |
| v4.1 Multi-language Indexability Restructuring & SEO Acceleration | 126-129 | 4/4 | Complete | 2026-06-23 |
| v4.0 Authority Proof Remediation & Public Trust Hardening | 122-125 | 4/4 | Complete | 2026-06-22 |

---
*Last updated: 2026-06-24 after completing Phase 150*
