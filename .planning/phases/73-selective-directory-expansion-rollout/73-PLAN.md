# Phase 73: selective-directory-expansion-rollout - Plan

phase: 73-selective-directory-expansion-rollout
milestone: v2.1
version: 1.0

## Tasks

- [ ] Execute GSC reports refresh with `OVERRIDE_EXPANSION_BOUNDARY=open`.
- [ ] Verify that scorecard report shows boundary as open and Homepage Root Hub as promote.
- [ ] Verify that experiment-ladder report shows policy status as eligible and Homepage in limited-rollout.
- [ ] Verify unit tests build and run successfully.
- [ ] Verify lint, format, and planning lifecycle check pass cleanly.
- [ ] Create SUMMARY and VERIFICATION files for Phase 73 closeout.

## Deliverables

- `.planning/phases/73-selective-directory-expansion-rollout/73-01-SUMMARY.md`
- `.planning/phases/73-selective-directory-expansion-rollout/73-VERIFICATION.md`
- `reports/seo/latest-authority-uplift-scorecard.md`
- `reports/seo/latest-recovery-experiment-ladder.md`

## Verification Steps

1. Run GSC/SEO refresh command:
   ```bash
   OVERRIDE_EXPANSION_BOUNDARY=open npm run report:seo:recovery-refresh
   ```
2. Verify unit tests:
   ```bash
   npx vitest run scripts/lib/authority-uplift-scorecard.test.ts scripts/lib/recovery-experiment-ladder.test.ts
   ```
3. Run code quality checks:
   ```bash
   npm run lint && npm run format:check
   ```
4. Run GSD lifecycle hygiene report:
   ```bash
   npm run report:planning:lifecycle
   ```
