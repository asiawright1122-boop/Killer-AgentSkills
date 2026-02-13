---
title: "如何构建 MCP 服务器：使用 Agent Skills 的完整指南"
description: "了解如何使用官方 mcp-builder 技能为 AI Agent 构建生产级 MCP 服务器。涵盖 TypeScript 和 Python 的设置、工具设计、测试和部署。"
pubDate: 2026-02-13
author: "Killer-Skills 团队"
tags: ["MCP", "教程", "Agent Skills", "Claude Code"]
lang: "zh"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# 如何构建 AI Agent 真正会用的 MCP 服务器

如果你的 AI 编程助手不仅能写代码，还能发送 Slack 消息、查询数据库、部署到生产环境，并管理你的整个 DevOps 流水线——这一切都通过一个标准的协议实现，那会怎样？

这正是 **MCP 服务器**（Model Context Protocol）所实现的。借助于 Anthropic 官方技能库中的 **mcp-builder** 技能，你可以在几分钟内构建出生产级的 MCP 服务器，而不是花费数小时。

```bash
# 一键安装 mcp-builder 技能
npx killer-skills add anthropics/skills/mcp-builder
```

在本指南中，你将了解构建 MCP 服务器所需的一切知识——从理解协议到部署你的第一个服务器。

## 什么是 MCP 服务器？

**MCP 服务器** 是一种标准化的服务，它向 AI Agent 暴露工具（Tools）、资源（Resources）和提示词（Prompts）。你可以把它看作是 AI 助手与现实世界（数据库、API、文件系统、云服务等）之间的桥梁。

**Model Context Protocol** (MCP) 由 Anthropic 创建，旨在解决一个根本问题：AI Agent 需要一种通用的方式与外部服务交互。在 MCP 出现之前，每次集成都需要编写自定义代码。现在，一个协议就能搞定一切。

为什么 MCP 如此重要：

- **通用兼容性** —— 适用于 Claude, Cursor, Windsurf 以及任何兼容 MCP 的客户端
- **标准化的接口** —— 工具、资源和提示词遵循一致的 Schema
- **安全优先设计** —— 内置身份验证、输入验证和权限控制
- **可组合的工作流** —— Agent 可以将多个 MCP 工具链接在一起

## 为什么使用 mcp-builder 技能？

**mcp-builder** 技能是 Anthropic 官方库中最强大的技能之一。它通过提供以下功能，将 Claude 转变为专业的 MCP 服务器开发专家：

1. **深度的协议知识** —— 该技能加载了完整的 MCP 规范，因此 Claude 了解每一个细节
2. **内置最佳实践** —— 工具命名、错误处理和分页模式都已预先配置
3. **框架特定指南** —— 针对 TypeScript 和 Python 优化的模板
4. **评估生成** —— 为你的 MCP 服务器自动创建测试套件

与从头开始构建不同，mcp-builder 技能遵循一个结构化的 4 阶段工作流：

| 阶段 | 发生什么 |
|:------|:-------------|
| **阶段 1：调研** | 研究 API，规划工具覆盖范围，设计 Schema |
| **阶段 2：构建** | 实现具有正确错误处理和身份验证的服务器 |
| **阶段 3：评审** | 测试所有工具，验证响应，检查边缘情况 |
| **阶段 4：评估** | 创建自动化评估以验证质量 |

## 快速入门：构建你的第一个 MCP 服务器

### 第一步：安装技能

首先，确保你已经安装了 Killer-Skills CLI：

```bash
npm install -g killer-skills
```

然后将 mcp-builder 技能添加到你的项目中：

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

该技能将被添加到你的 `.claude/skills/` 目录中，并在 Claude 检测到 MCP 服务器开发任务时自动激活。

### 第二步：选择你的技术栈

mcp-builder 技能支持两种主要技术栈：

**TypeScript (推荐)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

推荐使用 TypeScript 的几个原因：
- 来自 MCP 官方团队的高质量 SDK 支持
- 静态类型在运行前捕获错误
- 与执行环境的强兼容性
- AI 模型非常擅长生成 TypeScript 代码

**Python**
```bash
pip install mcp pydantic
```

如果你的团队已经在使用 Python，或者你要集成的 API 偏重于 Python，那么 Python 也是一个不错的选择。

### 第三步：定义你的工具

一个好的 MCP 服务器的关键在于设计良好的工具。这是一个模板：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "在系统中创建一个新项目",
  {
    name: z.string().describe("要创建的项目名称"),
    description: z.string().optional().describe("可选描述"),
    tags: z.array(z.string()).optional().describe("分类标签"),
  },
  async ({ name, description, tags }) => {
    const result = await api.createItem({ name, description, tags });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);
```

### 第四步：实施最佳实践

mcp-builder 技能强制执行几个关键模式：

**工具命名规范**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

使用一致的前缀（服务名称）+ 以动作导向的动词。这有助于 Agent 快速发现并选择正确的工具。

**可操作的错误消息**
```typescript
// ❌ 错误做法
throw new Error("Not found");

// ✅ 正确做法
throw new Error(
  `未找到仓库 "${owner}/${repo}"。` +
  `请检查仓库是否存在以及你是否有访问权限。` +
  `尝试先使用 github_list_repos 列出你的仓库。`
);
```

**工具注解**

每个工具都应该包含帮助 Agent 理解其行为的注解：

```typescript
server.tool(
  "delete_item",
  "永久删除一个项目",
  { id: z.string() },
  async ({ id }) => { /* ... */ },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    }
  }
);
```

## 实战案例：构建 GitHub MCP 服务器

让我们来看看一个现实的例子。假设你想构建一个让 AI Agent 管理 GitHub 仓库的 MCP 服务器。

**在激活 mcp-builder 技能的情况下询问 Claude：**

> "帮我构建一个 GitHub API 的 MCP 服务器。它应该支持创建 Issue、列出仓库、管理 Pull Request 和搜索代码。"

Claude 将会：
1. 研究 GitHub REST API 文档
2. 规划要覆盖的端点（通常是 15-25 个工具）
3. 构建完整的服务器，并带有正确的 OAuth 身份验证
4. 为每个工具生成测试评估

其结果是一个具有正确错误处理、分页、速率限制和身份验证的生产级服务器——这通常需要花费数天时间手动构建。

## MCP 服务器的关键设计原则

### API 覆盖 vs. 工作流工具

mcp-builder 技能教导了一个重要的平衡：

- **全面覆盖** 为 Agent 组合操作提供了灵活性
- **工作流工具** 将常见的多个步骤合并为单个调用
- 不确定时，优先考虑全面的 API 覆盖

### 上下文管理

Agent 在处理聚焦、相关联的数据时表现最好：

- 只返回 Agent 需要的字段，而不是整个 API 响应
- 对列表操作支持分页
- 包含过滤器以缩小结果范围

### 测试与评估

mcp-builder 技能生成的自动化评估会测试：

- **正常路径** —— 使用有效输入的正常操作
- **边缘情况** —— 空结果、大数据集、特殊字符
- **错误处理** —— 无效输入、授权失败、速率限制
- **真实场景** —— 链接多个工具的多步工作流

## 通过 Killer-Skills 安装

最快的入门方式是通过 Killer-Skills 市场：

```bash
# 浏览官方技能
npx killer-skills search mcp

# 安装 mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# 验证安装
npx killer-skills list
```

安装后，该技能会自动在 Claude Code、Claude.ai 和任何 Claude API 集成中可用。只需开始关于构建 MCP 服务器的对话，Claude 就会加载该技能的指令。

## 下一步是什么？

MCP 服务器正在成为 AI Agent 与世界交互的标准方式。借助于 mcp-builder 技能，你不需要成为 MCP 协议专家——Claude 处理复杂性，而你专注于服务器应该做什么。

准备好构建你的第一个 MCP 服务器了吗？以下是今天的开始方式：

1. **安装技能**：`npx killer-skills add anthropics/skills/mcp-builder`
2. **选择你的 API**：选择你想集成的服务（Slack, Notion, JIRA 等）
3. **描述你的需求**：告诉 Claude 你需要什么工具，它将构建整个服务器
4. **部署并测试**：使用生成的评估来验证你的服务器

AI 开发的未来不在于编写更多代码，而在于为 AI Agent 提供正确的工具。MCP 服务器和 Agent Skills 让这个未来在今天成为可能。

---

*想探索更多技能吗？浏览 [Killer-Skills 市场](https://killer-skills.com/zh/skills) 发现数百个经过验证的 AI 编程工作流 Agent Skills。*
