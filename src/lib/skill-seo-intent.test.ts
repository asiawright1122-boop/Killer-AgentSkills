import { describe, expect, it } from 'vitest';
import { resolveSkillSeoIntent, sanitizeSkillKeywords } from './skill-seo-intent';

describe('resolveSkillSeoIntent', () => {
  const mockTranslations: Record<string, string> = {
    'Seo.Category.developer.titleLabel': 'Developer Tool Skill',
    'Seo.Category.developer.useCaseLabel': 'coding, debugging, and developer automation',
    'Seo.Category.finance.titleLabel': '金融支付 Skill',
    'Seo.Category.finance.useCaseLabel': '支付、账单与金融自动化',
    'Seo.Category.default.titleLabel': 'AI Agent Skill',
    'Seo.Category.default.useCaseLabel': 'AI agent workflows and automation',
  };
  const t = (k: string) => mockTranslations[k] || k;

  it('maps category to base seo labels and avoids redundant keywords', () => {
    const result = resolveSkillSeoIntent('developer', ['code review', 'mcp server'], t);
    expect(result.id).toBe('developer');
    expect(result.titleLabel).toBe('Developer Tool Skill');
    expect(result.useCaseLabel).toContain('developer automation');
    expect(result.keywords).toContain('developer tool skill');
    expect(result.supportTerm).toBe('code review');
  });

  it('handles zh specific rendering', () => {
    const result = resolveSkillSeoIntent('finance', ['stripe', '支付'], t);
    expect(result.id).toBe('finance');
    expect(result.titleLabel).toBe('金融支付 Skill');
    expect(result.supportTerm).toBe('stripe');
  });

  it('falls back to default if classification fails or is unspecified', () => {
    const result = resolveSkillSeoIntent('unknown-category', ['ai agent skill', 'mcp'], t);
    expect(result.id).toBe('default');
    expect(result.titleLabel).toBe('AI Agent Skill');
    expect(result.supportTerm).toBe('');
  });
});

describe('sanitizeSkillKeywords', () => {
  const mockTrans = (k: string) => k;

  it('filters low-intent query-style keywords', () => {
    const result = sanitizeSkillKeywords([
      'how to use playwright',
      'playwright browser automation',
      'tooling',
      'mvp vs mcp',
      'playwright setup guide',
    ]);
    expect(result).toContain('playwright browser automation');
    expect(result).not.toContain('how to use playwright');
    expect(result).not.toContain('mvp vs mcp');
    expect(result).not.toContain('playwright setup guide');
  });

  it('never picks low-intent phrases as support term', () => {
    const result = resolveSkillSeoIntent(
      'developer',
      ['how to use claude code', 'developer mcp server', 'react workflow automation'],
      mockTrans,
    );
    expect(result.supportTerm).toBe('react workflow automation');
  });

  it('strips short, redundant or low intent variations from npm metadata', () => {
    const result = sanitizeSkillKeywords([
      'ai',
      'agent',
      'how to use mcp',
      'my-special-tool',
      'automation workflow',
      'best ai tools 2024',
      'github action helper',
    ]);

    expect(result).not.toContain('ai');
    expect(result).not.toContain('how to use mcp');
    expect(result).not.toContain('best ai tools 2024');
    expect(result).toContain('my-special-tool');
    expect(result).toContain('github action helper');
  });

  it('drops keywords composed purely of generic terms when normalized', () => {
    const result = resolveSkillSeoIntent(
      'developer',
      ['developer workflow', 'agent', 'automation skills', 'mcp tools', 'git helper', 'python code reviewer'],
      mockTrans,
    );

    expect(result.supportTerm).toBe('git helper');
  });

  it('omits terms that overly overlap with MCP syntax directly', () => {
    const result = resolveSkillSeoIntent('developer', ['mcp server', 'MCP tools'], mockTrans);
    expect(result.supportTerm).toBe('');
  });

  it('filters MCP-first combined phrases from sanitized keywords', () => {
    const result = sanitizeSkillKeywords([
      'mcp server',
      'MCP tools',
      'model context protocol server',
      'model context protocol tools',
      'playwright automation',
    ]);

    expect(result).toContain('playwright automation');
    expect(result).not.toContain('mcp server');
    expect(result).not.toContain('MCP tools');
    expect(result).not.toContain('model context protocol server');
    expect(result).not.toContain('model context protocol tools');
  });
});
