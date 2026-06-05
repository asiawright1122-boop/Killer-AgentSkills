# Collections Quality Checklist (合集内容质量准入清单)

为了保证 Killer-Skills 平台 JSON 合集（Collections）的品质、SEO 权重和前端渲染正确性，所有位于 `src/content/collections/` 下的合集文件必须满足以下质量与准入标准。

---

## 1. 基础规范

- **合集文件格式**：必须为标准 JSON 文件，以 `.json` 结尾。
- **字段完整性**：
  - 必须包含 `title`、`description`、`seoTitle`、`seoDescription`、`keywords`、`skills`、`longDescription` 和 `editorial` 等必要字段。
  - 各多语言文本字段（例如 `title`、`description` 等）必须至少提供英文 (`en`) 和中文 (`zh`) 版本，推荐同时包含其他支持的语言。

---

## 2. 文本长度与 SEO 指标

- **Description (简介)**：
  - 英文版 (`description.en`) 长度应在 **30 至 300 字符**之间。
  - 中文版 (`description.zh`) 长度应在 **15 至 150 字符**之间。
  - 必须包含核心关键词且语义通顺，避免单纯堆砌。
- **Long Description (详细描述)**：
  - 英文版 (`longDescription.en`) 长度至少应为 **50 字符**，以确保页面有充足的文本内容用以 SEO 抓取与用户理解。

---

## 3. 技能列表 (Skills) 规范

- **技能引用格式**：
  - `skills` 数组内的每一项必须是合规的仓库标识名（例如 `"cloudflare/skills"`），或者是直接对应的 Skill ID（例如 `"affaan-m/everything-claude-code/prompt-optimizer"`）。
  - **禁止** 包含未同步到缓存中的失效子路径、未注册的私有仓库或不存在的 GitHub 仓库。
- **缓存存在性验证**：
  - 合集内引用的所有技能，必须在 `data/skills-cache.json` 中存在。
  - 审计逻辑中，应能匹配 cache 对象的 `repo` 字段，或者匹配 cache 对象的 `id`，或作为 `id` 的父路径前缀（例如 `colSkill + "/"` 匹配 `colSkill/sub-skill`）。
- **去重性**：
  - 单个合集内 `skills` 数组的成员不能有重复项（不区分大小写）。

---

## 4. 相似度与重合度控制 (Jaccard Overlap)

- 为了防止内容同质化并提高 SEO 页面独特性，任意两个合集之间的 **Jaccard 相似度 (技能重合度) 必须低于 80%**。
- **特例豁免**：
  - `top-claude-code-skills.json` 与 `top-windsurf-skills.json` 因服务于不同的特定 IDE SEO 入口，允许有 83% 的重合度。除此之外的所有合集对均不享受豁免。

---

## 5. 准入审计机制

- 任何合集的修改或新增，必须在提交流程前运行以下审计脚本进行自动校验：
  ```bash
  npx tsx scripts/seo-collection-quality-audit.ts
  ```
- 审计失败（退出码为 `1`）时，禁止合入代码仓库。
