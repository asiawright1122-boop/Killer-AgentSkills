# Phase 105 — Traffic and CTR Visibility Refresh

## What This Phase Does

Refresh live GSC search console traffic statistics and organic click trends by executing `scripts/gsc-ctr-report.ts`, updating reports, and validating if the business recovery status can transition out of `blocking` on the scorecard.

## Requirement

- **AIOPS-26**: Refresh live GSC search console stats, track organic click trends, and verify if the business recovery status can transition out of `blocking`.

## Current State

- **Technical Recovery**: Confirmed CLEAR (100.00% indexation rate).
- **Business Recovery**: Requires fresh, live organic CTR report data.
- **Traffic Tools**: `scripts/gsc-ctr-report.ts` fetches Search Console metrics and writes `reports/gsc/latest-ctr-report.md`.
- **Scorecard**: Needs to read the latest GSC CTR data to evaluate business recovery gate status.

## Key Files

| File | Role |
|------|------|
| `scripts/gsc-ctr-report.ts` | Fetches live Search Console click/impression metrics and generates report |
| `reports/gsc/latest-ctr-report.md` | Generated organic performance and CTR report |
| `scripts/seo-recovery-scorecard.ts` | Evaluates overall recovery scorecard gates, including Business Recovery |

## Discussion Summary

To prove that the directory's organic search visibility has recovered, we must ingest and display recent Search Console performance records. In this phase, we will:
1. Run the GSC query script `npm run report:gsc` to fetch the latest weekly traffic, click, and impression counts.
2. Verify the output file `latest-ctr-report.md` matches expected formatting and is populated.
3. Run the scorecard recalculation script to update `latest-recovery-scorecard.json` and confirm if both Technical and Business recovery gates are fully CLEAR.
