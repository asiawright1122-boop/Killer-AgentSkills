# Testing

## Frameworks
Killer-Skills utilizes two distinct testing frameworks driven by different scopes of the stack:
- **Vitest**: Controls unit testing, property-based testing (using `fast-check`), state-level assertions, and Astro page logic mock verifications.
- **Playwright**: Used exclusively in the end-to-end and UI-heavy pipelines for browser-emulated checks (`npm run test:e2e`).

## Testing Structure & Philosophy
- **Collocation**: `.test.ts` files reside directly alongside their corresponding codebase files. E.g., `src/pages/public-links.test.ts` lives intimately near `src/pages/`.
- **Property-based Integrity**: Extensively tests internal middlewares and logic using randomized input seeds (e.g., `middleware.property.test.ts`, `i18n.property.test.ts`).
- **Astro Source Checking**: Uniquely asserting static template output or source-layout composition using file-reading mocks (`readPageSource()`) to prevent component link regressions prior to actual DOM rendering. E.g., Verifying all sitemap hardcoded relative endpoints.

## Coverage & Validation
- **CI Guard**: `npx vitest run --coverage` executes inside CI blocking deployments if the baseline coverage falters.
- **Post-Build Validation**: An entirely isolated test suite (`vitest.build-validation.config.ts`) runs purely against the built `dist/` envelope post-compilation to catch edge-rendering snags early.
