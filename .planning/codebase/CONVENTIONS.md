# Code Conventions

## TypeScript Style
- **Strict mode**: `strict: true` in tsconfig
- **Module system**: ESM (`"type": "module"` in package.json)
- **Import style**: Named imports preferred, `type` keyword for type-only imports
- **Error handling**: Try-catch with typed errors, `e instanceof Error` pattern
- **Null safety**: Optional chaining (`?.`) + nullish coalescing (`??`) extensively used

## i18n Convention
- **Source of truth**: `src/messages/en.json` (797 keys)
- **Translation accessor**: `tr(key, fallback)` function in `src/i18n.ts`
- **Key structure**: Namespace.SubKey pattern — `Metadata.title`, `CLI.pageTitle`, `Seo.Keywords.core`
- **No hardcoded locale checks**: All `isZh` / `locale === 'zh'` eliminated, replaced with `text[locale] || text['en']`
- **Brand terms untranslated**: "Killer-Skills", "Claude Code", "Cursor", "Windsurf", "MCP" stay English

## SEO Convention
- **Title format**: `[Capability]: [Use Case] | AI Agent Skills`
- **Meta description**: 120-160 chars EN, 60-160 chars CJK, must include CTA
- **Keywords**: 2 theme anchors + 4-8 capability-specific terms
- **Forbidden terms**: "how to", "what is", "tutorial", "agentic workflow", generic fillers
- **Quality gate**: `isSkillFullyOptimized()` checks 12 conditions before skipping re-generation

## Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Scripts | `verb-noun.ts` | `build-skills-cache.ts`, `translate-locales.ts` |
| Lib files | `kebab-case.ts` | `seo-keywords.ts`, `category-taxonomy.ts` |
| Tests | `*.test.ts` (co-located) | `src/lib/skills.test.ts` |
| Pages | `[locale]/section/index.astro` | `[locale]/cli/index.astro` |
| API routes | `api/resource/index.ts` | `api/skills/search.ts` |
| Components | `PascalCase.tsx/.astro` | `SkillCard.tsx` |
| JSON data | `kebab-case.json` | `skills-cache.json` |

## Git Conventions
- **Branches**: `main` only (no feature branches in current workflow)
- **Commits**: Conventional commits — `feat:`, `fix:`, `docs:`, `chore:`
- **Hooks**: Husky + lint-staged (ESLint + Prettier on commit)

## Error Handling Patterns
- **AI calls**: Race strategy with fallback, 429 retry with exponential backoff
- **Data pipeline**: Auto-save progress, graceful shutdown on SIGINT, max-duration timeout
- **API routes**: Standard HTTP status codes, JSON error responses
