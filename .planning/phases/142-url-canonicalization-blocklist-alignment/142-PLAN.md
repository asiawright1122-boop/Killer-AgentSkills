# Phase 142: URL Canonicalization & Blocklist Alignment

- **Wave**: 1
- **Depends On**: Phase 141
- **Files Modified**: 
  - `src/pages/[locale]/skills/[owner]/[...repo].astro`
  - `tests/pages/canonicalization-remediation.test.ts`
- **Autonomous**: true

## Tasks

### Task 1: Integrate Sitemap Blocklist into Skill Detail Rendering
<read_first>
- [src/pages/[locale]/skills/[owner]/[...repo].astro](file:///Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro)
- [src/lib/sitemap-blocklist.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/sitemap-blocklist.ts)
</read_first>
<acceptance_criteria>
- `[...repo].astro` imports `compileSitemapBlocklist` and `isSitemapSkillBlocked` from `../../../../lib/sitemap-blocklist`
- `[...repo].astro` imports `sitemapBlocklistData` from `../../../../../data/seo-sitemap-blocklist.json`
- `[...repo].astro` calculates `isBlocked` and includes it in `layoutNoindex` definition.
</acceptance_criteria>
<action>
- In `[...repo].astro`, import the blocklist helper functions and raw JSON blocklist data.
- Compile sitemap blocklist: `const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);` in frontmatter.
- Compute blocklist check: `const isBlocked = isSitemapSkillBlocked(owner, canonicalRoutePath, sitemapBlocklist);`.
- Update `layoutNoindex` to:
  ```typescript
  const layoutNoindex =
    useStaticFallback ||
    isBlocked ||
    (renderRepoDirectory ? !isForcedOpen : !skillIndexability?.isIndexable || (hasSkill && !isPageInSitemap));
  ```
</action>

### Task 2: Create Integration Tests for Canonicalization and Blocklist Governance
<read_first>
- [tests/pages/gsc-overrides.test.ts](file:///Users/kaka/Dev/Killer-Skills/tests/pages/gsc-overrides.test.ts)
</read_first>
<acceptance_criteria>
- New test file `tests/pages/canonicalization-remediation.test.ts` is created.
- Tests verify that `[...repo].astro` includes sitemap blocklist imports and applies `isBlocked` to `layoutNoindex`.
- Tests run and pass successfully.
</acceptance_criteria>
<action>
- Create [tests/pages/canonicalization-remediation.test.ts](file:///Users/kaka/Dev/Killer-Skills/tests/pages/canonicalization-remediation.test.ts) with assertions checking `[...repo].astro` file contents.
- Run tests: `npx vitest run tests/pages/canonicalization-remediation.test.ts`
</action>

### Task 3: System Integrity & Regression Guard
<read_first>
- [package.json](file:///Users/kaka/Dev/Killer-Skills/package.json)
</read_first>
<acceptance_criteria>
- `npm run typecheck` compiles cleanly.
- `npm test` successfully runs and passes all 1030+ tests.
- `npm run build` compiles production bundle with no errors.
</acceptance_criteria>
<action>
- Run typecheck: `npm run typecheck`
- Run test suite: `npm test`
- Run production build: `npm run build`
</action>
