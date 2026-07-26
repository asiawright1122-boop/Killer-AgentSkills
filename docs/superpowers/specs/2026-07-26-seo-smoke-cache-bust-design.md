# SEO Smoke Cache-Bust Classification Design

## Context

The production SEO smoke check requests public pages with the crawler user agent `Killer-Skills-Warmup-Bot/1.0` and appends `seo_smoke_cache_bust` to bypass stale responses. The middleware currently treats every query parameter on `/{locale}/skills` as a semantic filtered listing. As a result, the smoke request for `/en/skills` receives the filtered-listing crawler capsule instead of the indexable public crawler surface.

That capsule is intentionally `noindex, follow`, but its canonical includes the operational cache-bust parameter. The smoke check therefore fails with a canonical mismatch before GSC collection, URL inspection, and sitemap crawl health can run.

Normal browser requests to `/en/skills` still expose the clean canonical. This is a monitoring and crawler-query classification defect, not evidence that the ordinary visitor page changed canonical policy.

## Evidence

- GitHub Actions run `30183934407` passed indexability report generation, content governance, and the operator summary after the prerequisite fix.
- `Run Production SEO Smoke` then failed because `/en/skills` returned a canonical using origin `https://killer-skills.com` with query-bearing path `/en/skills?seo_smoke_cache_bust=...`.
- `scripts/seo-smoke.ts` deliberately appends `seo_smoke_cache_bust` through `withCacheBust` and uses `Killer-Skills-Warmup-Bot/1.0`.
- `src/middleware.ts` recognizes that user agent as a crawler.
- `isCrawlerSkillsListingParamPath`, `isAiCrawlerCapsulePath`, and `resolveCrawlerPublicSurface` currently use total query-parameter count rather than distinguishing operational parameters from semantic filters.
- `buildAiCrawlerCapsuleResponse` builds its canonical from the complete request query string, preserving the cache-bust token.

## Decision

Treat only the exact query-parameter name `seo_smoke_cache_bust` as an operational, nonsemantic parameter when classifying crawler requests and generating crawler canonicals.

For crawler requests to `/{locale}/skills`:

1. With no query parameters, retain the existing indexable public crawler surface.
2. With only `seo_smoke_cache_bust`, return the same indexable public crawler surface and canonicalize to the clean pathname, such as `https://killer-skills.com/en/skills`.
3. With any other query parameter, retain the existing filtered-listing crawler capsule and `noindex, follow` policy.
4. When semantic parameters and `seo_smoke_cache_bust` coexist, remove only `seo_smoke_cache_bust` from the capsule canonical. Preserve every semantic parameter and its value.

The smoke script will continue sending cache-busted requests. Cache bypass behavior and monitor coverage remain unchanged.

## Design

Introduce a narrow middleware-level definition for the operational SEO smoke parameter. Query classification will answer whether a URL has parameters other than that allowlisted name. This helper will be used consistently by the crawler listing predicates and public crawler-surface resolver so a cache-only request follows the same lightweight indexable path as a clean request.

Crawler capsule canonical generation will create a copy of the request URL, delete only `seo_smoke_cache_bust`, and construct the canonical from the remaining pathname and query. The incoming URL will not be mutated. Existing semantic parameters such as `q`, `category`, and `occupation`, as well as unknown parameters, remain meaningful for classification and remain present in the canonical.

The operational parameter remains part of the request and edge-cache decision. Existing crawler requests with query parameters already bypass edge-cache lookup, so this change does not turn cache-busted smoke requests into cache hits.

No general tracking-parameter normalization is introduced. Expanding the allowlist to UTM parameters or arbitrary cache keys would change product SEO policy and is outside this fix.

## Alternatives Considered

### Stop appending cache-bust in the smoke script

Rejected because the monitor could validate a stale edge response after a deployment and report a false success.

### Use request `Cache-Control` headers instead of a query parameter

Rejected because intermediary and CDN cache behavior is not guaranteed to honor a client bypass directive consistently. The current URL variation gives the monitor deterministic cache separation.

### Ignore all query parameters for crawler listing canonicals

Rejected because real search and filter combinations intentionally remain `noindex` surfaces with query-aware canonicals. Removing all parameters would collapse semantically different filtered URLs and weaken the existing policy.

### Special-case only the smoke assertion

Rejected because accepting a polluted canonical in the monitor would hide the production middleware defect rather than fix it.

## Failure Semantics

- A cache-only crawler request that does not resolve to the indexable public surface is a regression and must fail middleware tests and the production smoke check.
- A semantic filtered crawler request that becomes indexable is a blocking regression.
- A mixed request whose canonical retains `seo_smoke_cache_bust` or drops a semantic parameter is a blocking regression.
- Unknown query parameters are treated as semantic by default. The allowlist fails closed and contains only `seo_smoke_cache_bust`.
- The monitor retains its current retry and failure behavior; this change adds no fallback, `continue-on-error`, or assertion bypass.

## Testing

Add focused middleware tests using the actual warmup crawler user agent:

1. `/en/skills?seo_smoke_cache_bust=1700000000000` returns status 200, `index, follow`, the crawler public-surface marker, and canonical `https://killer-skills.com/en/skills`.
2. `/en/skills?q=spreadsheet` remains `noindex, follow` and retains `q=spreadsheet` in its canonical.
3. `/en/skills?q=spreadsheet&seo_smoke_cache_bust=1700000000000` remains `noindex, follow`; its canonical retains `q=spreadsheet` and omits only the cache-bust parameter.
4. `/en/skills?unknown=value&seo_smoke_cache_bust=1700000000000` remains `noindex, follow`, proving unknown parameters fail closed.

Run the focused middleware test file first, then the full test suite, formatting checks, and the repository's type/build checks. After merge and deployment, manually dispatch `SEO And Operator Monitoring` and verify that production smoke, GSC collection, URL inspection, and sitemap crawl health all execute.

## Scope

This change is limited to crawler query classification and canonical generation in `src/middleware.ts`, with regression coverage in `src/middleware.property.test.ts`. It does not change browser rendering, the Data Pipeline, Cache Warmup, sitemap contents, GSC submission behavior, semantic filter policy, or the smoke script's cache-busting mechanism.
