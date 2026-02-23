---
title: "如何在 30 秒内安装 AI Agent 技能"
description: "使用 killer-skills 命令行工具，将社区的 AI Agent 技能快速安装到 Claude Code、Cursor 或 Windsurf 中的简明指南。"
pubDate: 2026-02-24
author: "Killer-Skills Team"
tags: ["教程", "AI Agent Skills", "CLI", "开发者工具", "自动化"]
lang: "zh"
featured: false
category: "guides"
heroImage: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop"
---

# 如何安装 AI Agent 技能

你找到了一个想用的 AI Agent 技能。可能是一个 [docx 自动化技能](/zh/skills/anthropics/skills/docx)，也可能是一个专门的前端 UI 生成器。现在你需要把它放进你的项目里，这样你的编程 Agent 才能读到它。

你可以手动复制粘贴 Markdown 文本，自己建好对应的目录，再修好 frontmatter 格式。或者你可以运行一条命令，让它帮你全搞定。

## killer-skills CLI 工具

我们专门为此做了一个命令行工具。它负责从 GitHub 拉取技能，转换成你的 IDE（Claude Code、Cursor、Windsurf 或 GitHub Copilot）认识的格式，然后放到正确的目录里。

你不需要永久安装它。可以直接用 `npx`（Node.js 自带）运行打包。

打开终端，进入你的项目目录，运行：

```bash
npx killer-skills add <owner>/<repo>/<skill-name>
```

比如，要安装 PDF 自动化技能，你运行：

```bash
npx killer-skills add anthropics/skills/pdf
```

这个工具会看你的项目文件来判断你在用哪个 IDE。如果它看到一个 `.cursor` 目录，就把技能格式化成 `.mdc` 文件。如果看到 `.claude` 目录，就格式化成 `SKILL.md`。

## 在多个 IDE 里同时安装

如果你的项目里同时在用多个 Agent（比如终端里用 Claude Code，编辑器用 Cursor），你可以强制 CLI 一次性为它们全部安装该技能。

只要加上 `--all` 参数：

```bash
npx killer-skills add anthropics/skills/pdf --all
```

这会在 `.claude/skills/` 和 `.cursor/rules/` 里都创建必要的文件，核心指令完全一样，但给每个 Agent 的元数据格式都对。

## 查找要安装的技能

如果你知道想找什么，但不记得具体的仓库路径了，你可以直接在终端里搜：

```bash
npx killer-skills search auth
```

这会查询社区数据库并返回最匹配的结果，包括具体 Star 数和完整的安装路径。你也可以在 [Killer-Skills 网站](/zh/skills) 上浏览完整的开源目录。

## 保持技能更新

技能是会进化的。作者们会添加新的边缘情况处理、修复不好的指令、提高提示词的可靠性。因为你是通过 CLI 安装的，所以更新起来同样简单。

```bash
npx killer-skills update
```

这会检查你安装过的所有技能，和 GitHub 上的源文件对比。在尽可能保留本地修改的同时，应用所有的更新。

## 底层到底发生了什么？

当你运行 `add` 命令时，CLI 并没有在装什么可执行软件或 npm 依赖。它只是在下载文本文件。

技能文件本质上就是包含大语言模型要求的说明 Markdown 文件。CLI 把那个 Markdown 拉下来，包上你的编辑器期望的那层 YAML 或 JSON 格式，然后写进本地文件夹。

没有后台进程，没有搜集隐私偷偷上传，没有隐藏代码。就是普通的文档，只是恰好放进了你的 AI Agent 知道去读的地方。

---

*相关阅读：[什么是 AI Agent 技能？](/zh/blog/what-are-ai-agent-skills) 和 [2026 年最佳 AI Agent 技能](/zh/blog/best-ai-agent-skills-2026)*
