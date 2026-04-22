---
phase: 47-traffic-diagnosis-and-recovery-priority-board
plan: 01
type: plan
wave: 1
depends_on:
  - '46-01'
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/STATE.md'
  - '.planning/milestones/v1.5-phases/47-traffic-diagnosis-and-recovery-priority-board/47-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/47-traffic-diagnosis-and-recovery-priority-board/47-PLAN.md'
  - 'scripts/lib/recovery-control-board.ts'
  - 'scripts/lib/recovery-control-board.test.ts'
  - 'scripts/seo-recovery-control-board.ts'
  - 'reports/seo/latest-recovery-control-board.md'
  - 'reports/seo/latest-recovery-control-board.json'
requirements:
  - SEO-16
  - GOV-10
autonomous: true
must_haves:
  truths:
    - 'The recovery board must separate true recovery opportunities from measurement gaps caused by missing GSC evidence.'
    - 'Page, query, locale, and issue-cluster lenses must resolve into one ranked operator board instead of disconnected diagnostics.'
    - 'The board must remain honest when only coverage or recovery-scorecard evidence is available.'
  artifacts:
    - path: 'reports/seo/latest-recovery-control-board.json'
      provides: 'Machine-readable ranked recovery board with blocked, recoverable, and recovered lenses'
    - path: 'reports/seo/latest-recovery-control-board.md'
      provides: 'Operator-readable recovery control board for Phase 48 execution'
---

# Phase 47 Plan 01: Traffic Diagnosis and Recovery Priority Board

<objective>
Turn the recovery scorecard and upstream evidence into one ranked control board that shows which surfaces are blocked by missing measurement, which are recoverable, and which already look stable.

Purpose: move from global recovery truth to surface-level operator diagnosis without pretending missing traffic evidence exists.
Output: one control-board generator that merges page, query, locale, and issue-cluster lenses into a ranked priority view with explicit next actions.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.5-phases/47-traffic-diagnosis-and-recovery-priority-board/47-CONTEXT.md
@reports/seo/latest-recovery-scorecard.json
@reports/gsc/latest-ctr-report.json
@reports/seo/latest-coverage-drilldown.json
@reports/seo/index-drift.json
@scripts/lib/recovery-scorecard.ts
@src/lib/gsc-report.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Build a unified recovery-control board model</name>
  <action>Create a reusable board builder that merges recovery scorecard truth, coverage clusters, and Search Console evidence into one ranked priority surface list.</action>
  <acceptance_criteria>The board emits machine-readable blocked, recoverable, and recovered items instead of separate ad-hoc reports.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Add page, query, locale, and cluster lenses</name>
  <action>Use GSC snapshot CSVs when available to rank page/query/locale opportunities, and fall back to explicit measurement-gap states when GSC evidence is blocked or missing.</action>
  <acceptance_criteria>Operators can see which lenses are blocked by missing traffic evidence versus which issue clusters are already diagnosable from coverage data.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Ship operator-facing control-board artifacts</name>
  <action>Generate markdown and JSON artifacts that summarize lens readiness, top priority surfaces, and the next actions that Phase 48 should execute against.</action>
  <acceptance_criteria>The board is readable locally, ranks the top opportunities, and remains truthful when traffic evidence is not yet fresh.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-control-board.test.ts`
- `npx tsx scripts/seo-recovery-control-board.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has one ranked control board that can answer what is blocked, what is recoverable, and what is already stable without hiding measurement gaps behind technical recovery.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/47-traffic-diagnosis-and-recovery-priority-board/47-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/47-traffic-diagnosis-and-recovery-priority-board/47-VERIFICATION.md` only if the board and verification gates are actually satisfied.
</output>
