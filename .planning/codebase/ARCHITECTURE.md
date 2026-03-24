# Architecture

## Overview
Killer-Skills is a server-side-rendered Astro application deployed on Cloudflare Pages/Workers. It is a skill discovery platform for Claude Agent Skills (SKILL.md-based), supporting 10 locales with AI-translated content.

## Request Flow
```
Browser → Cloudflare CDN → Astro SSR (Workers) → KV / D1 / NVIDIA API
```

## Core Data Flow
1. **Harvest** (`scripts/harvest-github-skills.ts`) — crawls GitHub for repos containing SKILL.md files
2. **Build Cache** (`scripts/build-skills-cache.ts`) — validates, scores, and AI-enriches skills (SEO, descriptions, translations via NVIDIA/SiliconFlow/OpenRouter APIs)
3. **Sync to Storage** (`scripts/sync-to-kv.ts`, `scripts/sync-d1-delta.ts`) — writes enriched skill data to Cloudflare KV (`SKILLS_CACHE`) and D1 (FTS5 full-text search)
4. **Runtime Serving** (`src/lib/kv.ts`, `src/lib/skills.ts`) — reads from D1 (fast path) or KV (fallback) per request

## Storage Architecture
| Store | Purpose | Access Pattern |
|-------|---------|----------------|
| Cloudflare D1 (`DB`) | Primary skill store with FTS5 full-text search | All skill queries |
| Cloudflare KV (`SKILLS_CACHE`) | Skill listing cache, individual skill blobs | Read-heavy, fallback |
| Cloudflare KV (`TRANSLATIONS`) | Translated documentation strings | Read per locale |
| Local `data/skills-cache.json` | Dev fallback only (2.9MB, never in prod) | Dev mode only |

## Search Architecture
- **Primary (D1 FTS5)**: SQL FTS5 prefix matching, concurrent count+data queries, ordered by rank/quality/stars
- **Fallback (Fuse.js)**: Client-side fuzzy search via `src/lib/search.ts` when D1 unavailable
- **Rate limiting**: 30 req/min per IP on `/api/skills/search`

## Routing Structure
- `src/pages/index.astro` — root redirect
- `src/pages/[locale]/index.astro` — localized home
- `src/pages/[locale]/skills/[owner]/[...repo].astro` — individual skill pages
- `src/pages/[locale]/collections/[...slug].astro` — collections
- `src/pages/[locale]/solutions/[topic].astro` — solutions hub
- `src/pages/[locale]/blog/[...slug].astro` — blog (MDX)
- `src/pages/api/**` — API endpoints (prerender=false)

## i18n
- 10 locales: `en`, `zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`
- Default locale: `en` with prefix routing enabled
- All routes prefixed: `/en/skills/...`, `/zh/skills/...`
- Translations stored in KV (`TRANSLATIONS` binding)
- AI-translated descriptions stored inline in skill JSON as `Record<locale, string>`

## Key Libraries
- **Astro** (SSR, Cloudflare adapter) — framework
- **React** — interactive islands (search, favorites, skill actions)
- **Fuse.js** — client fuzzy search fallback
- **Tailwind CSS v4** — styling
- **react-markdown** — skill README rendering
