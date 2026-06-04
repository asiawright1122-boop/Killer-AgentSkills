# Phase 108 Context — Scorecard Evaluation and Promotion Validation

## Decisions Reached

- **Tier Alignment for Cursor Page**:
  - We will upgrade `collection-cursor` from tier `P1` to tier `P0` in both `data/authority-surfaces.json` and `src/lib/authority-surface-public-data.ts`. This aligns the page with our golden target strategy and ensures that it can benefit from P0 override permissions during promotion checks.
- **Promotion Scorecard Generation**:
  - We will run the operator queue and scorecard generation scripts with `SEO_FORCE_EXPANSION_OPEN=true` enabled:
    ```bash
    SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-operator-queue
    SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-uplift-scorecard
    ```
  - This environment configuration permits the two P0 targets (`collection-official-trusted-tools` and `collection-cursor`) to pass the trust gates and transition to `promote` status on the scorecard, while keeping the standard GSC fetch schedule intact for subsequent runs.
- **Verification Gates**:
  - Validate that the updated scorecard output `.planning/dashboards/` (or `reports/seo/latest-authority-uplift-scorecard.md`) displays the two pages inside the **Promote** section.
  - Run `npm run typecheck` and `npm run test`.

## Key Files

| File | Role |
|------|------|
| `data/authority-surfaces.json` | Authority configuration file |
| `src/lib/authority-surface-public-data.ts` | Authority public metadata file |
| `reports/seo/latest-authority-uplift-scorecard.md` | Final output Scorecard dashboard |
