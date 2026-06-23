---
phase: 136
plan: 136-01
type: execute
wave: 1
depends_on:
  - 135
files_modified: []
autonomous: true
---

# Phase 136 Plan — System Build & Regression Check

## Objective

Run a comprehensive regression check pipeline, verifying type checks, lint checks, test suites, public surface checks, and production Astro bundling to secure Milestone v4.3 deliverables.

## Requirement Traceability

- **INTEGRATE-02**: Verify global build, type safety, and all tests pass with zero regressions.

***

## Tasks

### Task 1: Execute Complete Validation Check Pipeline

<read_first>
- Reference: `package.json`
</read_first>

<acceptance_criteria>
- `npm run typecheck` passes with no errors.
- `npm run lint` passes with no warnings.
- `npm run format:check` or prettier check is clean.
- `npm run validate:public-surface` passes with zero failures.
- `npm test` successfully executes all 1031 tests.
- `npm run build` bundles server assets and prerenders pages.
</acceptance_criteria>

<action>
1. Execute the type checking:
   ```bash
   npm run typecheck
   ```
2. Execute syntax lint check:
   ```bash
   npm run lint
   ```
3. Execute Vitest test suite:
   ```bash
   npm test
   ```
4. Execute public surface validation and production build:
   ```bash
   npm run validate:public-surface
   ```
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Intermittent build or test failures in mock runtime | Ensure local environment variables (like KV/D1 dev bindings) do not interfere with test mock structures. |
