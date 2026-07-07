# Task 2 Report: Listing Routes And Review Policy Guardrails

## Status
Done.

## What I changed
- Added a source-level regression test in `tests/pages/public-links.test.ts` to lock the marketplace browse routes to the shared admission and ranking contracts.
- Added a source-level regression test in `tests/pages/public-links.test.ts` to keep the Review Policy page framed as admission evidence instead of generic safety guidance.
- Updated `src/pages/[locale]/occupations/[slug].astro` to pass `getMarketplaceSkills(skillsFetched)` into `buildOccupationDetail(...)`, making the admission gate explicit at the route boundary.

## Verification
- Ran: `npx vitest run tests/pages/public-links.test.ts src/lib/marketplace-filters.test.ts --reporter=verbose`
- Result: passed

## Notes
- The review-policy copy already matched the brief, so no content rewrite was needed there.
- No unrelated changes were reverted.

---

# Task 2 Report: Replace Marketplace Filters With A Policy Facade

## Status
Done.

## What I changed
- Replaced `src/lib/marketplace-filters.ts` with a compatibility facade that re-exports the Task 1 policy admission, ranking, and source-kind helpers under the existing marketplace-filter names.
- Updated `src/lib/marketplace-filters.test.ts` so its default helper builds publicly admitted skills and added a regression that proves explicit `T3` and blocker-risk skills are excluded through the compatibility facade.
- Updated `src/lib/occupations.test.ts` fixtures so public-facing test skills include the reviewed metadata expected by the new baseline policy defaults.

## Verification
- Ran: `npx vitest run src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts`
- Result: passed
- Ran: `npx vitest run src/lib/marketplace-policy.test.ts src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts`
- Result: passed

## Notes
- Existing marketplace-filter import names and route URLs remain unchanged; only the underlying implementation now delegates to `src/lib/marketplace-policy.ts`.
- No unrelated files were modified or reverted.
