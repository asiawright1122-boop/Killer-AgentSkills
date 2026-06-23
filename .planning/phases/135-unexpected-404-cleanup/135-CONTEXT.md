# Phase 135: Unexpected 404 Cleanup - Context

**Gathered:** 2026-06-23
**Status:** Ready for execution
**Source:** User request and GSC crawl research

<domain>
## Phase Boundary

This phase aims to analyze the Google Search Console (GSC) 404 crawl errors, update the static 404 rules mapping, and ensure that legacy or deprecated paths redirect properly to canonical pages or return 410 Gone status dynamically, preventing crawl budget dispersion and unexpected indexing penalties.

</domain>

<decisions>
## Implementation Decisions

### 404 Rules Materialization
- Run the 404 cleanup tools (`npm run report:seo:404-refresh`) to parse the latest `未找到 (404)` Coverage Drilldown raw data from GSC (dated 2026-06-03).
- Commit the materialized rules (`data/seo-404-rules.json`) that declare redirect mappings (such as redirecting legacy `/ar/collections/top-community-skills` to `/ar/collections/top-community-contributed-ai-agent-skills`) and 410 Gone mappings for dead skills.

### Middleware-level Redirection Guard
- Verify that the edge middleware (`src/middleware.ts`) automatically intercepts matching pathnames using the refreshed `seo-404-rules.json` data and issues correct 301 Redirect or 410 Gone responses.

### Verify Template Integrity
- Build Astro production bundles to ensure no broken or malformed relative links inside components (`src/components/`, `src/layouts/Layout.astro`) or page routes generate local 404 failures during static page prerendering.

</decisions>

<canonical_refs>
## Canonical References

- [seo-404-rules.json](file:///Users/kaka/Dev/Killer-Skills/data/seo-404-rules.json)
- [middleware.ts](file:///Users/kaka/Dev/Killer-Skills/src/middleware.ts)
- [latest-404-remediation-plan.md](file:///Users/kaka/Dev/Killer-Skills/reports/seo/latest-404-remediation-plan.md)
- [latest-404-missing-cluster-audit.md](file:///Users/kaka/Dev/Killer-Skills/reports/seo/latest-404-missing-cluster-audit.md)

</canonical_refs>
