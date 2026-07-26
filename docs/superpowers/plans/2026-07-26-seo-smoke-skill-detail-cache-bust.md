# SEO Smoke Skill-Detail Cache-Bust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cache-busted crawler skill-detail requests reach canonical route resolution directly, producing a clean one-hop repository fallback redirect without changing semantic-query or browser behavior.

**Architecture:** Extend the existing exact operational-parameter classifier with a cache-only predicate and a reusable sanitized-search helper. Bypass pre-canonical crawler capsules and early skill-detail query cleanup only for recognized crawler requests containing no semantic parameters, then remove only cache-bust from explicit and canonical redirect locations.

**Tech Stack:** Astro middleware, TypeScript, WHATWG `URL`/`URLSearchParams`, Vitest

## Global Constraints

- Treat only the exact parameter name `seo_smoke_cache_bust` as operational.
- Limit the early-query bypass to recognized crawler skill-detail requests containing only cache-bust.
- Repository entries with only cache-bust must redirect directly to a clean canonical skill path in one hop.
- Canonical skill-detail URLs with only cache-bust may return the existing clean, indexable crawler response directly.
- Real and unknown query parameters must retain existing clean-path redirect behavior, including when cache-bust is also present.
- Ordinary browser query behavior must remain unchanged.
- Do not change repository fallback data, SEO smoke assertions, Data Pipeline, Cache Warmup, sitemap contents, GSC submission, or workflow failure handling.
- Use test-first red-green-refactor for production behavior changes.

---

## File Structure

- Modify `src/middleware.property.test.ts`: add warmup and AI crawler repository-entry, explicit redirect, canonical-detail, mixed unknown, and browser regressions beside the existing skill-detail query test.
- Modify `src/middleware.ts`: classify cache-only query sets before crawler short-circuits, skip premature crawler detail cleanup, and sanitize crawler skill-detail redirect suffixes.

No new module is needed because the operational parameter and every consumer remain private to middleware.

---

### Task 1: Preserve Skill-Detail Canonical Resolution For Cache-Busted Crawlers

**Files:**

- Test: `src/middleware.property.test.ts:674-693`
- Modify: `src/middleware.ts:406-410`
- Modify: `src/middleware.ts:818-822`
- Modify: `src/middleware.ts:1047-1098`
- Modify: `src/middleware.ts:1264-1273`
- Modify: `src/middleware.ts:1549-1586`

**Interfaces:**

- Consumes: `SEO_SMOKE_CACHE_BUST_PARAM`, `hasSemanticCrawlerSearchParams(searchParams)`, `isCrawlerRequest`, and existing canonical/repository fallback resolution.
- Produces: private `hasOnlySeoSmokeCacheBust(searchParams): boolean` and `buildSearchWithoutSeoSmokeCacheBust(url): string` helpers.

- [ ] **Step 1: Add failing behavior regressions**

Insert after the existing `redirects crawler skill detail query variants to the clean canonical path before SSR` test:

```ts
it('redirects cache-busted warmup repository entries directly to the clean canonical skill', async () => {
  let nextCalled = false;
  const response = (await onRequest(
    createContext(
      new URL(
        '/en/skills/callstackincubator/agent-skills?seo_smoke_cache_bust=1700000000000',
        'https://killer-skills.com',
      ).href,
      { headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' } },
    ),
    async () => {
      nextCalled = true;
      return new Response('<html></html>', { status: 200 });
    },
  )) as Response;

  expect(nextCalled).toBe(false);
  expect(response.status).toBe(301);
  expect(response.headers.get('Location')).toBe(
    '/en/skills/callstackincubator/agent-skills/react-native-best-practices',
  );
});

it('serves cache-busted canonical skill details on the clean crawler surface', async () => {
  let nextCalled = false;
  const response = (await onRequest(
    createContext(
      new URL('/en/skills/anthropics/skills/xlsx?seo_smoke_cache_bust=1700000000000', 'https://killer-skills.com').href,
      { headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' } },
    ),
    async () => {
      nextCalled = true;
      return new Response('<html></html>', { status: 200 });
    },
  )) as Response;

  const body = await response.text();
  expect(nextCalled).toBe(false);
  expect(response.status).toBe(200);
  expect(response.headers.get('X-Robots-Tag')).toBe('index, follow');
  expect(body).toContain('<link rel="canonical" href="https://killer-skills.com/en/skills/anthropics/skills/xlsx">');
  expect(body).not.toContain('seo_smoke_cache_bust');
});

it('keeps mixed unknown crawler skill-detail queries on existing clean-path consolidation', async () => {
  const sourcePath = '/en/skills/callstackincubator/agent-skills';
  const response = (await onRequest(
    createContext(
      new URL(`${sourcePath}?unknown=value&seo_smoke_cache_bust=1700000000000`, 'https://killer-skills.com').href,
      { headers: { 'user-agent': 'Killer-Skills-Warmup-Bot/1.0' } },
    ),
    async () => new Response('<html></html>', { status: 200 }),
  )) as Response;

  expect(response.status).toBe(301);
  expect(response.headers.get('Location')).toBe(sourcePath);
});

it('keeps browser skill-detail cache-bust requests on existing clean-path consolidation', async () => {
  const canonicalPath = '/en/skills/anthropics/skills/xlsx';
  const response = (await onRequest(
    createContext(new URL(`${canonicalPath}?seo_smoke_cache_bust=1700000000000`, 'https://killer-skills.com').href, {
      headers: { accept: 'text/html,application/xhtml+xml' },
    }),
    async () => new Response('<html></html>', { status: 200 }),
  )) as Response;

  expect(response.status).toBe(301);
  expect(response.headers.get('Location')).toBe(canonicalPath);
});
```

- [ ] **Step 2: Run the focused suite and verify RED**

Run:

```bash
npx vitest run src/middleware.property.test.ts --reporter=verbose
```

Expected: the repository-entry test fails because `Location` is the same clean repository path, and the canonical-detail test fails because it receives `301` instead of the existing `200` crawler surface. Existing semantic and browser behavior tests pass.

- [ ] **Step 3: Add exact cache-only and sanitized-search helpers**

After `hasSemanticCrawlerSearchParams`, add:

```ts
function hasOnlySeoSmokeCacheBust(searchParams: URLSearchParams): boolean {
  return searchParams.size > 0 && !hasSemanticCrawlerSearchParams(searchParams);
}
```

Replace `buildCrawlerCanonicalUrl` with:

```ts
function buildSearchWithoutSeoSmokeCacheBust(url: URL): string {
  const sanitizedUrl = new URL(url);
  sanitizedUrl.searchParams.delete(SEO_SMOKE_CACHE_BUST_PARAM);
  return sanitizedUrl.search;
}

function buildCrawlerCanonicalUrl(url: URL): string {
  return `https://${SITE_DOMAIN}${url.pathname}${buildSearchWithoutSeoSmokeCacheBust(url)}`;
}
```

- [ ] **Step 4: Bypass premature query cleanup only for cache-only crawlers**

Replace the early skill-detail query block with:

```ts
const isSkillDetailQueryPath = /^\/[a-z]{2}\/skills\/[^/]+\/.+/.test(pathname) && context.url.searchParams.size > 0;
const isCacheBustOnlyCrawlerSkillDetailRequest =
  isSkillDetailQueryPath && isCrawlerRequest && hasOnlySeoSmokeCacheBust(context.url.searchParams);

if (isSkillDetailQueryPath && !isCacheBustOnlyCrawlerSkillDetailRequest) {
  const canonicalSkillPath = resolveCanonicalSkillPathFromPathname(pathname) || pathname;
  return new Response(null, {
    status: 301,
    headers: {
      Location: canonicalSkillPath,
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
```

- [ ] **Step 5: Sanitize skill-detail redirect locations**

In the canonical-route and repository-fallback redirects, replace `context.url.search` with:

```ts
buildSearchWithoutSeoSmokeCacheBust(context.url);
```

The resulting `Location` expressions are:

```ts
Location: canonicalPath + buildSearchWithoutSeoSmokeCacheBust(context.url),
```

Compute the cache-only crawler skill-detail predicate before crawler short-circuits. Use it to bypass the AI crawler capsule and to remove cache-bust from an earlier explicit SEO redirect while preserving its existing suffix behavior for all other requests.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npx prettier --write src/middleware.ts src/middleware.property.test.ts
npx vitest run src/middleware.property.test.ts --reporter=verbose
```

Expected: the middleware property file passes completely. Warmup and AI crawler repository entries have one clean redirect, explicit crawler redirects omit cache-bust, the canonical cache-only detail is `200 index, follow`, and semantic/browser query behavior is unchanged.

- [ ] **Step 7: Commit the behavior change**

Run:

```bash
git diff --check
git add src/middleware.ts src/middleware.property.test.ts
git commit -m "fix(seo): preserve cache-busted skill canonical redirects"
```

Expected: one focused runtime/test commit containing only the two authorized files.

---

### Task 2: Verify, Review, Integrate, And Restore Monitoring

**Files:**

- Review: `src/middleware.ts`
- Review: `src/middleware.property.test.ts`
- Review: `docs/superpowers/specs/2026-07-26-seo-smoke-skill-detail-cache-bust-design.md`
- Review: `docs/superpowers/plans/2026-07-26-seo-smoke-skill-detail-cache-bust.md`

**Interfaces:**

- Consumes: corrected middleware, GitHub required checks, Cloudflare deployment, and `seo-monitoring.yml` dispatch.
- Produces: a merged one-hop redirect fix and a monitoring run that reaches GSC, URL inspection, and sitemap crawl health unless a new independent failure is exposed.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npx prettier --check src/middleware.ts src/middleware.property.test.ts docs/superpowers/specs/2026-07-26-seo-smoke-skill-detail-cache-bust-design.md docs/superpowers/plans/2026-07-26-seo-smoke-skill-detail-cache-bust.md
git diff --check
```

Expected: all tests pass with only established skips; TypeScript, ESLint, Prettier, and whitespace checks pass.

- [ ] **Step 2: Review the complete branch and commit the plan**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src/middleware.ts src/middleware.property.test.ts
git add docs/superpowers/plans/2026-07-26-seo-smoke-skill-detail-cache-bust.md
git commit -m "docs: plan skill-detail smoke cache-bust fix"
```

Expected: the branch contains design, runtime/test, and plan commits with no unrelated changes.

- [ ] **Step 3: Obtain independent task and whole-branch reviews**

Provide reviewers the approved design, implementation plan, test evidence, and `origin/main...HEAD` diff. Fix all Critical and Important findings and rerun covering tests before continuing.

- [ ] **Step 4: Push, open PR, wait checks, and merge**

Run:

```bash
git push -u origin codex/fix-seo-smoke-skill-detail-cache-bust
gh pr create --repo asiawright1122-boop/Killer-AgentSkills --base main --head codex/fix-seo-smoke-skill-detail-cache-bust --title "fix(seo): preserve cache-busted skill canonical redirects" --body $'## Root cause\n\nThe operational SEO smoke cache-bust parameter triggered generic skill-detail query cleanup before repository fallback resolution. Cache-busted repository entries therefore redirected to themselves instead of their canonical skill.\n\n## Fix\n\nBypass early query cleanup only for recognized crawler skill-detail requests containing no semantic parameters, then remove only cache-bust from later canonical redirects. Real and unknown queries and browser behavior remain unchanged. Data Pipeline and Cache Warmup remain enabled and untouched.\n\n## Verification\n\n- Focused middleware RED/GREEN regressions\n- Full Vitest suite\n- TypeScript and ESLint\n- Prettier and whitespace checks\n- Independent task and whole-branch review'
PR_NUMBER=$(gh pr view codex/fix-seo-smoke-skill-detail-cache-bust --repo asiawright1122-boop/Killer-AgentSkills --json number --jq .number)
gh pr checks --repo asiawright1122-boop/Killer-AgentSkills --watch "$PR_NUMBER"
gh pr merge --repo asiawright1122-boop/Killer-AgentSkills "$PR_NUMBER" --squash --delete-branch
```

Expected: all required checks pass before squash merge. The PR body records root cause, fail-closed scope, Data Pipeline preservation, tests, and review results.

- [ ] **Step 5: Wait for deployment and verify live redirect behavior**

After the merge SHA deployment succeeds, run:

```bash
BASE_URL='https://killer-skills.com'
curl -sS -o /dev/null -D - --max-redirs 0 -A 'Killer-Skills-Warmup-Bot/1.0' "${BASE_URL}/en/skills/callstackincubator/agent-skills?seo_smoke_cache_bust=1700000000000"
```

Expected: `301` with `Location: /en/skills/callstackincubator/agent-skills/react-native-best-practices` and no query string.

- [ ] **Step 6: Re-run SEO monitoring and record independent outcomes**

Run:

```bash
RUN_URL=$(gh workflow run seo-monitoring.yml --repo asiawright1122-boop/Killer-AgentSkills --ref main)
RUN_ID=${RUN_URL##*/}
gh run watch --repo asiawright1122-boop/Killer-AgentSkills "$RUN_ID" --exit-status
gh run view --repo asiawright1122-boop/Killer-AgentSkills "$RUN_ID" --json conclusion,jobs,url
```

Expected: the GSC CTR consolidation check passes. `Fetch GSC Report`, `Run URL Inspection Coverage Sweep`, and `Run Sitemap Crawl Health Audit` execute rather than being skipped by this redirect failure. Diagnose any new downstream failure separately.

- [ ] **Step 7: Recheck GSC evidence conservatively**

Record the latest performance data date, impressions, clicks, visible queries/pages, indexed/not-indexed totals, 5xx validation state, and sitemap freshness. Restored monitoring is immediate evidence; traffic recovery still depends on Google recrawl and reindexing.
