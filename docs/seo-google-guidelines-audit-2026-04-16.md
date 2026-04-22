# Killer-Skills SEO 审计：对照 Google 官方规范

- 日期：2026-04-16
- 范围：`killer-skills.com` 流量暴跌诊断、Google 官方规范映射、代码证据、恢复优先级
- 方法：按 GSD 的代码库梳理方式做证据链审计，只使用 Google 官方 Search Central 文档，不使用二手 SEO 文章

## 结论先说

这次流量问题，最可能不是狭义上的“Google 直接把你们当成 GitHub 镜像站”这么简单。

更准确的判断是：

1. 站点整体呈现出非常强的“GitHub 派生内容大规模聚合”形态。
2. 大量技能详情页的主体内容仍然是上游 README / SKILL 文件，页面新增价值不够强。
3. 非英文技能 URL 被大规模放进 sitemap 和 hreflang，但爬虫实际看到的正文经常仍然是英文或源语言内容。
4. 站内重复 URL、路径陷阱、参数页、源码型 URL 仍然很多，继续稀释 Google 对站点的信任与恢复速度。

换成 Google 的语境，就是：

- 你们现在更像是一个 `GitHub 内容驱动的大规模聚合/复写体系`；
- 风险点更接近 `scaled content abuse`、`scraped / republished content with insufficient added value`、`multilingual inconsistency`；
- 尤其在 skill detail 页面上，风险非常集中。

## 这次问题不是什么

从当前证据看，持续性的流量压制已经不再主要是“线上仍有严重抓取故障”。

现状是：

- 最新 crawl sample 已经干净：1,650 个 URL，`4xx=0`、`5xx=0`、`Cloudflare 1102=0`。见 [latest-crawl-health.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-crawl-health.md#L1)
- sitemap 与 indexable cache 也已经对齐。见 [index-drift.json](/Users/kaka/Dev/Killer-Skills/reports/seo/index-drift.json#L1)

所以，主瓶颈已经从“可用性问题”转成了“内容质量、规范化、索引选择”。

## 对照的 Google 官方文档

本次审计使用的官方来源：

- [Google Search Essentials: Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [创建有帮助、可靠、以人为先的内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [关于 AI 生成内容的指导](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [管理多地区和多语言站点](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [如何指定规范网址 canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

这些文档里，和你们当前问题最相关的点有 5 个：

1. Google 会打击 `scaled content abuse`，也就是为了覆盖搜索结果而大规模生成页面。
2. Google 会警惕 `scraped content`，也就是从别处抓取/复写内容，但没有明显额外价值。
3. Google 明确说过：AI 本身不是问题，问题是低质量、无帮助、批量化生产。
4. Google 对多语言页面的要求是：目标语言页面要真的呈现该语言的主要内容，而不是只有外壳翻译。
5. Google 建议 canonical / hreflang 要一致，否则它会自己选择别的 canonical。

## 项目证据映射

### 1. 内容供应链是 GitHub-first，不是 editorial-first

你们的内容抓取链路，默认就是从 GitHub 原始文件开始：

- `fetchSkillMd()` 直接请求 `raw.githubusercontent.com/.../SKILL.md`、`.cursorrules` 等文件。见 [github.ts](/Users/kaka/Dev/Killer-Skills/scripts/lib/github.ts#L62)
- `parseSkillMd()` 在没有 frontmatter 时，会把整个源文件直接当成页面正文。见 [github.ts](/Users/kaka/Dev/Killer-Skills/scripts/lib/github.ts#L106)

这意味着，很多 skill 页面默认正文并不是你们原创编辑内容，而是上游仓库原文。

### 2. 技能详情页几乎是直接渲染导入的 markdown

skill 详情页主体内容来自：

- `skill.skillMd?.body`
- 或 `skill.skillMd?.bodyPreview`

正文来源和 fallback 组装逻辑在 [技能详情页](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro#L738)。

之后这个 markdown 被传给 `SkillReadme`，再由 `ReactMarkdown` 原样渲染。见 [SkillReadme.tsx](/Users/kaka/Dev/Killer-Skills/src/islands/SkillReadme.tsx#L104)

这件事本身不是违规，但在你们这个站点里，问题在于：

- 页面新增价值主要是 SEO 包装层、FAQ、安装命令、AI 生成摘要；
- 而不是强的一手测试、对比、评价、筛选、兼容性判断。

这就很容易让 Google 认为页面主体价值仍然来自 GitHub，而不是来自 Killer-Skills。

### 3. 项目在大规模制造“包装过的导入内容”

缓存构建流程会批量生成和补全这些东西：

- fallback readme
- SEO description / definition / keywords
- agentAnalysis
- 翻译后的多语言内容

相关逻辑见：

- fallback readme 构造：[build-skills-cache.ts](/Users/kaka/Dev/Killer-Skills/scripts/build-skills-cache.ts#L352)
- `generateAgentAnalysis()` 与翻译流程：[build-skills-cache.ts](/Users/kaka/Dev/Killer-Skills/scripts/build-skills-cache.ts#L1098)、[build-skills-cache.ts](/Users/kaka/Dev/Killer-Skills/scripts/build-skills-cache.ts#L1251)、[build-skills-cache.ts](/Users/kaka/Dev/Killer-Skills/scripts/build-skills-cache.ts#L1551)

这和 Google 对“批量模板化页面”的警惕是高度吻合的。

### 4. 多语言 skill 页面被过度扩张进索引体系

你们的 skill sitemap 是“每个 skill，所有支持语言都输出一遍”：

- 输出所有 `SUPPORTED_LOCALES` 的逻辑见 [sitemap-skills-[page].xml.ts](/Users/kaka/Dev/Killer-Skills/src/pages/sitemap-skills-[page].xml.ts#L45)
- 真正批量写入所有 locale URL 的循环见 [sitemap-skills-[page].xml.ts](/Users/kaka/Dev/Killer-Skills/src/pages/sitemap-skills-[page].xml.ts#L87)

页面元数据层也默认把 alternate locale 扩成全语言：

- canonical / alternates 生成逻辑见 [metadata.ts](/Users/kaka/Dev/Killer-Skills/src/lib/site/metadata.ts#L90)
- 页面 head 里实际输出 canonical 和 hreflang 的逻辑见 [Layout.astro](/Users/kaka/Dev/Killer-Skills/src/layouts/Layout.astro#L95)

但 skill 详情页没有像 collections 那样传入一个“真正可索引 locale 列表”。

反过来，collections 已经有更严格的索引治理：

- 先算 `availableLocales`
- 再选 `canonicalLocale`
- 再对非可索引 locale 做 `noindex`

见 [collections page](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/collections/[...slug].astro#L87)

也就是说：

- collections 的多语言索引治理已经像样了；
- skills 的多语言索引治理明显落后。

这是本次审计里最关键的结构性问题之一。

### 5. 你们明确让“爬虫看到的本地化”弱于“用户看到的本地化”

skill 详情页里，crawler request 会跳过本地化：

- `isCrawlerRequest` 判断见 [技能详情页](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro#L98)
- 轻量本地化只有在 `!isCrawlerRequest` 时才运行，见 [技能详情页](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro#L452)
- readme 的重本地化也要求 `!isCrawlerRequest` 且正文尺寸不超过阈值，见 [技能详情页](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro#L763)

这会直接导致一种非常危险的组合：

1. URL 是非英文的
2. canonical 是这个非英文 URL 自己
3. hreflang 宣称它是一个独立语言版本
4. 但 Googlebot 看到的正文仍然是英文 / 源语言正文

这不是“小瑕疵”，这是强烈的负面信号。

### 6. 薄内容防线太弱，不适合你们当前内容模型

skill 页只有在内容小于 250 bytes 时才 noindex：

- `isThinContent = readmeSize < 250` 见 [技能详情页](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro#L795)
- `layoutNoindex` 也基本只靠这个阈值。见 [技能详情页](/Users/kaka/Dev/Killer-Skills/src/pages/[locale]/skills/[owner]/[...repo].astro#L814)

但你们现在最大的问题并不是“极短页面”。

而是：

- 长度看起来不算短；
- 但主体内容仍然高度依赖 GitHub 原文；
- 页面自身新增价值不足。

所以 250 bytes 这个阈值，远远不够。

### 7. 站内重复与路径陷阱仍然很大

最新 coverage drilldown 仍然显示较大的索引/重复问题：

- 总 affected pages：`26,184`，见 [latest-coverage-drilldown.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-coverage-drilldown.md#L1)
- `已抓取 - 尚未编入索引`：`1,996`
- `重复网页，Google 选择的规范网页与用户指定的不同`：`423`
- 主集群包括：尾斜杠重复、源码文件型 URL、query 参数页、深层 skill path trap。见 [latest-coverage-drilldown.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-coverage-drilldown.md#L44)

这些问题单独看未必构成“内容质量降权”，但会明显放大问题：

- 浪费抓取资源
- 干扰 canonical 判断
- 让站点整体看起来更不稳定、更像聚合抓取站

### 8. robots 已经拦了一部分，但仍然挡不住“源码 URL 泄漏到发现集”

robots 里已经屏蔽了 `.md`、`.ts`、`.json`、深层 skill path 等：

- 见 [robots.txt.ts](/Users/kaka/Dev/Killer-Skills/src/pages/robots.txt.ts#L7)

但 coverage 里仍然有一个 `source_file_path` 集群，估算影响 `1,755.4` 个页面。见 [latest-coverage-drilldown.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-coverage-drilldown.md#L62)

说明当前策略还不够：

- 这些 URL 还是进入了 Google 的发现集合；
- 只是靠 robots/disallow 并没有真正解决规范化问题。

## 线上抽样验证

我在 2026-04-16 做了一次 Googlebot 风格抓取，目标 URL 是：

- `https://killer-skills.com/zh/skills/github/awesome-copilot/gh-cli`

抓到的结果是：

1. canonical 指向 `zh` 自身 URL
2. meta description 仍然是英文
3. 页面正文里可见标题仍然是英文，如 `Authentication`、`Setup Git Integration`、`CLI Structure`

这正好验证了上面的代码结论：

- 外壳本地化了
- 但爬虫看到的主体内容没有真正本地化

这是 Google 很不喜欢的模式。

## 现在的数据到底说明什么

### 当前数据事实

- crawl health 现在是干净的。见 [latest-crawl-health.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-crawl-health.md#L1)
- 但 Search Console CTR 报表非常稀疏：最新周期只有 `20` 个 query rows、`179` 个 page rows。见 [latest-ctr-report.md](/Users/kaka/Dev/Killer-Skills/reports/gsc/latest-ctr-report.md#L1)
- coverage 仍然记录着大量未编入索引、重复、重定向、历史问题 URL。见 [latest-coverage-drilldown.md](/Users/kaka/Dev/Killer-Skills/reports/seo/latest-coverage-drilldown.md#L44)

### 最合理的解释

当前更像是：

1. Google 现在可以抓到你们站了；
2. 但它对“哪些 URL 值得收录”非常保守；
3. 很多 skill 页面没有达到“足够独特、足够有帮助、语言一致性足够高”的门槛；
4. 历史的重复与路径噪音继续拖慢恢复。

## 回答你的核心问题

### Google 是不是把站点判成了 GitHub 镜像站？

严格说，未必是“跨域 canonical 到 GitHub”的那种镜像判定。

但从信号层面看，答案是：

`是的，你们现在非常像一个 GitHub 派生内容的聚合/复写站。`

区别在于：

- `不是最核心的问题`：单纯 duplicate content 理论
- `更像真正的问题`：低附加值的大规模聚合、爬虫视角下的未本地化多语言页、模板化扩张

所以我会这样表述：

- 不是“被当成 GitHub 镜像站”这么单一；
- 更像“被算法识别成 GitHub 派生的大规模低附加值聚合内容体系”。

### 有没有证据说明已经被 Google 手动处罚？

没有直接证据。

我在本地没有找到 Search Console Manual Actions 报告，也看不到 Google 内部分类器状态。

因此最严谨的说法是：

- 这是一个高置信度的 `算法级质量 / 索引选择问题` 诊断；
- 不是已经确认的人工处罚结论。

## 恢复优先级

### P0：立刻停止 skill 多语言页的过度索引扩张

对 skill 页面做和 collections 一样严格的 locale 索引治理：

1. 只有标题、描述、正文都真正本地化的 locale 才允许索引
2. 如果正文没有真正本地化：
   - 要么 canonical 到英文主版本
   - 要么直接 `noindex`
3. skill sitemap 和 hreflang 只输出真正可索引的 locale

这是当前最高杠杆的动作。

### P0：缩小可索引 skill 集合，只保留有真实一手价值的页面

现在 skill 页面不应该再用“`>= 250 bytes` 就可以 index”这种逻辑。

建议改成更强的 indexability 门槛，例如页面至少具备其中若干项：

1. 实际安装/验证结果
2. 维护者可信度判断
3. 一手兼容性说明
4. 和相似 skill 的差异比较
5. 原创截图 / walkthrough
6. 原创的“为什么选它 / 不该在什么场景用它”

如果页面仍然主要是导入 README + 生成型包装，就不应该给 index。

### P1：从模板层降低“GitHub 镜像感”

真正应该排到页面前半部分的，不该是导入 README 本身，而应该是你们自己的判断层：

- 适合谁
- 不适合谁
- 是否验证过
- 兼容哪些 agent / IDE
- 和同类 skill 比有何差异
- 是否值得安装

README 应该退到“参考材料”，而不是“页面主体”。

### P1：继续清理 URL 噪音

coverage 里仍要继续收口的集群：

1. 尾斜杠变体
2. 源码文件型 URL
3. query 参数页
4. 深层 skill path trap
5. repeated segment URL

这些问题会继续拖累整体索引恢复。

### P1：缩小 sitemap 的规模

不要再把 skill 页完整地按 10 个语言矩阵全部广播给 Google，除非这些 URL 每一个都真的值得独立收录。

### P2：用精选页和强一手内容重建 topical authority

真正更容易恢复流量的，不一定是全量 skill detail，而是：

1. 高质量英文 collection 页面
2. 官方 skill 的高置信详情页
3. 有明显原创判断的 comparison 页面
4. 带真实验证和实操经验的 workflow/tutorial 页面

这些页面更像产品与编辑资源，而不是抓取目录。

## 产品定位建议

如果目标是可持续搜索增长，站点不应该继续朝这个方向走：

- “把 GitHub 上的 skills 全部镜像成多语言目录”

更应该朝这个方向走：

- “AI coding skills 的可信筛选与决策平台”

这意味着：

1. 更少的可索引页面
2. 更强的一手评估
3. 更严格的 locale 治理
4. 更明确的 canonical 收敛
5. 更高的每页原创价值门槛

## 最终结论

你们现在流量没有恢复，最可能不是因为“Google 还没重新抓到站点”，而是因为 skill detail 这条内容架构仍然过于像：

- GitHub 原文驱动
- AI 包装增强
- 多语言批量扩张
- 页面新增价值不足

所以最终回答是：

- `不是简单的“被判成 GitHub 镜像站”这么单一。`
- `更像是被 Google 当成 GitHub 派生的大规模聚合/复写内容体系来低优先级处理。`

如果接下来只继续修 404 / 5xx，流量大概率不会显著恢复。

真正有恢复希望的路径是：

1. 先砍掉 skill 页错误的多语言索引扩张
2. 再砍掉低附加值 skill 页的 indexability
3. 再把少量高价值页做成真正的一手内容资产
