# Phase 149 Research: Multilingual Sitemap & Route Cache Warmup Automation

## 1. Background & Requirement
Requirement **WARM-01** (Cache Warmup & Hydration) mandates automated warmup mechanisms to ensure primary Google Search Console (GSC) crawl pathways, including multilingual sitemaps and key route templates, have a high edge cache hit rate. This is necessary to keep Time to First Byte (TTFB) low and prevent cold-start dynamic rendering load.

## 2. Key Findings & Existing Setup

### A. Sitemap URLs
The project generates several sitemap indexes and files at build time (`prerender = true`):
- `/sitemap.xml`
- `/sitemap-static.xml`
- `/sitemap-blog.xml`
- `/sitemap-collections.xml`
- `/sitemap-docs.xml`
- `/sitemap-skills.xml`
These static xml assets should be warmed up first.

### B. High-Priority Listing Routes
Multilingual core listing pages suffer from high Edge Worker dynamic loading time. Warming these up under all 10 supported locales (e.g. `/zh/skills`, `/ja/collections`) is crucial.
Supported locales: `en`, `zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`.

### C. Multilingual Skill Details
Currently, `scripts/warmup-ssr-cache.ts` only warms up the `canonicalLocale` URL of the top N skills.
However, crawlers hit various language variants published for each skill. We must load governance data from `data/seo-skill-locale-governance.json` and warm up all `publishedLocales` for each top skill.

### D. Throttling and Rate Limiting Exception
The project implements zsh sliding window IP request density throttling (REC-39) in `src/middleware.ts`. Under high concurrency, the warmup script sending hundreds of requests would trigger throttling, resulting in degraded static fallbacks instead of cache hydration.
- The User-Agent contains `killer-skills-warmup-bot`.
- The middleware must explicitly exempt requests matching this User-Agent from rate-limiting counters.

### E. Existing Warmup Script (`scripts/warmup-ssr-cache.ts`)
The existing script is functional but limited:
- Only canonical locales are queried.
- Sitemaps and static listing routes are ignored.
- CF Cache Status headers are not checked or logged.

## 3. Proposed Enhancements

### 3.1. Update `scripts/warmup-ssr-cache.ts`
1. **Extend Governance Map**: Map skill route keys to both `canonicalLocale` and `publishedLocales` array.
2. **Seed Initial URLs**:
   - Push all sitemap URLs.
   - Push all core listing routes for all supported locales.
3. **Queue Published Skill URLs**: For each skill in the top N (sorted by stars), query and add all locales present in `publishedLocales`.
4. **Cap Total URLs**: Enforce a sensible `WARMUP_URL_LIMIT` (default 300) to keep execution under 2 minutes.
5. **Analyze Cloudflare Cache**:
   - Parse `CF-Cache-Status` response header (e.g. `HIT`, `MISS`, `EXPIRED`).
   - Log cache statuses and aggregate a final Cache Hit Rate metric.

### 3.2. Update `src/middleware.ts`
Check if the User-Agent contains `killer-skills-warmup-bot` (or matching regex). If so, bypass the zsh request counters to prevent throttling.

## 4. Verification Plan
- **TypeScript Compilation**: `npm run typecheck`
- **Unit and Integration Tests**: `npm test`
- **Astro Build**: `npm run build`
- **Warmup Dry-Run**: Execute `npm run cache:warmup` against localhost/staging and verify outputs.
