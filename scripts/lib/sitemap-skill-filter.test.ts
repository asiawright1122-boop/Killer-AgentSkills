import { describe, expect, it } from 'vitest';
import { isPublicSkillForSitemap } from './sitemap-skill-filter.js';

describe('sitemap skill filter', () => {
  it('does not exclude AI skills that mention portfolio in a non-career context', () => {
    expect(
      isPublicSkillForSitemap({
        name: 'build-plugin',
        owner: 'opentabs-dev',
        repo: 'opentabs',
        description: 'Build a production-ready Claude Code plugin workflow.',
        topics: ['claude-code', 'mcp', 'ai-agents'],
        filePath: '.claude/skills/build-plugin/SKILL.md',
        skillMd: {
          body:
            'This skill covers plugin build workflows, portfolio performance dashboards, MCP integration, and agent automation patterns.',
        },
      }),
    ).toBe(true);
  });

  it('still excludes obvious career portfolio templates', () => {
    expect(
      isPublicSkillForSitemap({
        name: 'portfolio-helper',
        owner: 'demo',
        repo: 'portfolio-site',
        description: 'Personal portfolio resume site builder for job applications.',
        topics: ['portfolio'],
        filePath: '.claude/skills/portfolio-helper/SKILL.md',
        skillMd: {
          body: 'Use this template to create a personal portfolio site and resume showcase for hiring.',
        },
      }),
    ).toBe(false);
  });
});
