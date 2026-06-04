---
phase: 105-traffic-and-ctr-visibility-refresh
requirements_completed:
  - AIOPS-26
---

# Verification: Phase 105 (Traffic and CTR Visibility Refresh)

## Verification Steps
- Check that the GSC report snapshot directory has the latest query and page csv files.
- Run the GSC query script:
  ```bash
  npx tsx scripts/gsc-fetch-report.ts
  ```
- Check the generated report at `reports/gsc/latest-ctr-report.md`.
- Run the scorecard recalculation script:
  ```bash
  npx tsx scripts/seo-recovery-scorecard.ts
  ```
- Check the generated scorecard report at `.planning/dashboards/recovery-scorecard.md` to confirm all gates (Crawl Health, Coverage Freshness, Index Integrity, Traffic Visibility, AI Runtime Posture) are CLEAR and overall status transitions to CLEAR.

## Expected Outcomes
- Search Console snapshot directory contains files for `2026-05-28-to-2026-06-03`.
- `latest-ctr-report.json` shows status as `clear`.
- Scorecard regenerated with all gates (including Traffic Visibility) showing `CLEAR`.
