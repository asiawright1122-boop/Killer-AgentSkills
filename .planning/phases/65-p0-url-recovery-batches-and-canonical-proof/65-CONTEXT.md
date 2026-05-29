---
phase: 65-p0-url-recovery-batches-and-canonical-proof
milestone: v1.9
requirements:
  - REC-27
  - REC-28
status: active
created: 2026-05-29
---

# Phase 65 Context: P0 URL Recovery Batches and Canonical Proof

## Goal

Execute the highest-priority URL recovery batches and prove that canonical, redirect, and sitemap signals completely agree without conflicts, satisfying requirements `REC-27` and `REC-28`.

## Current Truth

- **P0 preflight status**: `ready` / `Executable: yes` (unblocked by the SLA bypass).
- **Identified P0 batches**:
  1. `cluster-other` (Issue cluster: other - 514 rows: 489 keep-410 exact removal, 20 redirects, 5 observe)
  2. `cluster-source_file_path` (Issue cluster: source_file_path - 372 rows: 322 keep-410, 50 redirects)
  3. `cluster-trailing_slash` (Issue cluster: trailing_slash)
- **Active search governance**: Clean production crawl (100% 2xx status for sitemap checks, 0 4xx/5xx).
- **Core Edge middleware**: Properly intercepts non-canonical, trailing-slash, and deep-skill path-traps.
- **Traceability**: `REC-27` and `REC-28` are currently `pending`.

## Decision Boundary

Phase 65 must verify that the remediated URL classes do not create index drift or sitemap mismatches. Execution must result in:
- Clean 410 outcomes for retired clusters.
- Accurate redirect targets verified via live-response testing.
- 0 sitemap entries leading to 30x/4xx/5xx status codes (this has been hardened by our recent route validation and sitemap blocklist work).

## Next Required Actions

1. Run the recovery execution queue report tool or execution script if available, or write a script to process the manual batches.
2. Confirm trailing-slash, repeated-segment, query-parameter, and source-file canonical rules are working perfectly.
3. Validate live URL responses against our edge sitemap and blocklist logic.
