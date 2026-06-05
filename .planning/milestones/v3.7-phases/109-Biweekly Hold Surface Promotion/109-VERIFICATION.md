---
phase: 109-biweekly-hold-surface-promotion
requirements_completed:
  - AIOPS-30
---

# Verification: Phase 109 (Biweekly Hold Surface Promotion)

## Verification Steps
- Check that the upgraded guides contain the expected links and code snippets.
- Verify configuration alignment for target guides in `data/authority-surfaces.json` and `src/lib/authority-surface-public-data.ts`.
- Run authority scorecard regeneration with the override flag:
  ```bash
  SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-uplift-scorecard
  ```
- Run compiler checks and test suites:
  ```bash
  npm run typecheck
  npm run test
  ```

## Expected Outcomes
- Both guides (`official-ai-agent-skills-guide.md` and `claude-code-vs-cursor-vs-windsurf.md` in both languages) feature active first-party links and configuration syntax examples.
- The tier configuration matches `P0` for both guides in JSON and TS configurations.
- `reports/seo/latest-authority-uplift-scorecard.md` shows both guides under the `Promote` section with a `promote` decision.
- All typechecks run clean.
- All 935 unit tests pass.
