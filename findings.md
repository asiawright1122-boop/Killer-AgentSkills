# SEO Workflow Findings

## Core findings

1. **核心问题是 ontology drift，不是技术 SEO 基础设施失效。**
   站点对外权威定义已经更接近 Skills-first，但大量生成层与公开文案仍把产品讲成 MCP Server marketplace。

2. **现有技术 SEO 基础设施总体可复用。**
   `src/layouts/Layout.astro`、`src/middleware.ts`、blog sitemap、collections locale canonical helpers 已经覆盖 canonical / hreflang / robots / noindex / crawl trap 等基础能力，不应推倒重来。

3. **漂移主要发生在抓取与生成层，而不是只在页面模板层。**
   需要重点审查并重构的上游节点包括：
   - `scripts/build-skills-cache.ts`
   - `scripts/lib/ai.ts`
   - `scripts/analyze-keyword-opportunities.ts`
   - `scripts/generate-longtail-collections.ts`
   - `scripts/generate-blog-posts.ts`
   - `src/lib/seo-keywords.ts`
   - `src/lib/query-intent.ts`
   - `src/lib/blog-seo-intent.ts`
   - `src/lib/skill-seo-intent.ts`
   - `src/lib/skill-schema.ts`

4. **用户要求关键词在“抓取 / 生成 SEO 数据”阶段就贴合 Skills 主题。**
   这意味着不能只做页面文案清洗，必须把 Skills-first 定义前移到 cache、intent、cluster、schema 与 generator policy。

5. **collections 与 blogs 是 ontology drift 的放大器。**
   这两类内容既影响公开入口，也影响内部链接与 topical authority，因此必须做 rewrite / merge / retire / generator redesign。

## Public output hotspots

- `src/pages/[locale]/skills/[owner]/[...repo].astro`
- `src/pages/[locale]/skills/index.astro`
- `src/pages/[locale]/cli/index.astro`
- `src/pages/[locale]/integrations/index.astro`
- `src/pages/[locale]/collections/[...slug].astro`
- `src/pages/llms-full.txt.ts`
- `src/pages/llms.txt.ts`
- `README.md`

这些页面和文档需要统一回答：主产品是什么、Skills 与 MCP 的关系是什么、规范安装命令是什么。

## Reuse guidance

### Keep / minimally adapt
- `src/layouts/Layout.astro`
- `src/middleware.ts`
- `src/pages/sitemap-blog.xml.ts`
- `getLocalizedSeoEligibleLocales`
- `getPreferredCanonicalLocale`
- `isDirectlyLocalizedVariant`

### Rebalance, not rewrite from scratch
- `buildKeywordString`
- `getIntentKeywordClusters`
- `resolveQueryIntent`
- `resolveSkillSeoIntent`
- `sanitizeSkillKeywords`

## Current baseline already achieved

- locale 404 / 4xx 默认 robots header 已在代码中改为 `noindex, nofollow`
- collections canonical slug 已在公开入口与 sitemap 层增加回归保护
- 相关热修已整理到 PR #1：`seo/canonical-collections-robots`

## New findings from P1 slice

6. **过滤单个 generic token 不够，必须拦截 MCP 组合词。**
   仅屏蔽 `mcp` / `server` / `tools` 这种单词仍会让 `mcp server`、`MCP tools`、`model context protocol server` 穿透到 `supportTerm`。`sanitizeSkillKeywords` 需要在组合词层面阻断。

7. **源码级 contract tests 能有效防止公开 copy 回 drift。**
   `src/pages/public-links.test.ts` 与 `src/messages/public-copy.test.ts` 适合锁住高权重页面的 H1、platform count、hardcoded copy，不必每次都依赖端到端人工抽查。

8. **高权重页面的一致性问题常是“小字眼、大影响”。**
   像 skills detail 页的 `18+` vs `19+`，以及 skills index 默认 H1 与 metadata framing 不一致，虽然改动很小，但会直接影响可信度、snippet 与页面实体信号。

## Metrics / reports worth preserving

- `data/seo-collection-locale-gaps.json` 当前显示 43/43 collections 已具备完整 locale coverage，说明当前主要问题不是 locale coverage，而是 ontology / intent / copy precision
- 现有 SEO smoke / audit / report 脚本可以继续复用，应在此基础上补 terminology guards
- Step 6 生成层 guardrail 的最小闭环可以先落在脚本层，而不必先大改业务生成器：`scripts/lib/ai.ts` 的 fallback SEO keyword、`scripts/generate-longtail-collections.ts` 的 title/description/keywords/canonical metadata、`scripts/seo-collection-drift.ts` 对 `data/seo-collection-canonical-map.json` 的消费，都能用一个轻量脚本级测试文件锁住回归。
- `scripts/generate-blog-posts.ts` 当前仍是 unsafe boilerplate generator。与其继续让它产出 MCP-first 模板污染，不如先显式 hard stop，强制后续改走 curated workflow。
- `scripts/analyze-keyword-opportunities.ts` 仍保留大量 MCP query research 语料，但其“立即创建集合”建议已可先改为 canonical slug + 人工审核导向，避免继续推动 legacy slug 扩散。
- 高权重多语言 blog 的残留问题已从明显错链转向更细粒度的命令占位与文案 contract 漏洞。像 `top-10-mcp-servers-2026` 这类 featured 文章，即使没有 `/en/skills` 错链，也可能继续携带 `npx killer-skills add <skill>` / `<author>/<skill>` 这类不应公开暴露的占位命令，需要继续用 `src/pages/public-links.test.ts` 做 source-level contract 锁定。
- 命令占位回归需要匹配多语言 angle-bracket 变量，而不能只盯英文 `<skill>`。对高权重 blog 更稳的做法是直接在源码层用 `npx killer-skills add <[^>\n]+>` 这类 regex 兜住 `<habilidad>`、`<スキル>`、`<스킬명>`、`<owner>/<repo>/<skill-name>` 等模板残留，再统一收口到规范命令 `npx killer-skills add owner/repo`。
- `humanizer` 的 canonical skill identity 已可从 `data/skills-cache.json` 直接确认：`minhtungo/ai-agents-factory/humanizer`。因此，`openclaw-application-scenarios` 中旧的 `/<locale>/blog/humanizer-skill` 应收口到 `/<locale>/skills/minhtungo/ai-agents-factory/humanizer`，而 `best-ai-agent-skills-2026` 中的 `npx killer-skills add blader/humanizer` 应收口到 `npx killer-skills add minhtungo/ai-agents-factory/humanizer`。
- 这类 source-level contract 不应只断言“旧错误不存在”，还应断言“新 canonical target 存在”。本轮已把 `public-links.test.ts` 的 humanizer 相关断言从纯 `not.toContain(...)` 扩展为同时校验 canonical skills URL 与 canonical install command。
- 高权重多语言 blog 的污染已进一步从显眼错链转向 **example block 未本地化**。像 `what-are-ai-agent-skills` 这类 featured guide，即使主正文已本地化，仍可能残留英文 code comment、frontmatter description、markdown sample。更稳的策略是在 `src/pages/public-links.test.ts` 中同时断言“本地化目标文本存在”与“英文 scaffolding 不存在”。
- `enhancing-openclaw-with-killer-skills-guide` 这类 integration guide 还会残留另一类问题：正文语言看似正确，但 skill pack 示例命令仍使用短名（如 `npx killer-skills add pdf` / `frontend-design` / `humanizer`），与当前公开 canonical install path 不一致。对这类文章应把命令统一为真实 repo path，并在 contract 中锁住 canonical command presence。
- creative-tools 文章还存在 **错误本地化 slug / path 翻译** 风险：例如把 `/es/skills/...` 误写成 `/es/habilidades/...`，或把 `/es/blog/what-are-ai-agent-skills` 误翻成不存在的西语 slug。source-level 测试应直接锁住 canonical localized route，而不是仅检查旧坏链是否被删除。

- 首页不应直接承载 `solution-intents` 这类 query-funnel 入口。`workflow automation / process automation / document automation ...` 这套入口更适合放在 `solutions` 或 `collections` 等 intent page，而不是站点首页；否则会把首页实体从“技能目录 / 安装入口”稀释成“自动化关键词入口页”。
- 更稳的首页 contract 应锁住两件事：一是首页源码中不再出现 `高意图自动化入口` / `High-Intent Workflow Searches`；二是首页 FAQ 与 metadata 要明确回答“站点是什么、怎么安装、支持哪些 IDE”，而不是围绕 query harvesting 展开。
- 首页 drift 不只会残留在 section / metadata 层，也会藏在 i18n messages 里。像 `Home.heroBadge`、`heroDesc2`、`featuresSubtitle`、`footerDesc` 这类首页 copy，即使删掉 query-funnel section，仍可能继续把首页讲成 `IDE workflows / automation` hub。更稳的做法是让 `src/pages/public-links.test.ts` 同时锁住页面源码 contract 和中英文 locale copy 的“目录 / 安装入口”表述。

## Working assumptions for implementation

- 先修定义层与共享生成层，再改高权重页面，最后才做 slug / redirect 收口
- MCP 相关 query 不应被删除，而应被压缩到真正相关的页面与描述中
- 修复必须增量进行，并用测试锁住公开输出，避免再次回归到 MCP-first 默认值
