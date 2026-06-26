---
gsd_state_version: 1.0
milestone: v4.9
milestone_name: Authority Surface Uplift & Coverage Freshness
status: in_progress
last_updated: "2026-06-26T10:30:00.000Z"
last_activity: 2026-06-26
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
---

# Current Position

Phase: 155 (automation complete; manual submission pending operator)
Plan: GSC Removal Batch Submission & Index Verification
Status: Phase 155 automation delivered (runbook corrections + removal tracker script). The 975-URL GSC removal submission is a manual operator task — no API exists. Tracker script supports planning, progress recording, and verification.
Last activity: 2026-06-26

## Phase 155 Automation Delivered

The GSC URL Removal tool has no API, so submission is manual. This phase automated the surrounding workflow:
- Corrected the operator runbook (`docs/superpowers/runbooks/gsc-url-removal-runbook.md`) — cluster counts now match `latest-gsc-removal-batch.md`, priority order corrected, baseline values updated to post-Phase-154 state (boundary=open, compliance=watch), target corrected to <2,000.
- Created `scripts/seo-gsc-removal-tracker.ts` with four commands: `status` (submission dashboard), `prefix` (safe prefix-removal extraction — only 2 safe prefixes exist, most owner-level prefixes would collateral-remove live landing pages), `mark` (record submissions), `verify` (delegates to URL Inspection sweep).
- Wired `npm run report:seo:gsc-removal-tracker`.

## Remaining Operator Action

Phase 155 submission is a manual operator task:
- Runbook: `docs/superpowers/runbooks/gsc-url-removal-runbook.md`
- 975 URLs to submit via GSC URL Removal tool (mostly individual; only 2 safe prefix removals)
- Track progress: `npm run report:seo:gsc-removal-tracker -- mark --cluster <name> --count <N>`
- Verify after 24–48h: `npm run report:seo:url-inspection-coverage-sweep`
