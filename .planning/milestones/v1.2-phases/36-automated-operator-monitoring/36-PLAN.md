---
phase: 36-automated-operator-monitoring
plan: 01
type: plan
wave: 1
depends_on:
  - 35-01
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/milestones/v1.2-phases/36-automated-operator-monitoring/36-CONTEXT.md"
  - ".planning/milestones/v1.2-phases/36-automated-operator-monitoring/36-PLAN.md"
  - ".planning/milestones/v1.2-phases/36-automated-operator-monitoring/36-01-SUMMARY.md"
  - ".planning/milestones/v1.2-phases/36-automated-operator-monitoring/36-VERIFICATION.md"
  - ".github/workflows/ci.yml"
  - ".github/workflows/seo-monitoring.yml"
requirements:
  - AIOPS-06
  - GOV-05
autonomous: true
must_haves:
  truths:
    - "AI health and content governance can run in automated contexts without manual shell intervention."
    - "Monitoring thresholds are explicit per context instead of hidden in script defaults."
    - "Automated runs publish reviewable artifacts for operators."
  artifacts:
    - path: "reports/seo/latest-ai-provider-health.md"
      provides: "Operator-facing AI health review artifact for automated runs"
    - path: "reports/seo/latest-content-governance.md"
      provides: "Operator-facing governance review artifact for automated runs"
---

# Phase 36 Plan 01: Automated Operator Monitoring

<objective>
Wire the existing operator lanes into CI and scheduled monitoring with explicit thresholds, uploaded artifacts, and job summaries.

Purpose: stop relying on manual local execution for AI health and content governance review.
Output: updated GitHub Actions workflows plus refreshed planning state showing automated monitoring is active.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.2-phases/36-automated-operator-monitoring/36-CONTEXT.md
@.github/workflows/ci.yml
@.github/workflows/seo-monitoring.yml
@scripts/ai-provider-health.ts
@scripts/content-governance-report.ts
@scripts/seo-crawl-health.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Add CI-level operator artifact validation</name>
  <action>Update CI so repo-local AI health and content governance reports run with explicit thresholds and upload artifacts for review.</action>
  <acceptance_criteria>CI exposes AI health and content governance as explicit automated checks instead of only local commands.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Extend scheduled monitoring with operator lanes</name>
  <action>Update scheduled monitoring to generate AI health and content governance artifacts alongside existing crawl or SEO monitoring, with explicit threshold configuration in workflow env.</action>
  <acceptance_criteria>Scheduled monitoring uploads operator artifacts and publishes readable summary sections for AI health, governance, and crawl state.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Verify and record GSD completion evidence</name>
  <action>Run the automated monitoring commands locally, verify workflow-facing outputs, and update summary / verification / roadmap / state artifacts.</action>
  <acceptance_criteria>Phase 36 has summary + verification files and roadmap analyzer reflects the updated milestone state.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npm run report:ai:health -- --limit=20 --fail-on=critical`
- `npm run report:content:governance -- --fail-on=blocking`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
CI and scheduled monitoring can execute the operator lanes with explicit thresholds and leave durable review artifacts behind for operators.
</success_criteria>
