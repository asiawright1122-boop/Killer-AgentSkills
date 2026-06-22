---
phase: 116
plan: 116-01
type: execute
wave: 1
depends_on:
  - 115
files_modified:
  - scripts/lib/collection-locale-punctuation.ts
  - scripts/verify-collection-cjk-punctuation.ts
  - scripts/lib/collection-locale-punctuation.test.ts
  - package.json
  - src/content/collections/*.json
autonomous: true
must_haves:
  artifacts:
    - path: scripts/verify-collection-cjk-punctuation.ts
      min_lines: 5
  key_links: []
---

# Phase 116 Plan — Translation Parity & Punctuation Guardrails

## Objective

Add a collection-specific guard that enforces full locale parity and ending punctuation for public collection metadata, then repair existing collection JSON gaps so the guard passes.

## Requirement Traceability

- **AIOPS-37**: Enforce strict CJK parity and ending punctuation validation checks.

## Tasks

1. Add reusable validation logic under `scripts/lib/collection-locale-punctuation.ts`.
2. Add CLI entrypoint `scripts/verify-collection-cjk-punctuation.ts`.
3. Add unit tests for missing locale, missing punctuation, keyword locale gaps, and intentionally en/zh-scoped nested editorial examples.
4. Backfill missing collection locales for `keywords`, `editorial.reviewSummary`, and `editorial.selectionReason`.
5. Wire `guard:collection-cjk-punctuation` into `validate:public-surface`.
6. Run typecheck, full tests, public-surface validation, public-output guards, and diff checks.
