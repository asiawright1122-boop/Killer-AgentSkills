---
wave: 1
depends_on: []
files_modified:
  - "src/pages/public-links.test.ts"
  - "src/messages/public-copy.test.ts"
autonomous: true
---

# Phase 1: Resolve UI component test drift

<objective>
Fix all failing Vitest assertions relating to the `SkillRelated` Astro component extraction and i18n copy overrides heavily impacting CI workflows.
</objective>

<task>
<read_first>
- src/pages/public-links.test.ts
- src/messages/public-copy.test.ts
</read_first>
<action>
Change the hardcoded string matching assertions in `public-links.test.ts` to query the correct DOM structure output by `<SkillRelated />`. Delete obsolete translation mapping assertions in `public-copy.test.ts` that were tied to old string identifiers.
</action>
<acceptance_criteria>
- `npx vitest run src/pages/public-links.test.ts` exits 0
- `npx vitest run src/messages/public-copy.test.ts` exits 0
</acceptance_criteria>
</task>

<verification>
<must_haves>
- The global test suite MUST turn green for these previously failing component tests to enable CI gating.
</must_haves>
</verification>
