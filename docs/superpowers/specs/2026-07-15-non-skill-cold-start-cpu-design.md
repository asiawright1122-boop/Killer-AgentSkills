# Non-Skill Cold-Start CPU Design

## Problem

Uncached localized pages can return Cloudflare `503 / 1102` under concurrent requests. A production probe reproduced the failure on blog index and category routes for both Googlebot and browser user agents. Those routes currently initialize the complete skill-locale governance map before rendering, even though they never consume skill routing data.

The governance payload is approximately 4.36 MB and contains 7,927 records. Parsing and populating it on Worker cold starts consumes enough CPU to exceed the Cloudflare limit when uncached requests create several isolates at once.

## Chosen Design

Keep the existing middleware pipeline, but load skill-specific routing data only for localized skill detail paths of the form `/{locale}/skills/{owner}/...`.

- Continue loading SEO redirect, gone, and sitemap blocklist rules wherever the middleware currently requires them.
- Skip `loadSkillLocaleGovernance()` and `ensureSitemapSkillsLoaded()` for blog, article, docs, collections, localized home pages, and the skills directory root.
- Preserve all crawler capsules, explicit `301` and `410` precedence, edge-cache behavior, security headers, and ordinary SSR output.
- Do not replace article or blog content with crawler-only capsules.

## Alternatives Rejected

1. Extending crawler capsules to blog routes would lower CPU, but it would serve reduced content to search engines and create indexing-quality risk.
2. Cache prewarming would only protect already-warmed points of presence and would not remove the cold-start failure mode.

## Verification

1. Add a middleware test proving a non-skill localized route does not invoke skill governance or sitemap-skill loaders.
2. Keep existing skill route, crawler capsule, redirect, and property tests green.
3. Run lint, formatting, Astro checks, and a production build.
4. Deploy, then repeat the uncached concurrency probe for Googlebot and browser user agents. The acceptance criterion is zero `5xx / 1102` responses.
