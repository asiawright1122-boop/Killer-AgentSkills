# SEO Smoke Skill-Detail Cache-Bust Design

## Context

PR #28 fixed crawler classification for cache-busted localized skills indexes. The merged change deployed successfully, and a live warmup request to `/en/skills?seo_smoke_cache_bust=...` now returns `index, follow` with clean canonical `https://killer-skills.com/en/skills`.

The next `SEO And Operator Monitoring` run passed `/en/skills` and continued through the remaining smoke checks until the GSC CTR consolidation redirect. A cache-busted request to the repository entry `/en/skills/callstackincubator/agent-skills` redirected back to the same clean repository path instead of redirecting to `/en/skills/callstackincubator/agent-skills/react-native-best-practices`. GSC collection, URL inspection, and sitemap crawl health were skipped again because production smoke is a blocking prerequisite.

## Evidence

- PR #28 merged as `82265508582cf35edbb22e0992eecec54937369f`.
- Main CI and Cloudflare deployment run `30186616162` passed unit tests, lint, build, local SEO smoke, local crawl health, deployment, and production verification.
- Live `/en/skills?seo_smoke_cache_bust=...` evidence after deployment returned `X-Robots-Tag: index, follow`, `X-Cache: BYPASS-CRAWLER-SURFACE`, and canonical `/en/skills`.
- Monitoring run `30186751338` passed the localized skills-index checks and then failed only at `runGscCtrConsolidationRedirectCheck`.
- Without a query parameter, `/en/skills/callstackincubator/agent-skills` returns one `301` to `/en/skills/callstackincubator/agent-skills/react-native-best-practices`.
- With only `seo_smoke_cache_bust`, the same repository entry returns one `301` to `/en/skills/callstackincubator/agent-skills`, dropping the parameter but delaying the real repository fallback redirect to a second request.
- `src/middleware.ts` currently strips every skill-detail query at an early generic canonicalization block before repository fallback resolution runs.

## Decision

For recognized crawler requests to localized skill-detail paths, treat a query containing only `seo_smoke_cache_bust` as operational during early query canonicalization.

1. A crawler skill-detail request with only `seo_smoke_cache_bust` bypasses pre-canonical crawler capsules and the early query-strip redirect, then continues through normal canonical-route or repository-fallback resolution.
2. A repository entry then redirects directly to its resolved clean canonical skill path in one hop.
3. The redirect `Location` omits `seo_smoke_cache_bust`.
4. A canonical skill-detail URL with only cache-bust may return the existing lightweight indexable crawler response directly, whose canonical remains clean.
5. Any real or unknown query parameter remains semantic. Existing behavior that redirects such skill-detail query variants to a clean canonical path remains unchanged, including when cache-bust is also present.
6. Browser behavior remains unchanged; the operational exception is limited to recognized crawler requests used by production monitoring and search crawlers.

## Design

Reuse the existing exact-name query classifier introduced by PR #28. The generic skill-detail query canonicalization condition will distinguish cache-only crawler requests from requests with semantic parameters. It will skip the early redirect only when all of these are true:

- the path is a localized skill-detail path;
- the request is recognized as a crawler;
- at least one query parameter is present; and
- no parameter other than `seo_smoke_cache_bust` is present.

All other requests keep the current early canonicalization behavior.

The cache-only predicate is computed before crawler short-circuits so recognized AI crawler user agents do not return a capsule before repository fallback resolution. Existing blocked-route handling remains ahead of that exception.

When an explicit SEO rule, canonical-route redirect, or repository-fallback redirect handles a cache-only crawler request, it builds the query suffix from a copied URL after deleting only `seo_smoke_cache_bust`. This produces the clean one-hop destination while preserving existing behavior for semantic parameters. The incoming request URL will not be mutated.

No repository-specific exception is added. The existing `callstackincubator/agent-skills` consolidation remains the monitored example, but the operational-parameter behavior applies consistently to every crawler skill-detail route.

## Alternatives Considered

### Make the smoke check follow two redirects

Rejected because the first redirect is caused only by an operational parameter and returns to the same resource path. Accepting the extra hop would hide middleware ordering interference and increase crawler work.

### Remove cache-bust from this smoke check

Rejected because the redirect assertion could validate a stale edge response after deployment.

### Hardcode the monitored repository before query canonicalization

Rejected because the defect is parameter classification and middleware ordering, not repository data. A repository-specific branch would leave the same behavior on other fallback routes.

### Ignore every query parameter on crawler skill details

Rejected because real and unknown query variants must continue consolidating to clean canonical URLs. Only the exact operational parameter is exempted.

## Failure Semantics

- A cache-only crawler repository entry that redirects to itself or needs two hops is a regression.
- A cache-only crawler redirect whose `Location` retains `seo_smoke_cache_bust` is a regression.
- A semantic or unknown query variant that stops redirecting to a clean path is a blocking regression.
- An ordinary browser request whose query behavior changes is a blocking regression.
- Unknown parameter names remain semantic by default; the allowlist contains only `seo_smoke_cache_bust`.
- Production smoke remains blocking. No retry, redirect-following relaxation, assertion bypass, or `continue-on-error` behavior is added.

## Testing

Add focused middleware coverage using `Killer-Skills-Warmup-Bot/1.0` and a representative AI crawler user agent:

1. The monitored repository entry with only cache-bust returns `301` directly to `/en/skills/callstackincubator/agent-skills/react-native-best-practices`, with no query string.
2. A canonical skill-detail route with only cache-bust returns the existing `200`, `index, follow` crawler response and a clean canonical.
3. The existing crawler skill-detail semantic-query test continues returning one clean-path `301`.
4. A crawler repository entry with an unknown parameter plus cache-bust keeps the existing semantic-query cleanup behavior.
5. A browser skill-detail cache-bust request keeps the existing clean-path redirect behavior.
6. An AI crawler repository entry with only cache-bust reaches the same one-hop canonical resolution.
7. A cache-only crawler skill-detail path covered by an explicit SEO redirect emits a clean `Location`.

Run the focused middleware suite, full unit suite, typecheck, lint, Prettier, and whitespace checks. After independent task and whole-branch review, open a new focused PR. Merge only after required checks pass, wait for deployment, verify the live one-hop redirect, and rerun `SEO And Operator Monitoring`.

## Scope

This change is limited to skill-detail crawler short-circuits, query canonicalization, and redirect suffix construction in `src/middleware.ts`, with regression coverage in `src/middleware.property.test.ts`. It does not change listing behavior fixed by PR #28, repository fallback data, smoke assertions, browser query policy, Data Pipeline, Cache Warmup, sitemap contents, GSC submission, or workflow failure handling.
