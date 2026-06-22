# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**

- PascalCase for React/Astro UI components (`src/islands/SkillActions.tsx`, `src/components/Layout.astro`).
- kebab-case for most utility modules and scripts (`src/lib/skill-md-parser.ts`, `scripts/seo-frontmatter-guard.ts`).
- Test files end with `.test.ts` (and occasional `.spec.ts` in E2E).

**Functions and Variables:**

- camelCase for functions and local variables (`getLightweightSkills`, `buildFtsQuery`).
- UPPER_SNAKE_CASE for module constants (`RESULT_LIMIT`, `CACHE_TTL`).
- Type aliases/interfaces use PascalCase (`UnifiedSkill`, `SkillListingItem`, `Env`).

## Code Style

**Formatting:**

- Prettier is the source of truth (`.prettierrc`, `.prettierignore`).
- Semicolons and single quotes are standard in TypeScript files.
- Comments are often bilingual (English + Chinese) in operational scripts.

**Linting:**

- ESLint config is centralized in `eslint.config.js`.
- Root CI enforces zero warnings for lint commands (`--max-warnings 0` in scripts).
- `@typescript-eslint/ban-ts-comment` allows `@ts-ignore` only with description.

## Import Organization

**Observed Order Pattern:**

1. External packages.
2. Internal aliases/relative app modules.
3. Type imports and runtime bindings where needed.

**Examples:**

- API routes keep framework imports first (`import type { APIRoute } from 'astro';`) and local lib imports after.
- Large page modules group many internal imports by feature area (`src/pages/[locale]/skills/[owner]/[...repo].astro`).

## Error Handling

**Patterns:**

- API handlers use explicit `try/catch` and return `Response` with status/body.
- Lower layers log and degrade gracefully (D1/KV fallback paths in `src/lib/kv.ts`).
- Scripts usually fail with explicit `console.error` and non-zero exit behavior.

**Boundary Strategy:**

- Request boundary errors are handled in route files (`src/pages/api/**`).
- Middleware enforces auth/redirect/guard logic before route execution (`src/middleware.ts`).

## Logging

**Framework:**

- Structured logger helper in `src/lib/logger.ts`.
- Direct `console.warn/error` remains common in scripts and some app paths for operational visibility.

**Patterns:**

- Include context payloads for API and pipeline logs.
- Emit warnings before fallback paths to make degraded behavior visible.
- Tests must not leave expected fallback/error logs on stdout or stderr. Wrap deliberate failure paths in scoped spies, assert the log call, and restore the spy.
- Scripts that load environment files for tests should prefer quiet dotenv configuration unless operator-facing diagnostics are the primary behavior under test.

## Comments

**Style:**

- Comments explain tradeoffs and edge-case handling more than obvious mechanics.
- Operational scripts include step-oriented comments to document pipeline phases.

**`@ts-ignore` Usage:**

- Allowed but expected to include rationale text (enforced by ESLint).
- Mostly appears in test/mocking contexts.

## Function and Module Design

**Route Handler Pattern:**

- Astro routes export `GET`/`POST` constants and optional `prerender = false`.
- Parameter parsing, validation, and response shaping occur in one module.
- Public API handlers return fixed generic messages for unexpected errors. Business validation errors may be specific, but raw exception messages stay in logs.

**Client Error Pattern:**

- Browser UI must not render caught exception messages. Use stable public copy for runtime failures and only display API-provided validation strings after the API boundary has sanitized them.
- Interactive terminal commands use shell-safe normalized refs from `src/lib/sandbox-skill-ref.ts` rather than route params directly.

**Utility Layer Pattern:**

- `src/lib/` favors pure helpers plus explicit runtime env parameters.
- Large modules centralize shared contracts and fallback orchestration (`src/lib/kv.ts`, `src/lib/skills.ts`).
- Public render surfaces use public/domain projection helpers from `src/lib/skills.ts`; Astro pages, components, and islands should not runtime-import low-level D1/KV helpers from `src/lib/kv.ts`.
- Type-only imports from `src/lib/kv.ts` are acceptable for `Env` and shared data-shape types.
- New public AI/provider output must pass through `src/lib/public-ai-output.ts`, `src/lib/public-skill-copy.ts`, or `src/lib/public-skill-api.ts` before it reaches API responses, streams, caches, static seeds, or browser UI.

**Module Exports:**

- Named exports are dominant.
- Interfaces/types are exported from the same module as their implementation.

## Testing Conventions in Code

- Mocks are created with Vitest `vi.fn` and helper factories (`src/lib/api-test-utils.ts`).
- Tests emphasize input validation and failure path coverage for API routes (`src/pages/api/skills/submit.test.ts`).
- Mocked external network calls should be exhaustive: an unexpected URL should throw in-test rather than fall through to `globalThis.fetch`.

---

_Convention analysis: 2026-06-09_
_Update when linting/style/error-handling standards change_
