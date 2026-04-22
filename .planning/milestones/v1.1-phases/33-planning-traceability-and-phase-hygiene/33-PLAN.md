---
phase: 33-planning-traceability-and-phase-hygiene
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
  - ".planning/MILESTONES.md"
  - ".planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-CONTEXT.md"
  - ".planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-PLAN.md"
  - ".planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-01-SUMMARY.md"
  - ".planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-VERIFICATION.md"
  - ".planning/milestones/v1.0-audit-comprehensive/AUDIT.md"
  - "package.json"
  - "scripts/planning-traceability-report.ts"
  - "scripts/planning-traceability-report.test.ts"
  - ".planning/traceability/latest-milestone-traceability.json"
  - ".planning/traceability/latest-milestone-traceability.md"
autonomous: true
requirements:
  - TRACE-01
  - TRACE-02
  - TRACE-03
must_haves:
  truths:
    - "Active milestone phase summaries expose machine-readable requirement completion metadata."
    - "Milestone requirement coverage can be recomputed from repository artifacts without manual reconstruction."
    - "Archived or stray planning artifacts no longer distort active-phase discovery or completion reporting."
  artifacts:
    - path: ".planning/traceability/latest-milestone-traceability.json"
      provides: "Machine-readable requirement coverage and hygiene findings for the active milestone"
    - path: ".planning/traceability/latest-milestone-traceability.md"
      provides: "Human-readable milestone traceability and planning-hygiene report"
---

# Phase 33 Plan 01: Machine-Readable Traceability and Planning Hygiene

<objective>
Make the active milestone's planning evidence self-consistent, machine-readable, and safe for automated audit/closeout flows.

Purpose: remove manual reconstruction from milestone audits and stop stray planning artifacts from distorting GSD discovery.
Output: one normalized metadata contract for active summaries/verifications, one reproducible traceability report, and one hygiene pass over stale planning artifacts.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/MILESTONES.md
@.planning/v1.0-MILESTONE-AUDIT.md
@.planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-CONTEXT.md
@.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md
@.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-VERIFICATION.md
@.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-01-SUMMARY.md
@.planning/milestones/v1.1-phases/32-workers-free-only-and-fallback-guards/32-VERIFICATION.md
@.planning/milestones/v1.0-phases/30-audit-comprehensive/30-01-SUMMARY.md
@.planning/milestones/v1.0-audit-comprehensive/AUDIT.md
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Normalize the active milestone traceability contract</name>
  <action>Define the metadata fields Phase 33 requires for summaries and verification artifacts, then align active milestone planning docs so requirement completion and phase identity are parseable without prose scraping.</action>
  <acceptance_criteria>Active milestone summaries and verification artifacts use one consistent machine-readable schema, and `TRACE-01` can be evaluated directly from checked-in files.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Build a reproducible milestone traceability report</name>
  <action>Create a repository-local report command that reads requirements, roadmap, state, and phase artifacts to emit Markdown + JSON coverage output for the active milestone.</action>
  <acceptance_criteria>The report can show requirement status, phase evidence, and missing metadata without manual reconstruction, satisfying `TRACE-02`.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Enforce planning-directory hygiene for active discovery</name>
  <action>Normalize or explicitly ignore stale phase artifacts that are not valid roadmap phases, and record the resulting hygiene status in the same traceability lane.</action>
  <acceptance_criteria>Stray legacy directories no longer affect active progress/completion interpretation, satisfying `TRACE-03`.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/planning-traceability-report.test.ts`
- `npx tsc --noEmit --pretty false`
- `node --import tsx scripts/planning-traceability-report.ts --stdout-only`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The repository can explain active milestone requirement coverage and planning hygiene directly from checked-in artifacts, without manual audit reconstruction or stray-phase false positives.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.1-phases/33-planning-traceability-and-phase-hygiene/33-01-SUMMARY.md`
</output>
