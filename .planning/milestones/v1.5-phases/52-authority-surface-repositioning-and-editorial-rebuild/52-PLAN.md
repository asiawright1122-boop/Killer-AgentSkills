---
phase: 52-authority-surface-repositioning-and-editorial-rebuild
plan: 01
type: plan
wave: 1
depends_on:
  - '51-01'
files_modified:
  - '.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-PLAN.md'
  - 'src/pages/[locale]/index.astro'
  - 'src/pages/[locale]/collections/index.astro'
  - 'src/pages/[locale]/collections/[...slug].astro'
  - 'src/pages/[locale]/skills/index.astro'
  - 'src/pages/[locale]/solutions/index.astro'
  - 'data/authority-surfaces.json'
  - 'scripts/seo-authority-surface-program.ts'
  - 'reports/seo/latest-authority-surface-program.md'
  - 'reports/seo/latest-authority-surface-program.json'
  - 'src/pages/public-links.test.ts'
requirements:
  - SEO-20
autonomous: true
must_haves:
  truths:
    - 'Post-pruning organic recovery must depend on fewer, stronger, more original entry surfaces.'
    - 'Internal discovery should reinforce authority surfaces instead of treating the full skills corpus as equally valuable.'
    - 'Authority recovery must become an editorial operating model, not a one-time polish pass.'
  artifacts:
    - path: 'reports/seo/latest-authority-surface-program.json'
      provides: 'Machine-readable authority-surface inventory, priority, and maintenance expectations'
    - path: 'reports/seo/latest-authority-surface-program.md'
      provides: 'Operator-readable authority-surface recovery program and public-surface emphasis guidance'
---

# Phase 52 Plan 01: Authority Surface Repositioning and Editorial Rebuild

<objective>
Re-center organic recovery on a smaller set of curated, first-party authority surfaces so the site's post-governance search strategy depends on depth and trust rather than long-tail bulk expansion.

Purpose: translate the governed corpus reset into a durable public-surface strategy that Google and users can trust more easily.
Output: an authority-surface inventory plus public-surface emphasis and editorial governance artifacts that redirect discovery toward stronger pages.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-CONTEXT.md
@docs/seo-google-guidelines-audit-2026-04-16.md
@src/pages/[locale]/index.astro
@src/pages/[locale]/collections/index.astro
@src/pages/[locale]/collections/[...slug].astro
@src/pages/[locale]/skills/index.astro
@src/pages/[locale]/solutions/index.astro
@reports/seo/latest-recovery-control-board.json
@reports/gsc/latest-ctr-report.json
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the authority-surface inventory</name>
  <action>Create a machine-readable inventory of the pages and surface types that should carry organic recovery after the corpus is pruned, including priority, rationale, and maintenance expectations.</action>
  <acceptance_criteria>The project can explicitly name which surfaces matter most for trust and recovery instead of treating discovery as a flat corpus problem.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Reposition public discovery toward authority surfaces</name>
  <action>Update the homepage and key browse surfaces so internal linking, page emphasis, and discovery cues steer users and crawlers toward the new authority inventory.</action>
  <acceptance_criteria>Public discovery favors curated authority surfaces over generic bulk-skill browsing, and the emphasis remains consistent across key entry pages.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Ship the editorial recovery program</name>
  <action>Generate Markdown/JSON artifacts that define the authority-surface recovery program, maintenance expectations, and the next editorial intervention queue.</action>
  <acceptance_criteria>The project has a durable editorial operating model for authority recovery instead of a one-off cleanup list.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/pages/public-links.test.ts`
- `npx tsx scripts/seo-authority-surface-program.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has a clear authority-surface strategy that redirects organic recovery toward curated, first-party pages and gives operators an editorial program to maintain them.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/52-authority-surface-repositioning-and-editorial-rebuild/52-VERIFICATION.md` only if the authority strategy and verification gates are actually satisfied.
</output>
