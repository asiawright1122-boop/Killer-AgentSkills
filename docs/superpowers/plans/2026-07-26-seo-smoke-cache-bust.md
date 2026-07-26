# SEO Smoke Cache-Bust Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep cache-busted SEO smoke requests for localized skills indexes indexable while preserving `noindex` behavior and semantic canonicals for real crawler filters.

**Architecture:** Define the exact operational parameter once in middleware, then use a small query classifier at every crawler listing decision point. Build crawler capsule canonicals from a copied URL with only the operational parameter removed, leaving request/cache behavior and all semantic parameters unchanged.

**Tech Stack:** Astro middleware, TypeScript, WHATWG `URL`/`URLSearchParams`, Vitest

## Global Constraints

- Treat only the exact parameter name `seo_smoke_cache_bust` as operational and nonsemantic.
- Keep the SEO smoke script's query-based cache bypass unchanged.
- Cache-only crawler requests to `/{locale}/skills` must return the indexable public crawler surface with a clean pathname canonical.
- Any real or unknown query parameter must keep the filtered crawler surface `noindex, follow`.
- Mixed requests must remove only `seo_smoke_cache_bust` from canonical output and preserve every semantic parameter and value.
- Do not alter browser rendering, edge-cache policy, Data Pipeline, Cache Warmup, sitemap contents, GSC submission, or semantic filter policy.
- Use test-first red-green-refactor for production behavior changes.

---

## File Structure

- Modify `src/middleware.property.test.ts`: add warmup-bot regressions for cache-only, semantic-only, mixed, and unknown query parameters.
- Modify `src/middleware.ts`: define the operational parameter, classify semantic search parameters consistently, and sanitize crawler capsule canonicals without mutating requests.

No new runtime module is warranted: the classifier is private to middleware, has no external consumers, and is exercised through public request behavior.

---

### Task 1: Correct Crawler Query Classification And Canonicals

**Files:**

- Test: `src/middleware.property.test.ts:430-489`
- Modify: `src/middleware.ts:405-461`
- Modify: `src/middleware.ts:558-560`
- Modify: `src/middleware.ts:812-830`

**Interfaces:**

- Consumes: `URL.searchParams`, existing `isAiCrawlerCapsulePath(url)`, `isCrawlerSkillsListingParamPath(url)`, `resolveCrawlerPublicSurface(url)`, and `buildAiCrawlerCapsuleResponse(url)`.
- Produces: private constant `SEO_SMOKE_CACHE_BUST_PARAM`, private function `hasSemanticCrawlerSearchParams(searchParams): boolean`, and private function `buildCrawlerCanonicalUrl(url): string`.

- [ ] **Step 1: Add failing warmup crawler regression tests**

Insert these tests after the existing `returns a lightweight noindex response for crawler skills search URLs before SSR` test in `src/middleware.property.test.ts`:

```ts
it('keeps a cache-busted warmup request on the indexable public skills surface', async () => {
  let nextCalled = false;
  const response = (await onRequest(
    createContext('https://killer-skills.com/en/skills?seo_smoke_cache_bust=1700000000000', {
      headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' },
    }),
    async () => {
      nextCalled = true;
      return new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    },
  )) as Response;

  const body = await response.text();
  expect(nextCalled).toBe(false);
  expect(response.status).toBe(200);
  expect(response.headers.get('X-Robots-Tag')).toBe('index, follow');
  expect(response.headers.get('X-Cache')).toBe('BYPASS-CRAWLER-SURFACE');
  expect(body).toContain('<link rel="canonical" href="https://killer-skills.com/en/skills">');
  expect(body).not.toContain('seo_smoke_cache_bust');
});

it('keeps a semantic warmup skills query noindex with its query canonical', async () => {
  const response = (await onRequest(
    createContext('https://killer-skills.com/en/skills?q=spreadsheet', {
      headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' },
    }),
    async () => new Response('<html></html>', { status: 200 }),
  )) as Response;

  const body = await response.text();
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
  expect(body).toContain('<link rel="canonical" href="https://killer-skills.com/en/skills?q=spreadsheet">');
});

it('removes only cache-bust from mixed warmup skills query canonicals', async () => {
  const response = (await onRequest(
    createContext('https://killer-skills.com/en/skills?q=spreadsheet&seo_smoke_cache_bust=1700000000000', {
      headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' },
    }),
    async () => new Response('<html></html>', { status: 200 }),
  )) as Response;

  const body = await response.text();
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
  expect(body).toContain('<link rel="canonical" href="https://killer-skills.com/en/skills?q=spreadsheet">');
  expect(body).not.toContain('seo_smoke_cache_bust');
});

it('treats unknown warmup query parameters as semantic and fails closed', async () => {
  const response = (await onRequest(
    createContext('https://killer-skills.com/en/skills?unknown=value&seo_smoke_cache_bust=1700000000000', {
      headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' },
    }),
    async () => new Response('<html></html>', { status: 200 }),
  )) as Response;

  const body = await response.text();
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
  expect(body).toContain('<link rel="canonical" href="https://killer-skills.com/en/skills?unknown=value">');
  expect(body).not.toContain('seo_smoke_cache_bust');
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/middleware.property.test.ts --reporter=verbose
```

Expected: the cache-only test fails because the response is `noindex, follow` with `X-Cache: BYPASS-AI-CRAWLER`, and the mixed/unknown tests fail because their canonicals still contain `seo_smoke_cache_bust`. Existing middleware tests continue to pass.

- [ ] **Step 3: Add the narrow operational-parameter classifier**

In `src/middleware.ts`, immediately after `isAiCrawlerUserAgent`, add:

```ts
const SEO_SMOKE_CACHE_BUST_PARAM = 'seo_smoke_cache_bust';

function hasSemanticCrawlerSearchParams(searchParams: URLSearchParams): boolean {
  return Array.from(searchParams.keys()).some((name) => name !== SEO_SMOKE_CACHE_BUST_PARAM);
}
```

Update the localized skills-listing branch in `isAiCrawlerCapsulePath` and replace `isCrawlerSkillsListingParamPath` with:

```ts
function isAiCrawlerCapsulePath(url: URL): boolean {
  const { pathname, searchParams } = url;
  if (/^\/[a-z]{2}\/skills\/[^/]+\/[^/]+(?:\/[^/]+)?$/.test(pathname)) return true;
  if (/^\/[a-z]{2}\/skills$/.test(pathname) && hasSemanticCrawlerSearchParams(searchParams)) return true;
  return /^\/[a-z]{2}\/occupations\/[^/]+$/.test(pathname);
}

function isCrawlerSkillsListingParamPath(url: URL): boolean {
  return /^\/[a-z]{2}\/skills$/.test(url.pathname) && hasSemanticCrawlerSearchParams(url.searchParams);
}
```

- [ ] **Step 4: Allow cache-only URLs to resolve to the public crawler surface**

Change the guard at the start of `resolveCrawlerPublicSurface` to:

```ts
function resolveCrawlerPublicSurface(url: URL): CrawlerPublicSurface | null {
  if (hasSemanticCrawlerSearchParams(url.searchParams)) return null;
```

This keeps clean and cache-only URLs eligible while all real or unknown parameters remain ineligible.

- [ ] **Step 5: Remove only the operational parameter from crawler capsule canonicals**

Add this helper immediately before `buildAiCrawlerCapsuleResponse`:

```ts
function buildCrawlerCanonicalUrl(url: URL): string {
  const canonicalUrl = new URL(url);
  canonicalUrl.searchParams.delete(SEO_SMOKE_CACHE_BUST_PARAM);
  return `https://${SITE_DOMAIN}${canonicalUrl.pathname}${canonicalUrl.search}`;
}
```

Then replace the existing canonical assignment inside `buildAiCrawlerCapsuleResponse`:

```ts
const canonicalUrl = buildCrawlerCanonicalUrl(url);
```

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run src/middleware.property.test.ts --reporter=verbose
```

Expected: `src/middleware.property.test.ts` passes completely. The cache-only warmup request returns `index, follow` with canonical `/en/skills`; semantic and unknown queries remain `noindex, follow`; mixed canonicals omit only the cache-bust parameter.

- [ ] **Step 7: Format and commit the behavior change**

Run:

```bash
npx prettier --write src/middleware.ts src/middleware.property.test.ts
npx vitest run src/middleware.property.test.ts
git diff --check
git add src/middleware.ts src/middleware.property.test.ts
git commit -m "fix(seo): ignore smoke cache-bust in crawler canonicals"
```

Expected: formatting and focused tests pass, `git diff --check` is clean, and the commit contains only the middleware behavior and regression tests.

---

### Task 2: Verify, Review, Integrate, And Re-run Production Monitoring

**Files:**

- Review: `src/middleware.ts`
- Review: `src/middleware.property.test.ts`
- Review: `docs/superpowers/specs/2026-07-26-seo-smoke-cache-bust-design.md`
- Review: `docs/superpowers/plans/2026-07-26-seo-smoke-cache-bust.md`

**Interfaces:**

- Consumes: the corrected middleware behavior, GitHub required checks, Cloudflare production deployment, and the `SEO And Operator Monitoring` workflow dispatch entry point.
- Produces: a merged production fix and a monitoring run in which SEO smoke no longer blocks GSC, URL inspection, or sitemap crawl health because of `/en/skills` canonical mismatch.

- [ ] **Step 1: Run the repository verification suite**

Run:

```bash
npm test
npm run typecheck
npm run lint
npx prettier --check src/middleware.ts src/middleware.property.test.ts docs/superpowers/specs/2026-07-26-seo-smoke-cache-bust-design.md docs/superpowers/plans/2026-07-26-seo-smoke-cache-bust.md
git diff --check
```

Expected: all tests pass with only established skips; TypeScript, ESLint, Prettier, and whitespace checks pass. Any unrelated pre-existing failure must be recorded rather than hidden or fixed outside scope.

- [ ] **Step 2: Review the complete branch diff**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src/middleware.ts src/middleware.property.test.ts
git status --short --branch
```

Expected: one design document commit, one middleware/test commit, and the uncommitted implementation plan. The runtime diff contains only the operational-parameter classifier, public-surface eligibility guard, canonical sanitizer, and four focused tests.

- [ ] **Step 3: Commit the implementation plan**

Run:

```bash
git add docs/superpowers/plans/2026-07-26-seo-smoke-cache-bust.md
git commit -m "docs: plan SEO smoke cache-bust fix"
```

Expected: the branch has three focused commits and a clean worktree.

- [ ] **Step 4: Push and open a focused pull request**

Run:

```bash
git push -u origin codex/fix-seo-smoke-cache-bust
gh pr create --repo asiawright1122-boop/Killer-AgentSkills \
  --base main \
  --head codex/fix-seo-smoke-cache-bust \
  --title "fix(seo): ignore smoke cache-bust in crawler canonicals" \
  --body $'## Root cause\n\nThe SEO smoke monitor appends `seo_smoke_cache_bust`, but middleware classified every crawler query on `/en/skills` as a semantic filtered listing. The monitor received a `noindex` capsule whose canonical included the operational parameter and stopped before GSC and crawl-health checks.\n\n## Fix\n\nTreat only `seo_smoke_cache_bust` as operational for crawler listing classification. Cache-only requests receive the normal indexable crawler surface; semantic and unknown query parameters remain `noindex`; mixed canonicals remove only the cache-bust parameter. The daily Data Pipeline and Cache Warmup workflows remain enabled and unchanged.\n\n## Verification\n\n- Focused middleware regressions using the production warmup user agent\n- Full Vitest suite\n- TypeScript and ESLint checks\n- Prettier and `git diff --check`'
```

Expected: a ready-for-review PR with required checks started.

- [ ] **Step 5: Wait for required checks and merge only when green**

Run:

```bash
PR_NUMBER=$(gh pr view codex/fix-seo-smoke-cache-bust --repo asiawright1122-boop/Killer-AgentSkills --json number --jq .number)
gh pr checks --repo asiawright1122-boop/Killer-AgentSkills --watch "$PR_NUMBER"
gh pr merge --repo asiawright1122-boop/Killer-AgentSkills "$PR_NUMBER" --squash --delete-branch
```

Expected: all required checks pass before the PR is squash-merged into `main`.

- [ ] **Step 6: Wait for production deployment and verify the live canonical directly**

Run after the deployment workflow for the merge commit succeeds:

```bash
curl -fsSL \
  -A 'Killer-Skills-Warmup-Bot/1.0' \
  'https://killer-skills.com/en/skills?seo_smoke_cache_bust=1700000000000' \
  | rg '<meta name="robots"|<link rel="canonical"'
```

Expected: robots contains `index, follow`, canonical is exactly `https://killer-skills.com/en/skills`, and the canonical contains no cache-bust parameter.

- [ ] **Step 7: Re-run the SEO monitoring workflow**

Run:

```bash
gh workflow run seo-monitoring.yml --repo asiawright1122-boop/Killer-AgentSkills --ref main
RUN_ID=$(gh run list --repo asiawright1122-boop/Killer-AgentSkills --workflow seo-monitoring.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch --repo asiawright1122-boop/Killer-AgentSkills "$RUN_ID" --exit-status
gh run view --repo asiawright1122-boop/Killer-AgentSkills "$RUN_ID" --json conclusion,jobs,url
```

Expected: `Run Production SEO Smoke` passes the localized skills-index check. `Fetch GSC Report`, `Run URL Inspection Coverage Sweep`, and `Run Sitemap Crawl Health Audit` execute rather than being skipped because of the canonical mismatch. Report any independent downstream failure separately.

- [ ] **Step 8: Recheck recovery evidence without claiming immediate traffic recovery**

Review the generated monitoring artifacts and current GSC performance/indexing reports. Record the latest data date, impressions, clicks, visible pages/queries, 5xx validation state, and sitemap freshness. The expected immediate result is restored trustworthy monitoring; search traffic and query visibility may lag recrawl and reindexing.
