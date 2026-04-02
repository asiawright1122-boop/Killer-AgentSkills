# Architecture

**Analysis Date:** 2026-04-02

## Pattern Overview

**Overall:**
- Edge-first Astro web application with server-rendered pages, API routes, Cloudflare data services, and parallel data-ingestion automation.
- Repo also contains a distributable CLI and dedicated Cloudflare workflow workers.

**Key Characteristics:**
- Hybrid SSR + client islands (`src/pages/` + `src/islands/`).
- Service-adapter style data access through `src/lib/kv.ts`.
- Multi-source fallback strategy (D1 -> KV -> local JSON).
- Strong SEO/i18n orientation embedded in middleware and page composition.

## Layers

**Presentation Layer:**
- Purpose: Render localized pages and interactive UI.
- Contains: Astro pages/components and React islands (`src/pages/`, `src/components/`, `src/islands/`).
- Depends on: domain/data helpers in `src/lib/`.
- Used by: browser clients and crawlers.

**Application/API Layer:**
- Purpose: Handle HTTP APIs for skills, search, translation, admin, and health.
- Contains: route handlers in `src/pages/api/**`.
- Depends on: `src/lib/*` helpers and Cloudflare runtime bindings.
- Used by: frontend islands/pages and automation clients.

**Domain and Data Layer:**
- Purpose: Encapsulate querying, filtering, caching, i18n fallback, and business rules.
- Contains: `src/lib/skills.ts`, `src/lib/kv.ts`, `src/lib/search.ts`, taxonomy/intent utilities.
- Depends on: Cloudflare bindings and local cache files.
- Used by: API layer and SSR pages.

**Automation/Pipeline Layer:**
- Purpose: Harvest external repos, enrich content, sync D1/KV, and run SEO operations.
- Contains: `scripts/*.ts`, `scripts/*.mjs`, `scripts/lib/*`.
- Depends on: external APIs and cloud credentials.
- Used by: GitHub Actions workflows and local operators.

**Satellite Packages Layer:**
- Purpose: CLI distribution and OG image service.
- Contains: `packages/cli/` and `packages/og-server/`.
- Used by: end users installing skills from terminal and auxiliary rendering contexts.

## Data Flow

**Web Request Flow (Skills Listing):**
1. Request enters `src/middleware.ts` for redirects/security/admin guards.
2. Route in `src/pages/[locale]/skills/index.astro` validates locale and query params.
3. Page requests lightweight data via `getLightweightSkills()` in `src/lib/skills.ts`.
4. Data access resolves from D1, with KV/local fallback via `src/lib/kv.ts`.
5. Page applies filter/sort/search and returns cached SSR HTML.

**API Search Flow:**
1. Client calls `GET /api/search` (`src/pages/api/search.ts`).
2. Endpoint applies in-memory rate limiting and query normalization.
3. Runs semantic search (Workers AI + Vectorize) and keyword FTS search (D1) in parallel.
4. Merges with RRF scoring; falls back to Fuse.js search if cloud search path is unavailable.
5. Returns JSON result list.

**Data Pipeline Flow:**
1. Workflow starts from `.github/workflows/data-pipeline.yml`.
2. Scripts harvest repositories and build enriched cache (`scripts/harvest-github-skills.ts`, `scripts/build-skills-cache.ts`).
3. Sync layer writes D1/KV (`scripts/sync-d1-delta.ts`, `scripts/sync-to-kv.ts`).
4. Site serves updated data via runtime queries and sitemap assets.

**State Management:**
- Primary persistent state: Cloudflare D1 + KV.
- Secondary/local fallback state: JSON files under `data/`.
- Per-request cache/state in module memory and Cloudflare Cache API (`src/lib/skills.ts`).

## Key Abstractions

**Env Binding Abstraction:**
- Purpose: Centralize access to Cloudflare runtime bindings.
- Examples: `Env` interface and helpers in `src/lib/kv.ts`.

**Unified Skill Model:**
- Purpose: Keep API/pages on one data shape regardless of source.
- Examples: `UnifiedSkill` in `src/lib/skills.ts`.

**Route Boundary Pattern:**
- Purpose: Keep boundary validation/error handling in route handlers.
- Examples: `src/pages/api/skills/index.ts`, `src/pages/api/translate.ts`.

## Entry Points

**Web Entry Points:**
- `src/pages/index.astro`, `src/pages/[locale]/**` for public pages.
- `src/pages/api/**` for JSON/streaming APIs.
- `src/middleware.ts` for cross-cutting request policies.

**Automation Entry Points:**
- `scripts/*.ts` invoked by npm scripts in root `package.json`.
- GitHub Actions workflows in `.github/workflows/*.yml`.

**Package Entry Points:**
- CLI binary registration in `packages/cli/package.json` -> `packages/cli/src/index.ts`.
- Workers entry in `workers/index.ts` and workflow files in `workers/*.ts`.

## Error Handling

**Strategy:**
- Route-level `try/catch` with explicit HTTP responses.
- Data layer catches provider/storage failures and falls back when possible.
- Automation scripts use explicit exit behavior and retry loops for transient failures.

**Patterns:**
- API responses use helper wrappers in `src/lib/api-utils.ts`.
- Fallback warnings emitted in `src/lib/kv.ts` and pipeline scripts.

## Cross-Cutting Concerns

**Localization:**
- Locale routing and detection in `src/middleware.ts` and `src/i18n.ts`.
- Message bundles under `src/messages/`.

**SEO/Crawl Management:**
- Robots/sitemap routes in `src/pages/*.xml.ts` and `src/pages/robots.txt.ts`.
- Crawl trap guards and indexing headers in `src/middleware.ts`.

**Security:**
- Security headers injected in middleware.
- Admin route protection via Basic Auth.

**Caching:**
- Edge cache headers in middleware/pages.
- Cloudflare Cache API usage in `src/lib/skills.ts`.

---

*Architecture analysis: 2026-04-02*
*Update when major data flow or layering changes*
