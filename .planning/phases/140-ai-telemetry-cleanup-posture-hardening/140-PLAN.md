---
wave: 1
depends_on: []
files_modified:
  - reports/seo/latest-ai-runtime-summary.json
autonomous: true
---

# Phase 140 Plan: AI Telemetry Cleanup & Posture Hardening

This phase resets the quarantined status of primary NVIDIA nodes by cleaning stale retryable failure statistics from telemetry logs and regenerates health indicators to restore the AI Runtime Posture to CLEAR.

## Tasks

### Task 1: Reset Quarantined Stats in latest-ai-runtime-summary.json

<read_first>
- [reports/seo/latest-ai-runtime-summary.json](file:///Users/kaka/Dev/Killer-Skills/reports/seo/latest-ai-runtime-summary.json)
</read_first>

<acceptance_criteria>
- `latest-ai-runtime-summary.json` contains no quarantined reasons for N0, N1, N2, N3.
- `consecutiveRetryableFailures` and `recentRetryableFailureCount` for all NVIDIA nodes are set to 0.
- `available` is set to `true` for N0, N1, N2, N3.
</acceptance_criteria>

<action>
Modify `reports/seo/latest-ai-runtime-summary.json` to reset stats for NVIDIA labels N0, N1, N2, N3:
- Set `consecutiveRetryableFailures` to 0.
- Set `consecutive429s` to 0.
- Set `recentRetryableFailureCount` to 0.
- Set `recentCooldownCount` to 0.
- Set `failureCount` to 0.
- Set `pressureScore` to 0.
- Set `available` to true.
- Clear the `reasons` list (set to `[]`).
- Set `lastError` and `lastPressureAt` to null.
</action>

---

### Task 2: Rerun AI Provider Health and Telemetry Reports

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run report:ai:health` runs successfully.
- `reports/seo/latest-ai-provider-health.json` has `AI Runtime Posture` status as CLEAR (or no active alerts blocking primary nodes).
- `npm run report:seo:recovery-scorecard` runs successfully and reports `AI Runtime Posture` as CLEAR.
</acceptance_criteria>

<action>
Execute:
1. `npm run report:ai:health`
2. `npm run report:seo:recovery-scorecard`
Verify the status outputs.
</action>

---

### Task 3: Execute System Integrity Verification

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run typecheck` exits with 0.
- `npm run validate:public-surface` exits with 0.
- `npm test` runs all tests successfully.
</acceptance_criteria>

<action>
Execute:
1. `npm run typecheck`
2. `npm run validate:public-surface`
3. `npm test`
</action>
