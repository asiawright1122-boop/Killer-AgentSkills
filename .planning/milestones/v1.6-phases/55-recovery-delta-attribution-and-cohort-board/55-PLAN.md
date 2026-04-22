---
phase: 55-recovery-delta-attribution-and-cohort-board
plan: 01
type: plan
wave: 1
depends_on:
  - '54-01'
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/STATE.md'
  - '.planning/phases/55-recovery-delta-attribution-and-cohort-board/55-CONTEXT.md'
  - '.planning/phases/55-recovery-delta-attribution-and-cohort-board/55-PLAN.md'
  - 'scripts/lib/recovery-delta-board.ts'
  - 'scripts/lib/recovery-delta-board.test.ts'
  - 'scripts/seo-recovery-delta-board.ts'
  - 'reports/seo/latest-recovery-delta-board.md'
  - 'reports/seo/latest-recovery-delta-board.json'
requirements:
  - SEO-22
autonomous: true
must_haves:
  truths:
    - 'Movement must be compared against the archived v1.5 baseline and dated proof windows, not guessed from isolated snapshots.'
    - 'Attribution must distinguish real movement from freshness gaps or still-blocked cohorts.'
    - 'Authority-surface grouping must sit inside the same decision surface as locale and cluster evidence.'
  artifacts:
    - path: 'reports/seo/latest-recovery-delta-board.json'
      provides: 'Machine-readable cohort delta view across authority surfaces, locales, clusters, and governed corpus groups'
    - path: 'reports/seo/latest-recovery-delta-board.md'
      provides: 'Operator-readable interpretation of what is improving, flat, noisy, or still blocked'
---

# Phase 55 Plan 01: Recovery Delta Attribution and Cohort Board

<objective>
Compare the archived `v1.5` baseline and the dated proof windows from Phase `54` so operators can see which cohorts are actually moving after governance.

Purpose: transform proof snapshots into actionable attribution before authority uplift work begins.
Output: a delta board that explains movement by authority-surface group, locale, issue cluster, and governed corpus cohort.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/55-recovery-delta-attribution-and-cohort-board/55-CONTEXT.md
@.planning/milestones/v1.5-MILESTONE-AUDIT.md
@reports/seo/latest-recovery-proof-window.json
@reports/seo/latest-recovery-control-board.json
@reports/seo/latest-authority-surface-program.json
@data/authority-surfaces.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define cohort comparison inputs</name>
  <action>Normalize the baseline and proof-window artifacts into comparable cohorts such as authority surfaces, governed canonicals, locales, and issue clusters.</action>
  <acceptance_criteria>The delta board reads from a shared comparison model instead of bespoke per-report logic.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Build the recovery delta board</name>
  <action>Generate a ranked board that marks each cohort as improving, flat, noisy, or blocked and explains the evidence behind that status.</action>
  <acceptance_criteria>Operators can open one report and understand where real post-governance movement exists and where confidence is still too low.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Prepare downstream handoff for authority uplift</name>
  <action>Expose the specific cohorts and surfaces that Phase `56` should deepen, hold, or avoid based on the delta evidence.</action>
  <acceptance_criteria>The report contains enough structured output that authority-surface uplift work can inherit it without manual re-analysis.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-delta-board.test.ts`
- `npx tsx scripts/seo-recovery-delta-board.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project can explain which cohorts are actually improving after governance and which ones are merely less noisy or still blocked.
</success_criteria>

<output>
After completion, create `.planning/phases/55-recovery-delta-attribution-and-cohort-board/55-01-SUMMARY.md` and `.planning/phases/55-recovery-delta-attribution-and-cohort-board/55-VERIFICATION.md` only if the delta-board verification gates are actually satisfied.
</output>
