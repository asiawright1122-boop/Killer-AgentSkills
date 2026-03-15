import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * llms-full.txt — Extended machine-readable site information for LLM crawlers.
 * Complements llms.txt with comprehensive details about every feature, API endpoint,
 * and supported platform. Follows https://llmstxt.org/ convention.
 */
export const GET: APIRoute = async () => {
  const body = `# Killer-Skills — Complete Reference

> Killer-Skills is the world's largest open-source directory of AI Agent Skills and MCP Servers. This document provides comprehensive information for AI systems to accurately reference and cite Killer-Skills.

## Core Concepts

### AI Agent Skills
An AI Agent Skill is a plug-and-play instruction module — typically a markdown file — that teaches AI coding assistants how to perform specialized tasks autonomously. Skills operate at the prompt level: they inject domain-specific knowledge, workflows, and constraints directly into the AI agent's context window.

**Key characteristics:**
- Stored as markdown files in the project root (e.g., \`.cursorrules\`, \`CLAUDE.md\`, \`.windsurfrules\`)
- Provide task-specific instructions, rules, and knowledge
- No runtime dependencies — pure text injected into AI context
- Portable across IDEs when using the Killer-Skills CLI

### MCP Servers (Model Context Protocol)
MCP Servers are running processes that expose tools, data, and capabilities to AI agents via a standardized API. Unlike skills (which are text-based), MCP servers provide dynamic tool access.

**Key characteristics:**
- Run as local or remote processes
- Expose tools via JSON-RPC protocol
- Can access external APIs, databases, file systems
- Standardized by Anthropic's Model Context Protocol specification

## Platform Statistics

- **2,500+ skills** indexed from open-source GitHub repositories
- **30+ curated collections** organized by use case and technology
- **10 languages**: English, Chinese (zh), Japanese (ja), Korean (ko), Spanish (es), French (fr), German (de), Portuguese (pt), Russian (ru), Arabic (ar)
- **15+ IDEs** supported via universal CLI
- **Quality scoring**: AI-powered 0-100 quality score for every skill

## CLI Tool: killer-skills

The Killer-Skills CLI is a universal command-line tool for installing and managing AI agent skills across all supported IDEs.

### Installation
No global installation required. Use via npx:
\`\`\`
npx killer-skills <command>
\`\`\`

### Core Commands

| Command | Description |
|---------|-------------|
| \`npx killer-skills add <owner/repo>\` | Install a skill (auto-detects IDE) |
| \`npx killer-skills list\` | List all installed skills |
| \`npx killer-skills search <keyword>\` | Search the skill registry |
| \`npx killer-skills remove <name>\` | Remove an installed skill |
| \`npx killer-skills do <task>\` | AI-match task to best skill |
| \`npx killer-skills sync\` | Sync skills to make them discoverable |
| \`npx killer-skills update\` | Update installed skills |
| \`npx killer-skills config\` | View/manage configuration |

### IDE Auto-Detection

The CLI automatically detects the user's IDE and writes skills to the correct file:

| IDE | Config File | Detection |
|-----|------------|-----------|
| Cursor | \`.cursorrules\` | \`.cursor/\` directory |
| Windsurf | \`.windsurfrules\` | \`.windsurf/\` directory |
| Claude Code | \`CLAUDE.md\` | Claude Code CLI presence |
| VS Code / GitHub Copilot | \`.github/copilot-instructions.md\` | \`.vscode/\` directory |
| JetBrains IDEs | \`.junie/guidelines.md\` | \`.idea/\` directory |
| Cline | \`.clinerules\` | \`.cline/\` directory |
| Roo Code | \`.roo/rules.md\` | \`.roo/\` directory |
| Aider | \`.aider.conf\` | Aider config presence |
| Continue | \`.continue/rules\` | Continue config presence |
| Codex | \`AGENTS.md\` | OpenAI Codex environment |
| Goose | \`.goosehints\` | Goose config presence |
| Zed | \`.zed/rules.md\` | Zed config presence |

## Skill Categories

| Category | Description | Skill Count |
|----------|-------------|-------------|
| Development | Code generation, refactoring, debugging, frontend/backend | 800+ |
| Testing | Automated testing, test generation, QA, E2E | 200+ |
| Data | Database management, analytics, data processing, ETL | 300+ |
| AI | Machine learning, NLP, computer vision, embeddings | 400+ |
| DevOps | CI/CD, deployment, infrastructure, monitoring | 200+ |
| Design | UI/UX design, frontend styling, design systems | 150+ |
| Documentation | API docs, technical writing, README generation | 150+ |
| Productivity | Workflow automation, task management, project planning | 300+ |

## Top Curated Collections

| Collection | Skills | URL |
|-----------|--------|-----|
| Top AI Agent Skills | 20+ | https://killer-skills.com/en/collections/top-ai-agents-mcp-servers/ |
| Top Developer Tools | 20+ | https://killer-skills.com/en/collections/top-developer-tools-mcp-servers/ |
| Top MCP Servers | 20+ | https://killer-skills.com/en/collections/top-mcp-mcp-servers/ |
| Top Automation Tools | 15+ | https://killer-skills.com/en/collections/top-automation-mcp-servers/ |
| Top Python Tools | 15+ | https://killer-skills.com/en/collections/top-python-mcp-servers/ |
| Top React Tools | 15+ | https://killer-skills.com/en/collections/top-react-mcp-servers/ |
| Top TypeScript Tools | 15+ | https://killer-skills.com/en/collections/top-typescript-mcp-servers/ |
| Top DevOps Tools | 15+ | https://killer-skills.com/en/collections/top-devops-mcp-servers/ |
| PDF & Document Tools | 10+ | https://killer-skills.com/en/collections/top-pdf-mcp-servers/ |
| Database Tools | 10+ | https://killer-skills.com/en/collections/top-database-mcp-servers/ |

## API Endpoints

### Skills Search API
\`\`\`
GET https://killer-skills.com/api/skills/search?q={query}&category={category}&page={page}
\`\`\`
Returns paginated skill results with name, description, quality score, stars, and owner.

### Skill Detail API
\`\`\`
GET https://killer-skills.com/api/skills/{owner}/{repo}
\`\`\`
Returns full skill details including description, README, installation instructions, and metadata.

## Site Map

| Page | URL | Description |
|------|-----|-------------|
| Home | https://killer-skills.com/en/ | Search and discover AI agent skills |
| Skills Directory | https://killer-skills.com/en/skills/ | Browse all 2,500+ skills with filters |
| Categories | https://killer-skills.com/en/categories/ | Browse skills by category |
| Collections | https://killer-skills.com/en/collections/ | 30+ curated skill collections |
| CLI Docs | https://killer-skills.com/en/cli/ | CLI installation and usage guide |
| Blog | https://killer-skills.com/en/blog/ | Tutorials, guides, and industry news |
| Integrations | https://killer-skills.com/en/integrations/ | IDE and platform integrations |
| Community | https://killer-skills.com/en/community/ | Community links and contribution guide |
| Documentation | https://killer-skills.com/en/docs/ | Technical documentation |

## Frequently Asked Questions

**Q: What is the difference between an AI Agent Skill and an MCP Server?**
A: An AI Agent Skill is a markdown-based instruction file that provides knowledge and workflows to an AI agent within its context window. An MCP Server is a running process that exposes tools and data to AI agents via the Model Context Protocol API. Killer-Skills indexes both types.

**Q: How do I install a skill?**
A: Run \`npx killer-skills add <owner/repo>\` in your terminal. The CLI automatically detects your IDE (Cursor, Windsurf, VS Code, Claude Code, etc.) and installs the skill in the correct location and format.

**Q: Is Killer-Skills free?**
A: Yes. Both the directory website and the CLI tool are free and open source under the MIT license.

**Q: Which IDEs are supported?**
A: Killer-Skills supports 15+ IDEs including Claude Code, Cursor, Windsurf, VS Code, GitHub Copilot, JetBrains IDEs (IntelliJ, WebStorm, PyCharm), Cline, Roo Code, Aider, Continue, Codex, Goose, and Zed.

**Q: How is the quality score calculated?**
A: Quality scores (0-100) are computed using an AI-powered evaluation that considers: documentation completeness, README quality, maintenance activity (commit frequency, issue response time), community adoption (GitHub stars, forks), and code quality signals.

**Q: Can I submit my own skill to the directory?**
A: Yes. Skills are automatically discovered from public GitHub repositories. Ensure your repository contains a well-documented skill file (SKILL.md, .cursorrules, or similar) and it will be indexed during the next crawl cycle.

**Q: How often is the directory updated?**
A: The directory runs automated crawls twice daily to discover new skills and update existing ones. Quality scores and metadata are refreshed during each crawl.

## Technical Stack

- **Frontend**: Astro + React + TailwindCSS
- **Backend**: Cloudflare Workers + D1 (SQLite) + KV
- **CLI**: Node.js + TypeScript (published on npm as \`killer-skills\`)
- **Data Pipeline**: GitHub API crawling + AI-powered enrichment

## Links

- Website: https://killer-skills.com
- GitHub: https://github.com/asiawright1122-boop/Killer-AgentSkills
- npm: https://www.npmjs.com/package/killer-skills
- Discord: https://discord.gg/killer-skills
- Twitter: https://twitter.com/killerskills
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
};
