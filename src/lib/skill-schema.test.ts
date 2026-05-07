import { describe, expect, it } from 'vitest';
import { buildSkillSoftwareApplicationSchema, deriveRatingFromStars } from './skill-schema';

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
    expect((schema.offers as { price: number }).price).toBe(0);
  });

  it('emits aggregateRating when stars cross the threshold', () => {
    const schema = buildSkillSoftwareApplicationSchema({
      name: 'Popular Skill',
      category: 'developer',
      description: 'A widely-starred skill.',
      canonicalUrl: 'https://killer-skills.com/en/skills/acme/popular',
      owner: 'acme',
      stars: 1500,
      version: '1.2.3',
      installUrl: 'https://killer-skills.com/en/skills/acme/popular#install',
    });

    const rating = schema.aggregateRating as {
      ratingValue: number;
      ratingCount: number;
      bestRating: number;
    };
    expect(rating.ratingCount).toBe(1500);
    expect(rating.ratingValue).toBeGreaterThan(4);
    expect(rating.bestRating).toBe(5);
    expect(schema.softwareVersion).toBe('1.2.3');
    expect(schema.installUrl).toMatch(/^https:\/\//);
    expect(schema.downloadUrl).toMatch(/^https:\/\//);
  });

  it('skips aggregateRating below threshold', () => {
    const schema = buildSkillSoftwareApplicationSchema({
      name: 'Fresh',
      category: 'developer',
      description: 'Just published.',
      canonicalUrl: 'https://killer-skills.com/en/skills/acme/fresh',
      owner: 'acme',
      stars: 4,
    });
    expect(schema).not.toHaveProperty('aggregateRating');
  });

  it('deriveRatingFromStars monotonic sanity', () => {
    expect(deriveRatingFromStars(0)).toBeNull();
    expect(deriveRatingFromStars(9)).toBeNull();
    const r10 = deriveRatingFromStars(10)!;
    const r100 = deriveRatingFromStars(100)!;
    const r1000 = deriveRatingFromStars(1000)!;
    expect(r10.ratingValue).toBeLessThan(r100.ratingValue);
    expect(r100.ratingValue).toBeLessThan(r1000.ratingValue);
    expect(deriveRatingFromStars(1e9)!.ratingValue).toBeLessThanOrEqual(5);
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
