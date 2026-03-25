---
title: "AI 智能体技能是什么，它们为什么重要？"
description: "AI 智能体技能是可复用的 SKILL.md 指令文件，告诉 Claude Code、Cursor 和 Windsurf 等 AI 编码助手如何执行特定工作。了解它们是什么、如何工作以及何时真正有帮助。"
pubDate: 2026-02-23
author: "Killer-Skills Team"
tags: ["AI Agent Skills", "SKILL.md", "Claude Code", "Cursor", "Developer Tools", "Automation"]
lang: "zh"
featured: true
category: ""
heroImage: ""
---

# 什么是 AI 智能体技能？

你是否曾要求你的 AI 编码助手“为这个模块编写测试”，结果它却写出了一些完全通用、忽略了你项目独特架构的东西？
## 什么是 AI 智能体技能？

**AI 智能体技能** 是一种专门的 Markdown 文件（通常命名为 `SKILL.md`），它为像 Claude、Cursor 和 Windsurf 这样的编码助手提供特定领域的指令。通过将这些文件放置在您的项目目录中，智能体可以自动学习您特定的约定、工作流程和规则，而无需重复提示。

<Info title="您将在本指南中学到什么">
* AI 智能体技能在实际中是如何运作的
* 针对不同 IDE（Claude、Cursor、Windsurf）放置技能文件的位置
* 技能最有效的理想使用场景
* 如何通过 CLI 安装社区技能
* 编写您自己自定义技能的最佳实践
</Info>

```text
.claude/skills/
  testing/SKILL.md       # 如何在此项目中编写测试
  deployment/SKILL.md    # 部署清单和配置
  code-review/SKILL.md   # 在代码审查中需要注意什么
```

当相关主题出现时，智能体会读取该文件，然后遵循这些指令，而不是进行猜测。
## 它们实际上是如何工作的

这里没有什么魔法。一个技能文件包含两个部分：

1. **Frontmatter**：包含名称和描述（以便智能体知道何时加载它）
2. **Instructions**：用纯 Markdown 编写的说明（即实际的知识）

以下是一个经过精简的真实示例：

```yaml
---
name: testing
description: How to write and run tests in this project
---
```

```markdown
# 本项目中的测试

我们使用 Vitest。通过 `npm test` 运行测试。

规则：
- 每个新函数至少需要一个测试
- 模拟外部 API，切勿在测试中调用真实 API
- 将测试文件与源码放在一起：`utils.test.ts` 与 `utils.ts` 并列放置
```

这就是完整的格式。智能体加载此文件，读取说明，并相应地改变其行为。无需 SDK，无需 API 调用，除了文件本身之外无需任何配置。
## 技能运行之处

目前，已有多个编程智能体支持 SKILL.md 文件或类似功能：

| 智能体 | 技能位置 | 运行机制 |
|-------|---------------|--------------|
| Claude Code | `.claude/skills/` | 根据上下文自动读取技能 |
| Cursor | `.cursor/rules/` | 项目级规则文件 |
| Windsurf | `.windsurfrules` | 项目根目录的单一规则文件 |
| GitHub Copilot | `.github/copilot-instructions.md` | 仓库级指导文件 |

格式正趋于统一。为 Claude 编写的技能通常只需稍作路径调整即可在 Cursor 中使用。
## 技能真正适用的场景（以及不适用的场景）

技能非常适用于 AI 无法自行推断的**项目特定规范**。例如：

- 您的部署流程包含 6 个步骤，其中两个步骤需要手动审批
- 您的团队在所有代码中都使用特定的错误处理模式
- 数据库查询需要通过某个抽象层进行处理
- 测试应遵循特定的命名约定

当任务通用性足够强，任何合格的开发人员（或 AI）都会以相同方式处理时，技能的作用就不明显。您不需要为“如何编写 for 循环”这样的操作专门配置技能。

最佳适用场景是那些存在于团队集体知识中但尚未形成文档的规范。技能迫使您将其文档化，而后 AI 也能遵循这些规范。
## 寻找立即可用的技能

您可以完全从零开始编写自己的技能，但针对常见任务，社区也提供了现成的技能：

- **docx** - 生成和编辑 Word 文档
- **pdf** - 读取、合并、拆分及创建 PDF 文件
- **xlsx** - 处理电子表格和公式
- **mcp-builder** - 为智能体集成构建 MCP 服务器
- **frontend-design** - 创建精美的网页界面

只需一条命令即可安装它们：

```bash
npx killer-skills add anthropics/skills/pdf
```

这会将 `SKILL.md` 文件复制到您项目的 `skills` 目录中。智能体将在下一次对话时自动识别并使用它。
## 编写专属技能

最好的技能往往源于挫败感。当你的 AI 助手反复犯同一个错误时，这就是需要为其创建技能的明确信号。

从简单的开始。针对某个具体场景写下十行规范：「在本项目中编写 API 路由时，请始终使用我们的 `withAuth` 包装器并按指定格式返回错误」。这短短一条指令就能避免你每次手动纠正 AI 助手。

随着规则不断补充，这个文件会逐渐扩展。我们内部一些最实用的技能最初只是五行的简短说明，后来逐渐发展成完整的参考文档。
## 下一步计划

技能功能仍处于早期阶段。不同智能体之间的格式尚未标准化，错误处理机制较为原始，可发现性也有限。但核心理念（为你的 AI 助手提供关于项目的书面指令）将会持续存在。

如果你想浏览现有技能或发布自己的技能，请查看[技能目录](/zh/skills)。目前已有超过2,500个社区贡献的技能，涵盖从数据库管理到UI设计的各个领域。

---

*相关阅读：[如何通过智能体技能构建 MCP 服务器](/zh/blog/how-to-build-mcp-servers-with-agent-skills) 和 [创建自定义 AI 智能体技能](/zh/blog/create-custom-ai-agent-skills)*