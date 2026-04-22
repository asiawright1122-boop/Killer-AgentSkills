---
phase: 46-fresh-search-console-and-coverage-ingestion
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/STATE.md'
  - '.planning/milestones/v1.5-phases/46-fresh-search-console-and-coverage-ingestion/46-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/46-fresh-search-console-and-coverage-ingestion/46-PLAN.md'
  - 'scripts/gsc-fetch-report.ts'
  - 'scripts/seo-coverage-drilldown.ts'
  - 'scripts/lib/recovery-scorecard.ts'
  - 'scripts/lib/recovery-scorecard.test.ts'
  - 'reports/gsc/latest-ctr-report.md'
  - 'reports/gsc/latest-ctr-report.json'
  - 'reports/gsc/monitoring-skipped.md'
  - 'reports/seo/latest-coverage-drilldown.md'
  - 'reports/seo/latest-coverage-drilldown.json'
  - 'reports/seo/latest-recovery-scorecard.md'
  - 'reports/seo/latest-recovery-scorecard.json'
requirements:
  - SEO-14
  - SEO-15
autonomous: true
must_haves:
  truths:
    - 'Search Console evidence must fail loudly and reproducibly when credentials or fresh data are missing.'
    - 'Coverage Drilldown freshness must distinguish raw-source freshness from generated-report freshness.'
    - 'Business recovery must remain blocked until fresh traffic evidence exists, even if technical recovery is stable.'
  artifacts:
    - path: 'reports/gsc/latest-ctr-report.md'
      provides: 'Standardized Search Console summary or explicit blocking artifact'
    - path: 'reports/seo/latest-coverage-drilldown.json'
      provides: 'Coverage drilldown with raw-source freshness metadata and operator-visible SLA status'
    - path: 'reports/seo/latest-recovery-scorecard.json'
      provides: 'Recovery board consuming the improved freshness and blocking evidence'
---

# Phase 46 Plan 01: Fresh Search Console and Coverage Ingestion

<objective>
Rebuild the business-evidence ingestion lane so Search Console and Coverage Drilldown inputs produce deterministic repo-local artifacts, explicit freshness metadata, and honest blocking states instead of silent gaps.

Purpose: remove ambiguity around whether traffic evidence is missing, stale, or truly fresh enough to judge recovery.
Output: standardized GSC blocking/success artifacts, coverage drilldown source-freshness metadata, and a recovery scorecard that consumes those states directly.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.5-phases/46-fresh-search-console-and-coverage-ingestion/46-CONTEXT.md
@reports/seo/latest-recovery-scorecard.json
@reports/seo/latest-coverage-drilldown.json
@scripts/gsc-fetch-report.ts
@scripts/seo-coverage-drilldown.ts
@scripts/lib/recovery-scorecard.ts
@.github/workflows/seo-monitoring.yml
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Normalize Search Console evidence states</name>
  <action>Update the GSC report generator so it always emits a standard local artifact describing either a fresh summary or an explicit blocking reason when credentials or data are unavailable.</action>
  <acceptance_criteria>`reports/gsc/latest-ctr-report.md` can be regenerated on demand and makes missing credentials, stale periods, or missing data explicit without requiring manual file hunting.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Add raw-source freshness metadata to Coverage Drilldown</name>
  <action>Extend the Coverage Drilldown report with source-level freshness fields, source listings, and SLA-oriented markdown so operators can tell whether the latest raw export is fresh, warning, or blocking.</action>
  <acceptance_criteria>`reports/seo/latest-coverage-drilldown.json` distinguishes generated freshness from raw-source freshness and surfaces the newest detected raw export date plus its age.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Feed the improved evidence into the recovery board</name>
  <action>Teach the recovery scorecard to consume the new GSC and Coverage freshness/blocking signals directly, including workflow skip fallbacks where needed.</action>
  <acceptance_criteria>`reports/seo/latest-recovery-scorecard.json` continues to show technical recovery as stable while carrying first-class blockers for missing/stale business evidence.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-scorecard.test.ts`
- `npx tsx scripts/seo-coverage-drilldown.ts`
- `npx tsx scripts/gsc-fetch-report.ts`
- `npx tsx scripts/seo-recovery-scorecard.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
Operators can regenerate one truthful business-evidence lane locally and immediately see whether recovery is blocked by missing GSC credentials, stale Coverage raw exports, or genuinely fresh data.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/46-fresh-search-console-and-coverage-ingestion/46-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/46-fresh-search-console-and-coverage-ingestion/46-VERIFICATION.md` only if the phase verification gates are actually satisfied.
</output>
