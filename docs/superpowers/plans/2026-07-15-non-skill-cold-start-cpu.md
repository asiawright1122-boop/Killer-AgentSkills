# Non-Skill Cold-Start CPU Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent non-skill page requests from initializing large skill routing datasets so uncached blog and article requests stay below the Cloudflare Worker CPU limit.

**Architecture:** Add one path classifier in the middleware and use it to gate the existing skill governance and sitemap-skill loaders. Keep the lightweight SEO rules loader global so redirect and gone-rule behavior remains unchanged.

**Tech Stack:** Astro middleware, TypeScript, Vitest, Cloudflare Workers, Wrangler

## Global Constraints

- Preserve explicit `301` and `410` rule precedence.
- Preserve crawler capsule behavior and ordinary SSR output.
- Do not add dependencies or change Sitemap contents.
- Accept only a production probe with zero `5xx / 1102` responses.

---

### Task 1: Route-Scoped Skill Data Loading

**Files:**

- Create: `src/middleware.lazy-loading.test.ts`
- Modify: `src/middleware.ts`

**Interfaces:**

- Consumes: `pathname: string`, existing `loadSkillLocaleGovernance()` and `ensureSitemapSkillsLoaded()` functions.
- Produces: `requiresSkillRoutingData: boolean`, true only for localized skill detail paths.

- [ ] **Step 1: Write the failing middleware test**

Create an isolated Vitest module test that mocks `loadSkillLocaleGovernance` and `getSitemapSkills`, invokes `onRequest` for `https://killer-skills.com/es/blog`, and asserts both mocks were not called while `next()` was called once.

```ts
const response = await onRequest(createContext('https://killer-skills.com/es/blog'), nextMock);

expect(response.status).toBe(200);
expect(nextMock).toHaveBeenCalledTimes(1);
expect(mocks.loadSkillLocaleGovernance).not.toHaveBeenCalled();
expect(mocks.getSitemapSkills).not.toHaveBeenCalled();
```

- [ ] **Step 2: Verify the test fails for the production bug**

Run:

```bash
npx vitest run src/middleware.lazy-loading.test.ts
```

Expected: FAIL because the current middleware invokes both skill-specific loaders for `/es/blog`.

- [ ] **Step 3: Implement the minimal route gate**

In `src/middleware.ts`, classify only localized skill detail paths as requiring skill routing data and gate the two large loaders with that value.

```ts
const requiresSkillRoutingData = /^\/[a-z]{2}\/skills\/[^/]+\/[^/]+(?:\/|$)/.test(pathname);

if (
  !_seoRedirectPathMap ||
  (requiresSkillRoutingData && (!isGovernanceLoaded() || !_sitemapSkillsLoaded || sitemapSkillsStale))
) {
  const env = await getRuntimeEnv<{ SKILLS_CACHE?: KVNamespace }>(context.locals);
  await Promise.all([
    requiresSkillRoutingData && !isGovernanceLoaded() ? loadSkillLocaleGovernance(env || {}) : Promise.resolve(),
    requiresSkillRoutingData && (!_sitemapSkillsLoaded || sitemapSkillsStale)
      ? ensureSitemapSkillsLoaded(env || {})
      : Promise.resolve(),
    !_seoRedirectPathMap ? ensureMiddlewareDataLoaded(env || {}) : Promise.resolve(),
  ]);
}
```

- [ ] **Step 4: Verify focused and regression tests**

Run:

```bash
npx vitest run src/middleware.lazy-loading.test.ts src/middleware.test.ts src/middleware.skill-route.test.ts src/middleware.property.test.ts
```

Expected: all tests pass with zero failures.

- [ ] **Step 5: Verify static checks and production build**

Run:

```bash
npx prettier --check src/middleware.ts src/middleware.lazy-loading.test.ts
npx eslint src/middleware.ts src/middleware.lazy-loading.test.ts --max-warnings 0
npm run check:astro
npm run build
```

Expected: every command exits `0`; existing Astro hints may remain, but no errors are allowed.

- [ ] **Step 6: Commit, deploy, and verify production**

```bash
git add src/middleware.ts src/middleware.lazy-loading.test.ts
git commit -m "fix(perf): scope skill routing cold-start data"
npm run deploy
git push origin HEAD:main
```

Repeat the same 80 Googlebot plus 80 browser uncached requests against `/es/blog`. Expected: `160/160` final status `200`, zero Cloudflare error code `1102`.
