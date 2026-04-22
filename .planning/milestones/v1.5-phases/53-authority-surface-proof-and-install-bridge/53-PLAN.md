---
phase: 53-authority-surface-proof-and-install-bridge
plan: 01
type: plan
wave: 1
depends_on:
  - '52-01'
files_modified:
  - '.planning/milestones/v1.5-phases/53-authority-surface-proof-and-install-bridge/53-CONTEXT.md'
  - '.planning/milestones/v1.5-phases/53-authority-surface-proof-and-install-bridge/53-PLAN.md'
  - '.planning/ROADMAP.md'
  - '.planning/REQUIREMENTS.md'
  - 'src/content.config.ts'
  - 'src/content/collections/top-official-mcp-servers.json'
  - 'src/content/collections/top-workflow-mcp-servers.json'
  - 'src/pages/[locale]/collections/[...slug].astro'
  - 'src/pages/[locale]/docs/[...slug].astro'
  - 'src/pages/public-links.test.ts'
requirements:
  - SEO-20
autonomous: true
must_haves:
  truths:
    - 'Top authority collections must explain why they are trusted and how users should act on them.'
    - 'Workflow authority surfaces must demonstrate real execution patterns, not only group related skills.'
    - 'Installation docs must serve as the clearest bridge from discovery into CLI setup and validation.'
  artifacts:
    - path: 'src/content/collections/top-official-mcp-servers.json'
      provides: 'First-party proof signals and maintenance posture for the highest-trust collection'
    - path: 'src/content/collections/top-workflow-mcp-servers.json'
      provides: 'Workflow grouping logic and execution examples for the top workflow collection'
    - path: 'src/pages/[locale]/docs/[...slug].astro'
      provides: 'Install-to-validation bridge on the docs surface'
---

# Phase 53 Plan 01: Authority Surface Proof and Install Bridge

<objective>
Upgrade the highest-priority authority surfaces so they visibly prove first-party selection quality and guide users from discovery into installation and validation.

Purpose: make the authority strategy feel editorially credible and operationally useful, not just better linked.
Output: stronger official/workflow collections plus installation docs that more clearly bridge traffic into CLI action.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5-phases/53-authority-surface-proof-and-install-bridge/53-CONTEXT.md
@data/authority-surfaces.json
@reports/seo/latest-authority-surface-program.md
@src/content.config.ts
@src/content/collections/top-official-mcp-servers.json
@src/content/collections/top-workflow-mcp-servers.json
@src/pages/[locale]/collections/[...slug].astro
@src/pages/[locale]/docs/[...slug].astro
@src/pages/public-links.test.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Add first-party proof layers to the two lead collections</name>
  <action>Extend collection content/schema so the official and workflow collections can expose editorial review reasons, trust signals, maintenance posture, and action-oriented next steps.</action>
  <acceptance_criteria>The collections prove why they were selected and how operators should use them instead of acting like generic grouped inventory pages.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Render authority proof and workflow execution sections on collection detail pages</name>
  <action>Update the collection detail template to show editorial proof, grouping logic, execution examples, and collection-specific handoff links when present.</action>
  <acceptance_criteria>The top authority collections visibly carry stronger first-party depth and clearer follow-on actions.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Turn installation docs into the main trust bridge</name>
  <action>Add an install-to-validation bridge on docs pages so discovery traffic can move directly into CLI setup, validation, and trusted authority surfaces.</action>
  <acceptance_criteria>Installation docs are visibly positioned as the main bridge from curated discovery into practical setup and verification.</acceptance_criteria>
</task>

</tasks>

<verification>
- `npx vitest run src/pages/public-links.test.ts`
- `npm run check:astro`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The top authority collections and installation docs now show clear first-party proof, practical next steps, and stronger conversion paths from discovery into action.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.5-phases/53-authority-surface-proof-and-install-bridge/53-01-SUMMARY.md` and `.planning/milestones/v1.5-phases/53-authority-surface-proof-and-install-bridge/53-VERIFICATION.md` only if the authority-proof and install-bridge gates are actually satisfied.
</output>
