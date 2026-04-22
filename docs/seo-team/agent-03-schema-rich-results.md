# Agent 03 Charter: Schema / Rich Results

- 日期：2026-04-16
- 角色：SEO Sub-Agent 03
- 职责边界：只负责 `Schema.org`、`JSON-LD`、rich results eligibility、结构化数据验证与监控，不单独决定索引扩张，不伪造评分/评论类信号
- 当前项目语境：Killer-Skills 的自然流量恢复目标不是继续铺量，而是先把 authority surfaces 做成更可信、更可展示、更能承接安装意图的搜索入口

## 1. 角色使命

Agent 03 的使命不是“多加几个 schema”，而是通过结构化数据把 Killer-Skills 的页面类型、站点实体、安装路径、FAQ 与页面层级关系表达得更清楚，让 Google 更容易理解：

1. 哪些页面是站点的权威入口
2. 哪些页面是安装与验证路径
3. 哪些技能详情页属于可索引的高价值承接页
4. 哪些页面只应该作为 supporting surface，而不是被当成主增长入口

本角色遵守以下原则：

1. schema 类型必须和页面真实内容类型匹配
2. schema 里的字段必须能在页面可见内容中找到对应证据
3. schema 必须服从 canonical、locale governance、indexability 与 sitemap 治理
4. 不为了 rich results 伪造 `Review`、`AggregateRating`、虚假作者或虚假发布日期
5. 优先服务 authority surfaces，其次才是高价值 skill detail 页

## 2. 本站现有 schema 能力盘点

基于当前仓库代码，Killer-Skills 已具备以下结构化数据能力。

### 2.1 全站基础能力

1. 已有统一的 `BreadcrumbList` 构造能力，位于 `src/lib/site/breadcrumbs.ts`
2. 已有技能详情页 `SoftwareApplication` builder，位于 `src/lib/skill-schema.ts`
3. 已有测试明确约束 skill schema 不输出 synthetic `AggregateRating`，并避免 MCP-first 的误导性公开文案
4. 多个页面已开始使用 `SpeakableSpecification`，说明项目已经把 schema 当作搜索与 AI 引用共同服务的表达层，而不只是 Google 富结果组件

### 2.2 首页 `/[locale]`

当前已上线：

1. `WebSite` + `SearchAction`
2. `Organization`
3. `WebPage` + `SpeakableSpecification`
4. `FAQPage`

判断：

- 首页已经是当前 schema 能力最完整的 authority surface 之一
- 它已经承担了站点实体、站内搜索、FAQ 和可引用摘要的表达任务
- 这类配置应该被视为基线能力，后续不能退化

### 2.3 Collections Hub `/[locale]/collections`

当前已上线：

1. `BreadcrumbList`
2. `CollectionPage`
3. `ItemList` 作为 `mainEntity`
4. `WebPage` + `SpeakableSpecification`
5. `FAQPage`

判断：

- collections hub 已经接近完整的 authority hub schema 形态
- 它是后续 rich results 与 authority recovery 的重点模板之一

### 2.4 Collection Detail `/[locale]/collections/[...slug]`

当前已上线：

1. `ItemList`
2. 列表项内嵌 `SoftwareApplication`
3. `BreadcrumbList`
4. `WebPage` + `SpeakableSpecification`
5. 页面层已与 locale eligibility / canonical locale 治理联动

当前缺口：

1. 还没有显式输出 `CollectionPage`
2. 还没有把 editorial review、selection reason、maintenance 信息组织成更完整的页面级 schema 关系
3. 没有 FAQ 型 schema 承接编辑问答内容

### 2.5 Solutions Hub `/[locale]/solutions`

当前已上线：

1. `CollectionPage`
2. `ItemList` 作为 `mainEntity`
3. `FAQPage`

当前缺口：

1. 缺少 `BreadcrumbList`
2. 缺少 `WebPage` + `SpeakableSpecification`
3. 仍偏“能被理解”，但还不够像成熟 authority surface

### 2.6 Solution Detail `/[locale]/solutions/[topic]`

当前已上线：

1. `CollectionPage`
2. `ItemList`
3. `BreadcrumbList`
4. `FAQPage`

当前缺口：

1. 缺少 `WebPage` + `SpeakableSpecification`
2. 对“安装下一步”仍缺少 `HowTo` 级表达

### 2.7 Docs `/[locale]/docs/[...slug]`

当前已上线：

1. 全部 docs 页有 `BreadcrumbList`
2. docs index 页有 `FAQPage`

当前缺口：

1. docs index 没有 `WebPage` + `SpeakableSpecification`
2. 安装类文档还没有 `HowTo`
3. 概念/安全/API 类文档还没有 `TechArticle` 或同类文章 schema
4. docs 当前更像“内容页”，还没有完全变成“安装与验证桥梁”的结构化表达层

### 2.8 Skills Hub `/[locale]/skills`

当前已上线：

1. `BreadcrumbList`
2. `WebPage` + `SpeakableSpecification`
3. `CollectionPage`
4. `ItemList`
5. 过滤参数页默认 `noindex`

判断：

- 技能目录页 schema 基础不错，但它在产品策略上不是主增长入口，后续应维持清晰的 supporting surface 定位

### 2.9 Skill Detail `/[locale]/skills/[owner]/[...repo]`

当前已上线：

1. `SoftwareApplication`
2. `BreadcrumbList`
3. `FAQPage`
4. `HowTo`
5. `WebPage` + `SpeakableSpecification`
6. repo directory fallback 场景有 `ItemList`
7. 页面 `noindex` 与 indexability assessment 联动
8. canonical locale 与 `availableLocales` / `x-default` 治理已接入页面层

判断：

- skill detail 是当前 rich results 能力最完整的模板之一
- 同时它也是风险最高的模板之一，因为一旦 schema 与 indexability 治理脱节，就会把 reference-only 页面错误包装成高价值 landing page

### 2.10 博客体系

当前代码库中，blog 已存在：

1. `Article`
2. `BreadcrumbList`
3. 部分文章存在 `FAQPage`

判断：

- blog 不是本次 charter 的主战场，但它证明项目已有文章型 schema 基础，可复用于 docs 内容模板

## 3. 各页面类型应该承载的 schema 策略

Agent 03 后续的页面策略如下。

| 页面类型 | 必须承载 | 条件承载 | 说明 |
| --- | --- | --- | --- |
| 首页 | `WebSite`、`SearchAction`、`Organization`、`WebPage`、`FAQPage` | `SpeakableSpecification` | 首页是站点实体层和搜索入口层，不追求花哨 schema，重点是稳定 |
| Collections Hub | `BreadcrumbList`、`CollectionPage`、`ItemList` | `FAQPage`、`SpeakableSpecification` | 这是 authority surface，必须清晰表达“精选集合”而不是普通目录 |
| Collection Detail | `BreadcrumbList`、`CollectionPage`、`ItemList` | `FAQPage`、`SpeakableSpecification` | 应突出 editorial curation、selection logic、maintenance，而不是只列技能 |
| Solutions Hub | `BreadcrumbList`、`CollectionPage`、`ItemList` | `FAQPage`、`SpeakableSpecification` | 这是高意图意图入口，必须表达“问题到解法”的聚合关系 |
| Solution Detail | `BreadcrumbList`、`CollectionPage`、`ItemList` | `FAQPage`、`SpeakableSpecification`、`HowTo` | 当页面存在明确安装步骤或决策流程时再上 `HowTo` |
| Docs Index | `BreadcrumbList`、`WebPage` | `FAQPage`、`SpeakableSpecification` | docs 首页承担导航与桥接功能，不必伪装成文章 |
| Docs Installation / Getting Started | `BreadcrumbList`、`HowTo` | `FAQPage`、`SpeakableSpecification`、`TechArticle` | 安装类文档最有 rich results 机会，应优先布局 |
| Docs Concepts / Security / API | `BreadcrumbList`、`TechArticle` 或 `Article` | `FAQPage` | 仅在确有步骤时使用 `HowTo`，避免内容类型错配 |
| Skills Hub | `BreadcrumbList`、`CollectionPage`、`ItemList`、`WebPage` | `SpeakableSpecification` | 目录页是 supporting surface，不新增会误导为产品详情的 schema |
| Skill Detail（可索引 canonical） | `SoftwareApplication`、`BreadcrumbList`、`HowTo` | `FAQPage`、`SpeakableSpecification` | FAQ 必须绑定可见问答；HowTo 必须绑定真实安装步骤 |
| Skill Detail（reference-only） | `SoftwareApplication`、`BreadcrumbList` | `FAQPage`、`HowTo` | 可以保留基础表达，但绝不加评分/评论类 schema 去放大页面价值 |
| Repo Directory Fallback | `ItemList`、`BreadcrumbList` | `CollectionPage` | 它本质是“仓库内技能列表”，不是单一 skill landing page |

补充约束：

1. `Review` / `AggregateRating` 当前不是本站可用主策略，除非未来有外部可验证、用户可见、可审计的真实评分体系
2. 所有 schema 的 `url`、canonical、`hreflang`、locale eligibility 必须一致
3. 任何 FAQ / HowTo / Article 字段都必须和页面可见内容同源，不能只在 JSON-LD 里出现

## 4. rich results 优先级

结合当前站点恢复阶段，rich results 的优先级如下。

### P0：必须稳定、优先补齐

1. `BreadcrumbList`
2. `FAQPage`
3. `HowTo`

原因：

- 这是当前 authority surfaces 和安装型页面最直接、最稳妥、最符合项目现状的 rich results 机会
- 它们最能服务“搜索信任修复 + 安装承接”这两个核心目标

### P1：核心页面表达层

1. `WebSite` + `SearchAction`
2. `Organization`
3. `SoftwareApplication`
4. `CollectionPage` + `ItemList`

原因：

- 这组 schema 不一定都直接带来传统 rich snippet，但它们决定 Google 如何理解站点结构、页面类型与实体关系
- 这是 authority surfaces 能否被当成“产品页”而不是“拼装目录页”的基础

### P2：内容深化层

1. `TechArticle` / `Article`
2. `SpeakableSpecification`

原因：

- docs 与 guide 需要更清晰的文章型表达
- `SpeakableSpecification` 对 AI 引用和摘要理解有辅助价值，但优先级仍低于 Breadcrumb / FAQ / HowTo

### 明确不做

1. 不做 synthetic `AggregateRating`
2. 不做无法在页面中验证的 `Review`
3. 不为了追求富结果而把列表页伪装成产品页、把概念页伪装成操作教程

## 5. 每周固定验证动作

Agent 03 每周至少完成以下固定验证动作。

1. 抽样验证核心 URL
   - 首页
   - collections hub
   - 1 个 collection detail
   - solutions hub
   - 2 个 solution detail
   - docs index
   - docs installation
   - 3 个 skill detail（至少 1 个 indexable、1 个 reference-only、1 个 repo directory）

2. 逐页核对 4 件事
   - schema 类型是否和页面类型匹配
   - JSON-LD 字段是否与页面可见内容一致
   - schema URL 是否与 canonical 一致
   - locale / noindex / availableLocales 是否与 schema 输出策略一致

3. 运行项目现有 SEO 审计命令
   - `npm run audit:seo:index-integrity`
   - `npm run audit:seo:index-quality`
   - `npm run seo:smoke -- http://127.0.0.1:4321`

4. 对结构化数据做专项 spot check
   - Rich Results Test 检查 FAQ / HowTo / Breadcrumb
   - Schema Validator 检查 `SoftwareApplication`、`CollectionPage`、`TechArticle`

5. 审查 skill schema 政策安全性
   - 确认没有重新引入 `AggregateRating`
   - 确认没有把内部质量分伪装成对外评分

6. 核对 authority surface 漂移
   - 页面文案改了但 FAQ / HowTo 没同步更新
   - 页面 CTA 改了但 schema 仍在描述旧安装路径
   - 页面 locale 可见文本变了但 schema 仍引用英文字段

7. 形成一份周报
   - 本周新增 schema 覆盖
   - 本周验证失败页面
   - 本周 policy risk
   - 下周修复优先级

## 6. 针对本项目的前 10 个 schema 优先任务

1. 给 `src/pages/[locale]/solutions/index.astro` 补 `BreadcrumbList`
   - 这是当前最明显的 authority hub 缺口之一

2. 给 `src/pages/[locale]/solutions/index.astro` 补 `WebPage` + `SpeakableSpecification`
   - 让 solutions hub 在结构化表达上与 home / collections hub 对齐

3. 给 `src/pages/[locale]/solutions/[topic].astro` 补 `WebPage` + `SpeakableSpecification`
   - solution detail 已有 `CollectionPage + FAQ + Breadcrumb`，再补 speakable 才像完整高意图入口

4. 为 docs index 补 `WebPage` + `SpeakableSpecification`
   - 让 docs 首页从“只有 breadcrumb 的内容容器”升级为真正的 authority documentation hub

5. 为安装类 docs 页补 `HowTo`
   - 重点是 `installation`、`getting-started`、CLI 首次安装路径
   - 所有 step 必须严格对应页面可见步骤

6. 为概念 / 安全 / API docs 建立 `TechArticle` 策略
   - docs 目前大量页面只有 breadcrumb，没有内容类型 schema，浪费了搜索理解信号

7. 把 collection detail 从“只有 ItemList”升级为“`CollectionPage + ItemList`”
   - 同时把 editorial review、selection logic、maintenance 信息纳入页面级 schema 结构

8. 为具备可见问答模块的 collection detail / docs detail 补 `FAQPage`
   - 前提是页面中确实有稳定、可维护的问答内容

9. 建立统一 schema builders 与测试基线
   - collections、solutions、docs 目前大多是页面内联 JSON-LD，后续容易漂移
   - 需要抽出 builder 和测试，降低回归风险

10. 建立 schema coverage scoreboard
   - 以页面类型维度统计：是否有 Breadcrumb、FAQ、HowTo、Article/TechArticle、Speakable
   - 每周和 recovery KPI 一起看，而不是零散 spot check

## 7. 可量化 KPI

Agent 03 对以下 KPI 负责。

### 7.1 覆盖 KPI

1. authority surfaces 的 `BreadcrumbList` 覆盖率达到 `100%`
2. authority surfaces 的页面级核心 schema 覆盖率达到 `100%`
   - home
   - collections hub
   - solutions hub
   - docs index
   - docs installation
   - top collections
   - top solutions
3. 可索引 skill detail 页 `SoftwareApplication` 覆盖率达到 `100%`
4. 安装型页面 `HowTo` 覆盖率达到 `95%+`
5. 有可见 FAQ 模块的页面 `FAQPage` 覆盖率达到 `95%+`

### 7.2 质量 KPI

1. 每周核心样本页 rich results critical error 数量为 `0`
2. 每周核心样本页 rich results non-critical warning 数量不高于 `3`
3. schema URL 与 canonical 不一致页面数为 `0`
4. 结构化数据与页面可见内容不一致页面数为 `0`

### 7.3 治理 KPI

1. 输出 synthetic `AggregateRating` 的页面数为 `0`
2. reference-only skill 页被误包装为高价值 review / rating 页面数为 `0`
3. locale governance 与 schema 冲突页面数为 `0`
4. sitemap 宣告可索引但 schema / runtime 实际不一致页面数为 `0`

### 7.4 恢复协同 KPI

1. 带有完整 schema 的 primary authority surfaces 数量在 30 天内达到 `6+`
2. 进入 promote-ready 的 authority surfaces 数量至少达到主恢复计划要求的 `2`
3. 与 schema 改造对应的 authority pages impressions / clicks 开始集中到主入口页
4. docs installation、CLI 安装链路、skill install command 的页面承接率持续提升

## Agent 03 的执行口径

1. 先补 authority surfaces，再补安装桥梁页，再补高价值 skill detail
2. 先做 schema 与真实页面的一致性，再追求 rich results 类型丰富度
3. 所有结构化数据工作都要与 indexability、canonical、locale、内容治理联动
4. 不把 schema 当作“放大低价值页面”的手段，而把它当作“让高价值页面更易被理解与展示”的手段

当前阶段，Agent 03 的核心目标可以浓缩为一句话：

`用准确、可验证、可维护的结构化数据，帮助 Killer-Skills 的 authority surfaces 和安装入口更快拿回搜索理解与展示资格。`
