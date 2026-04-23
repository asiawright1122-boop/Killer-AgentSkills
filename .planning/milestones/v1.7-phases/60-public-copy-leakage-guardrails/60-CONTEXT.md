# Phase 60: public-copy-leakage-guardrails - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** Completed Phase `59`, residual public wording still visible in the solutions hub and shared locale files, and the need to move from selected-file regression to reusable guardrails

<domain>
## Phase Boundary

This phase turns the Phase `59` normalization into a reusable prevention layer.

This phase covers:

- eliminating remaining public-facing strategy/process wording still present in shared locale catalogs or public hub templates
- creating reusable phrase-family guardrails that scan public entry surfaces and shared public content sources by directory/scope rather than a hand-picked small file list
- documenting the new detection scope and verification evidence in GSD artifacts

This phase does not cover:

- rewriting unrelated public content that is outside the trust-surface boundary problem
- auditing internal planning or operator-only assets under `.planning/` or tooling scripts
- solving generic style consistency issues that are unrelated to public/internal copy leakage
</domain>

<decisions>
## Implementation Decisions

- **D-01:** Guardrails should target public trust surfaces only: user-facing pages, shared public collections, public authority-surface data, and shipped locale messages used by those surfaces.
- **D-02:** Phase `60` should replace representative-file assertions with directory- or scope-based scans where feasible, so new files in the same public surface area inherit the protection automatically.
- **D-03:** Phrase families should be stored centrally in the test so future updates add or remove one source of truth rather than duplicating lists across assertions.
- **D-04:** If the wider scan exposes remaining public-facing leaks, fix the source before locking the guardrail so the new test can pass cleanly.
</decisions>

<specifics>
## Specific Ideas

- Normalize residual wording in `src/pages/[locale]/solutions/index.astro` and shared locale message catalogs where `high-intent`, `handoffs`, or similar process framing still appears.
- Add reusable scan targets for:
  - `src/pages/[locale]/collections/`
  - `src/pages/[locale]/solutions/`
  - `src/pages/[locale]/docs/`
  - `src/pages/[locale]/skills/`
  - selected public message catalogs under `src/messages/`
  - shared public data under `src/lib/authority-surface-public-data.ts`
  - shipped collection JSON under `src/content/collections/`
- Keep the guardrail phrase list focused on known public/internal boundary leakage rather than generic product vocabulary.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/59-user-facing-entry-surface-normalization/59-01-SUMMARY.md`
- `.planning/phases/59-user-facing-entry-surface-normalization/59-VERIFICATION.md`
- `src/pages/[locale]/solutions/index.astro`
- `src/messages/`
- `src/content/collections/`
- `src/lib/authority-surface-public-data.ts`
- `tests/pages/public-links.test.ts`
</canonical_refs>

<deferred>
## Deferred Ideas

- If future phases need lint-like copy governance across every public content class, that should build on the phrase-family and scope model established here rather than expanding this phase ad hoc.
</deferred>

---

_Phase: 60-public-copy-leakage-guardrails_
_Context gathered: 2026-04-23_
