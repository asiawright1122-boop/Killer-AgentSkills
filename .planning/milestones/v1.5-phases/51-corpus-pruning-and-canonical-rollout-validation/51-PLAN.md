---
phase: 51-corpus-pruning-and-canonical-rollout-validation
plan: 01
type: plan
wave: 1
depends_on:
  - '50-01'
files_modified:
  - '.planning/milestones/v1.5-phases/51-corpus-pruning-and-canonical-rollout-validation/51-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/51-corpus-pruning-and-canonical-rollout-validation/51-PLAN.md'
  - 'data/sitemap-skills.json'
  - 'data/seo-sitemap-blocklist.json'
  - 'src/pages/sitemap-skills-[page].xml.ts'
  - 'src/lib/sitemap-blocklist.ts'
  - 'scripts/seo-corpus-governance.ts'
  - 'reports/seo/latest-corpus-governance.md'
  - 'reports/seo/latest-corpus-governance.json'
  - 'reports/seo/latest-corpus-governance-diff.json'
requirements:
  - SEO-19
  - GOV-11
autonomous: true
must_haves:
  truths:
    - 'The project must know which skill URLs are being kept, consolidated, noindexed, or removed and why.'
    - 'Publication outputs must reflect the governed corpus instead of advertising legacy bulk coverage.'
    - 'Before/after evidence must separate intentional pruning from accidental SEO regressions.'
  artifacts:
    - path: 'reports/seo/latest-corpus-governance.json'
      provides: 'Machine-readable governed corpus inventory and bucket counts'
    - path: 'reports/seo/latest-corpus-governance.md'
      provides: 'Operator-readable explanation of the corpus-pruning rollout'
    - path: 'reports/seo/latest-corpus-governance-diff.json'
      provides: 'Before/after diff for kept, consolidated, and removed skill URL sets'
---

# Phase 51 Plan 01: Corpus Pruning and Canonical Rollout Validation

<objective>
Apply the new locale and originality contracts to the public skill corpus so the site publishes a smaller, stronger, and explicitly governed set of indexable URLs.

Purpose: turn governance policy into a real rollout with measurable publication changes and validation evidence.
Output: a governed corpus inventory plus publication outputs and before/after validation artifacts that explain exactly what changed.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5-phases/51-corpus-pruning-and-canonical-rollout-validation/51-CONTEXT.md
@docs/seo-google-guidelines-audit-2026-04-16.md
@data/sitemap-skills.json
@data/seo-sitemap-blocklist.json
@src/pages/sitemap-skills-[page].xml.ts
@src/lib/sitemap-blocklist.ts
@reports/seo/latest-coverage-drilldown.json
@reports/seo/latest-crawl-health.json
@reports/gsc/latest-ctr-report.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Build the governed corpus classifier</name>
  <action>Create a reproducible classifier that assigns each candidate skill URL to keep, consolidate, noindex, or remove based on the new locale and originality contracts.</action>
  <acceptance_criteria>The project has one machine-readable inventory that explains the intended publication state for the current skill corpus.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Republish sitemap and canonical-control artifacts</name>
  <action>Regenerate the sitemap inputs and related publication-control artifacts so they only advertise the governed corpus and no longer preserve legacy weak surfaces by default.</action>
  <acceptance_criteria>The public publication outputs reflect the reduced corpus, and the new state is explicit enough to audit or roll forward safely.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Validate the rollout with before/after evidence</name>
  <action>Ship diff artifacts plus validation summaries that compare the governed corpus to the prior publication set and relate the change to coverage and recovery evidence.</action>
  <acceptance_criteria>Operators can tell which losses are intentional governance outcomes and which would represent new regressions requiring remediation.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/sitemap-blocklist.test.ts scripts/lib/content-governance.test.ts`
- `npx tsx scripts/seo-corpus-governance.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project can deliberately publish a smaller governed corpus, explain exactly what changed, and validate that the rollout is structural pruning rather than a new technical SEO failure.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/51-corpus-pruning-and-canonical-rollout-validation/51-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/51-corpus-pruning-and-canonical-rollout-validation/51-VERIFICATION.md` only if the governed rollout and validation gates are actually satisfied.
</output>
