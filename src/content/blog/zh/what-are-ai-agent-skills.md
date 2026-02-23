---
title: "什么是 AI Agent 技能？为什么你应该了解它"
description: "AI Agent 技能是可复用的指令文件，告诉 Claude、Cursor、Windsurf 等编程代理如何做特定工作。本文介绍它们的工作原理和适用场景。"
pubDate: 2026-02-23
author: "Killer-Skills Team"
tags: ["AI Agent Skills", "SKILL.md", "Claude Code", "Cursor", "开发者工具", "自动化"]
lang: "zh"
featured: true
category: "guides"
heroImage: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=2560&auto=format&fit=crop"
---

# 什么是 AI Agent 技能？

你打开 IDE，让 Agent 帮你"给这个模块写测试"，结果它写了一堆不了解你项目结构的通用代码。是不是很熟悉？

AI Agent 技能可以解决这个问题。技能就是一个 Markdown 文件（通常叫 `SKILL.md`），放在你的项目里，给编程 Agent 提供领域专属的指令。你可以把它理解成新人入职文档，只不过读者是你的 AI 助手。

```
.claude/skills/
  testing/SKILL.md       # 本项目的测试规范
  deployment/SKILL.md    # 部署清单和配置
  code-review/SKILL.md   # 代码审查要点
```

Agent 在遇到相关话题时会读取这个文件，然后按照文件里的指令行事，而不是自己瞎猜。

## 工作原理

没什么黑魔法。一个技能文件就两部分：

1. **Frontmatter** — 写上名称和描述（让 Agent 知道什么时候该加载它）
2. **指令正文** — 用普通 Markdown 写的知识内容

看个实际例子：

```yaml
---
name: testing
description: 本项目的测试编写和运行方式
---
```

```markdown
# 本项目的测试规范

我们用 Vitest。运行测试用 `npm test`。

规则：
- 每个新函数至少要有一个测试
- 外部 API 一定要 mock，测试里不能真调
- 测试文件放在源码旁边：`utils.test.ts` 紧挨着 `utils.ts`
```

就这么简单。Agent 加载这个文件，读完指令，行为就会相应改变。不用装 SDK，不用调 API，除了这个文件本身不需要任何配置。

## 哪些 Agent 支持技能

目前支持 SKILL.md 或类似功能的编程 Agent：

| Agent | 技能文件位置 | 加载方式 |
|-------|-------------|---------|
| Claude Code | `.claude/skills/` | 根据上下文自动加载 |
| Cursor | `.cursor/rules/` | 项目级规则文件 |
| Windsurf | `.windsurfrules` | 项目根目录单文件 |
| GitHub Copilot | `.github/copilot-instructions.md` | 仓库级指令 |

格式正在趋同。为 Claude 写的技能文件，改个路径一般就能在 Cursor 里用。

## 什么时候该用技能（什么时候不必要）

技能最擅长处理的是**项目特有的约定**，就是那些 AI 自己猜不到的东西：

- 你的部署流程有 6 步，其中两步需要手动审批
- 团队里所有人都用同一种错误处理模式
- 数据库查询必须走某个抽象层
- 测试命名有特定规范

如果任务足够通用，任何靠谱的开发者（或 AI）都会用同样的方式处理，这时候不需要技能文件。你不需要为"怎么写 for 循环"写一个技能。

最有价值的是那些存在于团队成员脑子里但从来没有写下来的知识。技能文件迫使你把它们文档化，之后 AI 也能遵守。

## 找到可以直接用的技能

你可以从零开始写自己的技能，也可以使用社区已有的技能：

- **docx** — 生成和编辑 Word 文档
- **pdf** — 读取、合并、拆分和创建 PDF
- **xlsx** — 操作电子表格和公式
- **mcp-builder** — 构建 Agent 集成的 MCP 服务器
- **frontend-design** — 创建精致的 Web 界面

一行命令就能安装：

```bash
npx killer-skills add anthropics/skills/pdf
```

这会把 SKILL.md 文件复制到你项目的技能目录里。下次对话时 Agent 就会自动识别。

## 写你自己的技能

好的技能往往来自挫败感。当你的 Agent 反复犯同一个错误，这就是你需要一个技能文件的信号。

从小处开始。写 10 行关于一件具体事情的说明。比如"在本项目写 API 路由时，一定要用 `withAuth` 包装器，错误信息用这个格式返回。"就这一条指令，就能让你不用每次都纠正 Agent。

随着时间推移，文件会逐渐变长。我们自己最好用的一些内部技能，最初只是 5 行笔记，后来长成了完整的参考文档。

## 后续发展

技能还处于早期阶段。格式还没有在所有 Agent 间完全统一，错误处理比较原始，发现机制也有限。但核心想法——给你的 AI 助手提供关于你项目的书面说明——这个方向不会变。

如果你想浏览现有技能或发布自己的技能，去看看[技能目录](/zh/skills)。目前已有超过 1,000 个社区贡献的技能，涵盖数据库管理到 UI 设计的各种场景。

---

*相关阅读：[如何用 Agent 技能构建 MCP 服务器](/zh/blog/how-to-build-mcp-servers-with-agent-skills) 和 [创建你自己的 AI Agent 技能](/zh/blog/create-custom-ai-agent-skills)*
