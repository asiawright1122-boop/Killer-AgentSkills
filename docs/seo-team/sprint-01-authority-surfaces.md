# Sprint 01: Authority Surfaces Recovery

- 日期：2026-04-17
- 周期：Sprint 01
- 目标：把 `home`、`collections`、`solutions`、`docs-installation` 这批 authority surfaces 从“可访问页面”推进到“可被 Google 信任与点击的主入口”
- 编排方式：由主编排 Agent 调度 4 个 SEO Sub-Agent 协同执行

## 1. Sprint 目标

本轮不做 bulk 扩张，不追求新增大量索引页。

本轮只解决 3 件事：

1. 统一站点级公开口径，消除会损害信任的自相矛盾表达
2. 强化 authority surfaces 的价值承诺、可引用表达、snippet 与 schema 协同
3. 把第一波 SEO 团队 charter 转成可执行任务，而不是停留在职责说明

## 2. 本轮范围

### 核心页面

1. `/${locale}`
2. `/${locale}/collections`
3. `/${locale}/solutions`
4. `/${locale}/docs/installation`
5. `collection-official-trusted-tools`
6. `collection-agent-workflows`

### 本轮不做

1. 不恢复 full skills directory 为主增长入口
2. 不扩大多语言 skill 页面索引面
3. 不为 reference-only 技能页做 CTR 或 GEO 主攻
4. 不新增大批博客，只优先修复现有 authority surfaces

## 3. 战役拆分

### Track A：站点口径统一

目标：

- 全站公开文案、机器入口、首页入口对“技能规模”说同一套话

当前问题：

- 站内同时存在 `2,500+`、`80,000+`、`3456`

本轮动作：

1. 首页、llms 文本、公共营销文案统一为 `3,400+`
2. 把这套口径写入后续 SEO 团队执行基线
3. 把 count drift 视为 trust bug，而不是普通 copy issue

### Track B：Authority 页面承诺升级

目标：

- 让首页、Collections、Solutions 从“目录介绍页”升级成“可信入口页”

本轮动作：

1. 首页强化 direct answer 与 trusted workflow 口径
2. Collections 强化 curated / trusted picks / install paths
3. Solutions 强化 use case / next-step / install intent

### Track C：AI 引用与结构化表达协同

目标：

- 让 authority pages 更适合被 AI 摘要，也更适合被搜索系统解析

本轮动作：

1. 补齐 direct answer
2. 对齐 FAQ 与正文答案
3. 将内容、Meta、Schema 的责任链固定下来

### Track D：执行治理

目标：

- 让 4 个 SEO Agent 的工作进入稳定节奏

本轮动作：

1. 用 sprint 文档明确 owner、页面、路径、成功信号
2. 用 README 固定协作顺序
3. 后续所有 authority surface 任务先入 sprint，再进代码

## 4. Owner 分工

1. `Agent 01` GEO
   - 负责：direct answer、AI 可引用段落、FAQ 问题覆盖、authority 表达
2. `Agent 02` Meta
   - 负责：title、meta description、OG、Twitter、CTR 实验
3. `Agent 03` Schema
   - 负责：FAQ / WebSite / Collection / SoftwareApplication 等 rich results 层
4. `Agent 04` Content
   - 负责：authority pages 内容升级、editorial queue、页面主叙事
5. `主编排 Agent`
   - 负责：优先级、合并建议、开发任务落地、验证与节奏控制

## 5. 本轮任务清单

### P0

1. 统一公开技能规模口径
   - 页面：home / llms / public copy
   - 结果：只保留一套数字
2. 提升首页 authority 定义段
   - 页面：`src/pages/[locale]/index.astro`
   - 结果：首页首段更像可信入口，不像泛目录说明
3. 提升 Collections snippet 承诺
   - 页面：`src/pages/[locale]/collections/index.astro`
   - 结果：从“collections 列表页”转成“curated trusted picks 入口”
4. 提升 Solutions snippet 承诺
   - 页面：`src/pages/[locale]/solutions/index.astro`
   - 结果：从“分类页”转成“高意图场景入口”

### P1

1. Installation Docs 作为 trust bridge 的标题、摘要、schema 升级
2. `Official AI Skills & Trusted Tools` 内容与 schema 升级
3. `Agent Workflow Building Tools` 内容与 schema 升级
4. 首页、Collections、Solutions、Docs 的 FAQ 与 meta 对齐

### P2

1. authority surfaces 的内部链接再平衡
2. guide / comparison 页进入 editorial queue
3. 首批 authority surfaces 的 7-28 天观察表

## 6. 交付物

本轮 Sprint 的明确交付物：

1. SEO Sub-Agent 团队 charter 套件
2. authority surfaces Sprint 执行板
3. 第一批 authority entry copy 修复
4. 公开数字口径统一

## 7. 成功信号

本轮不以“流量立刻大涨”判断成败，而看这些信号：

1. authority pages 的公开承诺更一致
2. count drift 从公开入口消失
3. Collections / Solutions 不再像泛分类页
4. 4 个 SEO Agent 的责任链进入稳定执行状态
5. 后续 authority surface 改动可以直接按 Sprint 节奏推进

## 8. 下一步

Sprint 01 完成后，优先进入：

1. Installation Docs authority 升级
2. `Official AI Skills & Trusted Tools` 页面改造
3. `Agent Workflow Building Tools` 页面改造
4. 首页、Collections、Solutions、Docs 的 meta + schema + FAQ 一体化验证
