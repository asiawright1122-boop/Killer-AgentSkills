# Phase 74: limited-rollout-evidence-and-promotion - Plan

phase: 74-limited-rollout-evidence-and-promotion
milestone: v2.2
version: 1.0

## Tasks

- [ ] Modify `scripts/lib/recovery-experiment-ladder.ts` to support P0 automation candidacy under operator override.
- [ ] Execute GSC reports refresh with `OVERRIDE_EXPANSION_BOUNDARY=open`.
- [ ] Verify that experiment-ladder report shows Homepage Root Hub in `automation-candidate` status.
- [ ] Verify unit tests and quality checks build successfully.
- [ ] Create SUMMARY and VERIFICATION files for Phase 74 closeout.

## Deliverables

- `.planning/phases/74-limited-rollout-evidence-and-promotion/74-01-SUMMARY.md`
- `.planning/phases/74-limited-rollout-evidence-and-promotion/74-VERIFICATION.md`
- `reports/seo/latest-recovery-experiment-ladder.md`

## Verification Steps

1. Run GSC/SEO refresh command:
   ```bash
   OVERRIDE_EXPANSION_BOUNDARY=open npm run report:seo:recovery-refresh
   ```
2. Verify unit tests:
   ```bash
   npx vitest run scripts/lib/recovery-experiment-ladder.test.ts
   ```
3. Run code quality checks:
   ```bash
   npm run lint && npm run format:check
   ```
