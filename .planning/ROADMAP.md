# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v5.0 Traffic Activation & Index Health Closure is active. Phases 156-158 will close the coverage anomaly gap, activate measurable search traffic on P0 authority surfaces, and automate GSC data freshness to eliminate the 21+ day coverage staleness that has persisted since v4.8.

## Immediate Next Actions

- [ ] Plan Phase 156: Index Health Closure — Verify & Extend REMOV-01.
- [ ] Plan Phase 157: Traffic Activation — Title/Description/Structured-Data Optimization on P0 Surfaces.
- [ ] Plan Phase 158: Coverage Freshness Automation & Demand Measurement.

## Current Milestone: v5.0 Traffic Activation & Index Health Closure

**Goal:** Shift from structural readiness to measurable traffic and index growth. Close the coverage anomaly gap (10,783 anomalies → <2,000), earn measurable impressions on P0 surfaces (currently 0), and automate GSC data freshness so coverage age stays ≤7 days without manual export.

**Requirements:**

- [ ] IND-01: **Index Health Closure**: Close the coverage anomaly gap by verifying the REMOV-01 removal batch impact and building a second-pass batch for remaining clusters.
- [ ] TRAF-01: **Traffic Activation**: Earn measurable impressions on P0 authority surfaces within 4 weeks through title/description optimization, structured data, and IndexNow/Bing submission.
- [ ] FRESH-01: **Coverage Freshness Automation**: Establish automated GSC data freshness so coverage age stays ≤7 days without manual export, closing REC-24 (unresolved since April).

### Phase 156: Index Health Closure

- **Requirements:** IND-01
- **Scope:** Cross-reference the 975-URL removal batch against the coverage anomaly clusters, build post-submission verification automation, and generate a second-pass removal batch for remaining high-priority clusters.
- **Status:** Planned
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Second-pass removal batch generated (target: top 3 remaining clusters).
  - Post-submission verification emits automated delta report.
  - Coverage anomaly reduction estimate documented (how much the first + second batch should remove).

### Phase 157: Traffic Activation — Title/Description/Structured-Data Optimization

- **Requirements:** TRAF-01
- **Scope:** P0 title/description audit, rewrite for 8 P0 authority surfaces, structured data (`FAQPage`/`SoftwareApplication`), IndexNow ping-on-deploy, and internal link reinforcement.
- **Status:** Planned
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - All 8 P0 surfaces have unique, descriptive titles and meta descriptions (no templates).
  - Structured data validates clean on all 8 P0 surfaces.
  - IndexNow ping wired for deploy-time submission.
  - ≥3 internal inbound links per P0 surface.
  - 0 regressions (1088+ tests pass, crawl health CLEAR).

### Phase 158: Coverage Freshness Automation & Demand Measurement

- **Requirements:** FRESH-01
- **Scope:** Build a scheduled GSC API coverage pipeline, refactor Coverage Drilldown to accept API data, add freshness SLA alerts, and create a traffic proof dashboard.
- **Status:** Planned
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Coverage source age ≤7 days (automated, not manual).
  - `coverage-freshness-before-claims` compliance lane moves from `watch` to `pass`.
  - Traffic proof dashboard generated with real GSC API data.
  - Freshness alert wired into compliance matrix.

## Milestones

- 🟩 **v5.0 Traffic Activation & Index Health Closure** — phases 156-158 (active; [requirements](./REQUIREMENTS.md))
- ✅ **v4.9 Authority Surface Uplift & Coverage Freshness** — phases 153-155 (shipped 2026-06-26; [archive](./milestones/v4.9-ROADMAP.md), [requirements](./milestones/v4.9-REQUIREMENTS.md), [audit](./milestones/v4.9-MILESTONE-AUDIT.md))
- ✅ **v4.8 Crawl Remediation & Discovery Expansion** — phases 151-152 (shipped 2026-06-26; [archive](./milestones/v4.8-ROADMAP.md), [requirements](./milestones/v4.8-REQUIREMENTS.md), [audit](./milestones/v4.8-MILESTONE-AUDIT.md))
- ✅ **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (shipped 2026-06-24; [archive](./milestones/v4.7-ROADMAP.md), [requirements](./milestones/v4.7-REQUIREMENTS.md), [audit](./milestones/v4.7-MILESTONE-AUDIT.md))

## Carry-Forward Themes

- **Promotion proof before expansion:** discovery expansion stays closed until at least two primary authority surfaces earn `promote` under fresh evidence. (Satisfied: 34 surfaces promote-ready, boundary `open`.)
- **User-facing proof before promotion:** authority surfaces need visible selection criteria, maintained proof, and clear setup handoffs before scorecard emphasis increases. (v5.0 TRAF-01 addresses the traffic dimension directly.)
- **Coverage cleanup before scale:** expected 404s, source-path URLs, and trailing-slash drift should be contained before broadening indexable inventory. (v5.0 IND-01 addresses the anomaly gap.)
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear. (v5.0 FRESH-01 closes the measurement freshness gap.)

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v5.0 Traffic Activation & Index Health Closure | 156-158 | 0/3 | Planned | Active |
| v4.9 Authority Surface Uplift & Coverage Freshness | 153-155 | 3/3 | Complete | 2026-06-26 |
| v4.8 Crawl Remediation & Discovery Expansion | 151-152 | 2/2 | Complete | 2026-06-26 |
| v4.7 Core Web Vitals & Edge Performance Optimization | 148-150 | 3/3 | Complete | 2026-06-24 |
| v4.6 GitHub Workflow SEO & Harvester Hardening | 144-147 | 4/4 | Complete | 2026-06-24 |
| v4.5 GSC Crawl & AI Telemetry Hardening | 140-143 | 4/4 | Complete | 2026-06-23 |
| v4.4 GSC Opportunity & Authority Promotion | 137-139 | 3/3 | Complete | 2026-06-23 |
| v4.3 Sitemap Purity & Search Coverage Consolidation | 133-136 | 4/4 | Complete | 2026-06-23 |
| v4.2 Repository Size Reduction & Locale Configuration Normalization | 130-132 | 3/3 | Complete | 2026-06-23 |
| v4.1 Multi-language Indexability Restructuring & SEO Acceleration | 126-129 | 4/4 | Complete | 2026-06-23 |
| v4.0 Authority Proof Remediation & Public Trust Hardening | 122-125 | 4/4 | Complete | 2026-06-22 |

---
*Last updated: 2026-06-26 after archiving v4.9 and initializing v5.0*
