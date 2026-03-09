---
description: Add a new blog post and automatically translate it to all languages
---

# /add-blog — 发布新博客文章工作流

> 创建英文文章 → SEO 校验 → 自动翻译 → 同步元数据 → 提交索引。

## 步骤 1：创建英文博客文章

在 `src/content/blog/en/` 下创建 `[slug].md`：

```markdown
---
title: "Your SEO-Optimized Title Here"
description: "Compelling meta description, 120–158 chars for SEO (too short hurts CTR; run: npx tsx scripts/audit-blog-meta-descriptions.ts)."
pubDate: 2026-03-09
author: "Killer-Skills Team"
heroImage: "/blog/your-hero-image.webp"
tags: ["ai-agents", "mcp-servers"]
featured: false
draft: false
lang: "en"
layout: "~/layouts/BlogLayout.astro"
---

# Your Content Here
```

### 内容要求

- 正文中每 200-300 字插入一个**内链**到 skill 页面（`[Name](/en/skills/owner/repo/)`）
- 用 `##` 分隔段落（TOC + 翻译分块）
- 首段简洁有力，适合被 AI 引用（GEO 优化）

## 步骤 2：SEO Checklist

发布前逐项确认：

- [ ] **Title** ≤ 60 字符
- [ ] **Description** 120–158 字符（过短会触发 SEO 告警；发布前可运行 `npx tsx scripts/audit-blog-meta-descriptions.ts` 审计）
- [ ] Title/Description 含目标关键词
- [ ] 正文含 ≥ 3 个内链到 skill/collection 页面
- [ ] heroImage 存在于 `public/blog/` 下
- [ ] tags 用已有分类：`creative-tools`, `document-automation`, `enterprise-solutions`, `developer-experience`
- [ ] 代码块和技术术语标记清晰（不被翻译）

## 步骤 3：翻译到 9 种语言

// turbo
```bash
npm run translate:blog -- --slug=YOUR_SLUG_HERE
```

## 步骤 4：同步元数据

// turbo
```bash
npx tsx scripts/sync-blog-everything.ts
```

## 步骤 5：本地验证

// turbo
```bash
npx astro check 2>&1 | tail -5
```

然后 `npm run dev` 预览各语言渲染。

## 步骤 6：部署 & 提交索引

```bash
npm run deploy
```

// turbo
```bash
npm run submit:indexnow
```

## 🚨 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 翻译后 title 仍为英文 | 已存在同名文件 | 删除旧文件或 `FORCE_TRANSLATE=true` |
| heroImage 404 | 图片不在 `public/blog/` | 移到正确路径 |
| 内链 404 | 缺少 trailing slash | 确保格式 `/en/skills/owner/repo/` |
