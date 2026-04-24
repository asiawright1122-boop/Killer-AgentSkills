---
phase: 62-comparable-proof-window-refresh-and-delta-revalidation
plan: 01
type: plan
wave: 1
depends_on:
  - '61-coverage-drilldown-input-refresh-and-freshness-contract'
files_modified:
  - '.planning/phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-CONTEXT.md'
  - '.planning/phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-PLAN.md'
  - 'scripts/gsc-fetch-report.ts'
  - 'scripts/seo-crawl-health.ts'
  - 'scripts/lib/recovery-proof-window.ts'
  - 'scripts/lib/recovery-delta-board.ts'
  - 'scripts/seo-recovery-proof-window.ts'
  - 'scripts/seo-recovery-delta-board.ts'
  - 'src/pages/sitemap.xml.ts'
  - 'src/pages/sitemap-skills.xml.ts'
  - 'src/middleware.ts'
  - 'reports/gsc/latest-ctr-report.json'
  - 'reports/seo/latest-crawl-health.json'
  - 'reports/seo/latest-recovery-proof-window.json'
  - 'reports/seo/latest-recovery-delta-board.json'
requirements:
  - REC-25
autonomous: true
must_haves:
  truths:
    - 'A comparable proof window is not trustworthy unless demand evidence, crawl accessibility, and coverage freshness are all represented honestly.'
    - 'Blocking proof inputs should produce durable blocking artifacts instead of brittle script crashes or misleading empty-success states.'
    - 'The recovery delta board is only valid after it consumes the refreshed proof window, not in parallel with missing or seeded-only upstream inputs.'
  artifacts:
    - path: 'reports/gsc/latest-ctr-report.json'
      provides: 'Current demand-side proof contract for impressions, clicks, CTR, and blocking state'
    - path: 'reports/seo/latest-crawl-health.json'
      provides: 'Current crawl accessibility proof, including sitemap availability and sampled status outcomes'
    - path: 'reports/seo/latest-recovery-proof-window.json'
      provides: 'Comparable proof window with explicit trust verdict and baseline relationship'
    - path: 'reports/seo/latest-recovery-delta-board.json'
      provides: 'Revalidated cohort-level delta posture based on the refreshed proof substrate'
---

# Phase 62 Plan 01: Comparable Proof Window Refresh and Delta Revalidation

<objective>
Generate the next trustworthy post-governance proof window and revalidate the delta board against refreshed demand, crawl, and coverage evidence.

Purpose: move the recovery lane from a seeded baseline with missing demand inputs to an honest comparable window that can explain whether exposure and clicks are actually recovering or still blocked.
Output: stable proof-input contracts, a refreshed proof window, a revalidated delta board, and verification that the operator lane explains remaining blockers precisely.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-CONTEXT.md
@reports/gsc/latest-ctr-report.json
@reports/seo/latest-crawl-health.json
@reports/seo/latest-coverage-drilldown.json
@reports/seo/latest-recovery-proof-window.json
@reports/seo/latest-recovery-delta-board.json
@reports/seo/latest-authority-uplift-scorecard.json
@reports/seo/latest-404-remediation-plan.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Repair the proof-input contract for exposure and demand</name>
  <action>Make the demand and crawl evidence lanes reliable enough for comparison by preserving clear blocking artifacts for missing GSC inputs, keeping crawl-health reporting alive when sitemaps fail, and stabilizing the skills sitemap contract so live exposure is not suppressed by broken sitemap partitions.</action>
  <acceptance_criteria>Operators can see whether the proof lane is blocked by missing Search Console data, live sitemap failures, or both, and the repo contains the code needed to close the live skills sitemap failure once shipped.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Refresh the comparable proof window from current evidence</name>
  <action>Regenerate the proof-window lane so it consumes the freshest available coverage, the current demand artifact, and the current crawl/board context while making seeded-baseline versus truly comparable status explicit.</action>
  <acceptance_criteria>The proof-window artifact clearly distinguishes a trustworthy comparison from a seeded or blocked window and names the specific blocker state when trust is still unavailable.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Revalidate the delta board against the refreshed proof substrate</name>
  <action>Re-run the delta board only after the proof window is refreshed, ensuring downstream cohort decisions remain honest about whether current evidence supports movement, hold posture, or blocking status.</action>
  <acceptance_criteria>The delta board reflects the refreshed proof inputs and does not imply recovery momentum when the upstream proof window remains blocked or incomplete.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npm run report:gsc:fetch`
- `npm run report:seo:crawl-health`
- `npm run report:seo:recovery-proof-window`
- `npm run report:seo:recovery-delta-board`
- `npm run report:seo:authority-uplift-scorecard`
- `npm run report:planning:traceability`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The repo can generate a refreshed proof window and delta board from honest current inputs, and when those inputs are still incomplete, the blocking reason is explicit enough to explain why impressions, clicks, and expansion posture have not yet recovered.
</success_criteria>

<output>
After completion, create `.planning/phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-01-SUMMARY.md` and `.planning/phases/62-comparable-proof-window-refresh-and-delta-revalidation/62-VERIFICATION.md` only if the refreshed proof and delta-validation evidence are actually in place.
</output>
