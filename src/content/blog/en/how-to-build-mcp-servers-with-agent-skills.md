---
title: "How to Build MCP Servers: A Complete Guide Using Agent Skills"
description: "Learn how to build production-ready MCP servers for AI agents using the official mcp-builder skill. Covers setup, tool design, testing, and deployment with TypeScript and Python."
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "en"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# How to Build MCP Servers That AI Agents Actually Use

What if your AI coding agent could do more than just write code? What if it could send Slack messages, query databases, deploy to production, and manage your entire DevOps pipeline — all through a standardized protocol?

That's exactly what **MCP servers** (Model Context Protocol) make possible. And with the official **mcp-builder** skill from Anthropic's skills repository, you can build production-grade MCP servers in minutes instead of hours.

```bash
# Install the mcp-builder skill with one command
npx killer-skills add anthropics/skills/mcp-builder
```

In this guide, you'll learn everything you need to know about building MCP servers — from understanding the protocol to deploying your first server.

## What Is an MCP Server?

An **MCP server** is a standardized service that exposes tools, resources, and prompts for AI agents to consume. Think of it as a bridge between your AI assistant and the real world — databases, APIs, file systems, cloud services, and more.

The **Model Context Protocol** (MCP) was created by Anthropic to solve a fundamental problem: AI agents need a universal way to interact with external services. Before MCP, every integration required custom code. Now, a single protocol handles everything.

Here's why MCP matters:

- **Universal compatibility** — Works with Claude, Cursor, Windsurf, and any MCP-compatible client
- **Standardized interface** — Tools, resources, and prompts follow a consistent schema
- **Security-first design** — Built-in authentication, input validation, and permission controls
- **Composable workflows** — Agents can chain multiple MCP tools together

## Why Use the mcp-builder Skill?

The **mcp-builder** skill is one of the most powerful skills in Anthropic's official repository. It transforms Claude into a specialized MCP server developer by providing:

1. **Deep protocol knowledge** — The skill loads the full MCP specification so Claude understands every detail
2. **Best practices baked in** — Tool naming, error handling, and pagination patterns are all pre-configured
3. **Framework-specific guides** — Optimized templates for both TypeScript and Python
4. **Evaluation generation** — Automatically creates test suites for your MCP server

Unlike building from scratch, the mcp-builder skill follows a structured 4-phase workflow:

| Phase | What Happens |
|:------|:-------------|
| **Phase 1: Research** | Studies the API, plans tool coverage, designs the schema |
| **Phase 2: Build** | Implements the server with proper error handling and auth |
| **Phase 3: Review** | Tests all tools, validates responses, checks edge cases |
| **Phase 4: Evaluate** | Creates automated evaluations to verify quality |

## Getting Started: Build Your First MCP Server

### Step 1: Install the Skill

First, make sure you have the Killer-Skills CLI installed:

```bash
npm install -g killer-skills
```

Then add the mcp-builder skill to your project:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

The skill will be added to your `.claude/skills/` directory and automatically activated when Claude detects MCP server development tasks.

### Step 2: Choose Your Stack

The mcp-builder skill supports two primary stacks:

**TypeScript (Recommended)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript is recommended for several reasons:
- High-quality SDK support from the official MCP team
- Static typing catches errors before runtime
- Strong compatibility with execution environments
- AI models excel at generating TypeScript code

**Python**
```bash
pip install mcp pydantic
```

Python is a great choice if your team already uses Python or you're integrating with Python-heavy APIs.

### Step 3: Define Your Tools

The key to a great MCP server is well-designed tools. Here's a template:

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

### Step 4: Implement Best Practices

The mcp-builder skill enforces several critical patterns:

**Tool Naming Convention**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Use consistent prefixes (service name) + action-oriented verbs. This helps agents quickly discover and select the right tools.

**Actionable Error Messages**
```typescript
// ❌ Bad
throw new Error("Not found");

// ✅ Good
throw new Error(
  `Repository "${owner}/${repo}" not found. ` +
  `Check that the repository exists and you have access. ` +
  `Try listing your repositories first with github_list_repos.`
);
```

**Tool Annotations**

Every tool should include annotations that help agents understand their behavior:

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

## Real-World Example: Building a GitHub MCP Server

Let's walk through a realistic example. Suppose you want to build an MCP server that lets AI agents manage GitHub repositories.

**Ask Claude with the mcp-builder skill active:**

> "Build me an MCP server for the GitHub API. It should support creating issues, listing repositories, managing pull requests, and searching code."

Claude will:
1. Research the GitHub REST API documentation
2. Plan which endpoints to cover (typically 15-25 tools)
3. Build the complete server with proper OAuth authentication
4. Generate test evaluations for each tool

The result is a production-ready server with proper error handling, pagination, rate limiting, and authentication — something that would normally take days to build manually.

## Key Design Principles for MCP Servers

### API Coverage vs. Workflow Tools

The mcp-builder skill teaches an important balance:

- **Comprehensive coverage** gives agents flexibility to compose operations
- **Workflow tools** bundle common multi-step operations into single calls
- When uncertain, prioritize comprehensive API coverage

### Context Management

Agents work best with focused, relevant data:

- Return only the fields agents need, not entire API responses
- Support pagination for list operations
- Include filters to narrow results

### Testing and Evaluation

The mcp-builder skill generates automated evaluations that test:

- **Happy path** — Normal operation with valid inputs
- **Edge cases** — Empty results, large datasets, special characters
- **Error handling** — Invalid inputs, auth failures, rate limits
- **Real-world scenarios** — Multi-step workflows that chain tools together

## Installing via Killer-Skills

The fastest way to get started is through the Killer-Skills marketplace:

```bash
# Browse the official skills
npx killer-skills search mcp

# Install mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Verify installation
npx killer-skills list
```

Once installed, the skill is automatically available in Claude Code, Claude.ai, and any Claude API integration. Simply start a conversation about building an MCP server and Claude will load the skill's instructions.

## What's Next?

MCP servers are becoming the standard way AI agents interact with the world. With the mcp-builder skill, you don't need to be an MCP protocol expert — Claude handles the complexity while you focus on what your server should do.

Ready to build your first MCP server? Here's how to get started today:

1. **Install the skill**: `npx killer-skills add anthropics/skills/mcp-builder`
2. **Choose your API**: Pick a service you want to integrate (Slack, Notion, JIRA, etc.)
3. **Describe your needs**: Tell Claude what tools you need, and it will build the entire server
4. **Deploy and test**: Use the generated evaluations to validate your server

The future of AI development isn't about writing more code — it's about giving AI agents the right tools to work with. MCP servers and Agent Skills make that future possible today.

---

*Want to explore more skills? Browse the [Killer-Skills Marketplace](https://killer-skills.com/en/skills) to discover hundreds of verified Agent Skills for your AI coding workflow.*
