# Phase 132: System Integrity Build & Regression Check - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Source:** Standard GSD verification requirement (INTEGRATE-01)

<domain>
## Phase Boundary

The objective of this phase is to run a comprehensive system verification, ensuring the codebase is fully functional, free of compilation warnings, type-stable, and passes all unit/integration tests with zero regressions after workspace cleanup (Phase 130) and Hindi locale pruning (Phase 131).

</domain>

<decisions>
## Implementation Decisions

### Type Checking
- Run `npm run typecheck` to assert that all modules compile without type issues.

### Test Verification
- Run `npm test` to run the entire Vitest test suite (1027 tests) and assert all of them pass.

### Production Bundling
- Run `npm run build` to verify the Astro compiler builds the server bundle successfully.

### the agent's Discretion
- Technical verification execution logic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scripts & package configuration
- `package.json` — master commands
- `tsconfig.json` — compiler settings
- `astro.config.mjs` — Astro bundler configuration

</canonical_refs>

<specifics>
- None.

</specifics>

<deferred>
- None.

</deferred>

---

*Phase: 132-system-integrity-build-regression-check*
*Context gathered: 2026-06-23*
