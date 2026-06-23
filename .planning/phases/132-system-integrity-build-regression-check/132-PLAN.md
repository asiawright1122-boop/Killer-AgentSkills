---
phase: 132
plan: 132-01
type: execute
wave: 1
depends_on:
  - 131
files_modified: []
autonomous: true
---

# Phase 132 Plan — System Integrity Build & Regression Check

## Objective

Run a comprehensive system verification to ensure the codebase remains fully functional, compile-warning-free, type-stable, and passes all unit and integration tests with zero regressions after the workspace size optimization (Phase 130) and Hindi locale pruning (Phase 131).

*Note: While the Roadmap and Requirements reference 158 integration tests, the actual full Vitest test suite runs 1027 tests (1027 passed, 1 skipped). The plan verifies that the complete suite of 1027 tests is run to ensure zero regressions, covering the 158+ integration checks.*

## Requirement Traceability

- **INTEGRATE-01**: Verify type stability, rerun Edge Astro build, and ensure zero regressions across all 1027 tests.


***

## Tasks

### Task 1: Run TypeScript Type Check

<read_first>
- Reference: `package.json` (specifically the `typecheck` script definition)
- Reference: `tsconfig.json`
</read_first>

<acceptance_criteria>
- Running `npm run typecheck` exits with code 0.
- No TypeScript compilation or linting/type errors are reported in any of the workspaces.
</acceptance_criteria>

<action>
Execute the TypeScript typecheck script in the workspace root:
```bash
npm run typecheck
```
Verify the output indicates successful compilation with no errors.
</action>

***

### Task 2: Run Vitest Unit & Integration Test Suites

<read_first>
- Reference: `package.json` (specifically the `test` script definition)
- Reference: `vitest.config.ts` (if exists, or vitest configuration in workspace)
</read_first>

<acceptance_criteria>
- Running `npm test` exits with code 0.
- All 1027 tests (representing the full Vitest suite that covers the 158+ integration checks defined in Roadmap/Requirements) are executed and pass cleanly with zero failures (1027 passed, 1 skipped is acceptable if the skipped test is verified).
</acceptance_criteria>

<action>
Execute the test suites in the workspace root:
```bash
npm test
```
Verify that the output reports that all 1027 tests passed successfully (or 1027 passed, 1 skipped) and there are zero regressions.
</action>

***

### Task 3: Run Static Validation, Public Surface Checks, and Astro Production Build

<read_first>
- Reference: `package.json` (specifically the `build`, `lint`, `format:check`, and `validate:public-surface` script definitions)
- Reference: `astro.config.mjs`
</read_first>

<acceptance_criteria>
- Running `npm run lint` exits with code 0 (no lint errors).
- Running `npm run format:check` exits with code 0 (no formatting errors).
- Running `npm run validate:public-surface` exits with code 0 (verifies public copywriting, CJK punctuation, and client error surfaces are compliant).
- Running `npm run build` exits with code 0.
- Astro compiler successfully bundles the client and server assets, outputting them into the `dist/` directory without blocking errors.
</acceptance_criteria>

<action>
Execute quality checks and Astro production build in the workspace root:
```bash
npm run lint
npm run format:check
npm run validate:public-surface
npm run build
```
Verify that all checks and build complete successfully, and output directories (`dist/`) are created/populated correctly.
</action>

***

### Task 4: Verify Reconstructed Scripts

<read_first>
- Reference: `scripts/clean-broken-skills.js` (refactored in Phase 131)
- Reference: `scripts/sync-translations.ts` (refactored in Phase 131)
</read_first>

<acceptance_criteria>
- Running `npx tsx scripts/sync-translations.ts` completes successfully with exit code 0 and does not re-add Hindi locale or fail.
- Running `node scripts/clean-broken-skills.js` completes successfully with exit code 0.
</acceptance_criteria>

<action>
Run both refactored scripts in dry-run/validation mode to verify execution integrity:
```bash
npx tsx scripts/sync-translations.ts
node scripts/clean-broken-skills.js
```
Verify no script execution warnings or crashes are reported.
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| TypeScript compilation fails due to residual imports from deleted files | Verify that Phase 131 successfully pruned all references to `hi.json` in typescript files (like `src/i18n.ts` and `src/lib/nvidia.ts`). Run `npm run typecheck` first to identify any missing files. |
| Test suite fails due to missing files or hardcoded test expectations | Ensure `src/lib/seo-title-lengths.test.ts` was correctly refactored in Phase 131. Address any test failures directly before claiming success. |
| Build or public surface checks fail due to route configuration or missing dependency imports | Verify Astro builds successfully and `npm run validate:public-surface` passes. Check `astro.config.mjs` and related integrations to confirm no files were broken during cleaning. |
| Refactored scripts fail due to residual reference to 'hi' locale | Run the scripts in Task 4 to ensure they do not crash or throw exceptions. |
