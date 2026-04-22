---
title: '如何在30秒内安装AI代理技能'
description: '一个快速指南，使用killer-skills CLI工具将社区AI代理技能安装到Claude Code、Cursor或Windsurf中'
pubDate: 2026-02-24
author: 'Killer-Skills Team'
tags: ['Tutorial', 'AI Agent Skills', 'CLI', 'Developer Tools', 'Automation']
lang: 'zh'
featured: false
category: 'guides'
heroImage: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop'
---

# 如何安装 AI 代理技能

您找到了一种想要使用的 AI 代理技能。也许是 [docx 自动化技能](/en/skills/anthropics/skills/docx)，或者是一种专门的前端 UI 生成器。现在，您需要将其添加到您的项目中，以便您的编码代理可以实际读取它。

您可以手动复制和粘贴 markdown 文本，创建正确的目录，并自己修复前置格式。或者，您可以运行一条命令来为您完成这些操作。

## 杀手级技能 CLI

我们专门为此构建了一个命令行工具。它可以处理从 GitHub 获取技能、将其转换为适合您的 IDE（Claude Code、Cursor、Windsurf 或 GitHub Copilot）的正确格式，并将其放置在正确的目录中。

您不需要永久安装它。您可以直接通过 `npx` 运行它（它随 Node.js 一起提供）。

打开您的终端，转到您的项目目录，并运行：

```bash
npx killer-skills add owner/repo
```

例如，要安装 PDF 自动化技能，您可以运行：

```bash
npx killer-skills add anthropics/skills/pdf
```

CLI 通过检查您的项目文件来检测您正在使用哪个 IDE。如果它看到一个 `.cursor` 目录，它会将技能格式化为 `.mdc` 文件。如果它看到一个 `.claude` 目录，它会将其格式化为 `SKILL.md`。

## 在多个IDE中安装

如果您在同一个项目中使用多个代理（例如，在终端中使用Claude Code和在编辑器中使用Cursor），您可以强制CLI同时为所有代理安装技能。

只需添加`--all`标志：

```bash
npx killer-skills add anthropics/skills/pdf --all
```

这将在`.claude/skills/`和`.cursor/rules/`中创建必要的文件，同时保持核心指令的相同性，并为每个代理正确格式化元数据。

## 查找要安装的技能

如果您知道自己要找什么，但记不住确切的仓库路径，您可以直接从终端搜索：

```bash
npx killer-skills search auth
```

这会查询社区数据库并返回最匹配的结果，包括它们的星级数和完整的安装路径。您也可以浏览完整的开源目录，位于 [Killer-Skills 网站](/zh/skills)。

## 更新技能

技能会演变。作者会添加新的边缘情况，修复不良的指令，并提高提示的可靠性。由于您通过 CLI 安装了技能，因此可以同样轻松地更新它。

```bash
npx killer-skills update
```

这会检查您安装的所有技能，将其与 GitHub 上的上游源进行比较，并在可能的情况下应用任何更新，同时保留本地修改。

## 实际发生了什么？

当你运行 `add` 命令时，CLI 并没有安装可执行软件或 npm 依赖项。它只是下载文本。

一个技能只是一个包含大型语言模型指令的 Markdown 文件。CLI 获取该 Markdown 文件，将其封装在你的编辑器期望的特定 YAML 或 JSON 格式中，并将其写入本地文件夹。

没有后台进程，没有电话主机遥测，也没有隐藏有效载荷。它只是文档，放置在你的 AI 代理知道去寻找它的地方。

---

- 相关：[什么是 AI 代理技能？](/zh/blog/what-are-ai-agent-skills) 和 [2026 年最佳 AI 代理技能](/zh/blog/best-ai-agent-skills-2026) \*
