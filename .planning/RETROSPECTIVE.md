# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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
| v4.5 | 1 | 4 | Real-time telemetry audits and dynamic router blocklisting |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v4.5 | 1032 | 100% | 0 |

### Top Lessons (Verified Across Milestones)

1. Keep public surface boundaries clean of operator/internal strategy traces.
2. Direct router blocklisting is more robust than relying on sitemap exclusions alone.
