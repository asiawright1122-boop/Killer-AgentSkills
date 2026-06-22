# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**

- Root application: Vitest 4 (`vitest.config.ts`).
- Browser E2E: Playwright (`playwright.config.ts`).
- CLI package: separate Vitest config (`packages/cli/vitest.config.ts`).

**Assertion Library:**

- Vitest built-in `expect` and Playwright `expect` for browser assertions.

**Run Commands:**

```bash
npm test
npm run typecheck
npm run guard:public-ai-output
npm run guard:public-client-errors
npm run guard:public-skill-cache
npm run guard:public-d1-seeds
npm run guard:test-network
npx vitest run --coverage
npx vitest run --config vitest.build-validation.config.ts
npm run test:e2e
```

## Test File Organization

**Root App:**

- Most tests are colocated under `src/` as `*.test.ts`.
- Example: `src/lib/skills.ts` with `src/lib/skills.test.ts`.
- Property tests exist (`src/i18n.property.test.ts`, `src/middleware.property.test.ts`, `src/lib/kv.property.test.ts`).

**E2E:**

- Browser flows in `tests/e2e/*.spec.ts`.
- Uses dedicated local dev server lifecycle from `playwright.config.ts`.

**CLI Package:**

- Tests live under `packages/cli/tests/` (unit + e2e suites).
- Not executed by root Vitest config; they run in package scope.

## Test Structure

**Common Patterns:**

- `describe` + `it` blocks with explicit scenario names.
- `beforeEach` resets mocks/modules for deterministic API tests.
- API tests construct request/locals contexts through helper factories.

**Example Files:**

- `src/pages/api/skills/submit.test.ts` (HTTP validation/error/success cases).
- `src/lib/api-test-utils.ts` (mock KV/D1/context utilities).
- `src/lib/public-ai-output.test.ts` and `tests/pages/public-client-error-surfaces.test.ts` guard public output boundaries, including streaming AI output and client-side caught-error displays.

## Mocking

**Framework:**

- Vitest mocking (`vi.fn`, `vi.mock`, `vi.restoreAllMocks`).

**Patterns Used:**

- Mock runtime bindings (KV, D1, env) with lightweight in-memory fakes.
- Stub global fetch for GitHub/API interaction tests.
- Use helper constructors to reduce repeated setup noise.

## Fixtures and Factories

**Inline Fixtures:**

- Many tests keep fixtures close to test body for readability.
- Example markdown fixtures in `src/pages/api/skills/submit.test.ts`.

**Shared Factories:**

- `src/lib/api-test-utils.ts` provides `createMockKV`, `createMockD1`, and `createAPIContext`.

## Coverage

**Root Coverage:**

- V8 coverage enabled in `vitest.config.ts` with `text` and `lcov` reporters.
- CI uploads coverage artifacts (`.github/workflows/ci.yml`).

**Build Validation:**

- Post-build verification test runs separately via `vitest.build-validation.config.ts`.

## Test Types

**Unit/Logic Tests:**

- Library and utility behavior (`src/lib/*.test.ts`, `src/messages/public-copy.test.ts`).

**API Boundary Tests:**

- Route-level behavior and response contracts (`src/pages/api/**/*.test.ts`).

**Property-Based Tests:**

- Uses `fast-check` for invariants and edge cases (`*.property.test.ts`).

**E2E Browser Tests:**

- Critical navigation and API flows (`tests/e2e/*.spec.ts`).

## Common Patterns

**Async Testing:**

- Async handlers tested with `await` and direct response parsing (`await res.json()`).

**Error Path Testing:**

- Rate limits, malformed inputs, and upstream failures are explicitly asserted.
- Tests that deliberately trigger fallback/error logs should spy on `console.*` or `process.stdout.write`, assert the expected log happened, and restore the spy. Full `npm test` should stay free of noisy expected stderr/stdout so real regressions stand out.
- API tests that mock `fetch` should fail on unexpected URLs instead of falling through to the real network. `npm run guard:test-network` pins this for public API tests.

**Environment-Sensitive Testing:**

- Root Vitest excludes packages needing separate dependencies (`packages/cli/**`, `packages/og-server/**`).

**Public Output Guards:**

- `src/lib/public-ai-output.test.ts` covers hidden-reasoning sanitizer behavior, including streaming chunks.
- `tests/pages/public-text-routes.test.ts` checks rendered public text routes for hidden reasoning markers.
- `tests/pages/public-client-error-surfaces.test.ts`, `src/islands/ErrorBoundary.test.ts`, and `src/lib/sandbox-skill-ref.test.ts` protect browser-visible error and terminal surfaces.
- `tests/pages/public-headers.test.ts` keeps `public/_headers` deployable by rejecting empty header rules.
- `tests/pages/public-static-conflicts.test.ts` prevents file-like `src/pages` routes from colliding with static `public/` files.
- Script guards check source files, cache projections, D1 seed SQL, and post-build client artifacts before deployment.

## Current Testing Gaps

- Worker runtime coverage exists for `workers/lib/ai-runtime.test.ts`, but full workflow integration remains light.
- Some E2E assertions are conditional when local data is unavailable (can hide regressions if fixture data is missing).

---

_Testing analysis: 2026-06-09_
_Update when test stack, CI gates, or coverage strategy changes_
