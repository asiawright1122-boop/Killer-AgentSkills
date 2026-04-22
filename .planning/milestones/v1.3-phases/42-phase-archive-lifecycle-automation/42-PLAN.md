---
phase: 42-phase-archive-lifecycle-automation
plan: 01
type: plan
wave: 1
depends_on:
  - 33-01
  - 38-01
files_modified:
  - '.planning/PROJECT.md'
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/STATE.md'
  - '.planning/MILESTONES.md'
  - '.planning/traceability/latest-milestone-traceability.md'
  - '.planning/traceability/latest-milestone-traceability.json'
  - '.planning/phase-lifecycle/latest-phase-lifecycle.md'
  - '.planning/phase-lifecycle/latest-phase-lifecycle.json'
  - '.planning/milestones/v1.3-phases/42-phase-archive-lifecycle-automation/42-CONTEXT.md'
  - '.planning/milestones/v1.3-phases/42-phase-archive-lifecycle-automation/42-PLAN.md'
  - '.planning/milestones/v1.3-phases/42-phase-archive-lifecycle-automation/42-01-SUMMARY.md'
  - '.planning/milestones/v1.3-phases/42-phase-archive-lifecycle-automation/42-VERIFICATION.md'
  - 'package.json'
  - 'scripts/lib/planning-phase-lifecycle.ts'
  - 'scripts/lib/planning-phase-lifecycle.test.ts'
  - 'scripts/lib/planning-milestone-support.ts'
  - 'scripts/lib/planning-milestone-support.test.ts'
  - 'scripts/planning-phase-lifecycle-report.ts'
  - 'scripts/planning-milestone-support-report.ts'
requirements:
  - TRACE-05
autonomous: true
must_haves:
  truths:
    - 'Shipped milestone phase directories can move out of `.planning/phases/` into milestone archive storage without breaking planning evidence paths.'
    - 'Active milestone phase directories can be restored or created automatically when milestone support is regenerated.'
    - 'Traceability and milestone closeout continue to treat only the active milestone as current work.'
---

# Phase 42 Plan 01: Phase Archive Lifecycle Automation

<objective>
Automate phase-directory archive and restore lifecycle so shipped milestones stop polluting active discovery while planning references stay valid.

Purpose: turn milestone bootstrap/closeout generation into the point where phase directories are archived, restored, or created deterministically.
Output: a reusable phase lifecycle library, a reporting CLI, lifecycle-aware milestone support generation, and updated planning artifacts proving the active path is clean.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/MILESTONES.md
@.planning/milestones/v1.3-phases/42-phase-archive-lifecycle-automation/42-CONTEXT.md
@.planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-01-SUMMARY.md
@.planning/milestones/v1.2-phases/38-planning-bootstrap-and-closeout-automation/38-01-SUMMARY.md
@scripts/lib/planning-traceability.ts
@scripts/lib/planning-milestone-support.ts
@scripts/planning-milestone-support-report.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Build the phase lifecycle planner and sync engine</name>
  <action>Add a reusable planning lifecycle library that detects archive, restore, and create actions from current milestone state and applies deterministic directory moves plus path rewrites.</action>
  <acceptance_criteria>Shipped milestone phase dirs can be archived, active dirs can be restored or created, and `.planning` references stay valid after sync.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Wire lifecycle sync into milestone support</name>
  <action>Add a CLI entrypoint for lifecycle reporting, integrate lifecycle sync with milestone support generation, and expose lifecycle artifacts in bootstrap/closeout support.</action>
  <acceptance_criteria>`report:planning:milestones` can refresh lifecycle state automatically and generated closeout support shows the archive path contract.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Verify active discovery stays clean</name>
  <action>Run lifecycle sync on the real planning tree, refresh traceability and milestone artifacts, and prove `TRACE-05` is satisfied with tests plus planning reports.</action>
  <acceptance_criteria>The active `.planning/phases/` set matches the active roadmap, milestone artifacts reference archived phase paths correctly, and traceability reports `TRACE-05` as satisfied.</acceptance_criteria>
</task>

</tasks>
