# Phase 135 Research — Unexpected 404 Cleanup

## 1. Objective

Analyze GSC crawl stats, identify the root causes of unexpected 404 crawl errors, ensure all redirection mapping decisions are fully materialized in `data/seo-404-rules.json`, and verify that the edge router handles these mappings correctly with zero regressions.

---

## 2. GSC 404 Crawl Error Analysis

Following the execution of `npm run report:seo:404-refresh` on the latest GSC Coverage Drilldown data (ingested from 2026-06-03), we generated the latest 404 remediation reports. The findings are summarized below:

### 2.1 404 Remediation Plan Statistics
- **Total Sample URLs Analyzed**: 1000
- **301 Candidates**: 157 (mostly canonicalized/redirected at middleware level)
- **410 Gone Candidates**: 824 (unsupported, deprecated or dead paths)
- **Manual Review**: 12 (parameterized query search pages, e.g., `/fr/skills?q=...`)
- **Observe / Recrawl Watch**: 7 (sitemap-backed pages monitored for recrawl)

### 2.2 Core Remediation Categorizations

- **`trailing_slash_canonicalization`**: Handled automatically by the edge router redirecting `/*/.../` to `/*/...` (trailingSlash: 'never').
- **`repo_single_skill_redirect` & `nested_skill_parent_redirect`**: Handled dynamically by the middleware. If a requested skill repository has been deleted or renamed but contains exactly one active canonical skill target (or matches a parent skill route), the middleware dynamically redirects it (e.g., `/en/skills/remotion-dev/skills/rules/lottie.md` -> `/en/skills/remotion-dev/skills/remotion`).
- **`legacy_collection_slug_redirect`**: This is a key finding where a legacy collection slug `/ar/collections/top-community-skills` was reported as 404 in GSC because it was not covered by automatic middleware rules and its target has changed to `/ar/collections/top-community-contributed-ai-agent-skills`. Running the refresh script has successfully generated a static `redirect301` rule mapping for it in `data/seo-404-rules.json`.
- **`gone_410` Candidates**: Dead skill pages or crawl trap paths (such as source code extension pages `/skills/.../*.md` or invalid sub-paths) that are absent from the active corpus. These are compiled into the static `gone410` array of `data/seo-404-rules.json` to return 410 Gone.

---

## 3. Template and Layout Integrity Audit

- We searched the component files (`src/components/`), layouts (`src/layouts/`), and pages (`src/pages/`) for hardcoded or broken link structures.
- All primary links dynamically query the translation mappings or retrieve canonical slugs from collection models (e.g. using `canonicalSlug` and `legacySlugs` logic).
- Astro production build completed with `Complete!` status, proving that no broken relative links triggered prerendering errors.

---

## 4. Proposed Verification Strategy

### 4.1 Automated Tests
- Run `npm test` to verify all Vitest suite matches, particularly testing middleware redirection and the `seo-404-rules.json` data schema.
- Run Astro production build (`npm run build`) to ensure static prerendering is clean.

### 4.2 Manual / Rule Verification
- Assert that `/ar/collections/top-community-skills` resolves with a 301 Redirect to `/ar/collections/top-community-contributed-ai-agent-skills`.
- Assert that dead paths like `/ja/skills/sabaronnie/AI-Driven-Cronut-CEO-Agent` resolve with a 410 Gone status.
