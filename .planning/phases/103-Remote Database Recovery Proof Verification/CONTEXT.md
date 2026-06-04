# Phase 103 — Remote Database Recovery Proof Verification

## What This Phase Does

Verify remote D1 database GSC coverage records by executing `scripts/verify-recovery-proof.ts` to output the post-intervention recovery scorecard (`.planning/dashboards/recovery-scorecard.md`), validating the remote indexation recovery rate against the 95% threshold.

## Requirement

- **AIOPS-24**: Verify remote database GSC coverage records via automated tooling and generate the post-intervention recovery scorecard.

## Current State

- **Local Scorecard**: Overall status is `CLEAR`, crawl-health and local indicators are passing.
- **Verification Tool**: `scripts/verify-recovery-proof.ts` exists and queries wrangler remote database `killer-skills-db`.
- **Target File**: `.planning/dashboards/recovery-scorecard.md` needs to be generated/updated.
- **D1 Database**: Contains the `gsc_coverage_drilldown` table with actual status (Indexed vs Excluded) and exclusion reasons.

## Key Files

| File | Role |
|------|------|
| `scripts/verify-recovery-proof.ts` | Verification script that executes Wrangler D1 queries and writes the scorecard |
| `.planning/dashboards/recovery-scorecard.md` | Target generated markdown report showing recovery rate and exclusion analysis |

## Discussion Summary

To verify the actual search indexation state of the directory, we must run verification checks against the remote production database. Running `scripts/verify-recovery-proof.ts` performs JSON queries via Wrangler D1. The goal of this phase is to:
1. Ensure the script runs successfully on the operator's machine.
2. Confirm the remote recovery rate is correctly calculated and written to the markdown dashboard.
3. Investigate the generated exclusion reasons breakdown to inform the next phase (Phase 104 remediation).
