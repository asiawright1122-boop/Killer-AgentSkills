---
phase: 41-remediation-handoff-automation
plan: 01
type: plan
wave: 1
depends_on:
  - 37-01
  - 40-01
files_modified:
  - '.planning/STATE.md'
  - '.planning/milestones/v1.3-phases/41-remediation-handoff-automation/41-CONTEXT.md'
  - '.planning/milestones/v1.3-phases/41-remediation-handoff-automation/41-PLAN.md'
  - '.planning/milestones/v1.3-phases/41-remediation-handoff-automation/41-01-SUMMARY.md'
  - '.planning/milestones/v1.3-phases/41-remediation-handoff-automation/41-VERIFICATION.md'
  - 'package.json'
  - 'scripts/lib/operator-ops-summary.ts'
  - 'scripts/lib/operator-ops-summary.test.ts'
  - 'scripts/lib/operator-ops-handoff.ts'
  - 'scripts/lib/operator-ops-handoff.test.ts'
  - 'scripts/operator-ops-summary.ts'
  - 'scripts/operator-ops-handoff.ts'
  - '.github/workflows/seo-monitoring.yml'
  - '.github/workflows/ci.yml'
requirements:
  - GOV-07
  - GOV-08
autonomous: true
must_haves:
  truths:
    - 'Configured remediation seeds can publish a deduped GitHub issue or draft PR scaffold with evidence attached.'
    - 'Repeat alert states reuse existing GitHub handoffs instead of opening noisy duplicates.'
    - 'Disabled or under-configured repositories stay quiet and report why publication was skipped.'
---

# Phase 41 Plan 01: Remediation Handoff Automation

<objective>
Automate GitHub handoff for remediation scaffolds without widening provider behavior or generating duplicate operator noise.

Purpose: turn the Phase 37 repo-local remediation lane into a configuration-gated GitHub escalation path.
Output: a GitHub handoff publisher, dedupe-aware issue/PR publication semantics, and workflow integration for scheduled monitoring.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.3-phases/41-remediation-handoff-automation/41-CONTEXT.md
@.planning/milestones/v1.2-phases/37-remediation-seeding-and-ops-summary/37-01-SUMMARY.md
@.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md
@scripts/lib/operator-ops-summary.ts
@scripts/operator-ops-summary.ts
@reports/seo/latest-ops-remediation.json
@reports/seo/latest-ops-handoff.json
@.github/workflows/seo-monitoring.yml
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Implement GitHub handoff publisher</name>
  <action>Create a GitHub publication layer that can read the existing handoff scaffolds, create/update deduped issues, and create/update draft PR scaffolds when configuration is sufficient.</action>
  <acceptance_criteria>Configured handoff runs publish actionable GitHub artifacts with dedupe metadata and remote result reporting.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Preserve quiet and deduped behavior</name>
  <action>Ensure repeated or unchanged remediation states do not create duplicate external artifacts, and that missing configuration degrades to explicit skipped or disabled reporting.</action>
  <acceptance_criteria>Repeat runs reuse existing GitHub handoffs, updated runs patch them in place, and under-configured runs remain non-destructive.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Wire scheduled monitoring and verify</name>
  <action>Integrate the publisher into the scheduled monitoring lane, keep CI artifact visibility, and add regression coverage for publication/dedupe paths.</action>
  <acceptance_criteria>Automation can publish when enabled, local/CI verification covers issue and PR paths, and artifacts remain inspectable even when publish is disabled.</acceptance_criteria>
</task>

</tasks>
