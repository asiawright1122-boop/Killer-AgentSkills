# Technology Stack

**Analysis Date:** 2026-03-24

## Runtime & Framework

**Runtime:**
- Node.js (npm lockfile v3 present — Node 18+ inferred from Astro 5.x requirements)
- Cloudflare Workers runtime (production execution via `@astrojs/cloudflare` adapter)

**Framework:**
- Astro `5.6.1` — full-stack web framework, SSR mode, output `server`
  - Config: `astro.config.mjs`
  - Adapter: `@astrojs/cloudflare` `^12.4.0` — deploys to Cloudflare Workers/Pages

## Languages

**Primary:**
- TypeScript `~5.7.2` — all source files under `src/`

**Secondary:**
- MDX — content authoring (`@astrojs/mdx ^4.2.3`)
- CSS / Tailwind — styling

## Build Tools

**Build:**
- Astro CLI (`astro build`) — production build
- Wrangler `^4.2.0` — Cloudflare deployment and local dev tunneling
  - Config: `wrangler.toml`

**Dev Server:**
- `astro dev` — local development
- `astro preview` — local preview of production build

**Type Checking:**
- `tsc` (TypeScript compiler) — `tsconfig.json` extends `astro/tsconfigs/strict`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Key Dependencies (Production)

| Package | Version | Purpose |
|---|---|---|
| `astro` | `5.6.1` | Core framework |
| `@astrojs/cloudflare` | `^12.4.0` | Cloudflare Workers/Pages SSR adapter |
| `@astrojs/mdx` | `^4.2.3` | MDX content support |
| `@astrojs/sitemap` | `^3.2.1` | Sitemap generation |
| `@astrojs/tailwind` | `^5.1.4` | Tailwind CSS integration |
| `tailwindcss` | `^3.4.17` | Utility-first CSS framework |
| `@cloudflare/workers-types` | `^4.20250317.0` | TypeScript types for CF Workers runtime |
| `sharp` | `^0.33.5` | Image processing (build-time) |

## Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `wrangler` | `^4.2.0` | Cloudflare deployment CLI, local KV/D1 emulation |
| `typescript` | `~5.7.2` | TypeScript compiler |
| `@types/node` | `^22.13.10` | Node.js type definitions |
| `vitest` | (check package.json — not detected in top-level deps) | — |

> Note: No test framework was detected in `package.json` dependencies. However `src/lib/kv.test.ts` exists in git status, suggesting a test runner may be configured separately or is a newer addition.

## Configuration Files

- `astro.config.mjs` — Astro framework config (adapter, integrations, vite settings)
- `wrangler.toml` — Cloudflare Workers/Pages deployment config (KV namespaces, D1, routes)
- `tsconfig.json` — TypeScript config, extends `astro/tsconfigs/strict`
- `tailwind.config.*` — Tailwind CSS config (if present alongside astro integration)
- `package.json` — npm manifest

---

*Stack analysis: 2026-03-24*
