---
phase: 57-recovery-experiment-ladder-and-automation-readiness
plan: 01
type: plan
wave: 1
depends_on:
  - '56-01'
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/STATE.md'
  - '.planning/phases/57-recovery-experiment-ladder-and-automation-readiness/57-CONTEXT.md'
  - '.planning/phases/57-recovery-experiment-ladder-and-automation-readiness/57-PLAN.md'
  - 'scripts/lib/recovery-experiment-ladder.ts'
  - 'scripts/lib/recovery-experiment-ladder.test.ts'
  - 'scripts/seo-recovery-experiment-ladder.ts'
  - 'reports/seo/latest-recovery-experiment-ladder.md'
  - 'reports/seo/latest-recovery-experiment-ladder.json'
requirements:
  - GEO-02
autonomous: true
must_haves:
  truths:
    - 'Automation candidates must be proven manually before they are promoted.'
    - 'Rollback and retirement rules must be first-class parts of the experiment ladder.'
    - 'The ladder should make it easy to say an intervention is still manual-only or not worth automating.'
  artifacts:
    - path: 'reports/seo/latest-recovery-experiment-ladder.json'
      provides: 'Machine-readable experiment states, promotion criteria, and rollback reasons'
    - path: 'reports/seo/latest-recovery-experiment-ladder.md'
      provides: 'Operator-readable ladder for queue -> manual -> rollout -> automation candidate decisions'
---

# Phase 57 Plan 01: Recovery Experiment Ladder and Automation Readiness

<objective>
Define the governance ladder that recovery experiments must pass through before they are promoted into wider rollout or future automation work.

Purpose: make `GEO-02` operational while keeping automation behind explicit manual proof and rollback discipline.
Output: an experiment ladder model, operator report, and reusable promotion / rollback contract for later milestones.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/57-recovery-experiment-ladder-and-automation-readiness/57-CONTEXT.md
@reports/seo/latest-authority-uplift-scorecard.json
@reports/seo/latest-recovery-execution-queue.json
@reports/seo/latest-recovery-delta-board.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the recovery experiment state model</name>
  <action>Create a shared experiment ladder model that encodes queue, manual validation, review, limited rollout, automation candidate, and retirement states.</action>
  <acceptance_criteria>The model can represent both successful promotion paths and explicit reasons to pause, roll back, or retire an experiment.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Generate an operator-facing ladder report</name>
  <action>Publish a report that shows current or seeded experiment candidates, their current state, next evidence requirement, and rollback conditions.</action>
  <acceptance_criteria>Operators can tell what makes an experiment automation-ready and what still keeps it manual-only.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Lock automation behind proof</name>
  <action>Document how future automation work should consume the ladder so unproven patterns cannot skip straight from idea to automation.</action>
  <acceptance_criteria>The phase leaves a reusable governance contract for later automation work without implementing broad autonomous recovery loops yet.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-experiment-ladder.test.ts`
- `npx tsx scripts/seo-recovery-experiment-ladder.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has a clear ladder for deciding which recovery experiments stay manual, which ones can roll out further, and which ones are credible automation candidates later.
</success_criteria>

<output>
After completion, create `.planning/phases/57-recovery-experiment-ladder-and-automation-readiness/57-01-SUMMARY.md` and `.planning/phases/57-recovery-experiment-ladder-and-automation-readiness/57-VERIFICATION.md` only if the experiment-ladder verification gates are actually satisfied.
</output>
