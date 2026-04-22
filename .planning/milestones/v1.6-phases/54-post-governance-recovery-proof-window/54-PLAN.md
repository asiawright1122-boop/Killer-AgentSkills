---
phase: 54-post-governance-recovery-proof-window
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - '.planning/PROJECT.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/ROADMAP.md'
  - '.planning/STATE.md'
  - '.planning/phases/54-post-governance-recovery-proof-window/54-CONTEXT.md'
  - '.planning/phases/54-post-governance-recovery-proof-window/54-PLAN.md'
  - 'scripts/lib/recovery-proof-window.ts'
  - 'scripts/lib/recovery-proof-window.test.ts'
  - 'scripts/seo-recovery-proof-window.ts'
  - 'reports/seo/latest-recovery-proof-window.md'
  - 'reports/seo/latest-recovery-proof-window.json'
  - 'reports/seo/recovery-proof-windows/'
requirements:
  - SEO-21
autonomous: true
must_haves:
  truths:
    - 'Post-governance recovery must be judged from dated windows, not from memory or a single latest-state snapshot.'
    - 'Proof windows must show whether freshness is trustworthy before operators use them to justify expansion decisions.'
    - 'Stale raw Coverage inputs must remain explicit blockers even when snapshot generation succeeds.'
  artifacts:
    - path: 'reports/seo/latest-recovery-proof-window.json'
      provides: 'Machine-readable summary of the newest proof window, baseline reference, and freshness verdict'
    - path: 'reports/seo/latest-recovery-proof-window.md'
      provides: 'Operator-readable proof window report that explains what can and cannot be trusted yet'
    - path: 'reports/seo/recovery-proof-windows/'
      provides: 'Dated snapshot history for GSC, coverage, recovery board, and authority evidence'
---

# Phase 54 Plan 01: Post-Governance Recovery Proof Window

<objective>
Turn the current latest-state recovery artifacts into dated proof windows anchored to the shipped `v1.5` baseline, so operators can judge whether the governance reset is producing real movement over time.

Purpose: establish one truthful substrate for post-governance comparison before any authority-surface expansion or recovery automation is considered.
Output: a recovery proof-window generator, dated snapshot history, and one report that explains freshness, baseline alignment, and trustworthiness.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/54-post-governance-recovery-proof-window/54-CONTEXT.md
@.planning/milestones/v1.5-MILESTONE-AUDIT.md
@.planning/milestones/v1.5-CLOSEOUT.md
@reports/gsc/latest-ctr-report.json
@reports/seo/latest-coverage-drilldown.json
@reports/seo/latest-recovery-scorecard.json
@reports/seo/latest-recovery-control-board.json
@reports/seo/latest-recovery-execution-queue.json
@reports/seo/latest-authority-surface-program.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Create dated recovery proof snapshots</name>
  <action>Build a shared proof-window helper that snapshots the current recovery evidence set into a dated history directory while preserving the latest pointers.</action>
  <acceptance_criteria>A new proof window can be generated on demand and preserves dated copies of the reports needed for post-governance comparison instead of only replacing `latest-*` files.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Anchor proof windows to the v1.5 baseline</name>
  <action>Create a baseline manifest that records the archived `v1.5` closeout state and compares the newest proof window against it using the metrics already available in repo-local artifacts.</action>
  <acceptance_criteria>The generated proof report names the baseline artifact set, the current snapshot date, and the most important directional changes or trust gaps.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Surface freshness and trust gates for operators</name>
  <action>Make the proof-window report explicit about whether GSC, Coverage, and downstream recovery boards are fresh enough for decision-making, especially when stale inputs would make attribution unsafe.</action>
  <acceptance_criteria>Operators can open one report and immediately tell whether the current window is trustworthy enough for phase `55` attribution work or still blocked by stale inputs.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-proof-window.test.ts`
- `npx tsx scripts/seo-recovery-proof-window.ts`
- `npm run report:planning:traceability`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has a dated, baseline-aware proof-window lane that can answer whether post-governance recovery is moving, blocked, or still too stale to trust.
</success_criteria>

<output>
After completion, create `.planning/phases/54-post-governance-recovery-proof-window/54-01-SUMMARY.md` and `.planning/phases/54-post-governance-recovery-proof-window/54-VERIFICATION.md` only if the proof-window verification gates are actually satisfied.
</output>
