# Testing

## Framework
- **Unit/Integration**: Vitest (v4.0+) with `@vitest/coverage-v8`
- **Property-based**: fast-check
- **E2E**: Playwright (v1.58)
- **Total test files**: 222

## Test Distribution
| Layer | Files | Examples |
|-------|-------|---------|
| `src/lib/*.test.ts` | ~20 | `skills.test.ts`, `kv.test.ts`, `seo-keywords.test.ts` |
| `src/pages/api/*.test.ts` | ~5 | `search.test.ts`, `submit.test.ts`, `translate.test.ts` |
| `src/messages/*.test.ts` | ~3 | `public-copy.test.ts`, i18n property tests |
| `src/i18n.property.test.ts` | 1 | Property-based i18n validation |
| `tests/e2e/*.spec.ts` | 4 | `home.spec.ts`, `api.spec.ts`, `navigation.spec.ts`, `collections.spec.ts` |

## Test Patterns
- **Co-located**: Tests beside source files in `src/lib/`
- **Naming**: `*.test.ts` for unit/integration, `*.spec.ts` for E2E
- **Property tests**: `*.property.test.ts` using fast-check for i18n invariants

## CI Test Pipeline
```yaml
# ci.yml
npm run seo:smoke           # SEO frontmatter + meta checks
npm run seo:frontmatter:guard  # Blog SEO validation
npx tsx scripts/sync-translations.ts --check  # Translation key sync
npm run check:astro         # TypeScript + Astro diagnostics
npm run build               # Full build
npx vitest run --reporter=verbose  # All unit tests
```

## Coverage
- Tool: `@vitest/coverage-v8`
- Reports: `coverage/lcov-report/`
- No enforced threshold in CI (manual review)

## E2E Tests
| File | Coverage |
|------|----------|
| `home.spec.ts` | Homepage rendering, locale switching |
| `api.spec.ts` | API endpoint responses |
| `navigation.spec.ts` | Page navigation flows |
| `collections.spec.ts` | Collection page rendering |
