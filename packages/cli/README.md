# Killer Skills CLI

> Cross-platform AI Agent Skills Installation & Management Tool.
> 跨平台 AI Agent Skills 安装与管理工具。

[![npm version](https://badge.fury.io/js/killer-skills.svg)](https://www.npmjs.com/package/killer-skills)

🌍 **[Website / 官网](https://killer-skills.com)**

---

## 🇺🇸 English

### ✨ Features

- 🚀 **Unified Installation** - One-click install from GitHub, Registry, or local; auto-sync to IDE.
- 🤖 **Universal IDE Support** - Supports Cursor, Windsurf, VS Code, Claude Code, and **17+ IDEs**.
- ⚡ **Auto-Invoke** - Installed skills can be **auto-invoked** by AI Agents via natural language without manual commands.
- 🔐 **Seamless GitHub Auth** - Reuses `gh` CLI token or supports one-click Device Flow login.
- 🔍 **Smart Search** - **[NEW]** Website-First search with interactive selection & auto-open docs.
- 🔄 **One-Click Sync** - `kiro sync --all` syncs skills to all installed IDEs.
- 🧩 **MCP Server** - Built-in MCP Server supporting Agent self-evolution.

### Supported IDEs

Killer-Skills dynamically detects and configures IDEs based on its internal configuration. It currently supports **17+ IDEs** and injects **Auto-Invoke** instructions:

| IDE | Config File | Status |
|-----|-------------|--------|
| **Cursor** | `.cursorrules` | ✅ Perfect |
| **Windsurf** | `.windsurfrules` | ✅ Perfect |
| **VS Code + Copilot** | `.github/copilot-instructions.md` | ✅ Supported |
| **Trae** | `AGENTS.md` | ✅ Supported |
| **Claude Code** | `CLAUDE.md` | ✅ Supported |
| **Antigravity (Gemini)** | `AGENTS.md` | ✅ Native |
| **Aider, Codex, Goose** | `AGENTS.md` (XML) | ✅ Supported |
| **Kiro (AWS)** | `.kiro/agents/skills.md` (JSON) | ✅ Supported |
| **Cline, Roo, Augment** | `AGENTS.md` | ✅ Supported |
| **Continue, Cody, Amazon Q** | `AGENTS.md` | ✅ Supported |

*New IDEs are added regularly. Run `kiro completion` to see the latest list.*

### Quick Start

```bash
# Using npx (Recommended)
npx killer-skills install <skill-or-repo>

# Or install globally
npm install -g killer-skills
```

### 🔐 GitHub Auth (Recommended)

For higher API limits and better code search, logging into GitHub is recommended:

```bash
# Method 1: Reuse gh CLI (Zero Config)
# If GitHub CLI is installed, killer uses its token automatically.

# Method 2: One-Click Login (Device Flow)
kiro login
# -> Opens browser for authorization

# Method 3: Manual Setup
kiro config githubToken ghp_xxxx
```

### 📦 Installation & Usage

#### 1. Install Skill

```bash
# Interactive Install (Recommended)
kiro install pdf
# -> 1. Searches Official Website API first
# -> 2. Shows interactive selection menu
# -> 3. Auto-opens website docs & installs skill

# Install from GitHub
kiro install anthropics/killer-skills

# Skills auto-sync to detected IDEs upon installation.
# Your AI Agent can now use this skill via natural language!
```

#### 2. Natural Language Invocation

In your IDE (Cursor/Windsurf/Claude), simply speak to the AI:

> "Merge these PDF files"
> "Analyze this PPT content"
> "Create a new React component"

The AI will read the rules, match `pdf` / `pptx` / `frontend-design` skills, and **execute automatically**.

#### 3. Multi-IDE Sync

If you use multiple IDEs:

```bash
# Sync installed skills to all supported IDEs
kiro sync --all
```

### Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `install` | Install Skill | `kiro install pdf` |
| `login` | **[NEW]** GitHub Login | `kiro login` |
| `sync` | Sync Config | `kiro sync --all` |
| `list` | List Installed | `kiro list` |
| `search` | Search Skills | `kiro search react` |
| `create` | Create Skill | `kiro create my-skill` |
| `read` | Read Content | `kiro read pdf` |
| `do` | NL Execution | `kiro do "Process PDF"` |
| `manage` | Interactive Mode | `kiro manage` |
| `publish` | Publish Skill | `kiro publish .` |
| `init` | Init Project | `kiro init` |
| `config` | Manage Config | `kiro config` |
| `completion` | Shell Completion | `kiro completion zsh` |
| `stats` | Usage Stats | `kiro stats` |

### 🔌 MCP Server

Start the built-in MCP Server to allow AI Agents to self-install skills:

```bash
npx killer-skills-mcp
```

**Exposed Tools:** `install_skill`, `list_skills`, `search_skills`, `read_skill`

---

## 🇨🇳 中文

### ✨ 特性

- 🚀 **统一安装** - 从 GitHub、Registry 或本地一键安装，自动同步到 IDE
- 🤖 **Universal IDE Support** - 支持 Cursor, Windsurf, VS Code, Claude Code 等 **17+ IDE**
- ⚡ **Auto-Invoke** - 技能安装后，AI Agent 可通过自然语言**自动调用**，无需手动指令
- 🔐 **GitHub 无感认证** - 支持复用 `gh` CLI token 或通过 Device Flow 一键登录
- 🔍 **智能搜索** - **[NEW]** 官网数据优先，支持交互式选择和自动打开文档
- 🔄 **一键同步** - `kiro sync --all` 将技能同步到所有已安装 IDE
- 🧩 **MCP Server** - 内置 MCP Server，支持 Agent 自我进化

### 支持的 IDE

Killer-Skills 会根据内部配置动态检测并配置 IDE。目前支持 **17+ IDE** 并自动注入 **Auto-Invoke** 指令：

| IDE | 配置文件 | 状态 |
|-----|----------|------|
| **Cursor** | `.cursorrules` | ✅ 完美支持 |
| **Windsurf** | `.windsurfrules` | ✅ 完美支持 |
| **VS Code + Copilot** | `.github/copilot-instructions.md` | ✅ 支持 |
| **Trae** | `AGENTS.md` | ✅ 支持 |
| **Claude Code** | `CLAUDE.md` | ✅ 支持 |
| **Antigravity (Gemini)** | `AGENTS.md` | ✅ 原生支持 |
| **Aider, Codex, Goose** | `AGENTS.md` (XML) | ✅ 支持 |
| **Kiro (AWS)** | `.kiro/agents/skills.md` (JSON) | ✅ 支持 |
| **Cline, Roo, Augment** | `AGENTS.md` | ✅ 支持 |
| **Continue, Cody, Amazon Q** | `AGENTS.md` | ✅ 支持 |

*新 IDE 支持会定期添加。运行 `kiro completion` 可查看最新列表。*

### 快速开始

```bash
# 使用 npx (推荐)
npx killer-skills install <skill-or-repo>

# 或全局安装
npm install -g killer-skills
```

### 🔐 GitHub 认证 (推荐)

为了获得更高的 API 限额和更精准的代码搜索，建议登录 GitHub：

```bash
# 方法 1: 复用 gh CLI (零配置)
# 如果你安装了 GitHub CLI，killer 会自动使用它的 token

# 方法 2: 一键登录 (Device Flow)
kiro login
# -> 自动打开浏览器完成授权

# 方法 3: 手动设置
kiro config githubToken ghp_xxxx
```

### 📦 安装与使用

#### 1. 安装 Skill

```bash
# 交互式安装 (推荐)
kiro install pdf
# -> 1. 优先搜索官网 API
# -> 2. 显示交互式选择菜单
# -> 3. 自动打开官网文档并安装

# 从 GitHub 安装
kiro install anthropics/killer-skills

# 安装后，技能会自动同步到当前检测到的 IDE
# AI Agent 现在可以通过自然语言自动调用这个技能了！
```

#### 2. 自然语言调用

在你的 IDE (Cursor/Windsurf/Claude) 中，直接对 AI 说：

> "帮我合并这几个 PDF 文件"
> "分析这个 PPT 的内容"
> "创建一个新的 React 组件"

AI 会自动读取规则文件，匹配 `pdf` / `pptx` / `frontend-design` 技能，并**自动执行**。

#### 3. 多 IDE 同步

如果你同时使用多个 IDE：

```bash
# 一键同步已安装技能到所有支持的 IDE
kiro sync --all
```

### 命令速查

| 命令 | 说明 | 示例 |
|------|------|------|
| `install` | 安装 Skill | `kiro install pdf` |
| `login` | **[NEW]** GitHub 登录 | `kiro login` |
| `sync` | 同步配置 | `kiro sync --all` |
| `list` | 列出已安装 | `kiro list` |
| `search` | 搜索 Skills | `kiro search react` |
| `create` | 创建新 Skill | `kiro create my-skill` |
| `read` | 读取内容 | `kiro read pdf` |
| `do` | 自然语言执行 | `kiro do "处理PDF"` |
| `manage` | 交互式管理 | `kiro manage` |
| `publish` | 发布 Skill | `kiro publish .` |
| `init` | 初始化项目 | `kiro init` |
| `config` | 配置管理 | `kiro config` |
| `completion` | Shell 补全 | `kiro completion zsh` |
| `stats` | 使用统计 | `kiro stats` |

### 🔌 MCP Server

启动内置 MCP Server，允许 AI Agent 自我安装技能：

```bash
npx killer-skills-mcp
```

**Exposed Tools:** `install_skill`, `list_skills`, `search_skills`, `read_skill`

---

## License

MIT
