---
phase: 59-user-facing-entry-surface-normalization
plan: 01
type: plan
wave: 1
depends_on:
  - 58-01
files_modified:
  - '.planning/phases/59-user-facing-entry-surface-normalization/59-CONTEXT.md'
  - '.planning/phases/59-user-facing-entry-surface-normalization/59-PLAN.md'
  - 'src/pages/[locale]/collections/index.astro'
  - 'src/pages/[locale]/collections/[...slug].astro'
  - 'src/pages/[locale]/solutions/[topic].astro'
  - 'src/pages/[locale]/docs/[...slug].astro'
  - 'src/pages/[locale]/skills/[owner]/[...repo].astro'
  - 'src/lib/authority-surface-public-data.ts'
  - 'src/messages/zh.json'
  - 'src/content/collections/'
  - 'tests/pages/public-links.test.ts'
requirements:
  - UX-EXP-02
autonomous: true
must_haves:
  truths:
    - 'Public discovery pages should help users compare, install, and continue, without revealing internal editorial or operator process language.'
    - 'The dominant source of leaked copy is shared collection data, so the phase must normalize shared sources instead of only patching rendered templates.'
    - 'The first remediation pass should leave durable regression evidence behind for the phrase families it removes.'
  artifacts:
    - path: '.planning/phases/59-user-facing-entry-surface-normalization/59-VERIFICATION.md'
      provides: 'Evidence that the highest-impact public trust surfaces were normalized and verified'
---

# Phase 59 Plan 01: User-Facing Entry Surface Normalization

<objective>
Rewrite the highest-impact public entry surfaces so they present direct product guidance and cleaner next steps instead of internal strategy/process language.

Purpose: turn the Phase `58` inventory into visible user-facing trust improvements on the most important discovery and install surfaces.
Output: normalized public templates, normalized shared collection copy, and regression coverage for the removed phrase families.
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/58-public-copy-boundary-audit-and-inventory/58-01-SUMMARY.md
@.planning/phases/59-user-facing-entry-surface-normalization/59-CONTEXT.md
@src/pages/[locale]/collections/index.astro
@src/pages/[locale]/collections/[...slug].astro
@src/pages/[locale]/solutions/[topic].astro
@src/pages/[locale]/docs/[...slug].astro
@src/pages/[locale]/skills/[owner]/[...repo].astro
@src/lib/authority-surface-public-data.ts
@src/messages/zh.json
@src/content/collections/
@tests/pages/public-links.test.ts
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Normalize core discovery templates</name>
  <action>Rewrite the collections hub, collection detail page, and solution page section labels and explanatory copy so they guide users through comparison, installation, and next steps without internal-process wording.</action>
  <acceptance_criteria>These templates no longer present public headings or body copy built around operator checkpoints, editorial filters, high-intent narrowing, or recovery/decision-lane language.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Normalize shared public copy sources</name>
  <action>Rewrite shared authority-surface data, locale strings, and collection JSON phrases that feed public entry surfaces so the repeated internal-language pattern is removed systemically.</action>
  <acceptance_criteria>Shared collection/data sources stop emitting the recurring phrase families identified in Phase `58`, while preserving page usefulness and navigation intent.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Add regression coverage for the normalization pass</name>
  <action>Extend public trust-surface tests so the removed phrase families are blocked from returning to the touched templates and shared data sources.</action>
  <acceptance_criteria>The test suite checks the normalized surfaces against the internal-language families removed during this phase.</acceptance_criteria>
</task>

</tasks>

<verification>
- `rg -n "operator|handoff|checkpoint|install-first|editorial filter|trusted starter|sanity-check|收口|交叉核对|已验证路径|标准化之前|落地路径|决策入口" src/pages src/content/collections src/lib src/messages`
- `npm run format:check`
- `npx vitest run tests/pages/public-links.test.ts`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The highest-impact public entry surfaces and their shared sources now read like user-facing product guidance, and the removed internal phrase families are covered by regression checks.
</success_criteria>

<output>
After completion, create `.planning/phases/59-user-facing-entry-surface-normalization/59-VERIFICATION.md` only if the normalization changes and verification evidence are actually collected.
</output>
