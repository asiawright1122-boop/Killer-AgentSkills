import { describe, it, expect } from 'vitest';
import {
  isValidAgentSkill,
  calculateQualityScore,
  getNonTargetSkillReason,
  EXCLUDE_KEYWORDS,
  SUSPICIOUS_NAMES,
  SKILL_HEADERS,
  FUNCTIONAL_KEYWORDS,
  type SkillValidationInput,
  type SkillScoringInput,
} from './validation';

describe('isValidAgentSkill', () => {
  const validSkill: SkillValidationInput = {
    name: 'my-skill',
    owner: 'user123',
    body: '# Usage\nThis skill does something for Claude Code and AI agents.\n## Input\nSome input.\n## Output\nSome output.',
    description: 'A useful agent skill for AI coding assistants',
    topics: ['claude', 'ai agent'],
  };

  it('should return valid for a well-formed skill', () => {
    const result = isValidAgentSkill(validSkill);
    expect(result.valid).toBe(true);
  });

  it('should reject skills with exclude keywords in description', () => {
    const skill = { ...validSkill, description: 'This is a tutorial project' };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exclusion keyword');
  });

  it('should reject skills with exclude keywords in topics', () => {
    const skill = { ...validSkill, topics: ['leetcode', 'practice'] };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
  });

  it('should reject skills with missing name', () => {
    const skill = { ...validSkill, name: '' };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing name');
  });

  it('should reject suspicious names for non-official repos', () => {
    const skill = { ...validSkill, name: 'test' };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Suspicious name');
  });

  it('should reject skills without headers or keywords (non-official)', () => {
    const skill = {
      ...validSkill,
      body: 'This is just some random text without any structure at all.',
    };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing standard structure');
  });

  it('should reject skills with body too short (non-official)', () => {
    const skill = {
      ...validSkill,
      body: '# Usage\nShort.',
    };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('too short');
  });

  it('should pass skills with enough functional keywords even without headers', () => {
    const skill = {
      ...validSkill,
      body: 'This skill provides an action to trigger the api tool and process the input with schema validation for the output command. Works with Claude and MCP.',
    };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(true);
  });

  it('should reject non-target product manager skills', () => {
    const skill = {
      ...validSkill,
      description: 'A product manager workflow for PRD drafting and stakeholder planning.',
    };
    const result = isValidAgentSkill(skill);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Non-target skill theme');
  });

  it('should ignore localized summary boilerplate when the preferred description is safe', () => {
    const skill: SkillValidationInput = {
      ...validSkill,
      name: 'github-workflow',
      description: {
        en: 'GitHub workflow automation skill for Claude Code and MCP-based repository tasks.',
        fr: 'Resume localise : GitHub workflow automation skill for Claude Code and MCP-based repository tasks.',
      },
    };

    expect(getNonTargetSkillReason(skill)).toBe('');
  });

  it('should still flag real resume skills from the preferred description', () => {
    const skill: SkillValidationInput = {
      ...validSkill,
      name: 'resume-latex-pdf-generator',
      description: {
        en: 'Generates and compiles a single-page US Letter LaTeX resume for job applications.',
        fr: 'Resume localise : Generateur de CV LaTeX.',
      },
      topics: ['resume', 'latex'],
    };

    expect(getNonTargetSkillReason(skill)).toBe('career-prep');
  });

  it('should not flag technical resume commands without career context', () => {
    const skill: SkillValidationInput = {
      ...validSkill,
      name: 'slash-commands',
      description: 'Create and use Claude Code slash commands for repository workflows.',
      body: [
        '# Usage',
        'Use `/resume` to continue a session.',
        'Use `resume from cursor` to continue pagination.',
        'This skill is for Claude Code and MCP-driven command workflows.',
      ].join('\n'),
    };

    expect(getNonTargetSkillReason(skill)).toBe('');
  });

  it('should not flag portfolio-performance language that is unrelated to personal portfolios', () => {
    const skill: SkillValidationInput = {
      ...validSkill,
      name: 'build-plugin',
      description: 'Build a production-ready OpenTabs plugin for Claude Code workflows.',
      body: [
        '# Usage',
        'This Claude Code skill documents API helpers for accounts, portfolio performance, and crypto workflows.',
        'It supports MCP and browser automation tasks for AI agents.',
      ].join('\n'),
    };

    expect(getNonTargetSkillReason(skill)).toBe('');
  });
});

describe('calculateQualityScore', () => {
  const baseSkill: SkillScoringInput = {
    name: 'my-skill',
    owner: 'user123',
    repo: 'my-skill-repo',
    body: '# Usage\nDo something.\n## Input\nTakes input.\n## Output\nProduces output.\n```json\n{"key": "value"}\n```',
    description: 'A comprehensive skill for automating workflows and tasks.',
    topics: ['automation'],
    stars: 100,
    version: '1.0.0',
    tags: ['productivity'],
    updatedAt: new Date().toISOString(),
    repoPath: '.codex/SKILL.md',
  };

  it('should return 0 for skills with no name', () => {
    const skill = { ...baseSkill, name: '' };
    expect(calculateQualityScore(skill)).toBe(0);
  });

  it('should return 0 for suspicious names (non-official)', () => {
    const skill = { ...baseSkill, name: 'test' };
    expect(calculateQualityScore(skill)).toBe(0);
  });

  it('should give points for structural headers', () => {
    const base: SkillScoringInput = {
      name: 'a-skill',
      owner: 'someone',
      repo: 'a-repo',
      body: '',
      description: 'Short',
    };
    const withHeaders = calculateQualityScore({
      ...base,
      body: '# Usage\nThis skill provides an action to process tool input and generate structured output for the user workflow.',
    });
    const withoutHeaders = calculateQualityScore({
      ...base,
      body: 'This skill provides an action to process tool input and generate structured output for the user workflow.',
    });
    expect(withHeaders).toBeGreaterThan(withoutHeaders);
  });

  it('should give points for code blocks', () => {
    const base: SkillScoringInput = {
      name: 'a-skill',
      owner: 'someone',
      repo: 'a-repo',
      body: '',
      description: 'Short',
    };
    const withCode = calculateQualityScore({
      ...base,
      body: '# Usage\nDo something with action tool.\n```json\n{"key": "value"}\n```',
    });
    const withoutCode = calculateQualityScore({
      ...base,
      body: '# Usage\nDo something with action tool.',
    });
    expect(withCode).toBeGreaterThan(withoutCode);
  });

  it('should give points for standard path', () => {
    const withPath = calculateQualityScore(baseSkill);
    const withoutPath = calculateQualityScore({ ...baseSkill, repoPath: 'random/path.md' });
    expect(withPath).toBeGreaterThan(withoutPath);
  });

  it('should give points for metadata completeness', () => {
    const full = calculateQualityScore(baseSkill);
    const minimal = calculateQualityScore({
      ...baseSkill,
      version: undefined,
      tags: [],
      description: 'Short',
    });
    expect(full).toBeGreaterThan(minimal);
  });

  it('should give bonus for high stars', () => {
    const minimalSkill: SkillScoringInput = {
      name: 'a-skill',
      owner: 'someone',
      repo: 'a-repo',
      body: '# Usage\nDo something with this action tool.\n## Input\nTakes input.',
      description: 'Short',
    };
    const highStars = calculateQualityScore({ ...minimalSkill, stars: 100 });
    const lowStars = calculateQualityScore({ ...minimalSkill, stars: 2 });
    expect(highStars).toBeGreaterThan(lowStars);
  });

  it('should cap score at 100', () => {
    expect(calculateQualityScore(baseSkill)).toBeLessThanOrEqual(100);
  });

  it('should return 0 for MVP builder themed skills', () => {
    const skill = {
      ...baseSkill,
      description: 'An MVP builder workflow for startup launch experiments.',
    };
    expect(calculateQualityScore(skill)).toBe(0);
  });
});

describe('Constants', () => {
  it('EXCLUDE_KEYWORDS should contain expected entries', () => {
    expect(EXCLUDE_KEYWORDS).toContain('tutorial');
    expect(EXCLUDE_KEYWORDS).toContain('leetcode');
    expect(EXCLUDE_KEYWORDS).toContain('product manager');
    expect(EXCLUDE_KEYWORDS.length).toBeGreaterThan(5);
  });

  it('SUSPICIOUS_NAMES should contain expected entries', () => {
    expect(SUSPICIOUS_NAMES).toContain('test');
    expect(SUSPICIOUS_NAMES).toContain('demo');
  });

  it('SKILL_HEADERS should contain usage headers', () => {
    expect(SKILL_HEADERS).toContain('# usage');
    expect(SKILL_HEADERS).toContain('## usage');
  });

  it('FUNCTIONAL_KEYWORDS should contain expected entries', () => {
    expect(FUNCTIONAL_KEYWORDS).toContain('action');
    expect(FUNCTIONAL_KEYWORDS).toContain('tool');
  });
});
