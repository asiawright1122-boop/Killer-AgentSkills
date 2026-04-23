---
phase: 58-public-copy-boundary-audit-and-inventory
plan: 01
type: plan
wave: 1
depends_on: []
files_modified:
  - '.planning/PROJECT.md'
  - '.planning/REQUIREMENTS.md'
  - '.planning/ROADMAP.md'
  - '.planning/STATE.md'
  - '.planning/phases/58-public-copy-boundary-audit-and-inventory/58-CONTEXT.md'
  - '.planning/phases/58-public-copy-boundary-audit-and-inventory/58-PLAN.md'
  - '.planning/phases/58-public-copy-boundary-audit-and-inventory/58-01-SUMMARY.md'
  - '.planning/phases/58-public-copy-boundary-audit-and-inventory/58-VERIFICATION.md'
requirements:
  - GOV-13
autonomous: true
must_haves:
  truths:
    - 'Public product surfaces should guide users, not expose internal strategy/process framing.'
    - 'The audit must identify the real source of leaked copy, not just the rendered page where it appears.'
    - 'The findings should rank remediation urgency so downstream fixes hit trust-critical pages first.'
  artifacts:
    - path: '.planning/phases/58-public-copy-boundary-audit-and-inventory/58-01-SUMMARY.md'
      provides: 'Structured inventory of public copy leakage hotspots, source classes, and remediation priority'
    - path: '.planning/phases/58-public-copy-boundary-audit-and-inventory/58-VERIFICATION.md'
      provides: 'Evidence for the audit scope, scan method, and verification commands'
---

# Phase 58 Plan 01: Public Copy Boundary Audit and Inventory

<objective>
Audit the repository for public-facing internal-language leakage and produce one actionable inventory that downstream remediation phases can trust.

Purpose: make `GOV-13` concrete and measurable.
Output: a classified hotspot inventory covering templates, shared messages, content/data sources, and severity/priority for remediation.
</objective>

<execution_context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/58-public-copy-boundary-audit-and-inventory/58-CONTEXT.md
@src/pages/[locale]/index.astro
@src/pages/[locale]/collections/
@src/pages/[locale]/solutions/
@src/pages/[locale]/docs/
@src/lib/authority-surface-public-data.ts
@src/content/collections/
@src/messages/
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Define the leakage signal set</name>
  <action>Identify the kinds of internal phrasing that should not appear on public product surfaces, using the confirmed homepage leak as a seed case.</action>
  <acceptance_criteria>The audit has a clear pattern set for internal strategy/process language, not just one hard-coded phrase list.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Scan public-facing route templates and shared copy sources</name>
  <action>Search `src/pages`, public messages, collections, and authority-surface data for user-visible internal-language hotspots and trace each hotspot to its source.</action>
  <acceptance_criteria>Each finding identifies the page/surface, the source file, the offending language pattern, and why it is risky.</acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Classify and prioritize remediation</name>
  <action>Group findings by severity and by source class so downstream phases know which entry surfaces to rewrite first and which shared sources need systemic cleanup.</action>
  <acceptance_criteria>The inventory distinguishes trust-critical entry surfaces, medium-risk support pages, and lower-priority or intentionally internal documents.</acceptance_criteria>
</task>

</tasks>

<verification>
- `rg -n "trusted entry paths|narrow the choice|turn discovery into installation|authority surface|promotion|hold|workflow intent|operator|governance" src/pages src/messages src/content src/lib`
- `npm run format:check`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap analyze`
</verification>

<success_criteria>
The project has a trustworthy inventory of where internal strategy/process language leaks into public-facing surfaces, what source produced each leak, and which surfaces should be fixed first.
</success_criteria>

<output>
After completion, create `.planning/phases/58-public-copy-boundary-audit-and-inventory/58-01-SUMMARY.md` and `.planning/phases/58-public-copy-boundary-audit-and-inventory/58-VERIFICATION.md` only if the audit evidence is actually collected.
</output>
