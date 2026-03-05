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
