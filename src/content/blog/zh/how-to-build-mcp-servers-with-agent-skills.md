---
title: "如何搭建MCP服务器：使用Agent技能的完整指南"
description: "学习如何使用官方mcp-builder技能为AI代理搭建生产就绪的MCP服务器。涵盖设置、工具设计、测试和使用TypeScript和Python进行部署。"
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "zh"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# 如何构建 MCP 服务器，让 AI 代理真正使用

如果您的 AI 编码代理可以做的不仅仅是编写代码呢？如果它可以发送 Slack 消息，查询数据库，部署到生产环境，并管理您的整个 DevOps 流水线 —— 所有这些都通过一个标准化协议呢？

这正是 **MCP 服务器** (模型上下文协议) 所能实现的。并且，通过 Anthropic 的技能仓库中的官方 **mcp-builder** 技能，您可以在几分钟内构建生产级的 MCP 服务器，而不是花费数小时。

```bash
# 使用一条命令安装 mcp-builder 技能
npx killer-skills add anthropics/skills/mcp-builder
```

真正值得先做的，不是照着长清单往下抄，而是先定义好要暴露哪些能力、怎样描述工具，以及服务上线后要守住哪些边界。
## 什么是MCP服务器？

MCP服务器是一种标准化服务，向AI代理提供工具、资源和提示。可以把它看作是您AI助手和真实世界之间的桥梁——数据库、API、文件系统、云服务等。

**模型上下文协议**（MCP）由Anthropic创建，旨在解决一个基本问题：AI代理需要一种通用的方式来与外部服务交互。在MCP出现之前，每次集成都需要自定义代码。现在，一个单一的协议可以处理所有事情。

以下是MCP重要的原因：

- **通用兼容性** — 支持Claude、Cursor、Windsurf和任何MCP兼容客户端
- **标准化接口** — 工具、资源和提示遵循一致的模式
- **安全优先设计** — 内置认证、输入验证和权限控制
- **可组合工作流** — 代理可以将多个MCP工具链接在一起
## 为什么使用 mcp-builder 技能？

**mcp-builder** 技能是 Anthropic 官方仓库中最强大的技能之一。它将 Claude 转变为专门的 MCP 服务器开发者，提供：

1. **深入的协议知识** — 该技能加载完整的 MCP 规范，因此 Claude 了解每个细节
2. **最佳实践内置** — 工具命名、错误处理和分页模式都预先配置
3. **框架特定指南** —针对 TypeScript 和 Python 优化的模板
4. **评估生成** — 自动为您的 MCP 服务器创建测试套件

与从头开始构建不同，mcp-builder 技能遵循结构化的 4 阶段工作流程：

| 阶段 | 发生了什么 |
|:------|:-------------|
| **阶段 1: 研究** | 研究 API，规划工具覆盖范围，设计模式 |
| **阶段 2: 构建** | 实现服务器，包括适当的错误处理和身份验证 |
| **阶段 3: 审查** | 测试所有工具，验证响应，检查边缘情况 |
| **阶段 4: 评估** | 创建自动评估以验证质量 |
## 快速入门：构建你的第一个 MCP 服务器

### 安装技能

你不需要全局安装 CLI，直接通过 `npx` 添加 mcp-builder 技能即可：

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

该技能将被添加到你的 `.claude/skills/` 目录中，并在 Claude 检测到 MCP 服务器开发任务时自动激活。

### 选择技术栈

mcp-builder 技能支持两种主要技术栈：

**TypeScript（推荐）**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

推荐 TypeScript 的原因包括：
- 官方 MCP 团队提供高质量的 SDK 支持
- 静态类型检查可在运行时前捕获错误
- 与执行环境具有强大的兼容性
- AI 模型擅长生成 TypeScript 代码

**Python**
```bash
pip install mcp pydantic
```

如果你的团队已使用 Python 或需要与 Python 密集的 API 集成，Python 是个不错的选择。

### 定义你的工具

优秀 MCP 服务器的关键在于精心设计的工具。以下是一个模板：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Creates a new item in the system",
  {
    name: z.string().describe("Name of the item to create"),
    description: z.string().optional().describe("Optional description"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
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

### 落实关键模式

mcp-builder 技能强制实施几个关键模式：

**工具命名规范**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

使用一致的前缀（服务名称）+ 动作导向的动词。这有助于代理快速发现并选择正确的工具。

**可操作的错误信息**
```typescript
// ❌ 不佳
throw new Error("Not found");

// ✅ 推荐
throw new Error(
  `Repository "${owner}/${repo}" not found. ` +
  `Check that the repository exists and you have access. ` +
  `Try listing your repositories first with github_list_repos.`
);
```

**工具注解**

每个工具都应包含帮助代理理解其行为的注解：

```typescript
server.tool(
  "delete_item",
  "Permanently deletes an item",
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
## 真实案例：构建 GitHub MCP 服务器

让我们通过一个实际案例来演示。假设您想构建一个能让 AI 代理管理 GitHub 仓库的 MCP 服务器。

**激活 mcp-builder 技能后向 Claude 提问：**

> "为我构建一个 GitHub API 的 MCP 服务器。它需要支持创建议题、列出仓库、管理拉取请求和搜索代码功能。"

Claude 将：
1. 研究 GitHub REST API 文档
2. 规划需要覆盖的 API 端点（通常包含 15-25 个工具）
3. 构建包含 OAuth 认证机制的完整服务器
4. 为每个工具生成测试评估方案

最终您将获得一个生产就绪的服务器，具备完善的错误处理、分页机制、速率限制和身份验证功能——这些工作若手动完成通常需要耗费数天时间。
## MCP 服务器的关键设计原则

### API 覆盖范围 vs 工作流工具

mcp-builder 技能传授了一个重要的平衡点：

- **全面覆盖**赋予智能体组合操作的灵活性
- **工作流工具**将常见的多步骤操作捆绑为单次调用
- 不确定时，优先考虑全面的 API 覆盖范围

### 上下文管理

智能体在处理聚焦且相关的数据时表现最佳：

- 仅返回智能体需要的字段，而非完整的 API 响应
- 为列表操作支持分页功能
- 包含筛选器以缩小结果范围

### 测试与评估

mcp-builder 技能生成的自动化评估可测试：

- **理想路径** — 使用有效输入的正常操作
- **边界情况** — 空结果、大型数据集、特殊字符
- **错误处理** — 无效输入、认证失败、速率限制
- **真实场景** — 将多个工具串联在一起的多步骤工作流
## 通过 Killer-Skills 安装

通过 Killer-Skills 技能目录开始使用是最快的方式：

```bash
# 浏览官方技能
npx killer-skills search mcp

# 安装 mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# 验证安装
npx killer-skills list
```

安装完成后，技能将自动在 Claude Code、Claude.ai 和任何 Claude API 集成中可用。只需开始关于构建 MCP 服务器的对话，Claude就会加载技能的说明。
## 下一步是什么？

MCP 服务器正逐渐成为 AI 代理与世界交互的标准方式。借助 mcp-builder 技能，您无需成为 MCP 协议专家 —— Claude 会处理所有复杂性，而您可以专注于服务器应实现的功能。

准备好构建您的第一个 MCP 服务器了吗？以下是今天的入门指南：

1.  **安装技能**：`npx killer-skills add anthropics/skills/mcp-builder`
2.  **选择您的 API**：挑选您想要集成的服务（Slack、Notion、JIRA 等）
3.  **描述您的需求**：告诉 Claude 您需要哪些工具，它将构建完整的服务器
4.  **部署与测试**：使用生成的评估来验证您的服务器

AI 开发的未来不在于编写更多代码，而在于为 AI 代理提供合适的工具。MCP 服务器和智能体技能让这一未来在今天成为可能。

---

*想探索更多技能？浏览 [Killer-Skills 技能目录](https://killer-skills.com/zh/skills)，为您的 AI 编程工作流发现数百种经过验证的智能体技能。*

---

*相关阅读：[什么是 AI 代理技能？](/zh/blog/what-are-ai-agent-skills) 和 [2026 年最佳 AI 代理技能](/zh/blog/best-ai-agent-skills-2026)*