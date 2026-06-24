---
wave: 1
depends_on: []
files_modified:
  - scripts/lib/typography.ts
  - scripts/lib/typography.test.ts
  - scripts/sync-translations.ts
  - scripts/translate-locales.ts
  - scripts/verify-collection-cjk-punctuation.ts
  - scripts/lib/collection-locale-punctuation.ts
  - scripts/lib/collection-locale-punctuation.test.ts
autonomous: true
---

# Phase 145 Plan: GEO-localized translation sync & CJK Punctuation

Improve dynamic translation workflows (sync & translation scripts) and validation routines to conform to CJK-specific typography, spacing, and phrasing standards, optimizing internationalized pages for search engine visibility.

## Goal
Implement a generic typography engine for CJK languages (Chinese, Japanese, Korean) to handle CJK-English spacing ("盘古之白"), geolocalized punctuation mapping (e.g. converting `.` to `。` or `,` to `，`/`、` appropriately while protecting decimals, URLs, and code interpolations), and enforce localized SEO phrasing glossary mappings. Build test suites and automate CLI repair features.

## Architecture
1. **Typography Engine (`scripts/lib/typography.ts`)**: Pure utility module exporting:
   - `cleanTypography(text: string, locale: string): string` for spacing and punctuation.
   - `postProcessPhrasing(text: string, locale: string): string` for glossary mappings.
2. **Dynamic Spacing**: Inserts a half-width space between CJK and ASCII characters (alphabets, numbers, and backticks) safely.
3. **Punctuation Geolocalization**:
   - `zh`: `,` -> `，`, `.` -> `。`, `!` -> `！`, `?` -> `？`, `:` -> `：`, `;` -> `；`
   - `ja`: `,` -> `、`, `.` -> `。`, `!` -> `！`, `?` -> `？`, `:` -> `：`, `;` -> `；`
   - `ko`: Keep modern Korean typography rules (keep half-width `,` and `.`), but full-width exclamation/interrogation marks.
4. **Translation Integration**: Apply the typography filters to translations loaded or generated in `sync-translations.ts` and `translate-locales.ts`. Modernize target translation prompts and fallback keys.
5. **Collection Auto-Fix**: Enhance `verify-collection-cjk-punctuation.ts` to support `--fix` for auto-repairing metadata JSON structures in-place.

## Tech Stack
- TypeScript (ESNext, tsx loader)
- Vitest

---

## Tasks

### Task 1: Create the Typography Engine

<read_first>
- [config/locales.mjs](file:///Users/kaka/Dev/Killer-Skills/config/locales.mjs)
</read_first>

<acceptance_criteria>
- File `scripts/lib/typography.ts` is created.
- Exports `cleanTypography(text: string, locale: string): string` supporting Chinese, Japanese, and Korean spacing and punctuation mapping rules.
- Exports `postProcessPhrasing(text: string, locale: string): string` correcting raw literal translations with localized technical phrasing glossary maps.
- Excludes decimals (e.g. `3.5`), code placeholders (e.g. `{count}`), and domain names (e.g. `fal.ai`) from full-width punctuation conversion.
</acceptance_criteria>

<action>
Create `scripts/lib/typography.ts` containing:
1. Regex for CJK characters: `const CJK_RE = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7a3]/;`
2. CJK-English Spacing rules:
   - CJK to ASCII: replace `(/([\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7a3])([a-zA-Z0-9])/g, '$1 $2')`
   - ASCII to CJK: replace `(/([a-zA-Z0-9])([\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7a3])/g, '$1 $2')`
   - Backticks around code: handle spacing around backticks (e.g., `使用 \`Cursor\`` -> `使用 \`Cursor\``).
3. Localized punctuation substitution:
   - For `zh`: replace `.` (except in floats, URLs) with `。`, `,` with `，`, `!` with `！`, `?` with `？`, `:` with `：`, `;` with `；`.
   - For `ja`: replace `.` with `。`, `,` with `、`, `!` with `！`, `?` with `？`, `:` with `：`, `;` with `；`.
   - For `ko`: keep `,` and `.`, convert `!` -> `！`, `?` -> `？`.
   - Exclude URLs/domains using regex like `(?<!\d|\b[a-zA-Z]{1,4})\.(?!\d|[a-zA-Z])`.
4. Glossary mapping rules in `postProcessPhrasing` targeting terms like:
   - "AI Agent Skill" -> zh: "AI 智能体技能", ja: "AIエージェントスキル", ko: "AI 에이전트 스킬"
   - "IDE integration" -> zh: "IDE 集成", ja: "IDE統合", ko: "IDE 통합"
   - "developer tools" -> zh: "开发者工具", ja: "開発者ツール", ko: "開発者ツール" (or "개발자 도구" for ko).
</action>

---

### Task 2: Implement Typography Engine Unit Tests

<read_first>
- [scripts/lib/typography.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/typography.ts)
</read_first>

<acceptance_criteria>
- File `scripts/lib/typography.test.ts` is created.
- Tests verify:
  - CJK-English spacing is applied correctly on mixed strings.
  - Floats, code templates, and domain names are safe from punctuation conversion.
  - Proper geolocalized punctuation output for Chinese, Japanese, and Korean.
  - Phrasing glossary conversions correct literal translations without touching brand names.
- Run `npx vitest run scripts/lib/typography.test.ts` successfully passes.
</acceptance_criteria>

<action>
Create `scripts/lib/typography.test.ts` with test cases:
- Spacing: `"安装Cursor技能"` -> `"安装 Cursor 技能"`, `"在\`VS Code\`中"` -> `"在 \`VS Code\` 中"`.
- Floats/Domains: `"v1.5.0 版本"` -> `"v1.5.0 版本"`, `"访问fal.ai来测试"` -> `"访问 fal.ai 来测试"`.
- Punctuation:
  - `"安装已完成."` -> `zh`: `"安装已完成。"`, `ja`: `"安装已完成。"`, `ko`: `"安装已完成."`.
  - `"技能, 工具和扩展"` -> `zh`: `"技能，工具和扩展"`, `ja`: `"技能、工具和扩展"`, `ko`: `"技能, 工具和扩展"`.
- Glossary: `"检查 AI Agent Skill 的配置"` -> `"检查 AI 智能体技能的配置"`.
Run Vitest to verify correctness.
</action>

---

### Task 3: Integrate Typography Formatting into sync-translations.ts

<read_first>
- [scripts/sync-translations.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/sync-translations.ts)
- [scripts/lib/typography.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/typography.ts)
</read_first>

<acceptance_criteria>
- `scripts/sync-translations.ts` imports `cleanTypography` and `postProcessPhrasing`.
- When exporting nested structures to CJK locales (`zh`, `ja`, `ko`), the script applies typography formatting to all string values.
- Running `npx tsx scripts/sync-translations.ts` aligns baseline files and successfully cleans existing CJK locales.
</acceptance_criteria>

<action>
Modify `scripts/sync-translations.ts`:
- Import `cleanTypography` and `postProcessPhrasing` from `./lib/typography`.
- In the locale iteration block, check if `code` is `'zh'`, `'ja'`, or `'ko'`.
- If so, map over all dictionary values recursively and apply `cleanTypography(value, code)` and `postProcessPhrasing(value, code)` before writing the JSON file.
</action>

---

### Task 4: Integrate Typography Formatting & Modernize translate-locales.ts

<read_first>
- [scripts/translate-locales.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/translate-locales.ts)
- [scripts/lib/typography.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/typography.ts)
</read_first>

<acceptance_criteria>
- Prompt in `scripts/translate-locales.ts` is modernized to instruct the AI model to respect CJK spacing, geolocalized punctuation, and Glossary mapping.
- Detection of missing keys handles sync placeholders (i.e. if the key exists but its value is identical to the English original and target locale is CJK, it is recognized as needing translation).
- Apply `cleanTypography` and `postProcessPhrasing` to raw AI outputs before saving to target language files.
</acceptance_criteria>

<action>
Modify `scripts/translate-locales.ts`:
- Import `cleanTypography` and `postProcessPhrasing`.
- In `translateText`, update prompt rules:
  - Add specific constraints for spacing (add half-width space between CJK and English letters/numbers).
  - List CJK terminal and inline punctuation rules (Chinese vs. Japanese vs. Korean).
  - Explicitly include a Glossary Table in the system instructions (e.g. "AI Agent Skill" -> "AI 智能体技能" for zh, etc.).
- In `main`, update missing keys detection:
  - Include keys whose value is equal to `flatEn[key]` and `locale !== 'en'`. (To avoid false positives on short terms like "Cursor", skip key translation if it only consists of non-translatable brand words).
- Post-process the translator returned value using `cleanTypography(translatedText, locale)` and `postProcessPhrasing(translatedText, locale)`.
</action>

---

### Task 5: Enhance verify-collection-cjk-punctuation.ts with In-Place Auto-Fixing

<read_first>
- [scripts/verify-collection-cjk-punctuation.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/verify-collection-cjk-punctuation.ts)
- [scripts/lib/collection-locale-punctuation.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/collection-locale-punctuation.ts)
- [scripts/lib/typography.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/typography.ts)
</read_first>

<acceptance_criteria>
- `scripts/verify-collection-cjk-punctuation.ts` parses `--fix` command-line argument.
- `scripts/lib/collection-locale-punctuation.ts` exports `fixCollectionsDirectory(options?: { workspaceRoot?: string })`.
- Auto-fix parses collections, applies CJK terminal punctuation rules and spacing via `cleanTypography` and writes changes back to the collection JSON files.
- Integration tests in `scripts/lib/collection-locale-punctuation.test.ts` verify the auto-fix logic.
</acceptance_criteria>

<action>
Modify `scripts/lib/collection-locale-punctuation.ts` and `scripts/verify-collection-cjk-punctuation.ts`:
1. In `scripts/lib/collection-locale-punctuation.ts`, implement `fixCollectionsDirectory` function. Iterate through JSON files, traverse each required field. If the locale is CJK (`zh`, `ja`, `ko`), run `cleanTypography` on its value, and append the appropriate terminal punctuation (e.g. `。` for `zh`/`ja`, `.` for `ko`) if missing.
2. In `scripts/verify-collection-cjk-punctuation.ts`, check if `process.argv.includes('--fix')`. If so, execute `fixCollectionsDirectory` before running the validation checks.
3. In `scripts/lib/collection-locale-punctuation.test.ts`, add a unit test that feeds a malformed record to a mock/inline check and validates that `fixCollectionRecord` successfully fixes spacing, replaces half-width punctuation, and appends correct terminal punctuation.
</action>

---

## Verification Criteria
To verify Phase 145 completeness, run:
1. `npx vitest run scripts/lib/typography.test.ts` - Verify core typography format calculations.
2. `npx vitest run scripts/lib/collection-locale-punctuation.test.ts` - Verify CJK punctuation and auto-fix rules on collections.
3. `npm run typecheck` - Verify compilation sanity.
4. `npx tsx scripts/sync-translations.ts` - Verify translation sync workflow formats files cleanly.
5. Check if Git diff shows correct CJK spacing and punctuation in localized json files.

## Must Haves (Goal-Backward Verification)
- [ ] Typography utility enforces spacing between CJK characters and English letters/numbers.
- [ ] Chinese/Japanese locales convert western punctuation to full-width equivalents (excluding float dot, placeholders, and domains).
- [ ] Korean locale retains modern technical half-width commas and periods.
- [ ] AI translation prompt includes Glossary and typography instructions.
- [ ] Missing key detection handles English sync placeholders.
- [ ] `verify-collection-cjk-punctuation.ts --fix` automatically repairs collection JSON formatting.
- [ ] Zero TypeScript compile or Vitest suite regressions.
