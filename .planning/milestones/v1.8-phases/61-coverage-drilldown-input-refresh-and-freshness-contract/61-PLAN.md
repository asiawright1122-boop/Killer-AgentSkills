---
phase: 61-coverage-drilldown-input-refresh-and-freshness-contract
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - '.planning/milestones/v1.8-phases/61-coverage-drilldown-input-refresh-and-freshness-contract/61-CONTEXT.md'
  - '.planning/milestones/v1.8-phases/61-coverage-drilldown-input-refresh-and-freshness-contract/61-PLAN.md'
  - 'scripts/lib/coverage-drilldown-source.ts'
  - 'scripts/lib/coverage-drilldown-source.test.ts'
  - 'scripts/seo-coverage-drilldown-ingest.ts'
  - 'scripts/seo-coverage-drilldown.ts'
  - 'reports/seo/latest-coverage-drilldown-ingest.md'
  - 'reports/seo/latest-coverage-drilldown-ingest.json'
  - 'reports/seo/latest-coverage-drilldown.md'
  - 'reports/seo/latest-coverage-drilldown.json'
requirements:
  - REC-24
autonomous: true
must_haves:
  truths:
    - 'Coverage Drilldown freshness must be proven from dated repository-local artifacts before recovery decisions rely on it.'
    - 'The ingest and report lane should make source selection and freshness status explicit rather than silently preferring one raw input source.'
    - 'Phase 61 restores the proof substrate for later phases; it does not jump ahead into promotion or automation decisions.'
  artifacts:
    - path: 'reports/seo/latest-coverage-drilldown-ingest.json'
      provides: 'Machine-readable ingest history and latest archived source selection'
    - path: 'reports/seo/latest-coverage-drilldown.json'
      provides: 'Machine-readable freshness and cluster summary built from the trusted latest Coverage Drilldown source'
---

# Phase 61 Plan 01: Coverage Drilldown Input Refresh and Freshness Contract

<objective>
Restore trustworthy Coverage Drilldown input freshness before the next recovery-proof comparison is attempted.

Purpose: replace the stale local Coverage Drilldown dependency with a dated, repository-local freshness contract that downstream proof work can trust.
Output: hardened source-selection and ingest behavior, explicit freshness reporting, and passing verification around the Coverage Drilldown evidence lane.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/milestones/v1.8-phases/61-coverage-drilldown-input-refresh-and-freshness-contract/61-CONTEXT.md
@.planning/milestones/v1.6-phases/54-post-governance-recovery-proof-window/54-CONTEXT.md
@scripts/lib/coverage-drilldown-source.ts
@scripts/lib/coverage-drilldown-source.test.ts
@scripts/seo-coverage-drilldown-ingest.ts
@scripts/seo-coverage-drilldown.ts
@reports/seo/latest-coverage-drilldown-ingest.json
@reports/seo/latest-coverage-drilldown.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Harden raw source discovery and ingest trust rules</name>
  <action>Extend the Coverage Drilldown source helpers and ingest flow so the latest trusted raw source is selected deterministically, archived with dated evidence, and reported clearly when inputs are stale, missing, or ambiguous.</action>
  <acceptance_criteria>The ingest lane preserves a trustworthy repository-local record of what source was imported, what was skipped, and which archived source is treated as the latest proof input.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Surface freshness as a first-class recovery blocker</name>
  <action>Update the Coverage Drilldown report lane so freshness status, freshness date, and blocker state remain explicit in both machine-readable and operator-readable outputs.</action>
  <acceptance_criteria>Operators can open the latest Coverage Drilldown outputs and immediately see whether the data is fresh enough for downstream proof work or still blocked.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Verify the refreshed freshness contract end to end</name>
  <action>Add or extend regression coverage around source discovery / ingest behavior and rerun the Coverage Drilldown report lane against the current repo-local raw inputs.</action>
  <acceptance_criteria>The Coverage Drilldown evidence lane verifies cleanly and provides the trusted substrate needed for Phase `62` proof-window work.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/coverage-drilldown-source.test.ts`
- `npm run report:seo:coverage-drilldown`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
- `npm run report:planning:traceability`
</verification>

<success_criteria>
The repo has a trustworthy Coverage Drilldown freshness contract: fresh raw inputs can be ingested into dated repository-local evidence, the latest trusted source is explicit, and downstream recovery-proof work no longer depends on an unexamined stale local export.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.8-phases/61-coverage-drilldown-input-refresh-and-freshness-contract/61-01-SUMMARY.md` and `.planning/milestones/v1.8-phases/61-coverage-drilldown-input-refresh-and-freshness-contract/61-VERIFICATION.md` only if the freshness contract and verification evidence are actually in place.
</output>
