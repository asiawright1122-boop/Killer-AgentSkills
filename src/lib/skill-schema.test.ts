import { describe, expect, it } from 'vitest';
import { buildSkillSoftwareApplicationSchema } from './skill-schema';

describe('skill-schema', () => {
  it('builds software application schema without synthetic aggregate ratings', () => {
    const schema = buildSkillSoftwareApplicationSchema({
      name: 'Workflow Helper',
      category: 'developer',
      description: 'Automates multi-step development workflows.',
      canonicalUrl: 'https://killer-skills.com/en/skills/acme/workflow-helper',
      owner: 'acme',
      updatedAt: '2026-03-15T00:00:00.000Z',
    });

    expect(schema['@type']).toBe('SoftwareApplication');
    expect(schema.description).toContain('AI Agent Skill');
    expect(schema).not.toHaveProperty('aggregateRating');
    expect(schema).not.toHaveProperty('offers');
    expect(schema.isAccessibleForFree).toBe(true);
  });

  it('keeps skills-first public keywords and avoids MCP-first keyword defaults', () => {
    const schema = buildSkillSoftwareApplicationSchema({
      name: 'Workflow Helper',
      category: 'developer',
      description: 'Automates multi-step development workflows.',
      canonicalUrl: 'https://killer-skills.com/en/skills/acme/workflow-helper',
      owner: 'acme',
    });

    expect(schema.keywords).toContain('AI Agent Skills');
    expect(schema.keywords).toContain('IDE Skills');
    expect(schema.keywords).not.toContain('MCP Server');
    expect(schema.keywords).not.toContain('MCP Tools');
    expect(schema.keywords).not.toContain('Model Context Protocol');
  });

  it('keeps skills-first description and avoids MCP-first public wording', () => {
    const schema = buildSkillSoftwareApplicationSchema({
      name: 'Workflow Helper',
      category: 'developer',
      description: 'Automates multi-step development workflows.',
      canonicalUrl: 'https://killer-skills.com/en/skills/acme/workflow-helper',
      owner: 'acme',
    });

    expect(schema.description).toContain('AI Agent Skill');
    expect(schema.description).not.toMatch(/\bMCP\b/i);
    expect(schema.description).not.toMatch(/model context protocol/i);
  });
});
