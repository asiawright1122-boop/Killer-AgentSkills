---
phase: 60-public-copy-leakage-guardrails
plan: 01
type: plan
wave: 1
depends_on:
  - 59-01
files_modified:
  - '.planning/phases/60-public-copy-leakage-guardrails/60-CONTEXT.md'
  - '.planning/phases/60-public-copy-leakage-guardrails/60-PLAN.md'
  - 'src/pages/[locale]/solutions/index.astro'
  - 'src/messages/'
  - 'src/content/collections/'
  - 'tests/pages/public-links.test.ts'
requirements:
  - GOV-14
autonomous: true
must_haves:
  truths:
    - 'Public copy-boundary protection should apply to public trust surfaces by scope, not only to a few manually selected files.'
    - 'The guardrail should rely on one centralized phrase-family definition so future maintenance stays coherent.'
    - 'If a reusable scan reveals remaining leaks, the phase must clean those sources before claiming the guardrail is complete.'
  artifacts:
    - path: '.planning/phases/60-public-copy-leakage-guardrails/60-VERIFICATION.md'
      provides: 'Evidence that reusable public copy-boundary guardrails are active and passing'
---

# Phase 60 Plan 01: Public Copy Leakage Guardrails

<objective>
Add reusable verification so public-facing internal-language leakage is caught automatically before merge or release.

Purpose: convert the completed Phase `59` normalization into durable prevention.
Output: cleaned residual public sources, centralized phrase-family guardrails, and passing verification over the guarded public scopes.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/59-user-facing-entry-surface-normalization/59-01-SUMMARY.md
@.planning/phases/59-user-facing-entry-surface-normalization/59-VERIFICATION.md
@.planning/phases/60-public-copy-leakage-guardrails/60-CONTEXT.md
@src/pages/[locale]/solutions/index.astro
@src/messages/
@src/content/collections/
@src/lib/authority-surface-public-data.ts
@tests/pages/public-links.test.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Clear residual shared public leaks</name>
  <action>Normalize any remaining user-visible strategy/process wording still present in the solutions hub or shared locale and collection sources covered by the new guardrail scope.</action>
  <acceptance_criteria>The reusable scan scope is clean before the new guardrail is locked in.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Centralize the public copy-boundary rule set</name>
  <action>Create one maintained phrase-family definition and one reusable scan-target definition for public trust surfaces.</action>
  <acceptance_criteria>Public copy-boundary detection no longer depends on duplicated hard-coded lists scattered across individual assertions.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Enforce reusable guardrails in verification</name>
  <action>Extend the regression suite so public pages, shared public data, locale messages, and shipped collections in the selected scope are checked automatically for the blocked phrase families.</action>
  <acceptance_criteria>The guardrail passes in CI-targeted verification and will fail when the blocked phrase families return to a guarded public source.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npm run format:check`
- `npx vitest run tests/pages/public-links.test.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The repository has a reusable public copy-boundary guardrail that scans the main public trust surfaces and shared sources, and the guarded scope is clean of the known internal/process phrase families.
</success_criteria>

<output>
After completion, create `.planning/phases/60-public-copy-leakage-guardrails/60-01-SUMMARY.md` and `.planning/phases/60-public-copy-leakage-guardrails/60-VERIFICATION.md` only if the guardrail and verification evidence are actually in place.
</output>
