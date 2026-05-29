---
phase: 66-priority-surface-ctr-and-ai-search-visibility
milestone: v1.9
plan: 66-01
requirements:
  - CTR-02
  - GEO-04
status: completed
created: 2026-05-29
files:
  - '.planning/phases/66-priority-surface-ctr-and-ai-search-visibility/66-CONTEXT.md'
  - '.planning/phases/66-priority-surface-ctr-and-ai-search-visibility/66-PLAN.md'
  - 'scripts/submit-indexnow.mjs'
  - 'reports/seo/latest-authority-uplift-scorecard.json'
---

# Phase 66 Plan 01: Priority Surface CTR and AI Search Visibility

## Objective

Identify priority authority surfaces with click opportunities, review and maintain non-manipulative, helpful copy, and capture IndexNow submission/AI visibility evidence.

## Tasks

1. Run the authority uplift scorecard to extract priority authority surfaces.
   - Identified priority surfaces: Homepage, Installation Docs, Official AI Skills.
2. Review the user-facing copy on these P0 surfaces.
   - Confirm that their metadata and headings remain accurate, clean, non-manipulative, and aligned with helpful-content/snippet guidelines.
3. Submit sitemap URLs recursively to IndexNow endpoints.
   - Run `npm run submit:indexnow` to notify search engines of our clean sitemap index.
4. Document the honest AI-search visibility state.
   - Confirm IndexNow success (8,428 total endpoints notified) and record Bing AI / GSC AI-search as currently unavailable (no synthetic or invented traffic claims).

## Acceptance Criteria

- Priority authority surfaces are selected from real-world GSC/scorecard evidence rather than intuition.
- Copy on priority surfaces is verified to comply with helpful-content guidelines.
- IndexNow submission is successfully executed with verifiable results.
- Unobtainable AI performance data is recorded as unavailable without synthetic claims.

## Verification Commands

```bash
npm run report:seo:authority-uplift-scorecard
npm run submit:indexnow
npm run report:planning:traceability
```
