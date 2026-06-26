# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v4.8 — Crawl Remediation & Discovery Expansion

**Shipped:** 2026-06-26
**Phases:** 2 | **Plans:** 2 | **Sessions:** 1

### What Was Built
- Executed a 3-tier index slimdown that reduced indexable skills from 5,308 to 436 Tier 1, with sitemap verified clean (all `/en/` canonical, no trailing slashes) and non-English `noindex` enforced via dual paths (sitemap exclusion + canonical-to-EN).
- Expanded the GSC removal batch from 521 to 975 URLs via a full CSV merge across clusters (source_file, skill_blocklisted, trailing_slash, skill_missing_or_unpublished, etc.).
- Prepared discovery expansion: proof-window trust moved `warning` → `ready`, 34 authority surfaces became promote-ready (from 0), and the search compliance matrix cleared its last blocking lane.
- All 7 recovery-scorecard gates cleared; P0 preflight and directory perf test (50/50 200 OK, avg 297ms) green.

### What Worked
- The recovery pipeline chain (scorecard → delta-board → proof-window → authority-uplift → compliance-matrix) correctly propagated `businessRecoveryStatus: "clear"` end-to-end, unlocking the editorial-readiness promote path automatically.
- Dual-path noindex enforcement (sitemap exclusion + canonical) proved more robust than relying on either signal alone.

### What Was Inefficient
- The discovery expansion boundary stayed `closed` because the GSC Coverage Drilldown CSV export was 21 days old (gate threshold ≤7d). This was an operational data-freshness task, not a code gap — but it blocked an entire milestone's exit criterion on a manual UI export.

### Key Lessons
- Data-freshness gates that depend on manual external UI exports (GSC CSV) become single points of failure for milestone exit. Where possible, prefer API-backed same-day alternatives. (This fed directly into v4.9 Phase 154's URL Inspection coverage sweep, which replaced the stale-export dependency.)
- Coverage cleanup (anomaly reduction) should precede inventory expansion: the 10,783 anomaly count had to be addressed before broadening the indexable surface.

---

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
| v4.8 | 1 | 2 | 3-tier index slimdown (5308→436 Tier 1), GSC removal batch expansion, discovery expansion prep |
| v4.7 | 1 | 3 | Automated E2E Core Web Vitals auditing and GSC Search health alerts |
| v4.6 | 1 | 4 | Harvester similarity checking, CJK typography parity, and metadata gates |
| v4.5 | 1 | 4 | Real-time telemetry audits and dynamic router blocklisting |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v4.8 | 1075 | 100% | 0 |
| v4.7 | 1067 | 100% | 0 |
| v4.6 | 1063 | 100% | 0 |
| v4.5 | 1032 | 100% | 0 |

### Top Lessons (Verified Across Milestones)

1. Keep public surface boundaries clean of operator/internal strategy traces.
2. Direct router blocklisting is more robust than relying on sitemap exclusions alone.
3. Enforce strict timeouts on simulated click/navigation E2E actions to avoid CI pipeline hangs.
4. Data-freshness gates that depend on manual external UI exports become single points of failure; prefer API-backed alternatives where available.
5. Coverage cleanup (anomaly reduction) must precede indexable inventory expansion.
