# Testing

## Framework & Config
- **Vitest** with `globals: true`, `environment: node`
- Coverage: `v8` provider, reporters: `text` + `lcov`, output: `coverage/`
- Path alias `@` → `/src`
- Excluded from test run:
  - `tests/e2e/**` (E2E suite, separate)
  - `packages/cli/**` (own deps, run separately)
  - `packages/og-server/**`
  - `src/build-validation.test.ts` (requires built `dist/`, run in CI build job)
  - `.claude/**` (worktree mirrors)

## Test Files
| File | What it tests |
|------|---------------|
| `src/lib/kv.test.ts` | Core KV/D1 data access: `getKV`, `setKV`, `getSkillsFromKV`, `getSkillsKV`, `getSitemapSkillsFromKV`. Uses mock KVNamespace and mock D1. Tests sitemap cache TTL, local fallback disable, env propagation. |
| `src/lib/kv.property.test.ts` | Property-based tests for kv.ts (fast-check or similar) |
| `src/lib/shared/validation.test.ts` | EXCLUDE_KEYWORDS, NON_TARGET_THEME_PATTERNS, SUSPICIOUS_NAMES, SKILL_HEADERS, scoring logic |
| `src/lib/favorites.test.ts` | localStorage-backed favorites CRUD |
| `src/lib/history.test.ts` | localStorage-backed history management |
| `src/islands/SkillActions.test.ts` | React island behavior (share/copy/favorite actions) |
| `src/i18n.test.ts` | i18n string lookup, locale fallback |
| `src/i18n.property.test.ts` | Property-based i18n invariants |
| `src/build-validation.test.ts` | Build artifact validation (run post-build only) |
| `scripts/lib/utils.test.ts` | Script utility functions |

## Mocking Patterns
- **KVNamespace**: Hand-rolled mock using `Map<string, any>` with `vi.fn()` for `get`, `put`, `delete`, `list`, `getWithMetadata`
- **D1Database**: `vi.fn()` mock with `prepare → bind → first/all` chain; `first()` does array `.find()` based on SQL pattern matching
- **node:fs**: `vi.mock('node:fs', ...)` with `existsSync → false`, `readFileSync` mocked — disables local file fallback
- **import.meta.env.DEV**: Mutated directly in `beforeEach`/`afterEach` via `@ts-ignore`
- **process.env**: `NODE_ENV=test`, `DISABLE_LOCAL_SITEMAP_FALLBACK=1` set at module top
- **Cache isolation**: `_clearSitemapSkillsCacheForTest()` exported specifically for test use

## Coverage Areas
- Data access layer (kv.ts): well covered
- Validation/scoring (shared/validation.ts): covered
- i18n: covered including property tests
- React islands: partial (SkillActions)
- API endpoints: NOT covered by unit tests
- Search logic (search.ts / Fuse.js integration): NOT covered
- Pipeline scripts (harvest, build, sync): NOT covered
- E2E: suite exists under `tests/e2e/` but excluded from default run

## Known Gaps
- No unit tests for API route handlers (`src/pages/api/**`)
- No unit tests for `src/lib/search.ts` (Fuse.js scoring)
- No unit tests for pipeline scripts (`build-skills-cache.ts`, `harvest-github-skills.ts`)
- `build-validation.test.ts` only runs post-build (not in dev iteration)
- E2E tests exist but are not wired into default CI (unclear trigger)
