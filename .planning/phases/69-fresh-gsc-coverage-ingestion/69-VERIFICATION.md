---
phase: 69-fresh-gsc-coverage-ingestion
milestone: v2.0
requirements:
  - REC-30
  - REC-31
status: pending
created: 2026-05-29
---

# Phase 69 Verification

## Success Criteria

1. **Physical Report Ingest**:
   - A raw Page Indexing (Coverage) Drilldown folder dating post-May 2026 is parsed successfully by `scripts/seo-coverage-drilldown.ts`.
2. **Freshness SLA Enforcement**:
   - The `SEO_COVERAGE_SOURCE_MAX_DAYS` environment variable can be unset or set to standard (3 days) without throwing freshness SLA failures.
3. **Historical Error Drop**:
   - GSC reported indexable error counts fall below 10% of their historical baseline (demonstrating that our 410 and 301 rules are actively processing crawler-traffic).
4. **De-indexing of Colon Traps**:
   - Invalid URLs containing colons or non-canonical trailing-slash segments are verified as successfully de-indexed/redirected.

## Verification Checklist

- [ ] GSC export directory situated in `data/coverage-drilldown-raw/`
- [ ] Freshness override cleared in environment
- [ ] Ingestion script `npm run report:seo:coverage-drilldown` runs and outputs JSON/MD reports with 0 execution failures
- [ ] Error counts validated as substantially recovered
