---
phase: 108-scorecard-evaluation-and-promotion-validation
requirements_completed:
  - AIOPS-29
---

# Verification: Phase 108 (Scorecard Evaluation and Promotion Validation)

## Verification Steps
- Modify tier configuration for `collection-cursor` to `"P0"` in:
  - `data/authority-surfaces.json`
  - `src/lib/authority-surface-public-data.ts`
- Run the operator queue and scorecard generation scripts with the force-expansion flag enabled:
  - `SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-operator-queue`
  - `SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-uplift-scorecard`
- Inspect `reports/seo/latest-authority-uplift-scorecard.md` to verify the decisions.
- Run project validation commands:
  - `npm run typecheck`
  - `npm run test`

## Expected Outcomes
- The configuration files are successfully updated and aligned to `"P0"` for the Cursor collection.
- Both target P0 pages (`Official AI Skills & Trusted Tools` and `Cursor-Compatible Skills`) successfully transition from `hold` to `promote` status in the generated scorecard.
- The Discovery Expansion Boundary is verified as open.
- `npm run typecheck` reports 0 errors.
- `npm run test` reports all 935 tests passed.
