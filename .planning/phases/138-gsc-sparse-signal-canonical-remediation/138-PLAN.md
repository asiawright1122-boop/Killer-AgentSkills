---
wave: 1
depends_on: []
files_modified:
  - src/pages/[locale]/skills/[owner]/[...repo].astro
  - tests/pages/gsc-overrides.test.ts
autonomous: true
---

# Phase 138 Plan: GSC Sparse-Signal & Canonical Remediation

This phase implements specific metadata overrides in Astro dynamic routing to optimize click-through rate (CTR) for key sparse-signal detail pages and adds integration tests to assert their presence.

## Tasks

### Task 1: Implement Skill Page Metadata Overrides in Astro Dynamic Router

<read_first>
- [src/pages/[locale]/skills/[owner]/[...repo].astro](file:///Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro)
</read_first>

<acceptance_criteria>
- `src/pages/[locale]/skills/[owner]/[...repo].astro` defines `SKILL_METADATA_OVERRIDES` containing specific SEO overrides for `Yorick-Ryu/deep-share`, `akiojin/llmlb`, `agentjido/jido_signal`, and `takuto-tanaka-4digit/excel-unidiff-cli`.
- When rendering these specific skills in their targeted locales, the overrides correctly intercept the `title` and `description` resolutions.
</acceptance_criteria>

<action>
1. Define a `SKILL_METADATA_OVERRIDES` dictionary inside the frontmatter of `src/pages/[locale]/skills/[owner]/[...repo].astro`.
2. Look up `SPECIAL_SEO_OVERFLOWS` using `requestedSkillId` and `typedLocale` in Astro.
3. If an override title or description is present, pass it as `override` to the `resolveSkillSeoTitle` and `resolveSkillSeoDescription` calls respectively.
</action>

---

### Task 2: Create Integration Test for GSC Metadata Overrides

<read_first>
- [tests/pages/sandbox-seo.test.ts](file:///Users/kaka/Dev/Killer-Skills/tests/pages/sandbox-seo.test.ts) (as template reference)
</read_first>

<acceptance_criteria>
- A new test file [tests/pages/gsc-overrides.test.ts](file:///Users/kaka/Dev/Killer-Skills/tests/pages/gsc-overrides.test.ts) is created.
- The test asserts that the overrides dictionary exists in the Astro file and contains entries for the four target skills.
- Running `npx vitest run tests/pages/gsc-overrides.test.ts` passes successfully.
</acceptance_criteria>

<action>
Create the new test file `tests/pages/gsc-overrides.test.ts` and write assertions that read the Astro file content to check for the presence of the override configurations.
</action>

---

### Task 3: Execute System Integrity Verification

<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>

<acceptance_criteria>
- `npm run typecheck` passes with no compilation errors.
- `npm run validate:public-surface` passes with 0 copy-leakage or formatting issues.
- `npm test` passes all unit and integration tests (including the new override checks) successfully.
- `npm run build` generates the production Astro output bundle successfully.
</acceptance_criteria>

<action>
Run the verification scripts in order:
1. Check types: `npm run typecheck`
2. Check copy guidelines: `npm run validate:public-surface`
3. Check test suites: `npm test`
4. Compile bundle: `npm run build`
</action>
