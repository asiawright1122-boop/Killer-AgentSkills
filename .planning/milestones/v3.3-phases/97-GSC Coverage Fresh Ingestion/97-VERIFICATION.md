---
phase: 97-gsc-coverage-fresh-ingestion
requirements_completed:
  - AIOPS-18
---

# Verification: Phase 97 (GSC Coverage Fresh Ingestion)

## Verification Steps
- Run the ingestion command:
  ```bash
  npx tsx scripts/ingest-coverage-drilldown.ts <path-to-fresh-csv>
  ```
- Confirm stdout outputs:
  `✅ SLA Freshness Check Passed: Latest crawl is X.X days old.`
- Ensure there are no warnings regarding SLA freshness violations.

## Expected Outcomes
- GSC Coverage database is updated with fresh data.
- The 7-day SLA validation passes cleanly.
