# Phase 75: automated-directory-expansion-and-index-rollout - Plan

phase: 75-automated-directory-expansion-and-index-rollout
milestone: v2.2
version: 1.0

## Tasks

- [ ] Modify `src/middleware.ts` to allow crawler access to known repo directory pages when `OVERRIDE_EXPANSION_BOUNDARY=open` is active.
- [ ] Modify `src/pages/[locale]/skills/[owner]/[...repo].astro` to set `layoutNoindex = false` for repo directory pages when `OVERRIDE_EXPANSION_BOUNDARY=open` is active.
- [ ] Add tests in `src/middleware.skill-route.test.ts` to verify crawler access behavior under operator override.
- [ ] Run quality gates: unit tests (`npm test`), lint (`npm run lint`), format (`npm run format:check`).
- [ ] Generate closeout deliverables: `75-01-SUMMARY.md` and `75-VERIFICATION.md` with YAML frontmatter.
- [ ] Update `ROADMAP.md` and `STATE.md` to complete Phase 75 and close Milestone v2.2.
- [ ] Run `report:planning:milestones` to verify clean closeout state.

## Deliverables

- `.planning/phases/75-automated-directory-expansion-and-index-rollout/75-01-SUMMARY.md`
- `.planning/phases/75-automated-directory-expansion-and-index-rollout/75-VERIFICATION.md`

## Verification Steps

1. Run vitest middleware tests:
   ```bash
   npx vitest run src/middleware.skill-route.test.ts
   ```
2. Verify sitemap and indexability reports:
   ```bash
   OVERRIDE_EXPANSION_BOUNDARY=open npm run report:seo:recovery-refresh
   ```
3. Run linting and formatting:
   ```bash
   npm run lint && npm run format:check
   ```
