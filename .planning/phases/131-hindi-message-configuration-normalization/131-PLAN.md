---
phase: 131
plan: 131-01
type: execute
wave: 1
depends_on:
  - 130
files_modified:
  - src/messages/hi.json
  - src/i18n.ts
  - src/lib/nvidia.ts
  - src/lib/seo-title-lengths.test.ts
  - scripts/clean-broken-skills.js
  - scripts/sync-translations.ts
autonomous: true
---

# Phase 131 Plan — Hindi Message Configuration Normalization

## Objective

Normalize the locale configuration by completely removing the unused/unsupported Hindi language file `src/messages/hi.json` and any references, loading logic, or test mocks associated with it. This aligns the codebase with the actual `SUPPORTED_LOCALES` configuration.

## Requirement Traceability

- **LOCALE-01**: Normalize and resolve status of `src/messages/hi.json` (either formally activate Hindi in `SUPPORTED_LOCALES` or completely prune it from codebase/CI pathways).

***

## Tasks

### Task 1: Delete src/messages/hi.json

<read_first>
- Delete target: `src/messages/hi.json`
</read_first>

<acceptance_criteria>
- `src/messages/hi.json` does not exist in the workspace.
- `git status` reports the deletion of `src/messages/hi.json`.
</acceptance_criteria>

<action>
Execute the following command in the workspace root to purge the unused Hindi locale translation file:
```bash
rm src/messages/hi.json
```
Verify the deletion by running:
```bash
ls src/messages/hi.json
```
Expected: "No such file or directory" error.
</action>

***

### Task 2: Refactor i18n logic and config files

<read_first>
- Modify: `src/i18n.ts`
- Modify: `src/lib/nvidia.ts`
</read_first>

<acceptance_criteria>
- `src/i18n.ts` does not contain the import statement for `hi` (`import hi from './messages/hi.json';`).
- `src/i18n.ts` does not contain `hi,` inside `MESSAGES_MAP`.
- `src/lib/nvidia.ts` does not contain `hi: 'Hindi',` in `getLangName`.
</acceptance_criteria>

<action>
1. Open `src/i18n.ts`.
   - Remove the import statement (around line 11):
     ```typescript
     import hi from './messages/hi.json';
     ```
   - Remove the mapping key inside `MESSAGES_MAP` (around line 24):
     ```typescript
     hi,
     ```
2. Open `src/lib/nvidia.ts`.
   - Remove the language name map entry for Hindi (around line 60):
     ```typescript
     hi: 'Hindi',
     ```
</action>

***

### Task 3: Refactor test and scripts referencing Hindi locale

<read_first>
- Modify: `src/lib/seo-title-lengths.test.ts`
- Modify: `scripts/clean-broken-skills.js`
- Modify: `scripts/sync-translations.ts`
</read_first>

<acceptance_criteria>
- `src/lib/seo-title-lengths.test.ts` does not contain `'hi'` inside the `localeFiles` array.
- `scripts/clean-broken-skills.js` does not contain `'hi'` inside the `locales` array.
- `scripts/sync-translations.ts` does not contain `'hi'` inside the `LOCALES` array.
</acceptance_criteria>

<action>
1. Open `src/lib/seo-title-lengths.test.ts`.
   - Locate the `localeFiles` array declaration in the `FAQ6 MCP exists in all locales` test block (around line 121):
     ```typescript
     const localeFiles = ['en', 'zh', 'ja', 'ko', 'ar', 'de', 'es', 'fr', 'hi', 'pt', 'ru'];
     ```
   - Remove `'hi'` from the list:
     ```typescript
     const localeFiles = ['en', 'zh', 'ja', 'ko', 'ar', 'de', 'es', 'fr', 'pt', 'ru'];
     ```
2. Open `scripts/clean-broken-skills.js`.
   - Locate the `locales` array declaration (around line 33):
     ```typescript
     const locales = ['en', 'zh', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru'];
     ```
   - Remove `'hi'` from the list:
     ```typescript
     const locales = ['en', 'zh', 'ar', 'de', 'es', 'fr', 'ja', 'ko', 'pt', 'ru'];
     ```
3. Open `scripts/sync-translations.ts`.
   - Locate the `LOCALES` array declaration (around line 12):
     ```typescript
     const LOCALES = ['en', 'zh', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru'];
     ```
   - Remove `'hi'` from the list:
     ```typescript
     const LOCALES = ['en', 'zh', 'ar', 'de', 'es', 'fr', 'ja', 'ko', 'pt', 'ru'];
     ```
</action>

***

### Task 4: Run full verification loop

<read_first>
- Target: Entire workspace
- Verification commands: `npm run typecheck`, `npm test`, `npm run build`
</read_first>

<acceptance_criteria>
- `npm run typecheck` exits with code 0.
- `npm test` runs and all tests pass cleanly.
- `npm run build` compiles the Astro production bundle successfully.
</acceptance_criteria>

<action>
Execute the following verification sequence in order:
1. Compile and typecheck:
   ```bash
   npm run typecheck
   ```
2. Run test suites:
   ```bash
   npm test
   ```
3. Run build to verify Astro outputs are functional:
   ```bash
   npm run build
   ```
Ensure all commands exit successfully with zero errors.
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Translation synchronization script breaks due to missing files | We have updated the script `scripts/sync-translations.ts` in Task 3 to completely remove `'hi'` from `LOCALES`, preventing it from attempting to read or write the deleted `src/messages/hi.json` file. |
| Test suite fails due to hardcoded checks on translation files | We have modified `src/lib/seo-title-lengths.test.ts` to exclude checking for the presence of `'hi'` or checking dynamic parameters in `hi.json`, and we run `npm test` at the end to guarantee everything is green. |
