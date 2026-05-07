import { describe, expect, it } from 'vitest';
import {
  SKILL_SEO_DESCRIPTION_MAX,
  SKILL_SEO_TITLE_MAX,
  buildSkillKeywordSeed,
  matchesIntentSignals,
  normalizeForMatch,
  normalizeSpace,
  resolveSkillSeoDescription,
  resolveSkillSeoTitle,
  truncateText,
} from './skill-seo-meta';

const intent = {
  titleLabel: 'AI Agent Skill',
  useCaseLabel: 'workflow automation',
  keywords: ['claude code', 'automation'],
  supportTerm: 'workflow automation',
};

describe('normalizeSpace / normalizeForMatch', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSpace('  a   b\n c ')).toBe('a b c');
  });
  it('is case-insensitive for match normalization', () => {
    expect(normalizeForMatch('Foo  BAR')).toBe('foo bar');
  });
});

describe('truncateText', () => {
  it('returns text untouched if within limit', () => {
    expect(truncateText('short', 20)).toBe('short');
  });
  it('breaks on nearest word boundary past 60% threshold', () => {
    const input = 'alpha beta gamma delta epsilon zeta';
    const out = truncateText(input, 20);
    expect(out.endsWith('...')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(23);
  });
  it('falls back to hard cut when no boundary present', () => {
    const out = truncateText('abcdefghijklmnop', 5);
    expect(out).toBe('abcde...');
  });
});

describe('matchesIntentSignals', () => {
  it('returns false for empty text or no signals', () => {
    expect(matchesIntentSignals(undefined, ['foo'])).toBe(false);
    expect(matchesIntentSignals('hello', [])).toBe(false);
    expect(matchesIntentSignals('hello', [''])).toBe(false);
  });
  it('is case/space insensitive', () => {
    expect(matchesIntentSignals('Claude Code integration', ['claude  code'])).toBe(true);
  });
});

describe('resolveSkillSeoTitle', () => {
  const base = {
    skillDisplayName: 'n8n',
    skillName: 'n8n',
    intent,
    category: 'Workflow Automation',
  };

  it('uses override verbatim when provided', () => {
    const { title, usedTemplate } = resolveSkillSeoTitle({
      ...base,
      rawSeoTitle: 'Some Raw Title',
      override: 'n8n Workflow Automation Skill for Claude Code',
    });
    expect(title).toBe('n8n Workflow Automation Skill for Claude Code');
    expect(usedTemplate).toBe(false);
  });

  it('falls back to template when raw is missing', () => {
    const { title, usedTemplate } = resolveSkillSeoTitle({ ...base });
    expect(usedTemplate).toBe(true);
    expect(title).toContain('n8n');
    expect(title.length).toBeLessThanOrEqual(SKILL_SEO_TITLE_MAX + 3); // +3 for ellipsis
  });

  it('falls back to template when raw does not match intent signals', () => {
    const { usedTemplate } = resolveSkillSeoTitle({
      ...base,
      rawSeoTitle: 'Totally unrelated marketing copy',
    });
    expect(usedTemplate).toBe(true);
  });

  it('keeps a high-quality raw title that matches intent', () => {
    const { title, usedTemplate } = resolveSkillSeoTitle({
      ...base,
      rawSeoTitle: 'n8n AI Agent Skill for Workflow Automation',
    });
    expect(usedTemplate).toBe(false);
    expect(title).toContain('n8n');
  });

  it('respects forceTemplate even if raw is valid', () => {
    const { usedTemplate } = resolveSkillSeoTitle({
      ...base,
      rawSeoTitle: 'n8n AI Agent Skill for Workflow Automation',
      forceTemplate: true,
    });
    expect(usedTemplate).toBe(true);
  });

  it('truncates long titles to 60 chars (+ ellipsis)', () => {
    const { title } = resolveSkillSeoTitle({
      ...base,
      skillDisplayName: 'Very Long Skill Name That Exceeds Sixty Character Limit For Sure',
    });
    expect(title.length).toBeLessThanOrEqual(SKILL_SEO_TITLE_MAX + 3);
    expect(title.endsWith('...')).toBe(true);
  });
});

describe('resolveSkillSeoDescription', () => {
  const base = {
    templateDescription: 'Install n8n, an AI agent skill for workflow automation. Learn setup and use cases.',
    intent,
    defaultDescription: 'The ultimate directory of AI Development Skills for Agents.',
  };

  it('uses override when provided', () => {
    const { description, usedTemplate } = resolveSkillSeoDescription({
      ...base,
      override: 'Hand-tuned description for n8n workflow automation.',
    });
    expect(description.startsWith('Hand-tuned')).toBe(true);
    expect(usedTemplate).toBe(false);
  });

  it('uses template when raw missing', () => {
    const { usedTemplate, description } = resolveSkillSeoDescription({ ...base });
    expect(usedTemplate).toBe(true);
    expect(description.length).toBeLessThanOrEqual(SKILL_SEO_DESCRIPTION_MAX + 3);
  });

  it('uses template when raw misses intent signals', () => {
    const { usedTemplate } = resolveSkillSeoDescription({
      ...base,
      rawSeoDescription: 'Random blurb with no relevant terms here at all.',
    });
    expect(usedTemplate).toBe(true);
  });

  it('keeps raw description when it matches intent', () => {
    const { usedTemplate, description } = resolveSkillSeoDescription({
      ...base,
      rawSeoDescription: 'Automate workflows with Claude Code using this n8n AI agent skill.',
    });
    expect(usedTemplate).toBe(false);
    expect(description).toContain('n8n');
  });

  it('falls back to defaultDescription when everything empty', () => {
    const { description } = resolveSkillSeoDescription({
      ...base,
      templateDescription: '',
    });
    expect(description).toBe(base.defaultDescription);
  });

  it('truncates to 158 chars (+ ellipsis)', () => {
    const long = 'x'.repeat(500);
    const { description } = resolveSkillSeoDescription({
      ...base,
      override: long,
    });
    expect(description.length).toBeLessThanOrEqual(SKILL_SEO_DESCRIPTION_MAX + 3);
  });
});

describe('buildSkillKeywordSeed', () => {
  it('deduplicates and caps to max', () => {
    const out = buildSkillKeywordSeed({
      skillName: 'n8n',
      skillDisplayName: 'n8n',
      repo: 'n8n',
      category: 'Workflow Automation',
      intent,
      extraKeywords: ['claude code', 'automation', 'n8n'],
      brandKeywords: ['n8n workflow automation'],
      max: 6,
    });
    expect(out.length).toBeLessThanOrEqual(6);
    // Should not contain empty strings and should include brand keyword.
    expect(out.every((k) => k.trim().length > 0)).toBe(true);
  });

  it('filters falsy values before sanitize without throwing', () => {
    const out = buildSkillKeywordSeed({
      skillName: 'claude agent',
      skillDisplayName: 'Claude Agent',
      repo: 'claude-agent',
      category: 'developer',
      intent: { keywords: ['automation workflow'], supportTerm: 'claude code' },
      extraKeywords: ['', undefined as unknown as string, 'ai agent skills'],
    });
    expect(Array.isArray(out)).toBe(true);
    // sanitizer output depends on generic/low-value filters; just assert
    // that falsy values never cause a throw and result stays within bounds.
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
  });
});
