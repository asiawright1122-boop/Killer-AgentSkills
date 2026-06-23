# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v4.3 Sitemap Purity & Search Coverage Consolidation is active. Four new phases (Phases 133-136) are defined to ensure sitemap purity, trailing-slash consistency, unexpected 404 cleanup, and verify build/regression integrity.

## Immediate Next Actions

- [x] Plan Phase 133: Sitemap Purity.
- [x] Plan Phase 134: Trailing-Slash Consistency.
- [x] Plan Phase 135: Unexpected 404 Cleanup.
- [x] Plan Phase 136: System Build & Regression Check.

## Current Milestone: v4.3 Sitemap Purity & Search Coverage Consolidation

**Goal:** Clean up sitemap link generation, resolve trailing-slash duplicates, and repair unexpected 404 crawl errors to maximize Search Console indexing efficiency and crawl budget.

**Requirements:**

- [x] SITEMAP-01: Ensure sitemap generation excludes redirects, dead links, or dynamic drafts.
- [x] SLASH-01: Resolve trailing-slash inconsistencies across the edge router, pages, and sitemaps.
- [x] ERR404-01: Investigate and fix root causes of unexpected 404 crawl errors reported in GSC.
- [x] INTEGRATE-02: Verify global build, type safety, and all tests pass with zero regressions.

### Phase 133: Sitemap Purity

- **Requirements:** SITEMAP-01
- **Scope:** Audit and refine dynamic sitemap generators (`sitemap-skills.xml` and `sitemap.xml`) to eliminate redirections, inactive language pages, or legacy draft references.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - Sitemap generates correctly with only valid, 2xx HTTP response canonical pages.
  - No dynamic drafts or disabled language pages are included in sitemaps.

### Phase 134: Trailing-Slash Consistency

- **Requirements:** SLASH-01
- **Scope:** Harmonize URL tail slash handling in Cloudflare KV edge router, Astro page routes, and sitemap URLs to avoid duplicate crawler indexing paths.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - Edge router and Astro pages resolve consistently with/without trailing slashes via unified redirects.
  - All sitemap URLs strictly match canonical page link representations.

### Phase 135: Unexpected 404 Cleanup

- **Requirements:** ERR404-01
- **Scope:** Trace Search Console crawl statistics, extract error URLs causing unexpected 404s, and fix malformed templates, links, or route patterns.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - No broken links in dynamic HTML layout files generate crawl exceptions.
  - Verify unexpected 404 issues are successfully remediated or resolved in GSC.

### Phase 136: System Build & Regression Check

- **Requirements:** INTEGRATE-02
- **Scope:** Run a comprehensive type check, Astro production build, static validation pipelines, and all tests to assert 0 regressions.
- **Status:** Completed
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - TypeScript type compilation passes with zero errors.
  - Edge Astro production build runs successfully.
  - All Vitest tests pass cleanly.

## Milestones

- ⏳ **v4.3 Sitemap Purity & Search Coverage Consolidation** — phases 133-136 (active; [requirements](./REQUIREMENTS.md))

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

- **Promotion proof before expansion:** discovery expansion stays closed until at least two primary authority surfaces earn `promote` under fresh evidence.
- **User-facing proof before promotion:** authority surfaces need visible selection criteria, maintained proof, and clear setup handoffs before scorecard emphasis increases.
- **Coverage cleanup before scale:** expected 404s, source-path URLs, and trailing-slash drift should be contained before broadening indexable inventory.
- **Public boundary is a release gate:** internal reasoning, operator-only process notes, raw provider diagnostics, and caught exception internals must never become frontend or public API copy.
- **Automation after repeatability:** no experiment should move into automation until proof, authority, and measurement gates all clear.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|---|---|---|---|---|
| v4.3 Sitemap Purity & Search Coverage Consolidation | 133-136 | 4/4 | Complete | 2026-06-23 |
| v4.2 Repository Size Reduction & Locale Configuration Normalization | 130-132 | 3/3 | Complete | 2026-06-23 |
| v4.1 Multi-language Indexability Restructuring & SEO Acceleration | 126-129 | 4/4 | Complete | 2026-06-23 |
| v4.0 Authority Proof Remediation & Public Trust Hardening | 122-125 | 4/4 | Complete | 2026-06-22 |
| v3.9 Promotion Gate Recovery & Public Boundary Assurance | 118-121 | 4/4 | Complete | 2026-06-09 |
| v3.8 Backlog Content Enrichment Automation | 114-117 | 4/4 | Complete | 2026-06-09 |
| v3.7 Authority Expansion & Content Depth Acceleration | 109-113 | 5/5 | Complete | 2026-06-05 |
| v3.6 Authority Surfaces Promotion | 106-108 | 3/3 | Complete | 2026-06-04 |
| v3.5 Post-Intervention Recovery Verification & GEO/CTR Promotion | 103-105 | 3/3 | Complete | 2026-06-04 |
| v3.4 Coverage Cluster Remediation & AI Telemetry Refresh | 100-102 | 3/3 | Complete | 2026-06-04 |
| v3.3 Manual Recovery Execution & Fresh Ingestion | 97-99 | 3/3 | Complete | 2026-06-04 |
| v3.2 CI/CD Typecheck Alignment & Tech Debt Remediation | 94-96 | 3/3 | Complete | 2026-06-04 |
| v3.1 AIOps Smart Gateway & Profile Hardening | 91-93 | 3/3 | Complete | 2026-06-03 |
| v3.0 Advanced Search Engine Optimization | 88-90 | 3/3 | Complete | 2026-06-03 |

---
*Last updated: 2026-06-23 after Phase 136 completed*
