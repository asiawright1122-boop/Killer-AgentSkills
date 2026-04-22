---
phase: 34-locale-content-governance-guards
plan: 01
type: plan
wave: 1
depends_on:
  - 33-01
files_modified:
  - ".planning/ROADMAP.md"
  - ".planning/STATE.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-CONTEXT.md"
  - ".planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-PLAN.md"
  - ".planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-01-SUMMARY.md"
  - ".planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-VERIFICATION.md"
  - "package.json"
  - "scripts/lib/content-governance.ts"
  - "scripts/lib/content-governance.test.ts"
  - "scripts/lib/seo-collection-locale-gaps.ts"
  - "scripts/lib/seo-collection-drift.ts"
  - "scripts/content-governance-report.ts"
  - "scripts/seo-collection-locale-gaps.ts"
  - "scripts/seo-collection-drift.ts"
  - "reports/seo/latest-content-governance.md"
  - "reports/seo/latest-content-governance.json"
autonomous: true
requirements:
  - GOV-01
  - GOV-02
  - GOV-03
must_haves:
  truths:
    - "Operators can run one governance command that surfaces locale/content drift across structured audits and representative route contracts."
    - "Representative localized public-route contract failures are blocking by default, while warning-only governance debt remains distinguishable."
    - "Governance results are emitted in machine-readable form for future audit and workflow consumption."
  artifacts:
    - path: "reports/seo/latest-content-governance.json"
      provides: "Machine-readable governance severity, checks, and gate outcome"
    - path: "reports/seo/latest-content-governance.md"
      provides: "Operator-facing locale/content governance summary"
---

# Phase 34 Plan 01: Locale and Content Governance Lane

<objective>
Consolidate locale/content/SEO drift detection into one operator-facing governance lane with explicit warning vs blocking semantics.

Purpose: catch translation, breadcrumb, metadata, tutorial-shell, and collection drift early, before they turn back into a large repair program.
Output: one governance report command, one Markdown + JSON report contract, and blocking route/content verification wired into the same lane.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-CONTEXT.md
@scripts/seo-collection-locale-gaps.ts
@scripts/seo-collection-drift.ts
@scripts/seo-smoke.ts
@src/pages/public-links.test.ts
@src/messages/public-copy.test.ts
@src/lib/markdown-headings.test.ts
@src/lib/site/breadcrumbs.test.ts
@src/lib/site/metadata.test.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Extract reusable locale/content drift signals into one governance model</name>
  <action>Refactor existing collection drift and locale-gap scripts into reusable functions, then build a unified governance report model that can represent clear, warning, and blocking checks.</action>
  <acceptance_criteria>The governance model can combine structured collection signals with route/content contract results into one JSON + Markdown report.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Add one canonical governance command with explicit gate semantics</name>
  <action>Create an operator command that runs the structured collection checks plus the representative route/content contract suite, emits artifacts, and supports threshold-based failure at warning or blocking severity.</action>
  <acceptance_criteria>One npm command surfaces current severity, individual check outcomes, and whether the selected threshold should fail the run.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Add regression coverage and phase artifacts</name>
  <action>Add focused tests for governance severity derivation and reporting, then record Phase 34 summary/verification evidence with the new command outputs.</action>
  <acceptance_criteria>Governance behavior is test-covered, machine-readable, and documented well enough to close the milestone requirements.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/content-governance.test.ts src/pages/public-links.test.ts src/messages/public-copy.test.ts src/lib/markdown-headings.test.ts src/lib/site/breadcrumbs.test.ts src/lib/site/metadata.test.ts`
- `npm run report:content:governance`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The repository has one governance lane for locale/content drift, with clear warning vs blocking semantics and machine-readable outputs for operators and milestone audit.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.1-phases/34-locale-content-governance-guards/34-01-SUMMARY.md`
</output>
