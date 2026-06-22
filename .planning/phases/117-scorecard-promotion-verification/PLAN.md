---
phase: 117
plan: 117-01
type: execute
wave: 1
depends_on: []
files_modified:
  - reports/gsc/latest-ctr-report.json
  - reports/seo/latest-recovery-scorecard.json
  - reports/seo/latest-recovery-control-board.json
  - reports/seo/latest-recovery-execution-queue.json
  - reports/seo/latest-recovery-experiment-ladder.json
  - reports/seo/latest-authority-surface-program.json
  - reports/seo/latest-recovery-proof-window.json
  - reports/seo/latest-recovery-delta-board.json
  - reports/seo/latest-authority-uplift-scorecard.json
  - reports/seo/latest-authority-operator-queue.json
autonomous: true
must_haves:
  artifacts:
    - path: reports/seo/latest-authority-uplift-scorecard.json
      min_lines: 5
  key_links: []
---

# Phase 117 Plan — Scorecard Promotion Verification

## Objective

Validate the enriched authority collections against production-like SEO evidence by fetching fresh Google Search Console CTR inputs, rebuilding the full recovery proof reports, and executing the authority uplift scorecard under authentic gates (without force-opening expansion overrides).

## Requirement Traceability

- **AIOPS-38**: Validate promoted surfaces using scorecard reports under production-like configs.

***

## Tasks

<task>
<name>Refresh GSC CTR Data & Recovery Stack Inputs</name>
<files>
- reports/gsc/latest-ctr-report.json
- reports/seo/latest-recovery-scorecard.json
- reports/seo/latest-recovery-control-board.json
- reports/seo/latest-recovery-execution-queue.json
- reports/seo/latest-recovery-experiment-ladder.json
</files>
<action>
Run the GSC fetcher and the full recovery report generator scripts to establish fresh and authentic inputs:
1. `npm run report:gsc:fetch` (or run tsx on scripts/gsc-fetch-report.ts)
2. `npm run report:seo:recovery-stack`
</action>
<verify>
Confirm that the CTR cache file and all intermediate recovery reports in reports/ are updated with current timestamps.
</verify>
<done>
Fresh GSC inputs are fetched, and all recovery stack reports are successfully regenerated.
</done>
</task>

<task>
<name>Regenerate Authority Uplift Scorecard & Operator Queue</name>
<files>
- reports/seo/latest-authority-uplift-scorecard.json
- reports/seo/latest-authority-operator-queue.json
</files>
<action>
Rebuild the authority surface program and run the scorecard audit to determine which collections have earned promotion status:
1. `npx tsx scripts/seo-authority-surface-program.ts`
2. `npx tsx scripts/seo-authority-uplift-scorecard.ts`
3. `npx tsx scripts/seo-authority-operator-queue.ts`
Verify the status of Homepage Root Hub and the overall promotion gate.
</action>
<verify>
Read the generated scorecard JSON/stdout outputs. Confirm that they report the correct number of promoted surfaces and the status of the expansion gate.
</verify>
<done>
The authority scorecard is regenerated and outputs the authentic promotion status.
</done>
</task>

<task>
<name>Global compilation and smoke test validation</name>
<files>
- reports/seo/latest-authority-uplift-scorecard.json
</files>
<action>
Verify that all typechecks and public surface smoke validations continue to pass cleanly after scorecard updates:
1. `npm run typecheck`
2. `npm run validate:public-surface`
</action>
<verify>
Confirm that both commands complete with exit code 0.
</verify>
<done>
All typechecks and smoke test scripts pass successfully.
</done>
</task>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| GSC API Rate limits or auth errors | Use local CTR cached fallback file if direct API fetch fails |
| Scorecard blocks expansion (expansion remains closed) | This is an expected and valid outcome. Do not force override the gates; report the authentic state in the phase summary |
