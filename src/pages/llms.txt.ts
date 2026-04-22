import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';

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
- Total skills indexed: 3,400+ from verified source repositories on GitHub.
- Languages supported: English, Chinese, Japanese, Korean, Spanish, French, German, Portuguese, Russian, Arabic.
- One-command install: npx killer-skills add <owner/repo>
- Cross-IDE delivery: writes the right native skill file for each supported environment

## Directory structure
- [Home](${SITE_URL}/en)
- [All Skills](${SITE_URL}/en/skills)
- [Collections](${SITE_URL}/en/collections)
- [Documentation](${SITE_URL}/en/docs)
- [CLI Docs](${SITE_URL}/en/cli)

## Featured Skills
- [PDF Skill](${SITE_URL}/en/skills/anthropics/skills/pdf) - PDF extraction, OCR, splitting, merging, and form workflows
- [Algorithmic Art Skill](${SITE_URL}/en/skills/anthropics/skills/algorithmic-art) - Generate original algorithmic art with code-driven workflows
- [Internal Comms Skill](${SITE_URL}/en/skills/anthropics/skills/internal-comms) - Draft updates, FAQs, reports, and internal communication artifacts
- [Webapp Testing Skill](${SITE_URL}/en/skills/anthropics/skills/webapp-testing) - Test local web apps with browser automation and UI verification

## Integration
AI tools like Claude Code, Cursor, Windsurf, and VS Code extensions can consume these skills by reading markdown-based instruction files or by using the Killer-Skills CLI to write the correct native format.

For full details, visit [Killer-Skills](${SITE_URL}).
`.trim();

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
