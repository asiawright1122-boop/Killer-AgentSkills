# Code Conventions

## TypeScript Config & Strictness
- Target: not confirmed (tsconfig not read in full), but Astro defaults to ESNext
- Path alias: `@` → `/src`
- Strict mode implied via `tseslint.configs.recommended`
- `no-explicit-any`: **OFF** — `any` is used freely throughout (especially in pipeline scripts)
- `@ts-ignore` allowed if accompanied by a description comment

## Linting Setup
- ESLint flat config (`eslint.config.js`) with:
  - `@eslint/js` recommended
  - `typescript-eslint` recommended
  - `eslint-plugin-astro` recommended
  - `eslint-config-prettier` (no style conflicts)
- Key rules:
  - Unused vars: **warn** (underscore prefix `_` suppresses warning)
  - `no-console`: OFF (scripts use console extensively)
  - `no-empty`: error, except empty catch blocks
  - `triple-slash-reference`: OFF

## Formatting
- Prettier integrated via `eslint-config-prettier`
- No `.prettierrc` found at root; defaults apply

## Naming Conventions
- Files: `kebab-case.ts` for lib/scripts, `PascalCase.astro` for components, `PascalCase.tsx` for React islands
- Functions: `camelCase`
- Types/Interfaces: `PascalCase` (e.g. `UnifiedSkill`, `SkillListingItem`, `Env`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g. `EXCLUDE_KEYWORDS`, `OFFICIAL_REPOS`, `SKILL_HEADERS`)
- Test files: co-located as `*.test.ts` or `*.property.test.ts`
- Locale routes: `[locale]` segment in page paths

## Error Handling Patterns
- API endpoints: return `Response` objects with JSON error bodies and appropriate HTTP status codes
- Scripts: `try/catch` with `console.error` + `process.exit(1)` on fatal errors
- KV reads: explicit `null` checks before parsing; returns `null` not throws on miss
- D1 queries: `.first()` returns null on miss (no throw), `.all()` always returns results array
- Empty catch blocks allowed (via eslint rule) for optional operations

## Import/Export Patterns
- Named exports preferred; no default exports in lib files
- Re-exports for backward compatibility: `export { OFFICIAL_REPOS, isOfficialRepo }` from `validation.ts`
- Dynamic imports not observed in core lib
- Cloudflare-specific: `node:fs`, `node:crypto`, `node:path` externalized in Vite SSR config

## API Endpoint Pattern
- All API endpoints export a `GET` (or `POST`) function receiving `APIContext`
- `env` accessed via `context.locals.runtime.env`
- Prerendering disabled on all API routes (`export const prerender = false`)
- Rate limiting via `src/lib/rate-limit.ts` on public endpoints
