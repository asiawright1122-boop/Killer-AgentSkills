# Codebase Structure

**Analysis Date:** 2026-04-02

## Directory Layout

```text
Killer-Skills/
├── .github/workflows/      # CI/CD, pipeline, SEO, and automation jobs
├── .planning/              # GSD planning artifacts and codebase maps
├── config/                 # Locale/runtime helper config modules
├── data/                   # Generated caches and SEO/support datasets
├── db/                     # D1/SQLite schema and seed helpers
├── docs/                   # Project documentation and guides
├── packages/
│   ├── cli/                # Publishable killer-skills CLI + MCP server
│   └── og-server/          # Next.js OG image service package
├── public/                 # Static assets
├── scripts/                # ETL, SEO, translation, and deployment utilities
├── src/                    # Main Astro app (pages, APIs, libs, islands)
├── tests/e2e/              # Playwright browser tests
├── workers/                # Cloudflare workers and workflows
├── astro.config.mjs        # Astro runtime/build config
├── wrangler.toml           # Cloudflare Pages bindings
└── package.json            # Root scripts and dependencies
```

## Directory Purposes

**`src/`:**
- Purpose: Main web application code.
- Contains: Astro routes (`src/pages/`), UI components (`src/components/`), React islands (`src/islands/`), and business/data libs (`src/lib/`).
- Key files: `src/middleware.ts`, `src/lib/kv.ts`, `src/pages/api/search.ts`, `src/pages/[locale]/skills/index.astro`.

**`scripts/`:**
- Purpose: Data ingestion, enrichment, SEO checks, and operational tooling.
- Contains: TypeScript and shell automation scripts.
- Key files: `scripts/build-skills-cache.ts`, `scripts/sync-to-kv.ts`, `scripts/sync-d1-delta.ts`, `scripts/seo-smoke.ts`.

**`workers/`:**
- Purpose: Cloudflare worker/webhook/workflow runtime.
- Contains: Workflow definitions and worker entry handlers.
- Key files: `workers/index.ts`, `workers/content-workflow.ts`, `workers/translation-workflow.ts`, `workers/wrangler.toml`.

**`packages/cli/`:**
- Purpose: Standalone terminal CLI and MCP server for skill install/sync workflows.
- Contains: command modules, adapters, tests, and package manifest.
- Key files: `packages/cli/src/index.ts`, `packages/cli/src/commands/install.ts`, `packages/cli/src/mcp-server.ts`.

**`data/`:**
- Purpose: Persistent generated artifacts used by site/runtime fallbacks.
- Key files: `data/skills-cache.json`, `data/docs-cache.json`, `data/sitemap-skills.json`.

**`.planning/`:**
- Purpose: GSD roadmap, phase artifacts, and context memory.
- Key files: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/codebase/*.md`.

## Key File Locations

**Entry Points:**
- `src/pages/index.astro` and `src/pages/[locale]/index.astro` - web entry pages.
- `src/pages/api/**` - API route entry points.
- `src/middleware.ts` - request-level policy and routing guards.
- `packages/cli/src/index.ts` - CLI command registration.
- `workers/index.ts` - worker webhook entry.

**Configuration:**
- `astro.config.mjs` - Astro adapter/build/i18n settings.
- `wrangler.toml` and `workers/wrangler.toml` - Cloudflare bindings and vars.
- `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`.

**Core Logic:**
- `src/lib/kv.ts` - D1/KV and fallback data access.
- `src/lib/skills.ts` - unified skill loading and caching.
- `src/lib/search.ts` - search ranking utilities.
- `db/schema.sql` - database schema and FTS setup.

**Testing:**
- Root tests are mostly colocated (`src/**/*.test.ts`).
- Browser tests in `tests/e2e/`.
- CLI tests in `packages/cli/tests/`.

**Documentation:**
- `README.md` and `CONTRIBUTING.md` at root.
- `docs/` for project docs.

## Naming Conventions

**Files:**
- React islands/components use PascalCase (`src/islands/SkillActions.tsx`, `src/components/SkillCard.astro`).
- Utility and script modules typically use kebab-case (`src/lib/seo-keywords.ts`, `scripts/sync-to-kv.ts`).
- Tests use `.test.ts` or `.spec.ts` suffixes.

**Directories:**
- Domain folders are lowercase (`src/lib/site/`, `src/pages/api/skills/`).
- Locale and catch-all route directories follow Astro route syntax (`src/pages/[locale]/`, `[...repo].astro`).

## Where to Add New Code

**New API Endpoint:**
- Handler: `src/pages/api/<feature>.ts` or nested route directory.
- Shared business logic: `src/lib/`.
- Tests: colocated `*.test.ts` near endpoint or helper.

**New UI Feature/Page:**
- Route: `src/pages/[locale]/...`.
- Server component: `src/components/`.
- Interactive island: `src/islands/`.
- State sharing: `src/stores/`.

**Pipeline/Automation Feature:**
- Script: `scripts/`.
- Shared helper: `scripts/lib/`.
- Workflow trigger: `.github/workflows/*.yml`.

**CLI Feature:**
- Command: `packages/cli/src/commands/`.
- Adapter/helper: `packages/cli/src/utils/`.
- Tests: `packages/cli/tests/`.

## Special Directories

**Generated/Derived:**
- `dist/` - Astro build output.
- `coverage/`, `playwright-report/`, `test-results/` - test artifacts.
- `.astro/`, `.wrangler/` - local build/runtime state.

**Operational State:**
- `logs/` - local pipeline logs.
- `.planning/phases/` - GSD phase execution artifacts.

---

*Structure analysis: 2026-04-02*
*Update when top-level or route/package layout changes*
