# Phase 1: 34 Promote-Ready Surfaces — 元数据自动化 + 内链结构化 + 信任信号注入

Created: 2026-07-03
Status: Design (pending approval)
Predecessor: Phase 0 (commit 22e5512 — blog prerender + crawl-index fixes)

## 1. 背景与现状

`data/authority-surfaces.json` 定义 35 个 surface（34 primary + 1 supporting），其中 19 个是 collection。Phase 0 修了 blog prerender 和 crawl-index；Phase 1 要把这批 surface 从"架构存在"推进到"内容深度 + 信任信号 + 内链"齐备，使其进入 promote-ready。

探索发现三处关键现状，直接决定 Phase 1 形态：

### 1.1 三套并行的 surface 数据，手工同步
- `data/authority-surfaces.json` —— 策略侧（仅 scripts 读取，src/ 不读）
- `src/lib/authority-surface-public-data.ts` —— 516 行手维护的 en/zh-only TS 副本（runtime 用）
- `src/content/collections/*.json` —— 38 个磁盘文件，collection 内容唯一真相源

没有任何生成器从 manifest 派生 `authority-surface-public-data.ts`，drift 只被 `public-ai-output-guard.ts` 间接审计。

### 1.2 manifest 与磁盘严重失配
- manifest 列 19 个 collection surface
- 磁盘上有 38 个 collection JSON
- 16 个磁盘 collection 未在 manifest 中（覆盖率 ~50%）
- 决策：**先补齐 manifest**（按质量自动纳入符合的 collection），再做自动化

### 1.3 三条线现状速查

| 线 | 现状 | Phase 1 工作量 |
|---|---|---|
| **元数据自动化** | collection 页 `<title>`/description/OG/canonical 已从 `cData.seoTitle/seoDescription` 派生（`[...slug].astro:248-253`）；但 manifest 未接入任何页面；`authority-surface-public-data.ts` 手维护；无 `seo-frontmatter-guard` 对应 collection 版本；`seo-structured-data-validate.ts` 仅覆盖 4 个硬编码 P0 surface | 生成器 + 校验守卫 + 扩展 validate |
| **内链结构化** | `linkingRules` 纯声明，仅 report script 读取；`placements` 仅作次级过滤；`SkillRelated.astro` 的 authority 路径**硬编码字符串**，不读 manifest；collection→collection 关系是 `authority-surfaces.ts` 里的 `relatedAuthorityCollectionIdsBySlug` 硬编码 map | 让组件读 manifest 派生数据 + 用 placements/rules 驱动渲染 |
| **信任信号注入** | `editorial{}` schema 已齐备（`selectionReason`/`trustSignals`/`maintenance.reviewedAt`/`executionExamples`/`decisionTracks`/`nextSteps`）；但 `groupingLogic` 字段有定义有数据却**模板未渲染**；hub 无"why directory is secondary"段；26/38 有 reviewedAt，8 个缺失；drift/quality-audit 不校验 editorial 字段 | 接通 groupingLogic + 补 hub 段 + 扩展 drift/quality 校验 editorial |

## 2. 范围

### In scope
1. **manifest 补齐**：按质量阈值把 16 个未纳入 collection 中达标的补进 `data/authority-surfaces.json`，使 manifest 成为 collection surface 完整清单。
2. **元数据自动化（Generation + Guard）**：
   - 新增 `scripts/sync-authority-surface-public-data.ts`：从 `data/authority-surfaces.json` 生成 `src/lib/authority-surface-public-data.ts`，消除手维护副本。
   - 新增 `scripts/seo-collection-frontmatter-guard.ts`：对 collection JSON 校验 `seoTitle`(<=60)、`seoDescription`(<=160)、`keywords` 意图词、title/description 必填，对齐 blog guard 形态。
   - 扩展 `scripts/seo-structured-data-validate.ts`：把 P0_SURFACES 硬编码列表改为从 manifest 派生，覆盖所有 collection surface。
3. **内链结构化**：
   - 重写 `SkillRelated.astro::getRelevantAuthoritySurfaces`：改为调用 `getAuthoritySurfaceEntries(...)` 按 category/placement 派生，删除内联硬编码 surface 元数据。
   - 让 collection hub 与 detail 页的权威入口卡从 manifest 派生（`getAuthoritySurfaceEntries({ placement, ids })`），`linkingRules` 至少有一条进入运行时断言（见 §4）。
4. **信任信号注入**：
   - 在 `[...slug].astro` 接通 `editorial.groupingLogic` 渲染（字段已在 schema 与 JSON 中）。
   - 在 collections hub 加两个段："When to use curated paths" 与 "Why the full directory stays secondary"（i18n key + manifest linkingRule 文案复用）。
   - 扩展 `seo-collection-drift.ts` 与 `seo-collection-quality-audit.ts`：输入 schema 加 editorial 字段，校验缺失/过期 `reviewedAt`、空 `selectionReason`/`trustSignals`。

### Out of scope (留 Phase 2+)
- 新增 `reviewedBy`/`curatedAt` 字段（schema 已有 `maintainedBy` 与 `reviewedAt`，先不扩，避免移 KV schema）
- 跨 collection 关系从硬编码 map 改为基于 content 派生（保留 `relatedAuthorityCollectionIdsBySlug`，仅同步 manifest id）
- IndexNow 提交（已在 Phase 0 之前交付，不在本 phase）
- 博客/文档/solutions 页的元数据自动化（本 phase 聚焦 collection + authority surfaces）

## 3. 架构与数据流（目标态）

```
src/content/collections/*.json  (collection 内容真相源，38 file)
        │
        │ scripts/sync-authority-surface-public-data.ts 读 manifest
        ▼
data/authority-surfaces.json  (surface 策略真相源，补齐后 ~35 collection surface)
        │ generators (build 时 / pre-commit)
        ├──────────────────────────────────────┐
        ▼                                      ▼
src/lib/authority-surface-public-data.ts   scripts/seo-collection-frontmatter-guard.ts
  (生成产物，不再手改)                        (校验 collection JSON meta 字段)
        │                                      │
        ▼                                      ▼
src/lib/authority-surfaces.ts  (runtime:   reports/seo/latest-collection-frontmatter-*.json
  getAuthoritySurfaceEntries /                  reports/seo/latest-structured-data-validation.{json,md}
  getRelatedAuthorityCollectionEntries /        (validate 从 manifest 派生 P0/P1 列表)
  getCollectionRecoveryPathEntries)
        │
        ▼
src/pages/[locale]/collections/[...slug].astro  + index.astro  + SkillRelated.astro
  - <title>/meta：现仍从 cData 派生（不变）
  - 信任信号：接通 groupingLogic + 维护时间戳渲染
  - 内链：从 manifest 派生的 authority entry 卡（SkillRelated 改读 manifest）
  - linkingRules 在 runtime 断言：每个 collection surface 至少有 1 个 nextStep 进 docs/solutions
```

设计原则：
- **单一真相源**：collection 内容真相源是磁盘 JSON；surface 策略真相源是 manifest；`authority-surface-public-data.ts` 退化为生成产物。
- **生成器 > 手维护**：所有跨数据传递通过生成脚本，禁止手同步。
- **校验守卫对称**：blog 有 `seo-frontmatter-guard`；collection 应有对等的 `seo-collection-frontmatter-guard`；JSON-LD validate 从 manifest 而非硬编码派生。
- **只接通已存在的字段**：信任信号多数 schema 已有（groupingLogic、reviewedAt），只需接通渲染与校验，不扩新字段。

## 4. 组件设计

### 4.1 `scripts/sync-authority-surface-public-data.ts` (新增)
**职责**：从 `data/authority-surfaces.json` 生成 `src/lib/authority-surface-public-data.ts`。

输入：`data/authority-surfaces.json` 中的 `surfaces[]`。
输出：TS 文件，导出 `authoritySurfacePublicData`，每条仅含 `{ id, role, tier, surfaceClass, href, title{en,zh}, description{en,zh}, placements }`（不含 rationale/editorialQueue/linkingRules，对齐 `authority-surfaces.test.ts` 的"不泄露内部字段"断言）。

边界：
- 判断 `title`/`description` locale 覆盖：若仅 en 则保留单语言项；若含 zh/更多则全输出。当前 manifest 是 en/zh 双语，输出双语言项即可。
- 生成产物头部含 `// AUTO-GENERATED by scripts/sync-authority-surface-public-data.ts — do not edit`。
- 生成后跑 `authority-surfaces.test.ts` 保证 redacted-subset 不变量。

依赖：读 manifest 的 helpers 复用 `scripts/lib/authority-surfaces-paths.ts` 既有的 `readJson`/surface 解析。
退出码：内容变化非 0；无变化 0（CI gate）。

### 4.2 `scripts/seo-collection-frontmatter-guard.ts` (新增)
**职责**：校验 `src/content/collections/*.json` 的 SEO 字段质量。

规则（对齐 `seo-frontmatter-guard.ts` blog 规则）：
- `seoTitle[].en`：长度 <=60 ascii / <=30 CJK；非必填但若填则上限硬校验；不允 acronym placeholder
- `seoDescription[].en`：长度 <=155（对齐 `normalizePublicSummary` 158 上限留余量）；>=40 字符（避免过短）
- `title`、`description`：必填，非空
- `keywords[]`：禁止 blog guard 同款低意图词（"best", "top", "free", "comparison", "interview"——注意 "top" 在 collection slug 中允许，仅校验 keywords 字段值）
- 输出 `reports/seo/latest-collection-frontmatter-guard.{json,md}`，含每个 collection 的 violations/warnings。
- 退出码：violation>0 非 0；仅 warning 0。
- 接入 package.json：`"seo:collection-frontmatter:guard": "node --import tsx scripts/seo-collection-frontmatter-guard.ts"`。

### 4.3 `scripts/seo-structured-data-validate.ts` (扩展)
**变更**：把 `P0_SURFACES`（lines 83-132）硬编码数组改为从 `data/authority-surfaces.json` 派生 —— 取所有 `tier in ['P0','P1']` 的 collection surface URL，按 surfaceClass 期望 schema 类型校验（collection → ItemList，hub → CollectionPage，guide/comparison 不必强校验或增 FAQPage）。

兼容：保留原 P0 校验断言语义；扩展只是把列表来源从硬编码换成 manifest。新增 manifest-driven surface 时 validate 自动跟上。

### 4.4 manifest 补齐脚本 `scripts/backfill-authority-surface-collections.ts` (新增)
**职责**：扫描磁盘 `src/content/collections/*.json`，对 manifest 中缺失的 collection，按质量阈值决定是否纳入。

质量阈值（达全部即纳入）：
- 有非空 `editorial` 块（`selectionReason` 或 `trustSignals` 或 `reviewSummary` 任一非空）
- 有 `maintenance.reviewedAt`
- 有 `canonicalSlug` 且无 drift 标记（`data/seo-collection-drift.json` 中无 issue）

输出：
- 把达标的 collection 追加到 `data/authority-surfaces.json` 的 `surfaces[]`，tier 默认 P1，surfaceClass `collection`，`title`/`description`/`rationale` 从 collection JSON 的对应字段取（en+zh），`placements` 默认 `["home","skills","collections","solutions"]`。
- 报告 `reports/seo/latest-authority-surface-backfill.{json,md}`：每条 collection 的纳入/推迟原因。
- **不自动 commit**：脚本只改写 manifest 文件，由人工审核后 commit（对齐"对外发布前确认"原则）。

### 4.5 `src/pages/[locale]/collections/[...slug].astro` (信任信号接通)
- 新增 `editorial.groupingLogic` 渲染段：放在"Selection Notes"之后、"Decision Tracks"之前，UI 形态用现有 `trustSignals` 一样的 chip/列布局。i18n label `"Grouping Logic"` / `"分组逻辑"`。
- 现有 `INTERNAL_PUBLIC_COPY_PATTERN`（lines 196-237）会剥离"review"/"editorial"/"checklist"等内部词：groupingLogic 文案写作时避开这些词，或在该 pattern 加白名单注释指引（不修 pattern，只通过文案规避）。
- 维护时间戳渲染已有（lines 549-565），不重做，仅校验脚本侧补齐 8 个缺失 `reviewedAt`（见 §4.7）。

### 4.6 `src/pages/[locale]/collections/index.astro` (hub 信任信号)
- 新增两个 i18n 段（en+zh）：
  1. "When to use curated paths" —— 复用 manifest `linkingRules` 中 `collections-need-next-steps` 的英文文案为锚文本，加 3 条何时走精选 vs 何时走全量目录的判断。
  2. "Why the full directory stays secondary" —— 复用 `directory-is-supporting` 文案，明确目录是支持面而非主力。
- 段位置：插入到现有 "Why These Collections Exist" (lines 279-314) 之后、"Decision-to-Setup Path" (lines 316-396) 之前。

### 4.7 `SkillRelated.astro` (内链读 manifest)
- 删除 `getRelevantAuthoritySurfaces(category)` 内联硬编码（lines 35-132）。
- 改为调用 `getAuthoritySurfaceEntries(locale, { placement: 'skills', ids: pickedIdsByCategory })`，其中 `pickedIdsByCategory` 是一个 category→surfaceId[] 的精简 map（保留分类→surface 映射逻辑，但 surface 元数据从 manifest 派生）。
- 保证 `collections-hub`、`docs-installation`、`skills-directory` 仍恒出现（对齐现有行为，不破坏既有expérience）。
- 加 vitest：改 `authority-surfaces.test.ts` 或新增 `skill-related-authority-paths.test.ts`，断言从此组件派生的 authority entry 全部能在 `authoritySurfacePublicData.surfaces` 中找到（无硬编码漂移）。

### 4.8 `scripts/lib/seo-collection-drift.ts` 与 `seo-collection-quality-audit.ts` (扩 editorial 字段)
- `seo-collection-drift.ts` 的 `CollectionData` 接口加 `editorial?` 字段，新增检测：
  - `editorial_missing_reviewed_at` —— 有 editorial 块但缺 maintenance.reviewedAt
  - `editorial_stale_reviewed_at` —— reviewedAt 早于 90 天（相对 `currentDate` 2026-07-03 → 早于 2026-04-04）
  - `editorial_empty_selection` —— editorial.selectionReason 与 trustSignals 同时为空
- `seo-collection-quality-audit.ts` 的 `CollectionData` 同样加 editorial，新增 advisory（非 blocking）信号：editorial 完整度评分（4 字段中几非空），低于 2/4 标 advisory。
- 输出 JSON 形态保持向后兼容（仅加新 code/字段）。

## 5. linkingRules 运行时断言 (新增 helper)
`src/lib/authority-surfaces.ts` 加函数 `assertLinkingRulesCompliance(surfaces)`（dev-only，runtime 跳过）：
- `collections-need-next-steps`：每个 collection surface 的 `[...slug].astro` 渲染至少 1 条 nextStep 进 docs/solutions（数据来源：collection JSON 的 `editorial.nextSteps`）。在 collection detail 页 frontmatter 调用，若违例 console.warn（dev），不抛错。
- 仅是观测，不阻塞渲染（避免 SSR 路径崩）。
- 价值：把 manifest 的声明性 rules 第一次接入 runtime，作为可观测信噪。

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| manifest backfill 引入 Tier 滥调（一切 P1） | 默认 P1；P0/featured 仅在 collection JSON `featured:true` 时考虑；报告列出每个 surface 的 tier 推荐理由供人工审 |
| 生成器导致 `authority-surface-public-data.ts` 漂移性，CI 红灯 | 生成器在 `sync:*` npm script 中显式调用，CI 跑生成器后 `git diff --exit-code` 检查产物一致 |
| `groupingLogic` 文案被 `INTERNAL_PUBLIC_COPY_PATTERN` 剥空 | 写文案时主动避开屏蔽词列表；新增单测断言 groupingLogic 文案非空 |
| `seo-collection-frontmatter-guard` 误报 collection slug 里的 "top" 词 | 规则只校验 `keywords` 字段，不校验 slug；slug "top-*" 前缀是品牌惯例 |
| manifest 补齐扩到 ~35 collection 后 validate 扩容拖慢 CI | validate 当前是 P0 hardcode 4 个 surface，扩到 manifest 当前 P0+P1 collection（17 个，backfill 后约 30+）；用并发 fetch + 超时 10s，估时增 <30s 可接受 |
| `INTERNAL_PUBLIC_COPY_PATTERN` 在 i18n 段触发 | 沿用现有 `polishCollectionPublicText` 调用，文案走同 sanitization 流 |

## 7. 验证与成功信号

- `scripts/sync-authority-surface-public-data.ts` 跑后 `authority-surface-public-data.ts` 与 manifest 一致；`authority-surfaces.test.ts` 通过。
- `scripts/seo-collection-frontmatter-guard.ts` 跑后 34 collection violations=0（新内容若不达标，guard 标出来由人修，不自动改）。
- `scripts/seo-structured-data-validate.ts` 覆盖 manifest 内全部 P0+P1 collection，无 missing schema。
- `groupingLogic` 在至少 1 个已有该字段的 collection 上（如 `top-official-mcp-servers.json`）渲染可见。
- collections hub 渲染两个新段，en+zh 都不空。
- `SkillRelated.astro` 派生的 authority entry 全部能在 `authoritySurfacePublicData` 找到（新单测）。
- `linkingRulesCompliance` 在 dev 跑 spice 路径时无违例 console.warn。
- `data/authority-surfaces.json` 经 backfill 后 report 列出 ~16 候选的纳入/推迟清单，人工阅后 commit。

## 8. 交付物清单

新增文件：
- `scripts/sync-authority-surface-public-data.ts`
- `scripts/seo-collection-frontmatter-guard.ts`
- `scripts/backfill-authority-surface-collections.ts`
- `scripts/lib/seo-collection-frontmatter-guard.ts`（rules 复用主体）
- `src/lib/authority-linking-rules.ts`（linkingRulesCompliance helper）
- 重写产物 `src/lib/authority-surface-public-data.ts`（生成化）
- `src/lib/authority-surfaces.test.ts` 新断言 / 或新 `skill-related-authority-paths.test.ts`
- i18n 键 `"Collections.whenToUseCurated"` / `"Collections.directorySecondary"` 等
- 构建产物报告 `reports/seo/latest-collection-frontmatter-guard.{json,md}` / `latest-authority-surface-backfill.{json,md}`

修改文件：
- `data/authority-surfaces.json`（backfill 后 surface 数 ~35）
- `scripts/seo-structured-data-validate.ts`
- `scripts/lib/seo-collection-drift.ts`、`scripts/seo-collection-quality-audit.ts`（editorial 字段）
- `src/pages/[locale]/collections/[...slug].astro`（groupingLogic 段）
- `src/pages/[locale]/collections/index.astro`（两个新段）
- `src/components/SkillRelated.astro`（读 manifest）
- `src/lib/authority-surfaces.ts`（assertLinkingRulesCompliance）
- `package.json`（新 npm scripts）

## 9. 实施顺序（含 gate）

1. manifest backfill（含人工审核）→ commit `data/authority-surfaces.json`
2. sync-authority-surface-public-data generator + 测试通过 → commit
3. seo-collection-frontmatter-guard + 修不达标 collection → commit
4. seo-structured-data-validate 扩展 manifest 派生 → commit
5. SkillRelated 改读 manifest + 测试 → commit
6. linkingRulesCompliance helper + collection detail 调用 → commit
7. collections hub 两段 i18n + 渲染 → commit
8. groupingLogic 渲染段 → commit
9. drift/quality-audit editorial 字段扩展 → commit

每步独立可回退；步骤 1 与 9 可人工执行后 commit，其余自动化。

## 10. 不在本 spec 决定的事项

- 是否新增 `/policy` 或 `/editorial` 集中页（留 Phase 2）
- `reviewedBy`/`curatedAt` schema 扩展（留 Phase 2）
- collection↔collection 关系图化（留 Phase 2）
- 跨 locale hreflang 策略调整（不在本 phase 触碰）
