# Killer Skills CLI

> Cross-platform AI Agent Skills Installation & Management Tool.
> 跨平台 AI Agent Skills 安装与管理工具。

[![npm version](https://badge.fury.io/js/killer-skills.svg)](https://www.npmjs.com/package/killer-skills)

[English](README.md) | [简体中文](README.zh-CN.md)

---

### ✨ Features
- 🚀 **Unified Installation** - One-click install from GitHub, Registry, or local; auto-sync to IDE.
- 🤖 **Universal IDE Support** - Supports Cursor, Windsurf, VS Code, Claude Code, OpenClaw, and **19 IDEs**.
- ⚡ **Auto-Invoke** - Installed skills can be **auto-invoked** by AI Agents via natural language without manual commands.
- 🔐 **Seamless GitHub Auth** - Reuses `gh` CLI token or supports one-click Device Flow login.
- 🔍 **Smart Search** - **[NEW]** Website-First search with interactive selection & auto-open docs.
- 🔄 **One-Click Sync** - `kiro sync --all` syncs skills to all installed IDEs.
- 🔌 **Auto-Inject MCP** - **[NEW]** Automatically parses and wires up `mcpCommand` parameters from MCP servers into `claude_desktop_config.json`.

### Supported IDEs

Killer-Skills dynamically detects and configures IDEs based on its internal configuration. It currently supports **19 IDEs** and injects **Auto-Invoke** instructions:

| IDE | Config File | Status |
|-----|-------------|--------|
| **Cursor, Trae** | `.cursorrules`, `.trae/rules/project_rules.md` | ✅ Perfect |
| **Windsurf** | `.windsurfrules` | ✅ Perfect |
| **Roo Code, Cline** | `.clinerules` | ✅ Perfect |
| **Goose** | `.goosehints` | ✅ Native |
| **Continue.dev** | `.continue/rules/skills.md` | ✅ Native |
| **Augment Code** | `.augment/rules/skills.md` | ✅ Native |
| **OpenClaw** | `AGENTS.md` | ✅ Native |
| **VS Code + Copilot** | `.github/copilot-instructions.md` | ✅ Supported |
| **Sourcegraph Cody** | `.github/instructions/cody.md` | ✅ Native |
| **Claude Code** | `CLAUDE.md` | ✅ Supported |
| **Antigravity (Gemini)** | `AGENTS.md` | ✅ Native |
| **Kiro (AWS)** | `.kiro/agents/skills.md` (JSON) | ✅ Perfect |
| **Aider, Codex, OpenCode, Amazon Q** | `AGENTS.md` | ✅ Supported |

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
| `install`/`add` | Install Skill | `npx killer-skills add pdf` |
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

#### Configuration

**Claude Desktop:**
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
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
1. Go to **Settings** > **Features** > **MCP Servers**
2. Click **+ Add Native MCP Server**
3. Name: `killer-skills`
4. Type: `command`
5. Command: `npx -y killer-skills-mcp`



## License

MIT
