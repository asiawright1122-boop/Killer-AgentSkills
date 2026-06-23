---
phase: 134
plan: 134-01
type: execute
wave: 1
depends_on:
  - 133
files_modified:
  - src/content/blog/ar/automating-i18n-workflows-with-llms.md
  - src/content/blog/de/automating-i18n-workflows-with-llms.md
  - src/content/blog/en/automating-i18n-workflows-with-llms.md
  - src/content/blog/es/automating-i18n-workflows-with-llms.md
  - src/content/blog/fr/automating-i18n-workflows-with-llms.md
  - src/content/blog/ja/automating-i18n-workflows-with-llms.md
  - src/content/blog/ko/automating-i18n-workflows-with-llms.md
  - src/content/blog/pt/automating-i18n-workflows-with-llms.md
  - src/content/blog/ru/automating-i18n-workflows-with-llms.md
  - src/content/blog/zh/automating-i18n-workflows-with-llms.md
  - tests/pages/public-links.test.ts
autonomous: true
---

# Phase 134 Plan — Trailing-Slash Consistency

## Objective

Correct trailing-slash relative link variations in the blog content files and extend the automated test suite to prevent relative trailing slash link regressions, verifying 100% path compliance with `trailingSlash: 'never'`.

## Requirement Traceability

- **SLASH-01**: Resolve trailing-slash inconsistencies across the edge router, pages, and sitemaps.

***

## Tasks

### Task 1: Correct Blog Content Trailing Slash Links

<read_first>
- Files: `src/content/blog/*/automating-i18n-workflows-with-llms.md` (10 files)
</read_first>

<acceptance_criteria>
- The home portal links in the 10 blog post files do not contain trailing slashes (e.g., they end with `/ar`, `/de`, `/en`, etc., rather than `/ar/`, `/de/`, `/en/`).
</acceptance_criteria>

<action>
Modify the home portal links in:
- `src/content/blog/ar/automating-i18n-workflows-with-llms.md` line 25: change `(/ar/)` to `(/ar)`
- `src/content/blog/de/automating-i18n-workflows-with-llms.md` line 23: change `(/de/)` to `(/de)`
- `src/content/blog/en/automating-i18n-workflows-with-llms.md` line 34: change `(/en/)` to `(/en)`
- `src/content/blog/es/automating-i18n-workflows-with-llms.md` line 23: change `(/es/)` to `(/es)`
- `src/content/blog/fr/automating-i18n-workflows-with-llms.md` line 23: change `(/fr/)` to `(/fr)`
- `src/content/blog/ja/automating-i18n-workflows-with-llms.md` line 23: change `(/ja/)` to `(/ja)`
- `src/content/blog/ko/automating-i18n-workflows-with-llms.md` line 23: change `(/ko/)` to `(/ko)`
- `src/content/blog/pt/automating-i18n-workflows-with-llms.md` line 23: change `(/pt/)` to `(/pt)`
- `src/content/blog/ru/automating-i18n-workflows-with-llms.md` line 26: change `(/ru/)` to `(/ru)`
- `src/content/blog/zh/automating-i18n-workflows-with-llms.md` line 23: change `(/zh/)` to `(/zh)`
</action>

***

### Task 2: Expand Relative Trailing Slash Tests in public-links.test.ts

<read_first>
- File: `tests/pages/public-links.test.ts`
</read_first>

<acceptance_criteria>
- `tests/pages/public-links.test.ts` contains a new pattern or rule to check relative links (e.g., matching `href="/..."` and `(/.../)`) ending with slashes.
- Excluding the root path `/`, no file under `src/content`, `src/pages`, `src/components`, `src/layouts` or `docs` is allowed to contain relative links ending with trailing slashes.
</acceptance_criteria>

<action>
1. Define a relative trailing slash regex pattern in `tests/pages/public-links.test.ts`:
   ```typescript
   const RELATIVE_TRAILING_SLASH_PATTERN = /(href=["']\/[a-zA-Z0-9_\-\/]+\/["'])|(\(\/[a-zA-Z0-9_\-\/]+\/\))/gi;
   ```
2. In the `keeps authored public URLs free of trailing-slash regressions` test case, scan files using `RELATIVE_TRAILING_SLASH_PATTERN` and assert that no matches are found, pushing any matches to the `trailingSlashMatches` array.
</action>

***

### Task 3: Run Build and Test Verification

<read_first>
- Reference: `package.json`
</read_first>

<acceptance_criteria>
- `npm run build` exits with code 0.
- `npm test` runs successfully, passing all 1030+ assertions cleanly.
</acceptance_criteria>

<action>
1. Execute build validation:
   ```bash
   npm run build
   ```
2. Execute Vitest suite:
   ```bash
   npm test
   ```
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Mocking patterns matching code Regexes | Ensure the relative link regex matches only valid alpha-numeric route segments to avoid false positives on typescript/javascript regex declarations in code files. |
