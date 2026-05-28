# Technology Stack

**Analysis Date:** 2026-04-02

## Languages

**Primary:**
- TypeScript 6.x - Main application, API routes, libraries, and tooling (`src/`, `scripts/`, `workers/`, `packages/cli/src/`).

**Secondary:**
- JavaScript (ESM/CJS) - Build/config and automation glue (`astro.config.mjs`, `eslint.config.js`, `scripts/*.mjs`, `scripts/*.cjs`).
- SQL (SQLite/D1) - Schema and indexing logic in `db/schema.sql`.
- Markdown/JSON content - Localized content and cache data in `src/content/`, `src/messages/`, and `data/`.

## Runtime

**Environment:**
- Node.js 22.12.0+ in root development/CI workflows (`.github/workflows/ci.yml`, `.nvmrc`).
- Node.js >=18 for the published CLI package (`packages/cli/package.json`).
- Cloudflare Workers runtime in production for Astro server output and workflows (`wrangler.toml`, `workers/wrangler.toml`).

**Package Manager:**
- npm with lockfile (`package-lock.json`) at repo root and in `workers/`.

## Frameworks

**Core Web:**
- Astro 6 (`astro`) with server output and Cloudflare adapter (`@astrojs/cloudflare` v13+).
- React (`react`, `react-dom`) for hydrated islands (`src/islands/`).
- Tailwind CSS 4 via Vite plugin (`@tailwindcss/vite`, `tailwindcss`).

**Cloud Platform:**
- Cloudflare Workers via Wrangler (`wrangler.toml`).
- Cloudflare D1 + KV + Vectorize + Workers AI bindings (`wrangler.toml`, `src/env.d.ts`).

**Testing:**
- Vitest 4 for root tests (`vitest.config.ts`).
- Playwright for browser E2E (`playwright.config.ts`, `tests/e2e/`).
- Separate Vitest 3 config for CLI package (`packages/cli/vitest.config.ts`).

**Build and Tooling:**
- TypeScript compiler (`tsconfig.json`, `workers/tsconfig.json`, `packages/*/tsconfig.json`).
- `tsx` for TypeScript scripts at runtime (`scripts/*.ts`).
- ESLint + Prettier + Husky (`eslint.config.js`, `.prettierrc`, `.husky/`).

## Key Dependencies

**Critical Application Dependencies:**
- `@astrojs/cloudflare` - Deploys Astro server output to Cloudflare runtime.
- `better-sqlite3` - Local SQLite support for data workflows and tooling.
- `fuse.js` - In-memory fallback search ranking.
- `react-markdown` + `remark-gfm` - Markdown rendering on skill/detail pages.
- `@webcontainer/api` + `@xterm/xterm` - Browser terminal experience (`src/islands/WebTerminal.tsx`).

**Critical CLI Dependencies (`packages/cli`):**
- `commander` - CLI command surface (`packages/cli/src/index.ts`).
- `@modelcontextprotocol/sdk` - MCP server support (`packages/cli/src/mcp-server.ts`).
- `fs-extra` and `simple-git` - Install/sync and repository interactions.

## Configuration

**Environment Configuration:**
- Root env files: `.env`, `.env.local`.
- Cloudflare bindings and vars in `wrangler.toml` and `workers/wrangler.toml`.
- Runtime env typing in `src/env.d.ts` and `src/lib/kv.ts`.

**Build and Lint Configuration:**
- Astro build/runtime config in `astro.config.mjs`.
- TypeScript config in `tsconfig.json` and package-specific `tsconfig.json` files.
- ESLint in `eslint.config.js`.
- Vitest in `vitest.config.ts` and `vitest.build-validation.config.ts`.
- Playwright in `playwright.config.ts`.

## Platform Requirements

**Development:**
- Node.js + npm installed locally.
- Wrangler-compatible environment for local Cloudflare bindings.
- Optional: GitHub CLI and provider credentials for scripts in `scripts/`.

**Production:**
- Cloudflare Workers deployment target (`wrangler deploy --config dist/server/wrangler.json`).
- Cloudflare managed services: D1, KV, Vectorize, Workers AI, Workflows.
- GitHub Actions CI/CD orchestration (`.github/workflows/*.yml`).

---

*Stack analysis: 2026-04-02*
*Update after major dependency or runtime changes*
