import { describe, expect, it } from 'vitest';
import { sanitizePublicSkill, sanitizePublicSkillLikeRecord, sanitizePublicSkillMd } from './public-skill-api';
import type { UnifiedSkill } from './skills';

describe('public skill API sanitizer', () => {
  it('strips hidden reasoning from skillMd metadata and body previews', () => {
    const result = sanitizePublicSkillMd(
      {
        description: '<thinking>private metadata</thinking> Public description',
        body: '# Usage\n\n<reasoning>hidden body</reasoning>\n\nUse the public instructions.',
      },
      { includeBodyPreview: true },
    );

    expect(result?.description).toBe('Public description');
    expect(result?.bodyPreview).toBe('Usage Use the public instructions.');
  });

  it('strips hidden reasoning from nested public skill records', () => {
    const result = sanitizePublicSkill({
      id: 'test/skill',
      name: 'Test Skill',
      skillName: 'Test Skill',
      owner: 'test',
      repo: 'skill',
      description: {
        en: 'Chain of thought:\nprivate notes\n\nPublic skill description.',
      },
      category: 'developer',
      topics: ['api'],
      stars: 1,
      source: 'cache',
      updatedAt: '2026-01-01T00:00:00Z',
      skillMd: {
        body: '<thinking>private body</thinking>\n\nPublic body',
      },
      agentAnalysis: {
        suitability: '<thinking>private suitability</thinking> Public suitability',
        recommendation: '<analysis>private recommendation</analysis> Public recommendation',
        useCases: ['Scratchpad:\nprivate case\n\nPublic use case'],
        limitations: ['Private analysis:\nprivate limitation\n\nPublic limitation'],
      },
    } satisfies UnifiedSkill);

    expect(result.description).toEqual({ en: 'Public skill description.' });
    expect(result.agentAnalysis).toEqual({
      suitability: 'Public suitability',
      recommendation: 'Public recommendation',
      useCases: ['Public use case'],
      limitations: ['Public limitation'],
    });
    expect((result.skillMd as Record<string, unknown> | undefined)?.body).toBeUndefined();
  });

  it('strips hidden reasoning from generic public skill-like records', () => {
    const result = sanitizePublicSkillLikeRecord({
      name: 'Example',
      filePath: '.claude/skills/example/SKILL.md',
      description: '<thinking>private</thinking> Public description',
      nested: {
        summary: 'Private analysis:\nnotes\n\nPublic summary.',
      },
    });

    expect(result).toEqual({
      name: 'Example',
      description: 'Public description',
      nested: {
        summary: 'Public summary.',
      },
    });
  });
});
