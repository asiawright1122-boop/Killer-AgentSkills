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
