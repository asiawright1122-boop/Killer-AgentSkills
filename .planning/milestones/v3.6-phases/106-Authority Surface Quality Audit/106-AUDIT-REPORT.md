# Phase 106 Audit Report — Authority Surface Quality Audit

本报告针对 Killer-Skills 项目现有的 32 个权威入口页面（Authority Surfaces）进行全面质量审计。依据最新的计分板数据（Scorecard）和配置规则，识别导致页面处于 `hold` 或 `stop` 状态的核心阻碍，并针对两个选定的 P0 级黄金入口页提出具体的内容与链接升级方案。

---

## 1. 权威入口页全局状态分析

根据 `latest-authority-uplift-scorecard.md` 指标：
- **总页面数**：32 个。
- **Promote（已晋升）**：0 个。
- **Hold（维持观察）**：31 个。
- **Stop（隔离避让）**：1 个 (`Full Skills Directory` / `skills-directory`)。

### 核心阻碍矩阵（Blocker Matrix）

| 阻碍项 | 影响范围 | 原因分析与现状 | 解决方案 |
|---|---|---|---|
| **Proof Window Trust Verdict** | 全局 32 个页面 | 证明窗口可信度显示为 `warning` 且 `baselineSeeded=no`。这通常由于 GSC 数据抓取周期较短或刚建立新基线导致。 | 无需本地参数硬编码绕过，保持 GSC 正常同步节奏，等待数据随时间累积自动流转为 `ready`。 |
| **Visibility / Impressions & Clicks** | 绝大多数 Hold 页面 | 除首页和少数 hub 外，大部分页面 clicks/impressions 均为 0，未达到 Tier P0 (Impr>=3, Clicks>=1) 或 Tier P1/P2 的流量门槛。 | 1. 提升 SEO TDK 结构与原创内容质量；<br>2. 增强全局页面的内链导流（展示位 placements）。 |
| **Internal Link Support** | 全局 Hub/Collection 页面 | 许多入口页缺乏足够的内链支撑。例如，Hub 页面需在全局至少有 3 个 placement 展现，Collection 需 >= 2 个。 | 升级全局布局（sidebar、main navigation、footer）的 placement 配置，为核心入口页提供更强的全局内链。 |

---

## 2. 32 个 Authority Surfaces 审计汇总表

| 序号 | 页面 ID | 级别 | 页面类型 | 展现位配置 (Placements) | 当前 Decision |
|---|---|---|---|---|---|
| 1 | `home-root` | P0 | hub | report, collections, skills, solutions, docs | hold |
| 2 | `collections-hub` | P0 | hub | home, skills, collections, solutions | hold |
| 3 | `collection-official-trusted-tools` | P0 | collection | home, skills, collections, solutions | hold |
| 4 | `collection-agent-workflows` | P0 | collection | home, skills, collections, solutions | hold |
| 5 | `docs-installation` | P0 | guide | home, skills, collections, solutions | hold |
| 6 | `collection-claude-code` | P1 | collection | home, skills, collections, solutions | hold |
| 7 | `collection-cursor` | P1 | collection | home, skills, collections, solutions | hold (CONTEXT 指定按 P0 级升级) |
| 8 | `collection-windsurf` | P1 | collection | home, skills, collections, solutions | hold |
| 9 | `collection-gemini` | P1 | collection | home, skills, collections, solutions | hold |
| 10 | `collection-opencode` | P1 | collection | home, skills, collections, solutions | hold |
| 11 | `collection-nextjs` | P1 | collection | home, skills, collections, solutions | hold |
| 12 | `collection-python` | P1 | collection | home, skills, collections, solutions | hold |
| 13 | `collection-react` | P1 | collection | home, skills, collections, solutions | hold |
| 14 | `collection-typescript` | P1 | collection | home, skills, collections, solutions | hold |
| 15 | `collection-devops` | P1 | collection | home, skills, collections, solutions | hold |
| 16 | `collection-framework` | P1 | collection | home, skills, collections, solutions | hold |
| 17 | `collection-productivity` | P1 | collection | home, skills, collections, solutions | hold |
| 18 | `solutions-hub` | P1 | hub | home, skills, collections, solutions | hold |
| 19 | `solution-agent-workflows` | P1 | solution | home, skills, solutions | hold |
| 20 | `solution-workflow-automation` | P1 | solution | home, collections, solutions | hold |
| 21 | `solution-process-automation` | P1 | solution | home, collections, solutions | hold |
| 22 | `solution-data-extraction` | P1 | solution | home, collections, solutions | hold |
| 23 | `docs-cli-overview` | P1 | guide | home, collections, solutions | hold |
| 24 | `blog-official-ai-agent-skills-guide` | P1 | guide | home, skills, collections, solutions | hold |
| 25 | `blog-how-to-install-ai-agent-skills` | P1 | guide | home, skills, solutions | hold |
| 26 | `collection-rust` | P2 | collection | home, skills, collections, solutions | hold |
| 27 | `collection-community` | P2 | collection | home, skills, collections, solutions | hold |
| 28 | `solution-document-automation` | P2 | solution | home, collections, solutions | hold |
| 29 | `solution-browser-automation` | P2 | solution | home, collections, solutions | hold |
| 30 | `blog-ide-comparison` | P2 | comparison | home, skills, solutions | hold |
| 31 | `blog-mcp-vs-rest-api` | P2 | comparison | home, skills, collections | hold |
| 32 | `skills-directory` | P3 | directory | home, skills, collections, solutions | **stop** (已隔离) |

*注：`skills-directory` (全量目录页) 在 Phase 55 被决策为隔离，防止因薄弱内容和低质量聚合被搜索引擎处罚。这完全符合“先精选后扩张”的核心恢复策略。*

---

## 3. P0 核心目标页深度审计

本次审计主要聚焦于 `Official AI Skills & Trusted Tools` 与 `Cursor-Compatible Skills` 两个 P0 级黄金入口，深入剖析其当前的内容债务及链接呈现阻碍。

### 目标页 1：Official AI Skills & Trusted Tools
- **ID**：`collection-official-trusted-tools`
- **链接**：`/{locale}/collections/top-official-ai-skills-trusted-tools`
- **底表配置**：`src/content/collections/top-official-mcp-servers.json`
- **内容债务审计**：
  1. 目前收录了 12 个官方技能项目（如 `ComposioHQ/awesome-claude-skills` 等）。
  2. 虽然有选择原因（`selectionReason`）和信任信号（`trustSignals`），但缺乏引导操作者立即尝试的**内联命令行安装示例**与针对特定开发环境的**具体配置教程**。
  3. 缺乏第一方判断的精细点评，项目描述偏向纯粹的元数据陈列。
- **展示位（Placements）阻碍**：
  - 虽然声明了 `["home", "skills", "collections", "solutions"]`。
  - 但在侧边栏、主导航栏等全站曝光量最大的常设位置上，该权威页的链接没有被直接、显眼地写死或动态注入，使得搜索引擎爬虫和真实用户难以通过极短的路径到达。

### 目标页 2：Cursor-Compatible Skills
- **ID**：`collection-cursor`
- **链接**：`/{locale}/collections/top-cursor-compatible-skills-workflow-integrations`
- **底表配置**：`src/content/collections/top-cursor-mcp-servers.json`
- **内容债务审计**：
  1. 页面包含一个很好的 `Cursor-Native MCP Setup & Verification (Expert Guide)` 专家级教程，从技术步骤上具有很强的可操作性。
  2. 缺点在于：对 Cursor 编辑器核心 `.cursorrules` 的具体语法规范、如何与新增 skill 的 tools 衔接讲解偏少。
  3. 9 个收录技能的实用对比数据缺失，无法直观反映不同技能对于 Cursor 的兼容度细节。
- **展示位（Placements）阻碍**：
  - 同样，该页作为 P1 级别（CONTEXT 中升级为 P0 级关注），缺少在全站布局中的高权重链接入口，难以获取稳定的页面权重。

---

## 4. Phase 107 内容与布局升级建议（Actionable Guidelines）

为确保上述两个核心页面在 Phase 108 中能顺利转为 `promote` 状态，Phase 107 的升级工作应包含：

### 1. 页面内容升级 (Content Depth Upgrades)
- **命令范例补充**：在两个 JSON 配置中的每个技能项（`skills` 或 `featuredSkillRefs`）下，显式补充形如 `npx killer-skills add <owner/repo>` 的真实命令行执行用例。
- **配置与护栏注释**：加入各技能在不同 IDE (Claude Code 与 Cursor) 中的运行差异说明与上下文限制配置提醒，体现 Killer-Skills 一手评测价值。

### 2. 全局展示位升级 (Global Placement Layout Upgrades)
- **侧边栏/主导航内链注入**：修改全局布局文件（如侧边栏、顶部导航），显式增加指向 `/collections/top-official-ai-skills-trusted-tools` 与 `/collections/top-cursor-compatible-skills-workflow-integrations` 的直接链接。
- **提升 Link Support 数量**：使这两个权威页面的实际反链来源数量 >= 3，彻底越过 `internal-link-support` 的评分门槛。
