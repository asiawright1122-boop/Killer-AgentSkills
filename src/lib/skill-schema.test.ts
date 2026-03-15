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
    expect(schema.offers.price).toBe(0);
  });
});
