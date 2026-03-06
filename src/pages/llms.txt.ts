import type { APIRoute } from 'astro';

export const prerender = true;

/**
 * llms.txt — Machine-readable site information for LLM crawlers and AI search engines.
 * Emerging standard similar to robots.txt but specifically for AI/LLM systems.
 * See: https://llmstxt.org/
 */
export const GET: APIRoute = async () => {
    const body = `# Killer-Skills

> The ultimate directory of AI Development Skills for Claude, Cursor, Windsurf, and other AI coding agents.

## About

Killer-Skills is a curated, searchable directory of 2000+ AI Agent Skills and MCP Servers. Each skill extends the capabilities of AI coding agents like Claude Code, Cursor, and Windsurf with specialized knowledge, workflows, or tool integrations.

## Key Features

- Browse 2000+ AI Agent Skills and MCP Servers
- One-command installation via CLI: \`npx killer-skills install <skill>\`
- Quality scoring and AI-powered analysis for every skill
- Available in 10 languages (EN, ZH, JA, KO, ES, FR, DE, PT, RU, AR)

## Main Pages

- [Home](https://killer-skills.com/en/)
- [Browse All Skills](https://killer-skills.com/en/skills/)
- [Categories](https://killer-skills.com/en/categories/)
- [CLI Documentation](https://killer-skills.com/en/cli/)
- [Blog](https://killer-skills.com/en/blog/)
- [Community](https://killer-skills.com/en/community/)
- [Integrations](https://killer-skills.com/en/integrations/)

## Curated Collections

Killer-Skills offers 30+ curated collections of top AI Agent skills grouped by topic:

- [All Collections](https://killer-skills.com/en/collections/)
- [Top AI Agents Skills](https://killer-skills.com/en/collections/top-ai-agents-mcp-servers/)
- [Top Developer Tools](https://killer-skills.com/en/collections/top-developer-tools-mcp-servers/)
- [Top MCP Servers](https://killer-skills.com/en/collections/top-mcp-mcp-servers/)
- [Top Automation Tools](https://killer-skills.com/en/collections/top-automation-mcp-servers/)
- [Top Python Tools](https://killer-skills.com/en/collections/top-python-mcp-servers/)
- [Top React Tools](https://killer-skills.com/en/collections/top-react-mcp-servers/)
- [Top TypeScript Tools](https://killer-skills.com/en/collections/top-typescript-mcp-servers/)
- [Top DevOps Tools](https://killer-skills.com/en/collections/top-devops-mcp-servers/)
- [Top Prompt Engineering Tools](https://killer-skills.com/en/collections/top-prompt-engineering-mcp-servers/)

## Categories

- Development: Code generation, refactoring, debugging skills
- Testing: Automated testing, test generation, QA skills
- Data: Database, analytics, data processing skills
- AI: Machine learning, NLP, computer vision skills
- DevOps: CI/CD, deployment, infrastructure skills
- Design: UI/UX, frontend design, styling skills
- Documentation: API docs, technical writing, README generation
- Productivity: Workflow automation, task management skills

## API

- Skills Search: https://killer-skills.com/api/skills/search?q={query}
- Skill Detail: https://killer-skills.com/api/skills/{owner}/{repo}

## Contact

- Website: https://killer-skills.com
- GitHub: https://github.com/anthropics/skills
`;

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
        },
    });
};
