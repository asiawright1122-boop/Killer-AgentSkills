# Phase 106 Plan — Authority Surface Quality Audit

## Objective

Run a comprehensive audit of the 32 authority surfaces (specifically analyzing configuration properties and placement definitions in data/authority-surfaces.json and src/lib/authority-surface-public-data.ts). Document current content debt and placement blockers for the two target P0 pages ("Official AI Skills & Trusted Tools" and "Cursor-Compatible Skills"). Compile an audit report (106-AUDIT-REPORT.md) in the phase directory.

## Requirement Traceability

- **AIOPS-27**: Run a comprehensive audit on the 32 authority surface pages to identify content gaps and hold reasons.

---

## Plan 106-01: Audit configurations and generate 106-AUDIT-REPORT.md

### What

Analyze configurations, placement definitions, and latest scorecard results for the 32 authority pages. Write a markdown audit report (`106-AUDIT-REPORT.md`) to `.planning/phases/106-Authority Surface Quality Audit/106-AUDIT-REPORT.md`. The report will contain:
1. An overall status summary of the 32 authority surfaces (cross-referencing `reports/seo/latest-authority-uplift-scorecard.md`).
2. Specific content gap analysis and placement blocker documentation for the two P0 pages:
   - `collection-official-trusted-tools` (Official AI Skills & Trusted Tools)
   - `collection-cursor` (Cursor-Compatible Skills)
3. Actionable upgrade guidelines and placement recommendations (e.g. sidebar, main navigation link configurations) to resolve their hold/noisy status in Phase 107.

### Why

Identifies the precise deficiencies preventing target authority surfaces from transitioning to the `promote` state. By focusing on two target P0 pages, we ensure high quality without overloading resources, setting up clear requirements for the subsequent Phase 107 content upgrade.

### Files to Modify / Create

- Create: `.planning/phases/106-Authority Surface Quality Audit/106-AUDIT-REPORT.md`

### Files to Read

- `data/authority-surfaces.json`
- `src/lib/authority-surface-public-data.ts`
- `reports/seo/latest-authority-uplift-scorecard.md`
- `.planning/phases/106-Authority Surface Quality Audit/CONTEXT.md`

### Verification

1. Verify that `.planning/phases/106-Authority Surface Quality Audit/106-AUDIT-REPORT.md` is created.
2. Confirm the report contains status auditing for 32 surfaces and deep-dives for `collection-official-trusted-tools` and `collection-cursor`.
3. Confirm that placement configuration strategies are proposed in the report.

---

## Plan 106-02: Run typecheck and test suite verification

### What

Run TypeScript typechecking and testing scripts to ensure that the repository remains stable and all type validations/unit tests continue to pass.

### Why

Guarantees type-safety and codebase stability before finishing the planning/auditing phase, preventing regressions on the main branch.

### Files to Modify / Create

- None.

### Files to Read

- `package.json`
- `tsconfig.json`

### Verification

1. Run the local type checking suite:
   ```bash
   npm run typecheck
   ```
   Expected: Exit code 0 (no errors).
2. Run the test suite:
   ```bash
   npm run test
   ```
   Expected: All unit tests pass.

---

## Execution Order

```
106-01
106-02
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Incomplete surface data causes missing audit entries | Read both `data/authority-surfaces.json` and `src/lib/authority-surface-public-data.ts` to build a unified catalog |
| Verification tests fail | Remediate any linting or type definitions mismatch before finalizing the phase |
