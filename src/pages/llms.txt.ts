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
- One-command install: npx killer-skills add <owner/repo>
- Cross-IDE delivery: writes the right native skill file for each supported environment

## Directory structure
- [Home](https://killer-skills.com/en)
- [All Skills](https://killer-skills.com/en/skills)
- [Collections](https://killer-skills.com/en/collections)
- [Documentation](https://killer-skills.com/en/docs)
- [CLI Docs](https://killer-skills.com/en/cli)

## Featured Skills
- [PDF Skill](https://killer-skills.com/en/skills/anthropics/skills/pdf) - PDF extraction, OCR, splitting, merging, and form workflows
- [Algorithmic Art Skill](https://killer-skills.com/en/skills/anthropics/skills/algorithmic-art) - Generate original algorithmic art with code-driven workflows
- [Internal Comms Skill](https://killer-skills.com/en/skills/anthropics/skills/internal-comms) - Draft updates, FAQs, reports, and internal communication artifacts
- [Webapp Testing Skill](https://killer-skills.com/en/skills/anthropics/skills/webapp-testing) - Test local web apps with browser automation and UI verification

## Integration
AI tools like Claude Code, Cursor, Windsurf, and VS Code extensions can consume these skills by reading markdown-based instruction files or by using the Killer-Skills CLI to write the correct native format.

For full details, visit [Killer-Skills](https://killer-skills.com).
`.trim();

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
