# Killer-Skills Skills-first SEO 全面修复计划

## Mission

将站点从“MCP Server marketplace”叙事纠偏为“AI Agent Skills / IDE Skills”主实体，并把这一口径前移到抓取、缓存、metadata 生成、页面模板、schema、审计与 CI guardrails。

## Current status

- [x] 技术 SEO 热修已完成：404/4xx robots header 与 collection canonical slug 回归保护已落到代码与测试
- [x] SEO workflow 审查已完成：已定位 ontology drift 的主要产生层
- [x] P0 公开术语层修复已完成：query intent、blog SEO helper、llms-full、detail metadata guard 已切到 Skills-first
- [x] P1 第一批修复已完成：skill-seo-intent 过滤 MCP-first 组合词；skills index H1 与 detail 平台 copy 已对齐
- [x] P1 第二批修复已完成：CLI / Integrations section-level copy 已进一步对齐 Skills-first 口径
- [x] collections 下一批最小修复已完成：data-analysis / testing 两个公开集合已完成 canonical slug 与 MCP-first 文案收口
- [x] 测试噪音已收敛：Vitest 已忽略 `.claude/worktrees/**`
- [x] 当前增量验证已通过：Vitest、`npx astro check --root .`、`npm run build`、`npm run seo:smoke`、`npm run audit:seo:index-integrity`、`npm run audit:seo:index-quality`
- [x] blog corpus 当前高优先 slice 已完成：4 篇 featured 文章中的跨语言错链、模板污染词与 OpenClaw 错误相关文章链接已修复，并由 `src/pages/public-links.test.ts` 锁定回归
- [x] collections cannibalization 当前最小收口已完成：`top-ai-agents-mcp-servers.json` 已并入 `top-agentic-ai-platforms-orchestration-tools`，公开 collections 入口已按 canonical slug 去重，并由测试与 `npx astro check --root .` 锁定回归
- [ ] 后续继续推进剩余 P2/P3：blog corpus、collections cannibalization、更多高权重页面 guard
- [x] 首页 query-funnel 偏移已收口：`src/pages/[locale]/index.astro` 中的“高意图自动化入口 / High-Intent Workflow Searches”区块已移除，首页 SEO metadata 与 FAQ 已恢复到“AI Agent Skills 开放目录 / 安装入口”定位，并由 `src/pages/public-links.test.ts` 锁定回归
- [x] 首页 messages 层剩余 workflow / automation 口径已收口：`src/messages/en.json` 与 `src/messages/zh.json` 的 hero / features / footer copy 已统一回“目录 / 安装入口 / IDE 原生安装”定位，并由 `src/pages/public-links.test.ts` 锁定回归
- [x] 首页 FAQ 层剩余 workflow 外显表述已收口：`src/pages/[locale]/index.astro` 中的 FAQ 已从 “IDE workflows / external tools” 角度改回 “skills packaging / detail page install decision” 角度，并由 `src/pages/public-links.test.ts` 锁定回归
- [x] 当前新增 humanizer 收口已完成：`openclaw-application-scenarios` 10 个 locale 的坏 blog 链已切到 canonical skills detail URL，`best-ai-agent-skills-2026` 10 个 locale 的错误安装命令已切到 canonical install path，并由 `src/pages/public-links.test.ts` 锁定回归
- [x] 当前新增高价值 blog 污染收口已完成：`de/best-ai-agent-skills-2026` 的英/西/中串线正文与英文 FAQ JSON-LD 已恢复为德语；`es/fr/pt` 的 `what-are-ai-agent-skills` example scaffolding 已本地化；`ar/enhancing-openclaw-with-killer-skills-guide` 的混语言段落与短名 skill pack 命令已收口到阿语 + canonical repo path；`es/mastering-generative-art-with-claudecode-skills` 的英文 heading 与错误 `/es/habilidades/...` / 翻译 slug 已修正，并由 `src/pages/public-links.test.ts` 锁定回归
- [x] workflow 当前阻塞项已收口：
  - `src/messages/public-copy.test.ts` 已从旧 homepage 文案预期更新为当前的 skills directory / install entry 文案，解决 `Unit Tests & Coverage` 失败
  - `prettier --check "src/**/*.{ts,tsx,astro,css,json}"` 命中的 23 个 `src/**` 文件已统一格式化，解决 `Lint & Format` 失败
  - workflow 对应本地验证已完成：`npx vitest run src/messages/public-copy.test.ts`、`npm run format:check`、`npm run format:check:seo-automation`、`npm run lint`、`npm run lint:seo-automation`、`npm run seo:frontmatter:guard`、`npm run check:astro`、`npx vitest run --coverage --reporter=default`、`npm run build`、`npx vitest run --config vitest.build-validation.config.ts --reporter=default --no-coverage`、`npm run seo:smoke -- http://127.0.0.1:4321`

## Success criteria

- 公开页面默认使用 Skills-first 定义
- MCP 仅在明确的 MCP-intent 页面作为辅助能力出现
- canonical / hreflang / noindex / sitemap 基础设施保持正确
- collections / blog 生成逻辑不再默认输出 MCP-first slug 或 copy
- 回归测试与审计能阻止 ontology drift 再次进入生产

## Phases

### Phase 0: Research + planning [completed]
- [x] 梳理现有 SEO workflow
- [x] 识别 ontology drift 的主要来源
- [x] 盘点可复用的技术 SEO 基础设施
- [x] 明确本轮增量修复的优先级与边界

### Phase 1: Definition / ontology source of truth [pending]
- [ ] 统一 llms / README / messages 层公开定义
- [ ] 固化规范命令词：`npx killer-skills add owner/repo`
- [ ] 明确 Skills 与 MCP 的主次关系
- [ ] 输出禁用术语清单，供后续测试与审计复用

### Phase 2: Shared SEO generators [pending]
- [ ] 调整 `src/lib/seo-keywords.ts` 的 cluster 权重
- [ ] 调整 `src/lib/query-intent.ts` 的 display / description / keywords
- [ ] 调整 `src/lib/skill-seo-intent.ts`、`src/lib/blog-seo-intent.ts`、`src/lib/skill-schema.ts`
- [ ] 确保默认输出为 Skills-first，MCP 仅作为辅助能力保留

### Phase 3: High-value public pages [pending]
- [ ] skills index
- [ ] skill detail
- [ ] cli page
- [ ] integrations page
- [ ] home / collections templates / blog listing / categories
- [ ] 校准 title / description / H1 / CTA / schema

### Phase 4: Content corpus + IA cleanup [pending]
- [ ] rewrite 仍有真实 intent 的 collections / blogs
- [ ] merge 会互相 cannibalize 的 collections
- [ ] retire 明显噪音的 `*-mcp-servers` 变体
- [ ] stop 或 redesign 长尾 collections / blog 生成脚本
- [ ] 为 redirect / sitemap 更新准备 canonical map

### Phase 5: Verification + rollout [pending]
- [ ] 补齐单测 / 回归测试
- [ ] 运行 `npm run check:astro`
- [ ] 运行 `npm run build`
- [ ] 运行 SEO smoke / audits / reports
- [ ] merge / deploy 后做 production 验证与 GSC 跟踪

## Current execution slice

当前已完成的增量 slices：

1. `src/lib/skill-seo-intent.ts` 通过 `MCP_FIRST_COMBINED_PATTERNS` 过滤 `mcp server`、`MCP tools`、`model context protocol ...` 这类组合词，避免它们进入公开关键词或 supportTerm
2. `src/lib/skill-schema.test.ts` 补了 Skills-first contract，确保 schema description / keywords 不回退到 MCP-first 文案
3. `src/pages/[locale]/skills/index.astro` 默认 H1 已与 installable Skills-first metadata 对齐
4. `src/pages/[locale]/skills/[owner]/[...repo].astro` 已把公开 copy 中的 `18+` 平台统一到 `19+`
5. `src/pages/[locale]/cli/index.astro` 进一步统一为 install / manage / sync 与 IDE-native skill file 口径
6. `src/pages/[locale]/integrations/index.astro` 进一步统一为 skills-first compatibility overview 与 IDE-native skill setup 口径
7. `vitest.config.ts` 已忽略 `.claude/**`，定向测试不再出现 worktree 重复 suite
8. `src/content/collections/top-mcp-for-data-analysis.json` 已增加 `canonicalSlug: data-workflows-and-analysis-tools` 并去掉 MCP-first seoDescription / keyword 残留
9. `src/content/collections/top-mcp-for-testing.json` 已增加 `canonicalSlug: testing-automation-and-qa-workflow-tools` 并去掉 MCP-first seoDescription / keyword 残留
10. `src/lib/collection-slugs.test.ts` 与 `src/pages/public-links.test.ts` 已补齐对应回归断言
11. `src/content/blog/en/best-ai-agent-skills-2026.md`、`src/content/blog/zh/best-ai-agent-skills-2026.md`、`src/content/blog/zh/what-are-ai-agent-skills.md`、`src/content/blog/zh/introducing-openclaw-autonomous-ai-agent.md` 已完成 featured blog 最小修复：移除 `ContinueWindsurf` 模板污染词、修正 `/zh/skills` 跨语言链接、修正 OpenClaw 相关文章 slug
12. `src/pages/public-links.test.ts` 已增加 featured blog contract，锁住上述错链与模板污染词回归
13. `src/content/collections/top-ai-agents-mcp-servers.json` 已将 canonical slug 收口到 `top-agentic-ai-platforms-orchestration-tools`，并将 `top-ai-agent-platforms-orchestration-tools` 降为 legacy slug，减少与 `top-agentic-ai-mcp-servers.json` 的公开 cannibalization
14. `src/lib/collection-slugs.ts` 已新增 `getCanonicalCollections()`，并在 `src/pages/[locale]/collections/index.astro`、`src/pages/sitemap-collections.xml.ts`、`src/pages/[locale]/index.astro`、`src/pages/[locale]/skills/[owner]/[...repo].astro` 中复用，确保 collections index / sitemap / homepage / skill detail 只公开每个 canonical slug 一次
15. `src/lib/collection-slugs.test.ts`、`src/pages/public-links.test.ts`、`src/pages/llms-full.txt.test.ts` 已补齐回归断言，`src/pages/llms-full.txt.ts` 中的 Top AI Agent Skills collection URL 也已切到 `top-agentic-ai-platforms-orchestration-tools`
16. `src/content/blog/fr/what-are-ai-agent-skills.md`、`src/content/blog/es/what-are-ai-agent-skills.md`、`src/content/blog/ja/what-are-ai-agent-skills.md`、`src/content/blog/ko/what-are-ai-agent-skills.md`、`src/content/blog/pt/what-are-ai-agent-skills.md` 已完成下一批 featured blog 最小修复：修正各自 locale 的 `/skills` 链接，并清理 `ja` 页的中日串线模板污染与 `pt` 页的 JSON 翻译残留
17. `src/pages/public-links.test.ts` 已扩展回归断言，锁住上述 5 篇 `what-are-ai-agent-skills` 的错语言链接与模板污染回归
18. `src/content/blog/de/best-ai-agent-skills-2026.md`、`src/content/blog/fr/best-ai-agent-skills-2026.md`、`src/content/blog/es/best-ai-agent-skills-2026.md`、`src/content/blog/ja/best-ai-agent-skills-2026.md`、`src/content/blog/ko/best-ai-agent-skills-2026.md`、`src/content/blog/pt/best-ai-agent-skills-2026.md`、`src/content/blog/ru/best-ai-agent-skills-2026.md`、`src/content/blog/ar/best-ai-agent-skills-2026.md` 已完成下一批 featured blog 最小修复：把正文末尾错误指向 `/en/skills` 的公开目录链接改为对应 locale 的 `/skills` 页面；其中 `de` 页顺手清掉了末尾中文串线句子
19. `src/pages/public-links.test.ts` 已继续扩展回归断言，锁住上述 8 篇 `best-ai-agent-skills-2026` 的 locale `/skills` 链接不再回退到 `/en/skills`
20. `src/content/blog/ar/how-to-install-ai-agent-skills.md`、`src/content/blog/fr/how-to-install-ai-agent-skills.md`、`src/content/blog/es/how-to-install-ai-agent-skills.md`、`src/content/blog/de/how-to-install-ai-agent-skills.md`、`src/content/blog/zh/how-to-install-ai-agent-skills.md`、`src/content/blog/ru/how-to-install-ai-agent-skills.md`、`src/content/blog/ko/how-to-install-ai-agent-skills.md`、`src/content/blog/ja/how-to-install-ai-agent-skills.md`、`src/content/blog/pt/how-to-install-ai-agent-skills.md` 已完成下一批 guides 最小修复：把文中的公开目录链接从 `/en/skills` 改为各自 locale 的 `/skills`
21. `src/pages/public-links.test.ts` 已再次扩展回归断言，锁住上述 9 篇 `how-to-install-ai-agent-skills` 的 locale `/skills` 链接不再回退到 `/en/skills`
22. `src/content/blog/de/best-ai-agent-skills-2026.md`、`src/content/blog/fr/best-ai-agent-skills-2026.md`、`src/content/blog/es/best-ai-agent-skills-2026.md`、`src/content/blog/ja/best-ai-agent-skills-2026.md`、`src/content/blog/ko/best-ai-agent-skills-2026.md`、`src/content/blog/pt/best-ai-agent-skills-2026.md`、`src/content/blog/ru/best-ai-agent-skills-2026.md`、`src/content/blog/ar/best-ai-agent-skills-2026.md` 已进一步完成 featured blog 最小修复：把开头残留的 `ContinueWindsurf` 模板污染统一收口为 `Windsurf`
23. `src/content/blog/de/what-are-ai-agent-skills.md`、`src/content/blog/ru/what-are-ai-agent-skills.md` 已完成下一批 featured blog 收口：`de` 页将公开目录链接从 `/en/skills` 修正为 `/de/skills`；`ru` 页移除中英串线模板污染块，恢复俄文 section heading / table / skill list，并将公开目录链接改为 `/ru/skills`
24. `src/pages/public-links.test.ts` 已继续扩展回归断言，锁住上述 `ContinueWindsurf`、`de` 错语言 `/skills` 链接与 `ru` 页中英串线污染回归；`npx vitest run src/pages/public-links.test.ts` 与 `npx astro check --root .` 已重新通过
25. 已完成 `top-mcp-mcp-servers.json` 与 `top-mcp-server-mcp-servers.json` 的下一轮 overlap 审查：当前继续保留 distinct，不做新的 canonical merge；并新增 `data/seo-collection-canonical-map.json` 作为未来 redirect phase 的 canonical map artifact
26. `src/lib/collection-slugs.test.ts` 已新增 canonical map artifact 与当前 keep-distinct 决策回归断言；`npx vitest run src/lib/collection-slugs.test.ts src/pages/public-links.test.ts src/pages/llms-full.txt.test.ts` 与 `npm run check:astro` 已重新通过
27. 已完成 Step 6 的最小生成层 / 审计层 guardrail：新增 `scripts/seo-generator-guardrails.test.ts`，并将 `scripts/lib/ai.ts` fallback SEO keywords、`scripts/generate-longtail-collections.ts` 的 Skills-first copy 与 canonical metadata、`scripts/seo-collection-drift.ts` 对 `data/seo-collection-canonical-map.json` 的消费一起锁进脚本级回归
28. `scripts/generate-blog-posts.ts` 已先 hard stop，避免继续生成 MCP-first boilerplate blog；`scripts/analyze-keyword-opportunities.ts` 与 `scripts/fill-collection-locale-metadata.ts` 也已做最小 Skills-first 收口
29. Step 6 定向验证已通过：`npx vitest run src/lib/seo-keywords.test.ts src/lib/query-intent.test.ts src/lib/blog-seo-intent.test.ts src/lib/collection-slugs.test.ts src/pages/public-links.test.ts src/pages/llms-full.txt.test.ts scripts/seo-generator-guardrails.test.ts`、`npm run audit:seo:index-integrity`、`npm run audit:seo:index-quality`、`npm run report:seo:collection-drift`
30. 已完成 `top-10-mcp-servers-2026` 下一轮高权重 blog corpus 最小修复：`src/pages/public-links.test.ts` 已新增占位命令 contract，锁住 `npx killer-skills add <skill>` / `npx killer-skills add <author>/<skill>` 不再出现在该文章；`en/ar/zh/de/es/fr/ja/ko/pt/ru` 10 个 locale 的对应文章已统一改为规范命令 `npx killer-skills add owner/repo`
31. 本轮定向验证已通过：`npx vitest run src/pages/public-links.test.ts`、`npx astro check --root .`，并已确认 `top-10-mcp-servers-2026` 多语言文章中无上述占位命令残留
32. 已完成 `official-ai-agent-skills-guide`、`best-ai-agent-skills-2026`、`how-to-install-ai-agent-skills` 的下一轮高权重 blog corpus 命令收口：`src/pages/public-links.test.ts` 已扩展 high-priority ai-agent blog contract，用 `npx killer-skills add <[^>\n]+>` 兜住多语言占位命令；`en/ar/de/es/fr/ja/ko/pt/ru/zh` 10 个 locale 下上述 3 组文章中的 `<skill>` / `<skillname>` / `<habilidad>` / `<スキル>` / `<스킬명>` / `<owner>/<repo>/<skill-name>` 占位命令已统一改为规范命令 `npx killer-skills add owner/repo`
33. 本轮定向验证已通过：`npx vitest run src/pages/public-links.test.ts`、`npx astro check --root .`；`astro check` 仍仅报告既有 duplicate id warnings 与 `scripts/generate-blog-posts.ts` unreachable-code hints，不阻塞本轮收口
34. 已完成新一轮高价值 blog corpus 收口：`src/pages/public-links.test.ts` 已新增 source-level contract，锁住 `de/best-ai-agent-skills-2026` 的 mixed-language bleed / 英文 FAQ JSON-LD、`es/fr/pt` 三篇 `what-are-ai-agent-skills` 的英文 example scaffolding、`ar/enhancing-openclaw-with-killer-skills-guide` 的非 canonical skill pack 命令与串线 heading、以及 `es/mastering-generative-art-with-claudecode-skills` 的英文 section heading / 错误 localized skill URL / 翻译 slug 回归
35. 对应内容已完成最小修复：`src/content/blog/de/best-ai-agent-skills-2026.md` 已重写回完整德语版本；`src/content/blog/es/what-are-ai-agent-skills.md`、`src/content/blog/fr/what-are-ai-agent-skills.md`、`src/content/blog/pt/what-are-ai-agent-skills.md` 的 sample block 已本地化；`src/content/blog/ar/enhancing-openclaw-with-killer-skills-guide.md` 的 skill pack 命令已统一到 `anthropics/skills/...` 与 `minhtungo/ai-agents-factory/humanizer`；`src/content/blog/es/mastering-generative-art-with-claudecode-skills.md` 的 creative-tools 链接与 related links 已切回 canonical `/es/skills/...` / `/es/blog/...`
36. 本轮定向验证已通过：`npx vitest run src/pages/public-links.test.ts`（19/19）、`npx astro check --root .`（0 errors, 0 warnings）；`astro check` 仍仅输出既有 duplicate id warnings 与 `scripts/generate-blog-posts.ts` unreachable code hints
37. `src/messages/en.json`、`src/messages/zh.json` 的 `Home` 区块已进一步完成文案收口：`heroBadge`、`heroDesc2`、`featuresSubtitle`、`footerDesc` 已从 `IDE workflows` / `automation` / `repeatable workflows` 收口到“开放目录 / 安装入口 / IDE 原生格式安装”定位
38. `src/pages/public-links.test.ts` 已新增 homepage locale copy contract，锁住上述首页 messages 不再回退到 workflow-query 口径；`npx vitest run src/pages/public-links.test.ts`（21/21）与 `npx astro check --root .` 已重新通过
39. `src/pages/public-links.test.ts` 已继续新增 homepage FAQ contract，锁住首页 FAQ 必须围绕“安装命令 / 支持 IDE / skills packaging / detail page decision”展开，不再回退到 `Why do these skills fit IDE workflows?` / `What if a workflow also needs external tools?`
40. `src/pages/[locale]/index.astro` 已对应完成 FAQ 收口：将末尾两条问答改为 “How are these skills packaged?” / “Why start from the skill directory?”，`npx vitest run src/pages/public-links.test.ts`（22/22）与 `npx astro check --root .` 已重新通过

当前建议的下一 slice：

1. 回到 blog corpus：继续扫描更多高权重多语言页，优先查找剩余更隐蔽的 example 未本地化、错误 related slug、短名 skill pack 命令与 localized path 翻译问题
2. 如继续深挖 Step 6，下一批可处理的是 `scripts/analyze-keyword-opportunities.ts` 中仍保留的 MCP query 研究语料，以及 `scripts/generate-blog-posts.ts` 的替代 curated workflow
3. 如需降低 CI / 本地噪音，再单独清理当前 build 中残留的非阻塞 CSS minify warnings

## Risks and constraints

- 当前工作区改动很多，必须分小批次执行
- 不应过早做大规模 slug 迁移，先修定义与生成层
- 需要保留现有 canonical / hreflang / noindex 基础设施
- 生产验证仍依赖现有 PR merge / deploy

## Errors and blockers

| Issue | Impact | Handling |
|---|---|---|
| planning files 仍停留在旧的医药平台任务 | 持久化上下文失真 | 已重写为当前 SEO 任务 |
| 生产仍可能运行旧版 collection / crawl 逻辑 | 本地修复尚未完全对外可见 | 作为 rollout 阶段单独验证 |
| 仓库中存在大量无关改动 | 容易扩大修复范围 | 采用 test-first + incremental slices |
| Vitest 曾扫描 `.claude/worktrees` 下的副本测试 | 定向测试输出重复 suite，噪音较大 | 已在 `vitest.config.ts` 增加 `**/.claude/**` exclude |
| build 存在非阻塞 esbuild CSS minify warnings（`[file:line]` 相关） | 不影响构建通过，但输出有噪音 | 本轮不处理，后续单独清理 |

## Next action

继续按 test-first 推进 blog corpus 的下一轮 Skills-first 清理，并评估其余高重叠 collections 的 canonical 收口机会；首页层面则保持“目录 / 安装入口”定位，不再把 solution-intent query funnel 直接暴露在首页主干。


## 2026-03-21 Completed

### Code Quality P1 (e19073f)
41. Extract parseSkillMd() to src/lib/skill-md-parser.ts (+4 tests); submit.ts Zod SubmitBodySchema; kv.ts all any types replaced; atob() replaced with Buffer.from()

### Blog Locale Links (8e83396)
42. 9 how-to-install blog posts: /en/skills/anthropics/skills/docx -> /{locale}/skills/... (ar/de/es/fr/ja/ko/pt/ru/zh)

### Korean Contamination Cleanup (b35c8cb)
43. 15 Korean posts: all Japanese Hiragana/Katakana removed. Scanner verified: 0 Japanese chars remaining

### Arabic Contamination Cleanup (702be44)
44. 7 Arabic posts: Chinese/Russian/Vietnamese mixed characters removed

### Verification (2026-03-21)
45. npx vitest run (30 files / 368 tests); npm run check:astro (0 errors); npm run lint (0 warnings)

### Next
- [ ] Continue scanning remaining blog corpus for unlocalized examples, bad slugs
- [ ] P2 architecture: hardcoded domain, CATEGORY_GROUPS extraction, fallbackPreview refactor
- [ ] P2 testing: API route tests for /submit, /search, /translate

