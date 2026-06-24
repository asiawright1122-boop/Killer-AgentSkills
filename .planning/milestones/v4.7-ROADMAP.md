# Roadmap: Killer-Skills Agent Directory

## Overview

Milestone v4.7 Core Web Vitals & Edge Performance Optimization is active. Phases 148-150 are defined to optimize edge rendering performance, reduce Cloudflare Worker CPU execution times, mitigate Error 1102, and warm up edge SSR caching for critical crawl pathways.

## Immediate Next Actions

- [ ] Plan Phase 148: Cloudflare Worker CPU & Serialization Optimization.

## Current Milestone: v4.7 Core Web Vitals & Edge Performance Optimization

**Goal:** Optimize edge rendering performance, reduce Cloudflare Worker CPU execution times to mitigate Error 1102, and warm up edge SSR caching for critical crawl pathways to improve SEO ranking.

**Requirements:**

- [x] CPU-01: **Edge CPU Optimization**: Optimize global skill loading logic and JSON deserialization workflows to reduce Cloudflare Worker CPU execution times, mitigating Error 1102.
- [x] WARM-01: **Cache Warmup & Hydration**: Implement automated or cron warmup mechanisms to ensure primary GSC crawl pathways (like multilingual sitemaps) have a 100% edge cache hit rate, significantly lowering TTFB.
- [x] CWV-01: **Core Web Vitals Validation**: Leverage Chrome DevTools plugin to audit core rendering pathways and optimize INP and LCP parameters.
- [x] MON-01: **Search Health Monitoring & Alerts**: Formulate automated diagnostics alerts to immediately warn operators of crawl errors or search-traffic anomalies.

### Phase 148: Cloudflare Worker CPU & Serialization Optimization

- **Requirements:** CPU-01
- **Scope:** Refactor global skill loading logic, reduce JSON parsing footprint, and optimize data serialization on edge Workers to prevent CPU limits and Error 1102.
- **Status:** Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - Cloudflare Worker CPU execution times are optimized under load simulation.
  - JSON load size is reduced or lazy-parsed on details pages.
  - Full vitest regression and production build checks pass cleanly.

### Phase 149: Multilingual Sitemap & Route Cache Warmup Automation

- **Requirements:** WARM-01
- **Scope:** Build and deploy cron/event-driven edge SSR cache warmup automation targeting sitemaps and priority crawl routes, ensuring TTFB stays under 200ms.
- **Status:** Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - Automated warmup script executes successfully and logs cache hit metrics.
  - Multilingual sitemaps yield 100% edge cache hits on repeated crawls.
  - Average TTFB for details pages drops below the targets in local smoke tests.

### Phase 150: INP & LCP Core Web Vitals Auditing & Search Health Monitoring

- **Requirements:** CWV-01, MON-01
- **Scope:** Execute CWV diagnostics on key page templates, resolve LCP/INP bottlenecks, and establish automated Search Console health monitor alerts.
- **Status:** Complete
- **Plans:** 1/1 plans complete
- **Success Criteria:**
  - INP and LCP parameters on target detail templates meet "Good" Web Vitals classification.
  - Search Health monitoring scripts trigger warning alerts on mocked GSC crawl error inputs.
  - Astro production bundle built and E2E verified with zero regression.

## Milestones

- 🟩 **v4.7 Core Web Vitals & Edge Performance Optimization** — phases 148-150 (active; [requirements](./REQUIREMENTS.md))
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
