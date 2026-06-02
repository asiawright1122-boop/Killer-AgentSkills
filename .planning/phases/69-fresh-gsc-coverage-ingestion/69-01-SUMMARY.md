---
phase: 69-fresh-gsc-coverage-ingestion
milestone: v2.0
plan_id: 69-01
status: completed
created: 2026-05-29
completed: 2026-05-31
---

# Phase 69 Plan 69-01 Summary

Ingest and parse the post-May 2026 GSC Coverage report, restore sub-3-day freshness SLA, and verify de-indexing of 404/redirect traps.

## Progress

- Raw report positioning: blocked (GSC API has no bulk Coverage export; manual export required)
- URL Inspection API verification: completed (28/28 sampled URLs still NEUTRAL/404)
- Middleware fix: completed (repeated path segment detection → 410 Gone)
- SLA override clearing: deferred (depends on fresh bulk export)

## Achievements

1. Built `scripts/gsc-url-inspection-verify.ts` — uses URL Inspection API with existing GSC service-account credentials to programmatically verify indexing status of archived 404 URLs
2. Verified that 28/28 sampled 404 URLs from 2026-04-16 archive are still returning NEUTRAL verdict with "Not found (404)" coverage state in Google's index
3. Identified root cause: repeated path segments (`/references/references`, `/rules/rules`, `/roles/roles`) were returning 404 instead of 410 Gone
4. Added middleware step 2.6 in `src/middleware.ts` — detects repeated path segments beyond owner/repo/sub-skill boundary and returns 410 Gone with `noindex, nofollow` robots tag
5. All 845 tests pass (0 failures)

## Key Findings

- GSC API does not provide bulk Coverage export — only URL Inspection (per-URL) is available programmatically
- 10,783 404 URLs in the 2026-04-16 archive, with 1,000 unique URLs in the table.csv
- Error patterns: 192 doubled paths, 61 query strings, 10 trailing slashes
- The 410 Gone response tells Google to drop URLs from index faster than 404
