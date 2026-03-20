import { describe, expect, it } from 'vitest';
import { resolveSkillSeoIntent, sanitizeSkillKeywords } from './skill-seo-intent';

describe('resolveSkillSeoIntent', () => {
  it('returns category-specific labels for developer skills', () => {
    const result = resolveSkillSeoIntent('developer', ['code review', 'mcp server'], 'en');
    expect(result.id).toBe('developer');
    expect(result.titleLabel).toBe('Developer Tool Skill');
    expect(result.useCaseLabel).toContain('coding');
    expect(result.supportTerm).toBe('code review');
  });

  it('returns zh labels for zh locale', () => {
    const result = resolveSkillSeoIntent('finance', ['stripe', '支付'], 'zh');
    expect(result.titleLabel).toBe('金融支付 Skill');
    expect(result.useCaseLabel).toContain('支付');
    expect(result.supportTerm).toBe('stripe');
  });

  it('falls back to default intent for unknown categories', () => {
    const result = resolveSkillSeoIntent('unknown-category', ['ai agent skill', 'mcp'], 'en');
    expect(result.id).toBe('default');
    expect(result.titleLabel).toBe('AI Agent Skill');
    expect(result.supportTerm).toBe('');
  });

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
      'en',
    );
    expect(result.supportTerm).toBe('react workflow automation');
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

  it('never picks MCP-first combined phrases as support term', () => {
    const result = resolveSkillSeoIntent(
      'developer',
      ['mcp server', 'model context protocol tools', 'repo scaffolding automation'],
      'en',
    );

    expect(result.supportTerm).toBe('repo scaffolding automation');
  });

  it('returns empty support term when only MCP-first combined phrases are provided', () => {
    const result = resolveSkillSeoIntent('developer', ['mcp server', 'MCP tools'], 'en');
    expect(result.supportTerm).toBe('');
  });
});
