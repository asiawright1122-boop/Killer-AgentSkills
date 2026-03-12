import { describe, expect, it } from 'vitest';
import { resolveSkillSeoIntent } from './skill-seo-intent';

describe('resolveSkillSeoIntent', () => {
  it('returns category-specific labels for developer skills', () => {
    const result = resolveSkillSeoIntent('developer', ['code review', 'mcp server'], 'en');
    expect(result.id).toBe('developer');
    expect(result.titleLabel).toBe('Developer Tool MCP Server');
    expect(result.useCaseLabel).toContain('coding');
    expect(result.supportTerm).toBe('code review');
  });

  it('returns zh labels for zh locale', () => {
    const result = resolveSkillSeoIntent('finance', ['stripe', '支付'], 'zh');
    expect(result.titleLabel).toBe('金融支付 MCP Server');
    expect(result.useCaseLabel).toContain('支付');
    expect(result.supportTerm).toBe('stripe');
  });

  it('falls back to default intent for unknown categories', () => {
    const result = resolveSkillSeoIntent('unknown-category', ['ai agent skill', 'mcp'], 'en');
    expect(result.id).toBe('default');
    expect(result.titleLabel).toBe('AI Agent Skill');
    expect(result.supportTerm).toBe('');
  });
});
