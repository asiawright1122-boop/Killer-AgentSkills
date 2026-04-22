---
phase: 48-priority-surface-recovery-execution-loop
plan: 01
type: plan
wave: 1
depends_on:
  - '47-01'
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/STATE.md'
  - '.planning/milestones/v1.5-phases/48-priority-surface-recovery-execution-loop/48-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/48-priority-surface-recovery-execution-loop/48-PLAN.md'
  - 'package.json'
  - 'scripts/lib/recovery-execution-queue.ts'
  - 'scripts/lib/recovery-execution-queue.test.ts'
  - 'scripts/seo-recovery-execution-queue.ts'
  - 'reports/seo/latest-recovery-execution-queue.md'
  - 'reports/seo/latest-recovery-execution-queue.json'
requirements:
  - GEO-01
autonomous: true
must_haves:
  truths:
    - 'The execution queue must turn ranked recovery items into explicit interventions rather than another passive report.'
    - 'Measurement prerequisites and public-surface fixes must both be represented, with clear blocked vs ready status.'
    - 'Every queued intervention must have one action, one success signal, and one outcome note template.'
  artifacts:
    - path: 'reports/seo/latest-recovery-execution-queue.json'
      provides: 'Machine-readable recovery execution queue with intervention metadata and queue state'
    - path: 'reports/seo/latest-recovery-execution-queue.md'
      provides: 'Operator-facing recovery execution queue for the next intervention loop'
---

# Phase 48 Plan 01: Priority Surface Recovery Execution Queue

<objective>
Convert the recovery control board into an execution queue that captures the next concrete interventions, their blockers, and the success signals needed to learn from each move.

Purpose: bridge ranked diagnosis into a repeatable recovery loop without pretending blocked evidence is already resolved.
Output: one execution-queue generator that produces ready, blocked, and watch items with explicit intervention classes and outcome note templates.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.5-phases/48-priority-surface-recovery-execution-loop/48-CONTEXT.md
@reports/seo/latest-recovery-control-board.json
@reports/seo/latest-recovery-scorecard.json
@reports/seo/latest-coverage-drilldown.json
@scripts/lib/recovery-control-board.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the recovery execution queue model</name>
  <action>Create a reusable queue builder that converts blocked and recoverable control-board items into intervention records with lane, priority, status, success signal, and outcome note template.</action>
  <acceptance_criteria>The queue is structured enough that operators can execute and learn from it instead of reinterpreting the control board manually.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Map board items into intervention classes</name>
  <action>Translate measurement gaps, canonicalization issues, and ambiguous clusters into explicit intervention lanes such as measurement, canonicalization, and triage.</action>
  <acceptance_criteria>Known high-confidence fixes are marked ready, ambiguous work is marked blocked or triage, and every queue item has one concrete next action.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Ship runnable queue artifacts</name>
  <action>Add a runnable report script plus markdown and JSON outputs so the queue can be regenerated alongside the control board.</action>
  <acceptance_criteria>The queue artifacts show ranked interventions, prerequisite blockers, and success signals that Phase 49+ or future loops can reuse.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-execution-queue.test.ts`
- `npx tsx scripts/seo-recovery-execution-queue.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has one executable recovery queue that identifies what can ship now, what is blocked on evidence, and how to record outcomes for each intervention.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/48-priority-surface-recovery-execution-loop/48-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/48-priority-surface-recovery-execution-loop/48-VERIFICATION.md` only if the queue and verification gates are actually satisfied.
</output>
