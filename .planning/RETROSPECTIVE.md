# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v4.7 — Core Web Vitals & Edge Performance Optimization

**Shipped:** 2026-06-24
**Phases:** 3 | **Plans:** 3 | **Sessions:** 1

### What Was Built
- Refactored badge endpoints and skill list functions to load lightweight data, avoiding costly JSON Markdown parses and lowering Edge CPU usage to defend against 1102 errors.
- Created cache warmup bot user-agent exemptions to bypass IP rate limits during automated crawls.
- Implemented Playwright E2E Core Web Vitals audits evaluating LCP, CLS, and INP metrics on target page templates.
- Developed `gsc-search-health-monitor.ts` executing weekly click change analysis, freshness SLA validations, and server error alert thresholds.

### What Worked
- Injecting PerformanceObservers before page navigation in Playwright scripts to reliably capture LCP and CLS.
- Catching interaction timeouts in E2E performance click tests to prevent build hangs in unseeded local database environments.

### What Was Inefficient
- Hardcoding detail page routes in E2E tests before checking database seed availability can trigger false positive timeouts unless robust click catches are added.

### Key Lessons
- Add short click timeouts (`{ timeout: 1000 }`) on simulated user events in E2E test scripts.
- Use lightweight metadata queries rather than complete JSON loads on high-frequency Edge router paths.

---

## Milestone: v4.6 — GitHub Workflow SEO & Harvester Hardening

**Shipped:** 2026-06-24
**Phases:** 4 | **Plans:** 4 | **Sessions:** 1

### What Was Built
- Implemented TF-IDF Cosine Similarity filter to skip duplicate or low-originality repositories during harvesting.
- Upgraded CJK spacing and localized full-width punctuation conversions, supporting recursion on translation array nodes.
- Integrated automated collections metadata & keywords mining batch enrichment in GHA, pushing changes back to repository.
- Integrated `typecheck`, CJK punctuation checks, and pre-flight metadata checker as CI commit/PR blocking gates.

### What Worked
- Using automated CI validation steps that immediately fail the pipeline on CJK punctuation parity issues.

---

## Milestone: v4.5 — GSC Crawl & AI Telemetry Hardening

**Shipped:** 2026-06-23
**Phases:** 4 | **Plans:** 4 | **Sessions:** 1

### What Was Built
- Reset failure stats for NVIDIA nodes in telemetry summary.
- Adjusted local warning SLA threshold to 30 days and regenerated scorecard.
- Sitemap-blocklisted pages forced `noindex` edge routing in the catch-all router.
- Clean system-wide regression checking including public-surface compliance.

### What Worked
- Parallelizing regression test suites and Astro build validation.
- Applying runtime blocklist checks directly to Catch-all Astro routers.

### What Was Inefficient
- Frontmatter alterations required additional Prettier formatting iterations to pass gates.

### Patterns Established
- Decoupling static check scripts from runtime edge routing check filters.

### Key Lessons
- Proactively run formatter rules on edited dynamic files before build validation.
- Telemetry thresholds require flexible SLA configurations to match external ingestion limits.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v4.7 | 1 | 3 | Automated E2E Core Web Vitals auditing and GSC Search health alerts |
| v4.6 | 1 | 4 | Harvester similarity checking, CJK typography parity, and metadata gates |
| v4.5 | 1 | 4 | Real-time telemetry audits and dynamic router blocklisting |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v4.7 | 1067 | 100% | 0 |
| v4.6 | 1063 | 100% | 0 |
| v4.5 | 1032 | 100% | 0 |

### Top Lessons (Verified Across Milestones)

1. Keep public surface boundaries clean of operator/internal strategy traces.
2. Direct router blocklisting is more robust than relying on sitemap exclusions alone.
3. Enforce strict timeouts on simulated click/navigation E2E actions to avoid CI pipeline hangs.
