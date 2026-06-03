# Phase 75: automated-directory-expansion-and-index-rollout - Context

## Background

Under Milestone `v2.2 Directory Automated Expansion and Full Rollout`, we are ready to enable automated directory expansion at scale.
Previously, target P0 surfaces have successfully been promoted to `automation-candidate` in Phase 74.
Now, in Phase 75, we need to open the indexation boundaries for wider directory sub-paths (namely supporting repository directory pages where multiple skills exist) and ensure the Edge routing rules (middleware) allow search engines to crawl and index them under the operator override flag (`OVERRIDE_EXPANSION_BOUNDARY=open`).

## Active Constraints

- Repository directory pages (`renderRepoDirectory` in `[...repo].astro`) are normally hardcoded to `noindex` and crawler requests to them are blocked with a `410` or `404` status in the edge middleware.
- When `isForcedOpen` is active, both the edge middleware and page layout should allow crawler access and set `X-Robots-Tag: index, follow` for these known repository directory pages.
