# Plan: Multilingual Sitemap & Route Cache Warmup Automation

This phase extends the edge SSR cache warmup script to support sitemaps, key list routes, and multilingual variants, and exempts the warmup bot from IP rate-limiting inside the middleware.

- **Wave:** 1
- **Depends on:** None
- **Files modified:**
  - `src/middleware.ts`
  - `scripts/warmup-ssr-cache.ts`
- **Requirements:** WARM-01
- **Autonomous:** true

## Tasks

### Task 1: Exempt Warmup Bot in `src/middleware.ts`

<read_first>
- [middleware.ts](file:///Users/kaka/Dev/Killer-Skills/src/middleware.ts)
</read_first>

<acceptance_criteria>
- `src/middleware.ts` contains rate limit exclusion for User-Agents matching `killer-skills-warmup-bot`.
- The rate limiter `incrementAndCheckRate` is bypassed when `isCrawlerUserAgent` matches the warmup bot, preventing it from being throttled.
</acceptance_criteria>

<action>
In `src/middleware.ts`, modify the onRequest middleware to check if `isCrawlerRequest` is active and skip IP counters for the warmup bot.
Around line 490:
```typescript
// Replace:
  // Apply request density throttling (REC-39)
  if (!isStaticOrApiPath(pathname)) {
    const clientIp = context.clientAddress || context.request.headers.get('cf-connecting-ip') || '127.0.0.1';
    const { ipLimit, globalLimit, ipCount, globalCount } = incrementAndCheckRate(clientIp);

// With:
  // Apply request density throttling (REC-39)
  const isWarmupRequest = userAgent.includes('killer-skills-warmup-bot');
  if (!isWarmupRequest && !isStaticOrApiPath(pathname)) {
    const clientIp = context.clientAddress || context.request.headers.get('cf-connecting-ip') || '127.0.0.1';
    const { ipLimit, globalLimit, ipCount, globalCount } = incrementAndCheckRate(clientIp);
```
</action>

---

### Task 2: Refactor `scripts/warmup-ssr-cache.ts` for Multilingual and Sitemap Warmup

<read_first>
- [warmup-ssr-cache.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/warmup-ssr-cache.ts)
- [seo-skill-locale-governance.json](file:///Users/kaka/Dev/Killer-Skills/data/seo-skill-locale-governance.json)
</read_first>

<acceptance_criteria>
- Sitemaps `/sitemap.xml`, `/sitemap-static.xml`, etc. are prepended to the URL list.
- Multi-locale listing templates (home, skills, collections, categories, docs) are enqueued.
- Both `canonicalLocale` and all available `publishedLocales` are queried and enqueued for the top skills.
- The total URL count is capped using a configurable environment variable `WARMUP_URL_LIMIT` (default: 300).
- Logs parse and display the `cf-cache-status` header, and print an aggregated Cache Hit Rate at the end.
</acceptance_criteria>

<action>
Rewrite `scripts/warmup-ssr-cache.ts` to implement the advanced warmup logic:
1. Load `publishedLocales` from `data/seo-skill-locale-governance.json` and add them to the queue.
2. Add static sitemaps and listing pages.
3. Call `probeWarmupUrl` and capture the `CF-Cache-Status` response header.
4. Calculate and log the final edge cache hit rate.
</action>

---

### Task 3: Execute Verification Loop

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run typecheck` succeeds.
- `npm test` runs with all 1063 tests green.
- `npm run cache:warmup` executes successfully against a test domain or localhost.
</acceptance_criteria>

<action>
Run:
1. `npm run typecheck`
2. `npm test`
3. Verify type safety and test stability.
</action>

## Verification Plan

### Automated Tests
- Type checking: `npm run typecheck`
- Test suite: `npm test`

### Manual Verification
- Dry-run the warmup script targeting localhost or a dummy domain:
  ```bash
  WARMUP_LIMIT=10 PUBLIC_SITE_URL=http://localhost:4321 npm run cache:warmup
  ```
