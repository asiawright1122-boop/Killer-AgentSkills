# Phase 116: Translation Parity & Punctuation Guardrails - Context

**Gathered:** 2026-06-09
**Status:** Complete

<domain>
## Phase Boundary

Enforce collection-level locale parity and terminal punctuation for public collection metadata that should ship in all supported locales.
</domain>

<decisions>
## Implementation Decisions

### Guard Scope

- **D-01:** Enforce full locale coverage for top-level collection metadata fields: `title`, `description`, `seoTitle`, `seoDescription`, `longDescription`, and `keywords`.
- **D-02:** Enforce full locale coverage for enriched editorial fields when present: `editorial.reviewSummary` and `editorial.selectionReason`.
- **D-03:** Do not force full locale coverage for nested execution examples, decision tracks, next steps, grouping logic, trust signals, or maintenance notes yet; those remain intentionally en/zh-scoped until separately expanded.

### Punctuation Scope

- **D-04:** Enforce terminal punctuation on description-like string fields: `description`, `seoDescription`, `longDescription`, `editorial.reviewSummary`, and `editorial.selectionReason`.

### CI Wiring

- **D-05:** Add `guard:collection-cjk-punctuation` and run it inside `validate:public-surface` so public collection regressions fail before deployment.
  </decisions>

<canonical_refs>

## Canonical References

- `scripts/lib/collection-locale-punctuation.ts`
- `scripts/verify-collection-cjk-punctuation.ts`
- `scripts/lib/collection-locale-punctuation.test.ts`
- `src/content/collections/*.json`
  </canonical_refs>
