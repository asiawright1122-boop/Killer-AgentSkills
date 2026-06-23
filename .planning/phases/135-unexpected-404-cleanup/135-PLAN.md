---
phase: 135
plan: 135-01
type: execute
wave: 1
depends_on:
  - 134
files_modified:
  - data/seo-404-rules.json
  - src/middleware.property.test.ts
autonomous: true
---

# Phase 135 Plan — Unexpected 404 Cleanup

## Objective

Analyze GSC crawl stats, update the static redirect/gone mappings in `data/seo-404-rules.json` via the remediation plan, and add test cases to verify both redirection and 410 Gone status codes resolve correctly at the middleware level.

## Requirement Traceability

- **ERR404-01**: Investigate and fix root causes of unexpected 404 crawl errors reported in GSC.

***

## Tasks

### Task 1: Materialize SEO 404 Rules and Validate Redirects in Tests

<read_first>
- File: `data/seo-404-rules.json`
- File: `src/middleware.property.test.ts`
- Reference: `src/middleware.ts` (specifically redirections and gone status handling)
</read_first>

<acceptance_criteria>
- `data/seo-404-rules.json` contains the legacy collection redirection rule for `/ar/collections/top-community-skills` redirecting to `/ar/collections/top-community-contributed-ai-agent-skills`.
- `src/middleware.property.test.ts` contains test assertions ensuring `/ar/collections/top-community-skills` returns a 301 Redirect to the canonical URL, and dead skills (such as `/ja/skills/sabaronnie/AI-Driven-Cronut-CEO-Agent`) return 410 Gone.
- All tests pass successfully.
</acceptance_criteria>

<action>
1. Verify `data/seo-404-rules.json` already contains the rule compiled by the refresh script.
2. Edit `src/middleware.property.test.ts`:
   - Add a test case asserting a GET request to `/ar/collections/top-community-skills` yields a `301` status code and a `Location` header pointing to `/ar/collections/top-community-contributed-ai-agent-skills`.
   - Add a test case asserting a GET request to `/ja/skills/sabaronnie/AI-Driven-Cronut-CEO-Agent` yields a `410` status code.
3. Run `npm test` to verify the new tests pass.
</action>

***

### Task 2: Build and Test Integrity Validation

<read_first>
- Reference: `package.json`
</read_first>

<acceptance_criteria>
- `npm run build` completes successfully.
- `npm test` completes successfully with all tests passing.
</acceptance_criteria>

<action>
1. Execute full Vitest suite:
   ```bash
   npm test
   ```
2. Execute production Astro build:
   ```bash
   npm run build
   ```
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Adding static redirects breaks other matching dynamic routes | Ensure the redirect rules in `data/seo-404-rules.json` are exact matches and do not overlap with active canonical sitemap paths. The `seo-404-rules.ts` script already includes protection via `sitemapPaths.has(fromPath)` check. |
