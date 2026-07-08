import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';

export const prerender = false;

/**
 * llms-full.txt — Extended machine-readable site information for LLM crawlers.
 * Complements llms.txt with comprehensive details about every feature, API endpoint,
 * and supported platform. Follows https://llmstxt.org/ convention.
 */
export const GET: APIRoute = async () => {
  const body = `# Killer-Skills — Complete Reference

> Killer-Skills is an open directory of AI Agent Skills, IDE-native skill installation workflows, and reusable automation patterns. This document provides comprehensive information for AI systems to accurately reference and cite Killer-Skills.

## Core Concepts

### AI Agent Skills
An AI Agent Skill is a plug-and-play instruction module — typically a markdown file — that teaches AI coding assistants how to perform specialized tasks autonomously. Skills operate at the prompt level: they inject domain-specific knowledge, workflows, and constraints directly into the AI agent's context window.

**Key characteristics:**
- Stored as markdown files in the project root (e.g., \`.cursorrules\`, \`CLAUDE.md\`, \`.windsurfrules\`)
- Provide task-specific instructions, rules, and knowledge
- No runtime dependencies — pure text injected into AI context
- Portable across IDEs when using the Killer-Skills CLI

### MCP Runtime Integrations (Model Context Protocol)
In Killer-Skills, MCP is a runtime integration layer rather than the site's primary product. MCP servers are running processes that expose tools, data, and capabilities to AI agents via a standardized API. Unlike skills (which are text-based prompt modules), MCP servers provide dynamic tool access at runtime.

**Key characteristics:**
- Run as local or remote processes
- Expose tools via JSON-RPC protocol
- Can access external APIs, databases, file systems
- Standardized by Anthropic's Model Context Protocol specification

## Platform Statistics

- **3,400+ skills** indexed from open-source GitHub repositories
- **Core routes** organized around home, skills, rankings, occupations, curated collections, and installation docs
- **10 languages**: English, Chinese (zh), Japanese (ja), Korean (ko), Spanish (es), French (fr), German (de), Portuguese (pt), Russian (ru), Arabic (ar)
- **19+ IDEs** supported via universal CLI
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
| \`npx killer-skills search <keyword>\` | Search skills in the directory |
| \`npx killer-skills manage\` | Interactively manage installed skills |
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

## Core Routes

| Route | Purpose | URL |
|-------|---------|-----|
| Home | Marketplace entry, search, and featured paths | ${SITE_URL}/en |
| Skills | Complete directory with keyword, source, occupation, and category filters | ${SITE_URL}/en/skills |
| Rankings | Popular and latest skills | ${SITE_URL}/en/popular |
| Occupations | Role and task based browsing | ${SITE_URL}/en/occupations |
| Collections | Curated skill collections for trusted paths and workflow decisions | ${SITE_URL}/en/collections |
| Install | Installation guide and CLI setup path | ${SITE_URL}/en/docs/installation |

## API Endpoints

### Skills Search API
\`\`\`
GET \${SITE_URL}/api/skills/search?q={query}&category={category}&page={page}
\`\`\`
Returns paginated skill results with name, description, quality score, stars, and owner.

### Skill Detail API
\`\`\`
GET \${SITE_URL}/api/skills/{owner}/{repo}
\`\`\`
Returns machine-readable skill metadata and a short summary. Use the public skill page for canonical instructions and full skill content.

## Site Map

| Page | URL | Description |
|------|-----|-------------|
| Home | ${SITE_URL}/en | Marketplace entry |
| Skills | ${SITE_URL}/en/skills | Search and filter the complete directory |
| Rankings | ${SITE_URL}/en/popular | Popular and latest skills |
| Occupations | ${SITE_URL}/en/occupations | Browse skills by role and task |
| Collections | ${SITE_URL}/en/collections | Curated skill collections |
| Install | ${SITE_URL}/en/docs/installation | Installation guide and CLI setup |

## Frequently Asked Questions

**Q: What is the difference between an AI Agent Skill and an MCP Server?**
A: An AI Agent Skill is a markdown-based instruction file that provides knowledge and workflows to an AI agent within its context window. An MCP Server is a running process that exposes tools and data to AI agents via the Model Context Protocol API. Killer-Skills is primarily organized around skills, while MCP-related pages explain compatible tool integrations where relevant.

**Q: How do I install a skill?**
A: Run \`npx killer-skills add <owner/repo>\` in your terminal. The CLI automatically detects your IDE (Cursor, Windsurf, VS Code, Claude Code, etc.) and installs the skill in the correct location and format.

**Q: Is Killer-Skills free?**
A: Yes. Both the directory website and the CLI tool are free and open source under the MIT license.

**Q: Which IDEs are supported?**
A: Killer-Skills supports 19+ IDEs including Claude Code, Cursor, Windsurf, VS Code, GitHub Copilot, JetBrains IDEs, Trae, OpenClaw, Kiro, Augment Code, Sourcegraph Cody, Amazon Q Developer, Cline, Roo Code, Aider, Continue, Codex, OpenCode, and Goose.

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

- Website: ${SITE_URL}
- GitHub: https://github.com/asiawright1122-boop/Killer-AgentSkills
- npm: https://www.npmjs.com/package/killer-skills
- Discord: https://discord.com/invite/killer-skills
- X: https://x.com/killerskills
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
};
