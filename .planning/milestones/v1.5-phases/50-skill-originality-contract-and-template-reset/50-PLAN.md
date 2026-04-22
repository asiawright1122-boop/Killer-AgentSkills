---
phase: 50-skill-originality-contract-and-template-reset
plan: 01
type: plan
wave: 1
depends_on:
  - '49-01'
files_modified:
  - '.planning/milestones/v1.5-phases/50-skill-originality-contract-and-template-reset/50-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/50-skill-originality-contract-and-template-reset/50-PLAN.md'
  - 'src/pages/[locale]/skills/[owner]/[...repo].astro'
  - 'src/islands/SkillReadme.tsx'
  - 'src/lib/skill-indexability.ts'
  - 'scripts/build-skills-cache.ts'
  - 'scripts/seo-skill-indexability-report.ts'
  - 'reports/seo/latest-skill-indexability.md'
  - 'reports/seo/latest-skill-indexability.json'
  - 'src/pages/public-links.test.ts'
requirements:
  - SEO-18
autonomous: true
must_haves:
  truths:
    - 'Indexable skill pages must prove first-party value beyond imported repository content.'
    - 'README length alone must stop being the effective index gate.'
    - 'The skill detail template must answer decision-support questions before it exposes long imported markdown.'
  artifacts:
    - path: 'reports/seo/latest-skill-indexability.json'
      provides: 'Machine-readable indexability audit for the new originality contract'
    - path: 'reports/seo/latest-skill-indexability.md'
      provides: 'Operator-readable summary of which skill pages satisfy the first-party value contract'
---

# Phase 50 Plan 01: Skill Originality Contract and Template Reset

<objective>
Replace the current README-first skill detail model with an originality contract and template that make Killer-Skills' first-party evaluation the primary reason a page deserves indexing.

Purpose: remove the strongest remaining low-value aggregation signal at the page-template level.
Output: a new skill detail contract plus page template structure that separates indexable first-party value from imported supporting material.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5-phases/50-skill-originality-contract-and-template-reset/50-CONTEXT.md
@docs/seo-google-guidelines-audit-2026-04-16.md
@src/pages/[locale]/skills/[owner]/[...repo].astro
@src/islands/SkillReadme.tsx
@scripts/build-skills-cache.ts
@reports/seo/latest-coverage-drilldown.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the first-party originality contract</name>
  <action>Create a reusable skill indexability contract that evaluates whether a page contributes enough original value, judgment, and decision support to remain indexable.</action>
  <acceptance_criteria>The project has a machine-readable rule set that is stronger than the current byte threshold and can drive governance reports plus runtime decisions.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Reset the skill detail template around first-party evaluation</name>
  <action>Rebuild the skill detail layout so fit, limitations, compatibility, verification, and decision-support content appear before imported README material, with the README clearly demoted to supporting evidence.</action>
  <acceptance_criteria>Indexable pages visibly lead with Killer-Skills' own evaluation layer, and imported markdown no longer dominates the first impression or the primary page value.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Replace the byte-threshold gate and ship audit artifacts</name>
  <action>Swap the current thin-content gate for the new originality contract and generate Markdown/JSON audits summarizing which skills remain indexable under the stronger contract.</action>
  <acceptance_criteria>The site can explain why a skill page remains indexable or becomes non-indexable, and that reason is no longer reducible to content byte size.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/pages/public-links.test.ts`
- `npx tsx scripts/seo-skill-indexability-report.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has a new skill detail contract and template that make first-party value the reason a page deserves indexing, not just imported markdown plus SEO wrappers.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/50-skill-originality-contract-and-template-reset/50-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/50-skill-originality-contract-and-template-reset/50-VERIFICATION.md` only if the originality contract and verification gates are actually satisfied.
</output>
