---
phase: 64-search-guidelines-compliance-baseline-and-fresh-coverage
milestone: v1.9
plan: 64-01
requirements:
  - SEO-15
  - REC-26
status: blocked_on_fresh_coverage_export
created: 2026-05-06
files:
  - '.planning/phases/64-search-guidelines-compliance-baseline-and-fresh-coverage/64-CONTEXT.md'
  - '.planning/phases/64-search-guidelines-compliance-baseline-and-fresh-coverage/64-PLAN.md'
  - '.planning/research/v1.9-search-guidelines.md'
  - 'scripts/lib/search-compliance-matrix.ts'
  - 'scripts/lib/search-compliance-matrix.test.ts'
  - 'scripts/seo-search-compliance-matrix.ts'
  - 'reports/seo/latest-search-compliance-matrix.md'
  - 'reports/seo/latest-search-compliance-matrix.json'
  - 'reports/seo/latest-coverage-drilldown.md'
  - 'reports/seo/latest-coverage-drilldown.json'
---

# Phase 64 Plan 01: Search Compliance Matrix and Fresh Coverage Gate

## Objective

Create a durable search compliance matrix from official guidance and current project evidence, then refresh Coverage Drilldown evidence before recovery execution continues.

## Tasks

1. Build the search compliance matrix report lane.
   - Add a reusable report builder under `scripts/lib/`.
   - Add a CLI script that writes Markdown and JSON artifacts.
   - Map official guidance to project evidence categories: crawl/index, Coverage freshness, canonical/redirect consistency, people-first copy, CTR/search appearance, structured data, AI-search/IndexNow evidence, and proof-before-expansion.
   - Expected output: `reports/seo/latest-search-compliance-matrix.{md,json}`.

2. Verify the compliance matrix against current evidence.
   - Confirm production crawl exposure can pass while recovery still blocks.
   - Confirm stale Coverage creates a blocking verdict.
   - Confirm AI-search evidence can be `unavailable` without inventing proof.
   - Expected output: passing `scripts/lib/search-compliance-matrix.test.ts`.

3. Refresh Coverage Drilldown input evidence.
   - Run the ingest/report lane.
   - If a fresh export exists in Downloads, import it and regenerate reports.
   - If no fresh export exists, record the exact blocking state and do not close `REC-26`.

4. Re-run the compliance matrix after Coverage ingest.
   - Expected current result: `block`, because the latest local export is still `2026-04-16`.
   - Phase 65 remains blocked until Coverage freshness is inside the hard SLA.

## Acceptance Criteria

- `SEO-15` has a repo-local, machine-readable compliance matrix with official source links and project-specific evidence.
- `REC-26` is either satisfied by a fresh imported Coverage Drilldown export or remains explicitly blocked with evidence.
- The report never claims organic recovery while proof is `blocking`.
- The next action is unambiguous: import fresh Coverage, then rerun Coverage and compliance reports.

## Verification Commands

```bash
npx vitest run scripts/lib/search-compliance-matrix.test.ts
npm run report:seo:coverage-drilldown
npm run report:seo:search-compliance-matrix
npm run report:planning:traceability
npm run format:check
```

## Current Status

Partial implementation exists:

- `SEO-15`: implemented.
- `REC-26`: blocked because no fresh Coverage Drilldown export exists in Downloads or the repository archive.

Do not create `64-01-SUMMARY.md` or `64-VERIFICATION.md` until the fresh Coverage export gate is satisfied or the milestone explicitly accepts the blocked state as the phase outcome.
