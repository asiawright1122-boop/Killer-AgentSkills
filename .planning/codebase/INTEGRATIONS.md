# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**Internal API Routes (Astro SSR endpoints under `src/pages/api/`):**

| Route file | HTTP method | Pattern | Purpose |
|---|---|---|---|
| `src/pages/api/skills/search.ts` | GET | `/api/skills/search?q=...` | Full-text skill search backed by Cloudflare KV |

No outbound calls to third-party REST APIs were detected in source files.

## Data Storage

**Cloudflare KV (Key-Value Store):**
- Binding name: `SKILLS_KV` (referenced in `src/lib/kv.ts` and `src/pages/api/skills/search.ts`)
- Declared in: `wrangler.toml` under `[[kv_namespaces]]`
- Access pattern: `context.locals.runtime.env.SKILLS_KV` (Cloudflare Workers runtime binding via `@astrojs/cloudflare` adapter)
- Client: Native Cloudflare KV Workers API — no external SDK
- Operations used: `get()`, `put()`, `list()`, `getWithMetadata()`
- KV abstraction layer: `src/lib/kv.ts` — wraps raw KV binding with typed helpers

**Cloudflare D1 (SQLite):**
- Not detected in source files. `wrangler.toml` should be checked for `[[d1_databases]]` bindings — none found in explored source code imports.

**Cloudflare R2 (Object Storage):**
- Not detected in source files or imports.

**Local / Filesystem:**
- Not used at runtime (Cloudflare Workers has no filesystem)
- Build-time only: `sharp` processes images at build time

## Authentication & Identity

**Auth Provider:** None detected
- No authentication library imports found in `src/lib/` or `src/pages/api/`
- API routes do not appear to implement auth middleware

## Third-party Services

| Service | SDK/Package | Purpose | Detected in |
|---|---|---|---|
| Cloudflare Workers/Pages | `@astrojs/cloudflare`, `wrangler` | Hosting, KV storage, edge runtime | `astro.config.mjs`, `wrangler.toml`, `src/lib/kv.ts` |

No other third-party service integrations (Stripe, SendGrid, Supabase, Auth0, Sentry, etc.) were detected.

## Environment Variables Required

Cloudflare Workers bindings (declared in `wrangler.toml`, injected by Workers runtime — NOT standard `process.env` vars):

| Binding | Type | Required | Used in |
|---|---|---|---|
| `SKILLS_KV` | KV Namespace | Yes | `src/lib/kv.ts`, `src/pages/api/skills/search.ts` |

Access pattern in code:
```typescript
// src/lib/kv.ts
const kv = context.locals.runtime.env.SKILLS_KV;
```

**Local development:** Wrangler emulates KV bindings locally using `wrangler dev`. No `.env` file is required for core functionality — bindings are declared in `wrangler.toml`.

**.env files:** `.env` file existence was detected but contents were not read. Any vars there are supplemental to Workers bindings.

## Webhooks & Callbacks

**Incoming:** None detected
**Outgoing:** None detected

## Monitoring & Observability

**Error Tracking:** None detected (no Sentry, Datadog, etc.)
**Logging:** `console.log` / `console.error` only (standard Workers logging visible in Cloudflare dashboard)

## CI/CD & Deployment

**Hosting:** Cloudflare Pages / Workers (via `wrangler.toml`)
**Deploy command:** `wrangler deploy` or `wrangler pages deploy`
**CI Pipeline:** Not detected in explored files (no `.github/workflows/` checked)

---

*Integration audit: 2026-03-24*
