Status: DONE_WITH_CONCERNS

Commits created (short SHA + subject)
- `54940bf test: add marketplace browser audit`

One-line test summary including pass/skip/fail counts
- `PLAYWRIGHT_PORT=4322 npx playwright test tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts --project=chromium` -> 10 passed, 0 skipped, 0 failed

Concerns, if any
- The final Playwright run passed, but local dev still logs repeated D1 `no such table: skills` errors while skill detail pages fall back; this did not fail the audit assertions, but the runtime noise is still present.

## Review Fix Follow-up

- Added stable Playwright hooks in `src/components/HeaderActionsNative.astro` for the desktop locale toggle, desktop locale options, and mobile locale options while preserving the existing runtime classes used by the component script.
- Replaced brittle class-based locale switching interactions in `tests/e2e/navigation.spec.ts` with `getByTestId(...)` selectors.
- Expanded `tests/e2e/marketplace-ui.spec.ts` so the Popular vs Latest audit checks visible `skill-card-link` ordering at the browser layer and skips with explicit reasons when local data is too small or legitimately identical.
- Broadened the clean-public-copy audit regex to catch internal strategy, recovery, rollout, and implementation-rationale phrasing without matching generic marketplace copy.

Verification
- `PLAYWRIGHT_PORT=4322 npx playwright test tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts --project=chromium`
- Result: 11 passed, 0 skipped, 0 failed.

Report file path
- `/Users/kaka/Dev/Killer-Skills/.superpowers/sdd/task-4-report.md`
