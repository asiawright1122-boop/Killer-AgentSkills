---
phase: 31-provider-telemetry-and-alerting
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
  - ".planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-CONTEXT.md"
  - ".planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-PLAN.md"
  - ".planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md"
  - "package.json"
  - "scripts/ai-provider-health.ts"
  - "scripts/lib/ai-provider-health.ts"
  - "scripts/lib/ai-provider-health.test.ts"
  - ".github/workflows/data-pipeline.yml"
  - "scripts/run-pipeline.sh"
autonomous: true
requirements:
  - AIOPS-01
  - AIOPS-02
must_haves:
  truths:
    - "Operators can generate one canonical provider-health summary that combines current provider state with alert severity."
    - "Provider-health gating uses an explicit threshold contract and returns a machine-readable blocking verdict."
    - "Local unattended runs and GitHub Actions consume the same provider-health command to reduce drift."
  artifacts:
    - path: "reports/seo/latest-ai-provider-health.json"
      provides: "Machine-readable provider health contract with gate status and threshold verdict"
    - path: "reports/seo/latest-ai-provider-health.md"
      provides: "Operator-facing provider health summary"
---

# Phase 31 Plan 01: Canonical Provider Health Contract

<objective>
Create a single provider-health contract that consolidates snapshot state, trend severity, and gate behavior into one reusable command for operators, local unattended runs, and CI.

Purpose: make provider instability visible and actionable before sync/publish steps continue.
Output: one Markdown + JSON health report, plus batch/workflow wiring that makes threshold breaches explicit.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-CONTEXT.md
@package.json
@scripts/build-skills-cache.ts
@scripts/lib/ai.ts
@scripts/lib/ai-telemetry-report.ts
@scripts/lib/ai-telemetry-trend.ts
@.github/workflows/data-pipeline.yml
@scripts/run-pipeline.sh
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the provider-health contract in one reusable library</name>
  <action>Build a reusable module that loads the latest telemetry checkpoint and trend window, derives a canonical health summary, and exposes Markdown + JSON outputs plus a threshold-based blocking verdict.</action>
  <acceptance_criteria>The contract includes current provider order, cooldown/quarantine/hard-disable state, strongest NVIDIA labels, Workers AI free-tier state, alert summary, threshold, and blocking outcome.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Expose one operator command and wire unattended flows to it</name>
  <action>Add a canonical CLI/npm script for provider health, then update local unattended pipeline and GitHub workflow usage so both consume the same thresholded gate.</action>
  <acceptance_criteria>Local unattended runs and CI both surface explicit warning/blocking outcomes through the same command rather than duplicating logic.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Add regression coverage for the contract and gate behavior</name>
  <action>Add tests covering stable, warning, and blocking scenarios so the combined provider-health contract remains machine-readable and reliable.</action>
  <acceptance_criteria>Tests verify human-readable output, JSON structure, and threshold-based blocking semantics across representative scenarios.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/ai-provider-health.test.ts scripts/lib/ai-telemetry-report.test.ts scripts/lib/ai-telemetry-trend.test.ts`
- `npm run report:ai:health -- --limit=20 --stdout-only`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
Provider health is available through one operator-facing contract that can also explicitly block unattended flows at configured severity thresholds.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.1-phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md`
</output>
