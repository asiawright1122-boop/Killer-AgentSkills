---
phase: 64-search-guidelines-compliance-baseline-and-fresh-coverage
milestone: v1.9
requirements:
  - SEO-15
  - REC-26
status: active
created: 2026-05-06
---

# Phase 64 Context: Search Guidelines Compliance Baseline and Fresh Coverage

## Goal

Establish the official search-guideline compliance baseline and refresh Coverage Drilldown evidence before executing recovery claims.

## Current Truth

- Production crawl exposure is technically clear: `6` sitemap files, `1546` discovered URLs, `721` sampled checks, `721` `2xx`, and `0` sitemap fetch errors.
- The latest GSC CTR report is live-api backed for `2026-04-08` to `2026-05-05`, with `26` query rows and `507` page rows.
- The latest proof window remains `blocking`: technical crawl is clear, but business recovery remains blocked.
- The freshest local Coverage Drilldown raw export is still `2026-04-16`. After rerunning the ingest/report lane on `2026-05-06`, the report now shows `20` day(s) old, outside the hard `7` day freshness SLA.
- Local Downloads currently contains only:
  - `/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-03`
  - `/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-03.zip`
  - `/Users/kaka/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-16`

## Official Guidance Baseline

The v1.9 research note maps recovery work to official search-engine guidance:

- `.planning/research/v1.9-search-guidelines.md`

The Phase 64 implementation should keep using these source categories:

- Google crawl/index/search essentials
- Google people-first/helpful content and snippet guidance
- Google canonicalization and redirects
- Bing Webmaster Guidelines
- IndexNow and Yandex IndexNow submission semantics

## New Evidence Produced So Far

- `scripts/lib/search-compliance-matrix.ts`
- `scripts/lib/search-compliance-matrix.test.ts`
- `scripts/seo-search-compliance-matrix.ts`
- `reports/seo/latest-search-compliance-matrix.md`
- `reports/seo/latest-search-compliance-matrix.json`

Current matrix verdict:

- Overall: `block`
- pass: `2`
- watch: `2`
- block: `3`
- unavailable: `1`

Blocking lanes:

- `coverage-freshness-before-claims`
- `canonical-redirect-signal-consistency`
- `proof-before-expansion`

## Decision Boundary

Phase 64 must not be closed until `REC-26` is honestly satisfied or explicitly re-scoped by milestone decision.

`SEO-15` is implemented by the search compliance matrix, but `REC-26` remains blocked because no fresh Coverage Drilldown export is available inside the hard freshness SLA.

## Next Required Input

Export a fresh Coverage Drilldown package from Google Search Console for `killer-skills.com`, place it in `/Users/kaka/Downloads`, then rerun:

```bash
npm run report:seo:coverage-drilldown
npm run report:seo:search-compliance-matrix
```

Only after the Coverage report is inside the hard freshness SLA should Phase 65 execute P0 URL recovery batches against fresh cluster evidence.
