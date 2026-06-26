---
title: GSC URL Removal Operator Runbook
scope: Phase 155 — GSC Removal Batch Submission & Index Verification
generated: 2026-06-26
---

# GSC URL Removal Operator Runbook

## Purpose

This runbook guides an operator through submitting the **975-URL GSC removal batch** via the Google Search Console URL Removal tool. This is a manual operation — Google does not provide a URL Removal API.

## Prerequisites

- **Access**: Owner or Full user role on the `killer-skills.com` property in [Google Search Console](https://search.google.com/search-console)
- **Browser**: Any modern browser (Chrome recommended for GSC compatibility)
- **CSV file**: `reports/seo/latest-gsc-removal-batch.csv` (975 URLs, one per line)
- **JSON file**: `reports/seo/latest-gsc-removal-batch.json` (975 URLs with cluster/priority metadata)

## Step-by-Step Procedure

### 1. Open the URL Removal Tool

Navigate to:
```
https://search.google.com/search-console/index?url=https://killer-skills.com/&inspectionRemoval
```
Or manually: **Google Search Console → killer-skills.com → Indexing → Page Indexing → Removals**

### 2. Submit URLs in Batches

Google allows bulk URL removal requests. Submit in groups of ~100 URLs per session to avoid rate-limiting.

**For each batch:**

1. Click **"New Request"** → **"Remove all URLs with this prefix"** or **"Remove this URL only"**
2. For cluster-based prefix removal (recommended for high-volume clusters):
   - **source_file cluster**: Submit prefix removal for `https://killer-skills.com/en/skills/*/blob` and similar source-file patterns
   - **trailing_slash cluster**: Submit individual trailing-slash URLs
   - **query_parameter cluster**: Submit prefix removal for URL patterns containing `?`
3. For individual URL removal:
   - Paste the URL from `reports/seo/latest-gsc-removal-batch.csv`
   - Click **"Submit"**

### 3. Removal Priority Order

Submit in this order (highest impact first):

| Priority | Cluster | Count | Method |
|----------|---------|-------|--------|
| 1 | source_file | 301 | Prefix removal by path pattern (e.g. `/skills/*/references/`, `/skills/*/*.md`) |
| 2 | skill_blocklisted | 258 | Individual URL removal |
| 3 | trailing_slash | 192 | Individual URL removal |
| 4 | skill_missing_or_unpublished | 187 | Individual URL removal |
| 5 | query_param | 12 | Individual URL removal |
| 6 | skill_repo_root_single_target | 11 | Individual URL removal |
| 7 | skill_noncanonical_locale | 4 | Individual URL removal |
| 8 | docs_legacy_slug | 3 | Individual URL removal |
| 9 | deep_path | 2 | Individual URL removal |
| 10 | skill_repo_root_multi_target | 2 | Individual URL removal |
| 11 | skill_route_mismatch_single_target | 2 | Individual URL removal |
| 12 | middleware_301_redirect | 1 | Individual URL removal |

### 4. Daily Quota

- Google allows approximately **1,000 removal requests per day**
- The full 975-URL batch should complete in a single day
- If rate-limited, spread across 2 days

**Tip:** Use the prefix removal method for the `source_file` cluster (301 URLs) — this can collapse many URLs into a single prefix request (e.g. a repo-level prefix like `/{locale}/skills/{owner}/{repo}/`). Note: most owner-level prefixes are NOT safe because they would also remove the live skill landing page. The `seo-gsc-removal-tracker.ts prefix` command extracts only the safe candidates (verifies no live landing page is collateral-removed).

### 5. Post-Submission Verification

After submitting all URLs:

1. **Wait 24–48 hours** for Google to process the removal requests
2. **Check removal status** in GSC → Removals → see "Removed" and "Expired" tabs
3. **Run the verification pipeline:**
   ```bash
   # Record submission status (edit the tracker JSON after submitting each cluster)
   npm run report:seo:gsc-removal-tracker

   # Refresh all source reports
   npm run report:seo:recovery-refresh

   # Run the URL Inspection coverage sweep to get same-day evidence
   npm run report:seo:url-inspection-coverage-sweep

   # Regenerate the authority uplift scorecard
   npm run report:seo:authority-uplift

   # Check the recovery scorecard
   npm run report:seo:recovery-scorecard
   ```
4. **Verify the expansion boundary** should show `open` if all gates pass
5. **Run the full test suite:** `npx vitest run`

### 6. Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Coverage anomaly count | 10,783 | <2,000 (within 4 weeks) |
| Recovery scorecard Gate 2 | CLEAR | CLEAR (maintained) |
| Authority uplift boundary | open (held) | open (maintained) |
| Search compliance verdict | watch | pass |

### 7. Troubleshooting

| Issue | Resolution |
|-------|-----------|
| "Request denied" | Verify you have Owner or Full user permissions on the property |
| "URL not found" | The URL may already be de-indexed; skip it |
| Rate limiting (429) | Wait 1 hour and retry |
| Removal expired after ~90 days | Re-submit if the URL is still indexed; our noindex tags should prevent re-indexing |
| No change in coverage count after 2 weeks | Some URLs may be "Crawled but not indexed" — they'll drop from coverage naturally over time |

## Related Files

- Removal batch CSV: `reports/seo/latest-gsc-removal-batch.csv`
- Removal batch JSON (with cluster details): `reports/seo/latest-gsc-removal-batch.json`
- Removal batch summary: `reports/seo/latest-gsc-removal-batch.md`
- URL Inspection sweep: `npm run report:seo:url-inspection-coverage-sweep`
- Recovery refresh: `npm run report:seo:recovery-refresh`
