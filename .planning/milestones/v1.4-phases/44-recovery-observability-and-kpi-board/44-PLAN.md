---
phase: 44-recovery-observability-and-kpi-board
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/STATE.md'
  - '.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-CONTEXT.md'
  - '.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-PLAN.md'
  - '.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-01-SUMMARY.md'
  - '.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-VERIFICATION.md'
  - 'reports/seo/latest-recovery-scorecard.md'
  - 'reports/seo/latest-recovery-scorecard.json'
  - 'scripts/seo-recovery-scorecard.ts'
  - 'scripts/lib/recovery-scorecard.ts'
  - 'scripts/lib/recovery-scorecard.test.ts'
requirements:
  - SEO-13
  - GOV-09
autonomous: true
must_haves:
  truths:
    - 'Operators can see one consolidated recovery scorecard instead of stitching crawl, coverage, index, and traffic evidence manually.'
    - 'Missing or stale raw inputs are explicit status outcomes, not silent omissions.'
    - 'Weekly gates separate technical recovery from business recovery so traffic closure cannot be claimed without fresh evidence.'
  artifacts:
    - path: 'reports/seo/latest-recovery-scorecard.json'
      provides: 'Machine-readable recovery state for crawl, coverage, index, traffic, and AI posture'
    - path: 'reports/seo/latest-recovery-scorecard.md'
      provides: 'Operator-facing weekly recovery scorecard and next actions'
---

# Phase 44 Plan 01: Recovery Observability and KPI Board

<objective>
Build the milestone-scoped recovery evidence board so operators can tell whether the traffic recovery program is technically fixed, evidentially complete, and business-validatable.

Purpose: replace fragmented recovery evidence with one repeatable scorecard that highlights both what is healthy and what is still missing.
Output: a reusable recovery scorecard generator, explicit weekly gates, and refreshed planning state that moves the milestone toward provider-resilience follow-up.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-CONTEXT.md
@.planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-01-SUMMARY.md
@.planning/milestones/v1.4-phases/43-production-sitemap-and-dynamic-404-closure/43-VERIFICATION.md
@reports/seo/latest-traffic-recovery-audit.md
@reports/seo/latest-crawl-health.json
@reports/seo/latest-coverage-drilldown.json
@reports/seo/index-drift.json
@reports/seo/latest-ai-provider-health.json
@scripts/seo-crawl-health.ts
@scripts/seo-coverage-drilldown.ts
@scripts/seo-index-integrity.ts
@scripts/gsc-fetch-report.ts
@scripts/gsc-ctr-report.ts
@scripts/operator-ops-summary.ts
@scripts/lib/operator-ops-summary.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Build the recovery scorecard generator</name>
  <action>Create a reusable scorecard builder that reads crawl, coverage, index, traffic, and AI-health inputs, then emits Markdown and JSON artifacts with explicit signal status.</action>
  <acceptance_criteria>The generated scorecard clearly distinguishes technical recovery, business recovery, and AI runtime posture without requiring operators to cross-reference multiple reports manually.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Make missing evidence a first-class outcome</name>
  <action>Handle missing Search Console summaries and stale Coverage Drilldown exports explicitly, with warnings or blocking states and concrete follow-up actions.</action>
  <acceptance_criteria>The board never implies traffic or coverage health when the source evidence is absent or stale.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Refresh planning closure and milestone gates</name>
  <action>Generate fresh scorecard artifacts, capture verification, and advance planning state so Phase `45` becomes the next unplanned lane.</action>
  <acceptance_criteria>Roadmap, requirements, and state files all show Phase `44` complete with updated recovery evidence artifacts referenced by the milestone.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run scripts/lib/recovery-scorecard.test.ts`
- `npx tsx scripts/seo-recovery-scorecard.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
One operator-facing recovery board now explains crawl stability, coverage freshness, index integrity, and traffic-evidence readiness in a single weekly view.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4-phases/44-recovery-observability-and-kpi-board/44-01-SUMMARY.md`
</output>
