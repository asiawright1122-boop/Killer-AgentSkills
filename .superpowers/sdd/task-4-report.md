## What I implemented

- Updated [src/components/SkillCard.astro](/Users/kaka/Dev/Killer-Skills/.worktrees/trusted-marketplace-policy/src/components/SkillCard.astro) to import and use `buildMarketplaceCardTrust(skill, { locale })` for trust badge rendering.
- Removed the card-local duplicate trust/source/risk badge derivation (`securityLevel`, `sourceKindLabel`, `reviewedLabel`, `riskLabels`, `riskEvidence`, and rank-score title composition).
- Preserved the existing score data attributes by keeping `data-rank-score` and `data-quality-score` sourced from the raw skill values.
- Set the trust-chip `title` from `cardTrust.title`.
- Added the zh regression test in [src/lib/marketplace-policy.test.ts](/Users/kaka/Dev/Killer-Skills/.worktrees/trusted-marketplace-policy/src/lib/marketplace-policy.test.ts) to assert `buildMarketplaceCardTrust()` emits `官方`, `已审查`, and `写文件`, and does not expose scoring internals in the title.

## What I tested and exact results

- `npx vitest run src/lib/marketplace-policy.test.ts -t "zh card badges"`
  - Result: passed
  - Output summary: `1 passed | 26 skipped`
- `npm run check:astro`
  - Result: failed with pre-existing errors outside this task's allowed edit scope
  - Exact blocking errors:
    - `src/components/SearchBarNative.astro:153:27 - error ts(18046): 'data' is of type 'unknown'.`
    - `src/components/SubmitSkillModalNative.astro:280:27 - error ts(18046): 'data' is of type 'unknown'.`
  - Final summary: `Result (294 files): - 2 errors - 0 warnings - 13 hints`

## Files changed

- [src/components/SkillCard.astro](/Users/kaka/Dev/Killer-Skills/.worktrees/trusted-marketplace-policy/src/components/SkillCard.astro)
- [src/lib/marketplace-policy.test.ts](/Users/kaka/Dev/Killer-Skills/.worktrees/trusted-marketplace-policy/src/lib/marketplace-policy.test.ts)
- [.superpowers/sdd/task-4-report.md](/Users/kaka/Dev/Killer-Skills/.worktrees/trusted-marketplace-policy/.superpowers/sdd/task-4-report.md)

## Self-review findings, if any

- The card now consumes a single policy-owned badge source of truth, which removes duplicated source/risk/review logic from the component.
- I removed one unused frontmatter local introduced by the refactor cleanup path.
- No issues found in the scoped code changes themselves.

## Any issues or concerns

- `npm run check:astro` does not exit cleanly in the current branch because of unrelated type errors in `SearchBarNative.astro` and `SubmitSkillModalNative.astro`, which are outside this task's permitted write scope.
