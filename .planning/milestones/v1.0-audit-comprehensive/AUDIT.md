# 全面审查报告 — Killer-Skills i18n / SEO / 代码质量

**审查日期**: 2026-03-31  
**审查范围**: src/pages, src/lib, src/components, src/layouts, src/messages, scripts

---

## 📊 审查总结

### ✅ 已完成（本次 i18n 重构）
- 8 个页面文件的 `isZh` 三元逻辑 → `tr()` 翻译系统：`categories`, `cli`, `integrations`, `labs/skill-try`, `docs/[...slug]`, `solutions`, `blog/index`, `blog/category`
- `zh.json` 新增 7 个命名空间：`CLI`, `Categories`, `IntegrationsPage`, `Labs`, `Docs`, `Solutions`, `BlogIndex`, `BlogCategory`
- 修复 `blog/category` 中 `buildKeywordString` 和 `getBlogIntentLinks` 参数缺失的预存 bug
- 合并 `zh.json` 中重复的 `Docs` 和 `Solutions` key 块

---

## 🔴 P0 — 翻译文件严重不同步

| 语言 | Key 数量 | 缺失 (vs en) | 多出 (vs en) |
|------|---------|-------------|-------------|
| en   | 666     | 基线         | 基线         |
| zh   | 797     | 0           | **131** ❗   |
| hi   | 181     | **485** ❗   | 0           |
| ar   | 487     | **179** ❗   | 0           |
| de   | 666     | 0           | 0           |
| es   | 666     | 0           | 0           |
| fr   | 666     | 0           | 0           |
| ja   | 666     | 0           | 0           |
| ko   | 666     | 0           | 0           |
| pt   | 666     | 0           | 0           |
| ru   | 666     | 0           | 0           |

### 问题分析
1. **zh.json 有 131 个独有 key**：这些是本次重构新增的翻译（CLI/Categories/Docs/Solutions/Labs/BlogIndex/BlogCategory），但 `en.json` 和其他 8 个语言文件完全没有对应
2. **hi.json 缺失 485 个 key（73%）**：仅包含 Blog/Category/Detail/Query/Seo 5 个 namespace
3. **ar.json 缺失 179 个 key（27%）**：缺失 Category/Query/Seo/Blog.categories 等大量 key
4. **反复覆盖问题的根源**：没有 "单一来源 → 自动同步" 机制，每次修改 zh.json 都需要手动同步到 10 个文件

---

## 🟡 P1 — lib 层仍有硬编码双语逻辑

3 个 lib 文件仍然使用 `locale === 'zh'` 硬编码逻辑：

| 文件 | 行号 | 逻辑 |
|------|------|------|
| `src/lib/category-taxonomy.ts` | 158 | `locale === 'zh' ? def.seoDescription.zh : def.seoDescription.en` |
| `src/lib/skill-try-profiles.ts` | 122 | `locale === 'zh' ? text.zh : text.en` |
| `src/lib/solution-intents.ts` | 210 | `locale === 'zh' ? text.zh : text.en` |

这些文件的模式是：数据结构内部已经有 `{ en: ..., zh: ... }` 的值，但取值逻辑只判断 zh/en 两种。对于其他 8 个语言（de/es/fr/ja/ko/pt/ru/ar/hi），都会 fallback 到英文。

---

## 🟡 P2 — scripts 层双语硬编码

6+ 个 scripts 文件使用 `locale === 'zh'` 硬编码：

| 文件 | 问题 |
|------|------|
| `scripts/fill-collection-locale-metadata.ts` | 只为 zh 生成定制标题/描述 |
| `scripts/generate-longtail-collections.ts` | 只为 zh 生成定制的长尾标题/描述/关键词 |
| `scripts/enrich-collections.ts` | 硬编码 `['zh', 'ja', 'ko']` |
| `scripts/clean-broken-skills.js` | 硬编码 `['zh', 'ja', 'ko']` |

---

## 🟡 P3 — SEO 关键词布局问题

### 当前状态
- `buildKeywordString` 从消息文件的 `Seo.keywordClusters.*` 读取翻译关键词
- 但只有 en/zh 两个语言有完整的 SEO 关键词定义
- 其他 8 个语言的关键词实际上是 en 的 fallback，无法为各语种用户提供本地搜索优化

### 覆盖问题
- `Solutions.faq2Q/A` 和 `Solutions.faq3Q/A` 在旧版和新版含义不同（旧版是技能详情页的 FAQ，新版是解决方案首页的 FAQ），合并后旧版的被覆盖了

---

## 🟢 P4 — 代码质量观察

### 已解决
- `src/components/` — 零 `isZh` 残留 ✅
- `src/layouts/` — 零 `isZh` 残留 ✅
- `src/lib/` — 零 `isZh` 残留（仅 `locale === 'zh'` 模式） ✅

### 合理保留
- `src/pages/api/skills/try.ts` — API 层，不是 UI 文案
- `src/pages/[locale]/skills/[owner]/[...repo].astro` — 列表分隔符格式化（`、` vs `, `）
- `src/lib/nvidia.ts` — AI 翻译 prompt，需要判断目标语言名
- `src/lib/skills.ts:57` — 多语言 fallback 链，合理

---

## 📋 行动计划

### Phase A: 翻译基础设施（防止反复覆盖）
1. **A1**: 将 zh.json 的 131 个独有 key 同步到 `en.json`（英文默认值）
2. **A2**: 编写 `scripts/sync-translations.ts` 自动同步脚本，以 en.json 为基线，自动为缺失 key 填入英文默认值
3. **A3**: 补全 hi.json（485 个缺失 key）和 ar.json（179 个缺失 key）
4. **A4**: 在 CI/build 中加入 key 一致性检查 gate

### Phase B: lib 层 locale 逻辑优化
1. **B1**: `category-taxonomy.ts` / `skill-try-profiles.ts` / `solution-intents.ts` 改为通用 locale 查找（`text[locale] || text['en']`）
2. **B2**: 为 10 个 locale 数据结构扩展翻译值

### Phase C: SEO 关键词深度优化
1. **C1**: 为 ja/ko/de/es/fr/pt/ru/ar/hi 补充本地化 SEO 关键词集群
2. **C2**: 优化 `buildKeywordString` 支持更灵活的 locale-specific 关键词生成
3. **C3**: 检查 meta description 在各 locale 下的质量

### Phase D: Scripts 层清理
1. **D1**: `fill-collection-locale-metadata.ts` 和 `generate-longtail-collections.ts` 改为从消息文件读取
2. **D2**: 统一 locale 列表引用为 `SUPPORTED_LOCALES` 常量
