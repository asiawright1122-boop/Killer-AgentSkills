---
phase: 49-skill-locale-index-governance
plan: 01
type: plan
wave: 1
depends_on:
  - '48-01'
files_modified:
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/PROJECT.md'
  - '.planning/STATE.md'
  - '.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-PLAN.md'
  - 'src/pages/[locale]/skills/[owner]/[...repo].astro'
  - 'src/pages/sitemap-skills-[page].xml.ts'
  - 'src/lib/site/metadata.ts'
  - 'src/lib/seo-locales.ts'
  - 'src/pages/public-links.test.ts'
  - 'reports/seo/latest-skill-locale-governance.md'
  - 'reports/seo/latest-skill-locale-governance.json'
requirements:
  - SEO-17
  - GOV-11
autonomous: true
must_haves:
  truths:
    - 'Skill locale variants must not self-canonicalize unless the crawler-visible page is genuinely localized.'
    - 'Skill sitemap, hreflang, canonical, and noindex outputs must all agree on the same locale-eligibility contract.'
    - 'Losing multilingual index volume is acceptable if it removes stronger low-value aggregation and mismatch signals.'
  artifacts:
    - path: 'reports/seo/latest-skill-locale-governance.json'
      provides: 'Machine-readable inventory of indexable, suppressed, and consolidated skill locale variants'
    - path: 'reports/seo/latest-skill-locale-governance.md'
      provides: 'Operator-readable summary of the new skill locale governance contract and its blast radius'
---

# Phase 49 Plan 01: Skill Locale Index Governance

<objective>
Define and enforce a single locale-eligibility contract for skill detail pages so the public indexable skill set stops over-claiming multilingual quality that the crawler-visible body does not actually provide.

Purpose: remove one of the site's strongest mirror-like and low-trust signals without waiting for a full template or corpus redesign.
Output: a shared skill locale governance layer that aligns runtime metadata, sitemap emission, and reporting on which skill locale variants remain indexable.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-CONTEXT.md
@docs/seo-google-guidelines-audit-2026-04-16.md
@docs/seo-index-governance-2026-03-15.md
@src/pages/[locale]/collections/[...slug].astro
@src/pages/[locale]/skills/[owner]/[...repo].astro
@src/lib/site/metadata.ts
@src/lib/i18n-dynamic.ts
@src/pages/sitemap-skills-[page].xml.ts
@reports/seo/latest-coverage-drilldown.json
@reports/gsc/latest-ctr-report.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the shared skill locale eligibility contract</name>
  <action>Create a reusable eligibility helper for skill pages that decides whether a locale variant is indexable, consolidated to another locale, or rendered as user-visible but non-indexable.</action>
  <acceptance_criteria>The contract is explicit enough that runtime pages, sitemap generation, and tests can all use the same answer instead of re-implementing locale heuristics.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Align runtime skill detail metadata and index signals</name>
  <action>Update skill detail routing so canonical, hreflang, and noindex behavior follow the new contract, especially for locales where crawler-visible body content still falls back to English or source-language text.</action>
  <acceptance_criteria>Ineligible skill locale variants no longer self-canonicalize as fully localized pages, and eligible locales expose consistent metadata plus crawl-safe rendering behavior.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Align sitemap output and publish governance artifacts</name>
  <action>Restrict the skill sitemap to eligible locale variants, then generate JSON/Markdown governance artifacts summarizing kept, suppressed, and consolidated skill locales plus their expected impact.</action>
  <acceptance_criteria>The sitemap no longer advertises non-eligible multilingual skill URLs, and operators can inspect the governance blast radius before or after rollout.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/lib/site/metadata.test.ts src/pages/public-links.test.ts`
- `npx tsx scripts/seo-skill-locale-governance.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has one truthful skill locale contract that stops multilingual over-indexing and makes the runtime, sitemap, and governance outputs agree on which skill locale URLs deserve indexing.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/49-skill-locale-index-governance/49-VERIFICATION.md` only if the governance contract and verification gates are actually satisfied.
</output>
