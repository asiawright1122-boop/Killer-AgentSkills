# Killer Skills CLI

> Cross-platform AI Agent Skills Installation & Management Tool.
> 跨平台 AI Agent Skills 安装与管理工具。

[![npm version](https://badge.fury.io/js/killer-skills.svg)](https://www.npmjs.com/package/killer-skills)

🌍 **[Website / 官网](https://killer-skills.com)**

[English](README.md) | [简体中文](README.zh-CN.md)

---

### ✨ 特性

- 🚀 **统一安装** - 从 GitHub、Registry 或本地一键安装，自动同步到 IDE
- 🤖 **Universal IDE Support** - 支持 Cursor, Windsurf, VS Code, Claude Code, OpenClaw 等 **19 IDE**
- ⚡ **Auto-Invoke** - 技能安装后，AI Agent 可通过自然语言**自动调用**，无需手动指令
- 🔐 **GitHub 无感认证** - 支持复用 `gh` CLI token 或通过 Device Flow 一键登录
- 🔍 **智能搜索** - **[NEW]** 官网数据优先，支持交互式选择和自动打开文档
- 🔄 **一键同步** - `npx killer-skills sync --all` 将技能同步到所有已安装 IDE
- 🔌 **自动注入 MCP** - **[NEW]** 自动解析 MCP server 的 `mcpCommand` 参数并写入 `claude_desktop_config.json`

### 支持的 IDE

Killer-Skills 会根据内部配置动态检测并配置 IDE。目前支持 **19 IDE** 并自动注入 **Auto-Invoke** 指令：

| IDE | 配置文件 | 状态 |
|-----|----------|------|
| **Cursor, Trae** | `.cursorrules`, `.trae/rules/project_rules.md` | ✅ 完美支持 |
| **Windsurf** | `.windsurfrules` | ✅ 完美支持 |
| **Roo Code, Cline** | `.clinerules` | ✅ 完美支持 |
| **Goose** | `.goosehints` | ✅ 原生支持 |
| **Continue.dev** | `.continue/rules/skills.md` | ✅ 原生支持 |
| **Augment Code** | `.augment/rules/skills.md` | ✅ 原生支持 |
| **OpenClaw** | `AGENTS.md` | ✅ 原生支持 |
| **VS Code + Copilot** | `.github/copilot-instructions.md` | ✅ 支持 |
| **Sourcegraph Cody** | `.github/instructions/cody.md` | ✅ 原生支持 |
| **Claude Code** | `CLAUDE.md` | ✅ 支持 |
| **Antigravity (Gemini)** | `AGENTS.md` | ✅ 原生支持 |
| **Kiro (AWS)** | `.kiro/agents/skills.md` (JSON) | ✅ 完美支持 |
| **Aider, Codex, OpenCode, Amazon Q** | `AGENTS.md` | ✅ 支持 |

*新 IDE 支持会定期添加。运行 `npx killer-skills completion zsh` 可查看最新列表。*

### 快速开始

```bash
# 使用 npx (推荐)
npx killer-skills add <owner/repo>

# 或全局安装
npm install -g killer-skills
```

### 🔐 GitHub 认证 (推荐)

为了获得更高的 API 限额和更精准的代码搜索，建议登录 GitHub：

```bash
# 方法 1: 复用 gh CLI (零配置)
# 如果你安装了 GitHub CLI，Killer-Skills 会自动使用它的 token

# 方法 2: 一键登录 (Device Flow)
npx killer-skills login
# -> 自动打开浏览器完成授权

# 方法 3: 手动设置
npx killer-skills config githubToken ghp_xxxx
```

### 📦 安装与使用

#### 1. 安装 Skill

```bash
# 交互式安装 (推荐)
npx killer-skills add pdf
# -> 1. 优先搜索官网 API
# -> 2. 显示交互式选择菜单
# -> 3. 自动打开官网文档并安装

# 从 GitHub 安装
npx killer-skills add anthropics/skills

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
npx killer-skills sync --all
```

### 命令速查

| 命令 | 说明 | 示例 |
|------|------|------|
| `install`/`add` | 安装 Skill | `npx killer-skills add pdf` |
| `login` | **[NEW]** GitHub 登录 | `npx killer-skills login` |
| `sync` | 同步配置 | `npx killer-skills sync --all` |
| `list` | 列出已安装 | `npx killer-skills list` |
| `search` | 搜索 Skills | `npx killer-skills search react` |
| `create` | 创建新 Skill | `npx killer-skills create my-skill` |
| `read` | 读取内容 | `npx killer-skills read pdf` |
| `do` | 自然语言执行 | `npx killer-skills do "处理PDF"` |
| `manage` | 交互式管理 | `npx killer-skills manage` |
| `publish` | 发布 Skill | `npx killer-skills publish .` |
| `init` | 初始化项目 | `npx killer-skills init` |
| `config` | 配置管理 | `npx killer-skills config` |
| `completion` | Shell 补全 | `npx killer-skills completion zsh` |
| `stats` | 使用统计 | `npx killer-skills stats` |

### 🔌 MCP Server

启动内置 MCP Server，为兼容的 AI 客户端暴露技能安装、搜索与读取工具：

```bash
npx killer-skills-mcp
```

**可用工具：** `install_skill`, `list_skills`, `search_skills`, `read_skill`

#### 配置指南

**Claude Desktop:**
添加到 `~/Library/Application Support/Claude/claude_desktop_config.json`：
```json
{
  "mcpServers": {
    "killer-skills": {
      "command": "npx",
      "args": ["-y", "killer-skills-mcp"]
    }
  }
}
```

**Cursor:**
1. 进入 **Settings** > **Features** > **MCP Servers**
2. 点击 **+ Add Native MCP Server**
3. Name: `killer-skills`
4. Type: `command`
5. Command: `npx -y killer-skills-mcp`

---

## License

MIT
