---
phase: 56-authority-surface-uplift-program-and-promotion-gates
plan: 01
type: plan
wave: 1
depends_on:
  - '55-01'
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/STATE.md'
  - '.planning/phases/56-authority-surface-uplift-program-and-promotion-gates/56-CONTEXT.md'
  - '.planning/phases/56-authority-surface-uplift-program-and-promotion-gates/56-PLAN.md'
  - 'scripts/lib/authority-uplift-scorecard.ts'
  - 'scripts/lib/authority-uplift-scorecard.test.ts'
  - 'scripts/seo-authority-uplift-scorecard.ts'
  - 'reports/seo/latest-authority-uplift-scorecard.md'
  - 'reports/seo/latest-authority-uplift-scorecard.json'
requirements:
  - SEO-23
  - GOV-12
  - UX-EXP-01
autonomous: true
must_haves:
  truths:
    - 'Authority-surface expansion must be gated by evidence, not by the desire to grow output volume.'
    - 'Editorial effort should be justified by measurable uplift or strategic support value.'
    - 'Promotion / hold / stop decisions must be explicit enough to prevent accidental scope creep.'
  artifacts:
    - path: 'reports/seo/latest-authority-uplift-scorecard.json'
      provides: 'Machine-readable promotion / hold / stop signals for priority authority surfaces'
    - path: 'reports/seo/latest-authority-uplift-scorecard.md'
      provides: 'Operator-readable authority uplift program with thresholds and next actions'
---

# Phase 56 Plan 01: Authority Surface Uplift Program and Promotion Gates

<objective>
Turn post-governance attribution into explicit decisions about which authority surfaces should be promoted, held steady, or stopped.

Purpose: make `SEO-23`, `GOV-12`, and `UX-EXP-01` operational with evidence-backed thresholds instead of informal judgment.
Output: an authority uplift scorecard, editorial cadence model, and clear promotion gates for discovery expansion.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/56-authority-surface-uplift-program-and-promotion-gates/56-CONTEXT.md
@reports/seo/latest-recovery-delta-board.json
@reports/seo/latest-authority-surface-program.json
@data/authority-surfaces.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Build the authority uplift scorecard model</name>
  <action>Define the metrics, freshness checks, and decision rules used to evaluate authority surfaces after the delta board is available.</action>
  <acceptance_criteria>The scorecard can classify surfaces into promote / hold / stop states using explicit criteria instead of one-off editorial judgment.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Generate promotion gates and editorial cadence</name>
  <action>Assign thresholds and next actions to the highest-priority surfaces, including when to deepen editorial work and when to stop spending effort.</action>
  <acceptance_criteria>The generated report makes it clear which surfaces deserve additional emphasis and which ones should stay stable or paused.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Encode expansion boundaries</name>
  <action>Document how discovery expansion can reopen only when surfaces clear the uplift gates, keeping weak or noisy surfaces from pulling the roadmap off course.</action>
  <acceptance_criteria>`UX-EXP-01` becomes an operational boundary with explicit evidence thresholds rather than a general reminder.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/authority-uplift-scorecard.test.ts`
- `npx tsx scripts/seo-authority-uplift-scorecard.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The team can decide which authority surfaces to deepen or hold without reopening broad, low-confidence discovery growth.
</success_criteria>

<output>
After completion, create `.planning/phases/56-authority-surface-uplift-program-and-promotion-gates/56-01-SUMMARY.md` and `.planning/phases/56-authority-surface-uplift-program-and-promotion-gates/56-VERIFICATION.md` only if the uplift-program verification gates are actually satisfied.
</output>
