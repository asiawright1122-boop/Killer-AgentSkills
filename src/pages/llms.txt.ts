import type { APIRoute } from 'astro';

export const prerender = true;

/**
 * llms.txt — Machine-readable site information for LLM crawlers and AI search engines.
 * Emerging standard similar to robots.txt but specifically for AI/LLM systems.
 * See: https://llmstxt.org/
 */
export const GET: APIRoute = async () => {
  const body = `# Killer-Skills

> Killer-Skills is the world's largest open-source directory of AI Agent Skills and MCP Servers, with 2,500+ verified entries. It enables developers to discover, install, and manage specialized instruction modules for AI coding agents like Claude Code, Cursor, Windsurf, and 15+ other IDEs.

## What Are AI Agent Skills?

An **AI Agent Skill** is a plug-and-play instruction module (typically a markdown file) that teaches AI coding assistants how to perform specialized tasks autonomously. Unlike traditional plugins, skills operate at the prompt level — they inject domain-specific knowledge, workflows, and constraints directly into the AI agent's context window. The Model Context Protocol (MCP) Server is a related standard that provides AI agents with external tool access via a standardized API.

## Key Facts

- **2,500+ skills** indexed from open-source repositories on GitHub
- **10 languages** supported: English, Chinese, Japanese, Korean, Spanish, French, German, Portuguese, Russian, Arabic
- **One-command install**: \`npx killer-skills add <owner/repo>\` works across all supported IDEs
- **Quality scoring**: Every skill receives an AI-powered quality score (0-100) based on documentation quality, maintenance activity, and community adoption
- **15+ IDE support**: Claude Code, Cursor, Windsurf, VS Code, GitHub Copilot, JetBrains, Cline, Roo Code, and more
- **Open source**: Both the directory and CLI are open source under MIT license

## How It Works

1. **Browse** the directory at https://killer-skills.com/en/skills/ or search by keyword, category, or IDE
2. **Install** any skill with one command: \`npx killer-skills add <skill-name>\`
3. **Use** — the CLI auto-detects your IDE and configures the skill. Your AI agent immediately gains the new capability

## Main Pages

- [Home](https://killer-skills.com/en/) — Search and discover skills
- [Browse All Skills](https://killer-skills.com/en/skills/) — Full directory with filters
- [Categories](https://killer-skills.com/en/categories/) — Browse by category (Development, Testing, Data, AI, DevOps, Design, Documentation, Productivity)
- [Collections](https://killer-skills.com/en/collections/) — 30+ curated skill collections
- [CLI Documentation](https://killer-skills.com/en/cli/) — Installation and usage guide
- [Blog](https://killer-skills.com/en/blog/) — Tutorials, guides, and news
- [Community](https://killer-skills.com/en/community/) — Contribute and connect
- [Integrations](https://killer-skills.com/en/integrations/) — IDE and platform integrations

## Top Curated Collections

| Collection | URL |
|-----------|-----|
| Top AI Agent Skills | https://killer-skills.com/en/collections/top-ai-agents-mcp-servers/ |
| Top Developer Tools | https://killer-skills.com/en/collections/top-developer-tools-mcp-servers/ |
| Top MCP Servers | https://killer-skills.com/en/collections/top-mcp-mcp-servers/ |
| Top Automation Tools | https://killer-skills.com/en/collections/top-automation-mcp-servers/ |
| Top Python Tools | https://killer-skills.com/en/collections/top-python-mcp-servers/ |
| Top React Tools | https://killer-skills.com/en/collections/top-react-mcp-servers/ |
| Top TypeScript Tools | https://killer-skills.com/en/collections/top-typescript-mcp-servers/ |
| Top DevOps Tools | https://killer-skills.com/en/collections/top-devops-mcp-servers/ |

## Categories

| Category | Description | Example Skills |
|----------|-------------|---------------|
| Development | Code generation, refactoring, debugging | frontend-design, mcp-builder |
| Testing | Automated testing, test generation, QA | webapp-testing, full-test |
| Data | Database, analytics, data processing | xlsx, pdf |
| AI | Machine learning, NLP, computer vision | algorithmic-art |
| DevOps | CI/CD, deployment, infrastructure | debug |
| Design | UI/UX, frontend design, styling | ui-ux-pro-max, canvas-design |
| Documentation | API docs, technical writing | doc-coauthoring, docx |
| Productivity | Workflow automation, task management | planning-with-files, pptx |

## Frequently Asked Questions

**What is the difference between an AI Agent Skill and an MCP Server?**
An AI Agent Skill is a markdown-based instruction file that provides knowledge and workflows to an AI agent within its context window. An MCP Server is a running process that exposes tools and data to AI agents via the Model Context Protocol API. Killer-Skills indexes both types.

**How do I install a skill?**
Run \`npx killer-skills add <owner/repo>\` in your terminal. The CLI automatically detects your IDE (Cursor, Windsurf, VS Code, Claude Code, etc.) and installs the skill in the correct location.

**Is Killer-Skills free?**
Yes. Both the directory website and the CLI tool are free and open source under the MIT license.

**Which IDEs are supported?**
Killer-Skills supports 15+ IDEs including Claude Code, Cursor, Windsurf, VS Code, GitHub Copilot, JetBrains IDEs, Cline, Roo Code, Aider, and Continue.

## API

- Skills Search: GET https://killer-skills.com/api/skills/search?q={query}
- Skill Detail: GET https://killer-skills.com/api/skills/{owner}/{repo}

## Contact

- Website: https://killer-skills.com
- GitHub: https://github.com/asiawright1122-boop/Killer-AgentSkills
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
};
