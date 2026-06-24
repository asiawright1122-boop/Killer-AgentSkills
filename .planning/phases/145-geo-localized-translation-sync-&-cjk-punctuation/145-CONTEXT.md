# Phase 145: GEO-localized translation sync & CJK Punctuation Context

## Requirement Details

- **GEO-01**: **GEO-localized translation sync**: Enforce CJK terminal punctuation and formatting rules in dynamic translation workflows to ensure GEO-local typography compliance.
- **GEO-02**: **Semantic translation phrasing**: Modernize semantic phrasing translation policies to avoid simple machine translations and ensure SEO-appropriate descriptions.

## Target Goals

1. **Typography Engine**:
   - Implement `scripts/lib/typography.ts` exporting:
     - `cleanTypography(text: string, locale: string): string`
     - `postProcessPhrasing(text: string, locale: string): string`
   - Rules for CJK (中、日、韩):
     - **CJK-English Spacing (盘古之白)**: Automatically insert a half-width space between CJK characters and English letters/numbers.
     - **Punctuation conversion**:
       - `zh` (Chinese): Convert `, . ! ? : ;` to `， 。 ！ ？ ： ；` (avoiding numbers/float dot, domain names, file extensions, and placeholders).
       - `ja` (Japanese): Convert `, . ! ? : ;` to `、 。 ！ ？ ： ；` (excluding floats, URLs, placeholders).
       - `ko` (Korean): Keep standard half-width `.` and `,` as per modern Korean technical typography, but format spacing and keep full-width `！`, `？` where appropriate.
       - **Trailing punctuation check & auto-fix**: Ensure fields that require terminal punctuation have the correct CJK terminal mark if they are CJK locales.
     - **Phrasing Glossary (Glossary Map)**: Prevent raw machine-translation of terms.
       - `"AI Agent Skill" / "AI Agent Skills"` -> `zh`: `"AI 智能体技能"`, `ja`: `"AIエージェントスキル"`, `ko`: `"AI 에이전트 스킬"`
       - `"IDE integration" / "IDE integrations"` -> `zh`: `"IDE 集成"`, `ja`: `"IDE統合"`, `ko`: `"IDE 통합"`
       - `"developer tool" / "developer tools"` -> `zh`: `"开发者工具"`, `ja`: `"開発者ツール"`, `ko`: `"개발자 도구"`
       - `"installation platform" / "installation platforms"` -> `zh`: `"安装平台"`, `ja`: `"インストールプラットフォーム"`, `ko`: `"설치 플랫폼"`
       - `"workflow automation"` -> `zh`: `"工作流自动化"`, `ja`: `"ワークフロー自動化"`, `ko`: `"워크플로우 자동화"`
       - `"marketplace"` -> `zh`: `"市场"`, `ja`: `"マーケットプレイス"`, `ko`: `"마켓플레이스"`

2. **Integration into workflows**:
   - `scripts/translate-locales.ts`: Update prompt template to request CJK spacing, correct punctuation, and Glossary compliance. Apply `cleanTypography` and `postProcessPhrasing` to AI outputs. Improve untranslated key detection (checking if value equals English text).
   - `scripts/sync-translations.ts`: Apply `cleanTypography` on CJK values when alignment takes place, ensuring CJK files in `src/messages/` are auto-formatted.
   - `scripts/verify-collection-cjk-punctuation.ts`: Add `--fix` option to auto-repair formatting and punctuation in collections (`src/content/collections/*.json`).

3. **Testing**:
   - New unit tests `scripts/lib/typography.test.ts` to assert all spacing, punctuation, and phrasing conversion/protection rules.

## Core Associated Files

- [scripts/lib/collection-locale-punctuation.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/lib/collection-locale-punctuation.ts)
- [scripts/sync-translations.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/sync-translations.ts)
- [scripts/translate-locales.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/translate-locales.ts)
- [scripts/verify-collection-cjk-punctuation.ts](file:///Users/kaka/Dev/Killer-Skills/scripts/verify-collection-cjk-punctuation.ts)
