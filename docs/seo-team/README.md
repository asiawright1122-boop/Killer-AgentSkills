# SEO Sub-Agent Team

- 日期：2026-04-16
- 团队目标：围绕 `killer-skills.com` 的自然流量恢复，建立一套长期运行的 SEO 专职 Sub-Agent 编排机制
- 总负责人：主编排 Agent（产品经理 + SEO 负责人）

## 团队定位

这不是临时性的修 bug 小组，而是一支围绕自然流量增长运转的常设 SEO 团队。

团队的工作目标分为 4 层：

1. 恢复 Google 对站点的搜索信任
2. 提升 authority surfaces 的收录、展示与点击
3. 控制低价值 URL 的抓取与索引噪音
4. 把 D1 / KV / 前端 / 内容 / 报表串成一个可持续的 SEO 发布系统

## 角色结构

1. `Agent 01`：GEO / AI 引用优化
2. `Agent 02`：Meta / Snippet / CTR 优化
3. `Agent 03`：Schema / Rich Results
4. `Agent 04`：SEO Content / Authority Surface

## 角色产物

- [Agent 01 Charter](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-01-geo-citation.md)
- [Agent 02 Charter](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-02-meta-snippet.md)
- [Agent 03 Charter](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-03-schema-rich-results.md)
- [Agent 04 Charter](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-04-content-authority.md)
- [Sprint 01 Authority Surfaces](/Users/kaka/Dev/Killer-Skills/docs/seo-team/sprint-01-authority-surfaces.md)

## 协作原则

1. 任何 Agent 都不能单独扩大索引面
2. 任何新页面进入 sitemap 之前，都要经过 canonical / locale / value 审核
3. authority surfaces 优先于 full directory
4. 技术修复只服务于流量恢复目标，不单独成为目标
5. D1 是技能事实主源，KV 只做缓存与分发

## 编排方式

主编排 Agent 负责：

- 分配优先级
- 合并冲突意见
- 统一行动顺序
- 维护 KPI
- 决定哪些任务进入开发落地

各 SEO Sub-Agent 负责：

- 在自己的职责边界内持续给出诊断、建议、SOP 和执行清单
- 对接对应页面类型与指标
- 不跨边界改写其他角色职责

## 当前编制

1. `Agent 01` GEO / AI 引用优化
   - 专属技能：`geo-content-optimizer`
   - 主要负责：authority surfaces 的 direct answer、AI 可引用表达、FAQ 问题覆盖、第一方判断摘录性
   - 交付文件：[agent-01-geo-citation.md](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-01-geo-citation.md)
2. `Agent 02` Meta / Snippet / CTR
   - 专属技能：`meta-tags-optimizer`
   - 主要负责：title、meta description、Open Graph、Twitter Card、CTR 工作流
   - 交付文件：[agent-02-meta-snippet.md](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-02-meta-snippet.md)
3. `Agent 03` Schema / Rich Results
   - 专属技能：`schema-markup-generator`
   - 主要负责：JSON-LD、rich results eligibility、FAQ / Collection / WebSite / SoftwareApplication 等结构化数据策略
   - 交付文件：[agent-03-schema-rich-results.md](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-03-schema-rich-results.md)
4. `Agent 04` SEO Content / Authority Surface
   - 专属技能：`seo-content-writer`
   - 主要负责：authority surfaces 内容策略、editorial queue、更新 SOP、内容 KPI
   - 交付文件：[agent-04-content-authority.md](/Users/kaka/Dev/Killer-Skills/docs/seo-team/agent-04-content-authority.md)

## 协作链路

团队的标准协作顺序固定为：

1. `Agent 04` 定义页面目标、内容增量、第一方判断和 editorial queue
2. `Agent 01` 校准 direct answer、AI 可引用段落、问题覆盖和 authority 表达
3. `Agent 02` 对齐 title / description / OG / Twitter，确保 SERP 承诺与正文一致
4. `Agent 03` 补齐 schema / FAQ / breadcrumb / collection / software application 等结构化层
5. 主编排 Agent 决定哪些建议进入代码和发布链

## 第一波战役

当前团队第一波只聚焦 authority surfaces，不做 bulk 扩张。

优先页面：

1. 首页 `/${locale}`
2. Collections Hub `/${locale}/collections`
3. Solutions Hub `/${locale}/solutions`
4. Installation Docs `/${locale}/docs/installation`
5. `Official AI Skills & Trusted Tools`
6. `Agent Workflow Building Tools`

优先目标：

1. 让至少 2 个 authority surfaces 进入 `promote-ready`
2. 建立统一的站点级价值承诺、第一方判断和下一步动作链
3. 让 meta、正文、schema、FAQ、AI 可引用表达保持同一口径
4. 避免继续把流量重心压回 full skills directory

## 启动状态

- `Agent 01`：已激活
- `Agent 02`：已激活
- `Agent 03`：已激活
- `Agent 04`：已激活
- `总编排`：已激活

## 当前阶段目标

当前团队不以“扩大收录数量”为目标，而以以下结果为目标：

1. 至少 2 个 authority surfaces 进入 promote-ready
2. Coverage 主要噪音 cluster 持续下降
3. 权威入口页的 impressions / clicks 开始恢复
4. 技能详情页只保留高价值 canonical 承接页

## 状态

- `团队已组建完成`
- `4 个专职 SEO Sub-Agent 已产出各自 charter`
- `当前可直接进入下一步：把 authority surfaces 的第一波优化任务派发到开发实现`
