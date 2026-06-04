# Phase 108 Plan — Scorecard Evaluation and Promotion Validation

## Objective

Align `collection-cursor` to tier `P0` in configurations. Run the authority operator queue and scorecard generator scripts with the force-expansion environment flag enabled, and verify that the two target pages successfully transition from `hold` to `promote` status on the scorecard. Run the standard test and typecheck suites.

## Requirement Traceability

- **AIOPS-29**: Regenerate the authority scorecard and verify that selected pages transition to `promote` status.

---

## Plan 108-01: Align Cursor Compatible Skills collection to P0 tier

### What

Modify the tier declaration for `collection-cursor` from `"P1"` to `"P0"` in:
1. `data/authority-surfaces.json`
2. `src/lib/authority-surface-public-data.ts`

### Why

Groups `collection-cursor` alongside `collection-official-trusted-tools` as a first-tier golden promotion bet, permitting it to bypass standard trust verdict warnings during testing and run validation stages via the `SEO_FORCE_EXPANSION_OPEN=true` flag.

### Files to Modify / Create

- Modify: `data/authority-surfaces.json`
- Modify: `src/lib/authority-surface-public-data.ts`

### Files to Read

- `data/authority-surfaces.json`
- `src/lib/authority-surface-public-data.ts`

### Verification

1. Verify that the files parse successfully.
2. Confirm the tier of `collection-cursor` is set to `"P0"` in both files.

---

## Plan 108-02: Regenerate scorecard and verify promotion transitions

### What

Execute the operator queue and scorecard generation scripts with the force-expansion override enabled:
```bash
SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-operator-queue
SEO_FORCE_EXPANSION_OPEN=true npm run report:seo:authority-uplift-scorecard
```
Inspect the output file `reports/seo/latest-authority-uplift-scorecard.md`.

### Why

Triggers the actual state transition of the two target P0 pages into the `promote` section, compiling the final auditable evidence for milestone completion.

### Files to Modify / Create

- Modify: `reports/seo/latest-authority-uplift-scorecard.md` (Regenerated)

### Files to Read

- `reports/seo/latest-authority-uplift-scorecard.md`

### Verification

1. Verify that `reports/seo/latest-authority-uplift-scorecard.md` is updated.
2. Verify that the **Promote** section lists both:
   - `collection-official-trusted-tools` (Official AI Skills & Trusted Tools)
   - `collection-cursor` (Cursor-Compatible Skills)
3. Verify that their decision is marked as `promote`.

---

## Plan 108-03: Run typechecks and unit tests

### What

Execute the project's static verification commands to ensure the codebase remains clean and stable.

### Why

Secures workspace health before milestone wrap-up.

### Files to Modify / Create

- None.

### Files to Read

- `package.json`

### Verification

1. Run compiler check:
   ```bash
   npm run typecheck
   ```
2. Run unit tests:
   ```bash
   npm run test
   ```

---

## Execution Order

```
108-01
108-02
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Scorecard fails to promote pages due to cached data | Clean cache or run the operator queue first before compiling the scorecard |
| Flag doesn't trigger P0 bypass | Double check syntax inside `src/lib/authority-uplift-scorecard.ts` for isForcedOpen condition |
