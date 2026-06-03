---
phase: 69-fresh-gsc-coverage-ingestion
milestone: v2.0
requirements:
  - REC-30
  - REC-31
status: active
created: 2026-05-29
---

# Phase 69 Plan: Ingest and Reconcile Fresh GSC Coverage Report

This plan outlines the steps needed to ingest the fresh Page Indexing Drilldown report from Google Search Console, confirm de-indexing of 404 traps, and restore our search-governance freshness SLA.

## Steps

### Step 1: Obtain and Position the GSC Coverage Drilldown Report
- **Action**: Operator downloads the latest Page Indexing (Coverage) export from Google Search Console for `killer-skills.com` and unzips it or places the zip file under `data/coverage-drilldown-raw/`.
- **Verify**: Confirm that a new directory named `killer-skills.com-Coverage-Drilldown-2026-05-XX` exists under `data/coverage-drilldown-raw/`.

### Step 2: Clear Local Freshness SLA Override
- **Action**: Locate the local freshness override settings (such as `SEO_COVERAGE_SOURCE_MAX_DAYS=100` in `.env.local` or inline environment configurations) and restore them to the default sub-3-day SLA (usually 3 days).
- **Verify**: Confirm that running the reporting scripts without the override successfully enforces the freshness constraint on the May 2026 report.

### Step 3: Run Coverage Ingestion & Error Reconciliation
- **Action**: Execute `npm run report:seo:coverage-drilldown` or the ingestion scripts to parse the raw CSV files, reconcile remaining error URLs, and classify crawler-reported paths.
- **Verify**: Check that the generated `reports/seo/latest-coverage-drilldown.json` and related audit files post-date May 2026 and that total unresolved errors dropped materially (e.g. < 10%).

### Step 4: Verify De-indexing of 404/Colon Traps
- **Action**: Verify that historical invalid/non-canonical paths (such as those containing colons or redirect loops) are marked as 410 (Gone) or 301 (Redirected) in the crawl logs, showing that Google has successfully de-indexed them.
- **Verify**: Confirm 0 occurrences of active redirect traps in our sitemap-skills.json index.
