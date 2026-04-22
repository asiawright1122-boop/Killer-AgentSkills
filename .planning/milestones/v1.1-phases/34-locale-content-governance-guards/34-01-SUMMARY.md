---
phase: 34-locale-content-governance-guards
plan: 01
status: completed
updated: 2026-04-06
requirements_completed:
  - GOV-01
  - GOV-02
  - GOV-03
---

# Plan 34-01 Summary: Locale and Content Governance Lane

## Outcome

- Added reusable collection-governance helpers:
  - `scripts/lib/seo-collection-locale-gaps.ts`
  - `scripts/lib/seo-collection-drift.ts`
- Added the shared governance report contract in `scripts/lib/content-governance.ts`.
- Added the operator wrapper `scripts/content-governance-report.ts`.
- Added the new npm command `npm run report:content:governance`.
- Refactored `scripts/seo-collection-locale-gaps.ts` and `scripts/seo-collection-drift.ts` to reuse the extracted libraries instead of carrying their own embedded implementations.
- The new governance command now aggregates:
  - collection locale coverage
  - collection metadata / canonical drift
  - representative localized public-route contract suites for translation, breadcrumb, metadata, and tutorial-shell drift
- The governance lane emits:
  - `reports/seo/latest-content-governance.md`
  - `reports/seo/latest-content-governance.json`
- Added regression coverage for governance severity derivation and threshold gating.

## Requirement Coverage

- `GOV-01`
  - Satisfied by the canonical command `npm run report:content:governance`, which surfaces locale/content drift in one place before it becomes a larger repair queue.
- `GOV-02`
  - Satisfied by making representative localized public-route contracts part of the governance lane via targeted Vitest suites:
    - `src/pages/public-links.test.ts`
    - `src/messages/public-copy.test.ts`
    - `src/lib/markdown-headings.test.ts`
    - `src/lib/site/breadcrumbs.test.ts`
    - `src/lib/site/metadata.test.ts`
- `GOV-03`
  - Satisfied by explicit `clear / warning / blocking` semantics in the JSON + Markdown report contract, with threshold-based gate behavior mirroring other operator lanes.

## Verification

- `npx vitest run scripts/lib/content-governance.test.ts src/pages/public-links.test.ts src/messages/public-copy.test.ts src/lib/markdown-headings.test.ts src/lib/site/breadcrumbs.test.ts src/lib/site/metadata.test.ts`
  - Passed (`55` tests).
- `npm run report:content:governance`
  - Passed.
  - Current baseline is `clear`.
  - Collection locale gaps: `0`
  - Collection drift issues: `0`
  - Representative route/content contract suites: passed (`50` tests)
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
  - Passed.

## Files Changed

- `package.json`
- `scripts/lib/seo-collection-locale-gaps.ts`
- `scripts/lib/seo-collection-drift.ts`
- `scripts/lib/content-governance.ts`
- `scripts/lib/content-governance.test.ts`
- `scripts/content-governance-report.ts`
- `scripts/seo-collection-locale-gaps.ts`
- `scripts/seo-collection-drift.ts`
- `reports/seo/latest-content-governance.md`
- `reports/seo/latest-content-governance.json`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-CONTEXT.md`
- `.planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-PLAN.md`
- `.planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-01-SUMMARY.md`
- `.planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-VERIFICATION.md`

## Residual Risks

- The governance lane is local/operator-ready, but it is not yet wired into CI or scheduled monitoring.
- Live production smoke and broader crawl-health remain adjacent signals rather than direct subchecks inside the new governance report.

## Conclusion

Phase 34 objective is complete: locale/content drift is now surfaced through one operator-facing governance lane with explicit threshold semantics and machine-readable outputs.
