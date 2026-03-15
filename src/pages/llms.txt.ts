import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * GET /llms.txt
 * Returns a machine-readable summary of the Killer-Skills world for LLM crawlers.
 */
export const GET: APIRoute = async () => {
  const content = `
# Killer-Skills: The AI Agent Skills Directory

An AI Agent Skill is a plug-and-play instruction module, typically a markdown file, that teaches AI coding assistants how to perform specialized tasks autonomously. Unlike traditional plugins, skills operate at the domain level; they inject specific knowledge, workflows, and constraints directly into the AI agent.

## Key Facts
- Total skills indexed: 2,500+ from verified source repositories on GitHub.
- Languages supported: English, Chinese, Japanese, Korean, Spanish, French, German, Portuguese, Russian, Arabic.
- One-command install: npx killer-skills install <skill-name>
- One-command copy: npx killer-skills copy <skill-name>

## Directory structure
- [Home](https://killer-skills.com/en)
- [All Skills](https://killer-skills.com/en/skills)
- [Collections](https://killer-skills.com/en/collections)
- [Documentation](https://killer-skills.com/en/docs)
- [CLI Docs](https://killer-skills.com/en/cli)

## Featured Skills
- [GitHub MCP Server](https://killer-skills.com/en/skills/modelcontextprotocol/servers/src/github) - Perform GitHub operations (search, issues, PRs)
- [Postgres MCP Server](https://killer-skills.com/en/skills/modelcontextprotocol/servers/src/postgres) - Read and write Postgres databases
- [Google Search MCP](https://killer-skills.com/en/skills/modelcontextprotocol/servers/src/google-maps) - Access real-time web information
- [Sequential Thinking](https://killer-skills.com/en/skills/modelcontextprotocol/servers/src/sequentialthinking) - Enhanced reasoning for complex problem solving

## Integration
AI agents (like Claude Desktop, Antigravity, or Cursor) can consume these skills by reading the .md files in this repository or using the MCP (Model Context Protocol).

For full details, visit [Killer-Skills](https://killer-skills.com).
`.trim();

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
