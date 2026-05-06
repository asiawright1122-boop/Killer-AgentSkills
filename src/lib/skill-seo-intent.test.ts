import { describe, expect, it } from 'vitest';
import {
  formatSkillNameForSeo,
  isLowValueSkillSeoDescription,
  isLowValueSkillSeoTitle,
  resolveSkillSeoIntent,
  sanitizeSkillKeywords,
} from './skill-seo-intent';

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

  it('filters wildcard and source-outline tokens from generated metadata keywords', () => {
    const result = sanitizeSkillKeywords([
      'bundle-*',
      'native-*',
      'Overview',
      'Quick Pattern',
      'official',
      'for Claude Code',
      'estimatedItemSize',
      'agent-skills',
      'ide skills',
      'react native performance',
    ]);

    expect(result).toEqual(['react native performance']);
  });

  it('filters code, status, and operator terms from generated metadata keywords', () => {
    const result = sanitizeSkillKeywords([
      'rest-api',
      'Retry-After',
      'is_admin: true',
      'for CORS',
      'Available',
      'ClawdBot',
      'Execute',
      'commands',
      'Mental',
      'High-Level',
      'gog library automation',
    ]);

    expect(result).toEqual(['rest-api', 'gog library automation']);
  });

  it('deduplicates slug and display-name keyword variants', () => {
    const result = sanitizeSkillKeywords(['Rest API', 'rest-api', 'just-works', 'Just Works']);

    expect(result).toEqual(['Rest API', 'just-works']);
  });
});

describe('formatSkillNameForSeo', () => {
  it('turns slug-style skill names into human-readable SERP titles', () => {
    expect(formatSkillNameForSeo('react-native-best-practices')).toBe('React Native Best Practices');
    expect(formatSkillNameForSeo('gh-cli')).toBe('GH CLI');
  });

  it('detects generic pipe titles that should fall back to a stronger template', () => {
    expect(
      isLowValueSkillSeoTitle('react-native-best-practices | AI Agent Skills', 'react-native-best-practices'),
    ).toBe(true);
    expect(isLowValueSkillSeoTitle('React Native Performance Review Skill', 'react-native-best-practices')).toBe(false);
  });

  it('detects slug-repeated descriptions that should not reach visible copy or schema', () => {
    expect(
      isLowValueSkillSeoDescription(
        'react native best practices. react-native-best-practices is an AI agent skill for react native best practices.',
        'react-native-best-practices',
      ),
    ).toBe(true);
    expect(
      isLowValueSkillSeoDescription(
        'Review React Native performance, bundle size, startup time, memory leaks, and native integration tradeoffs.',
        'react-native-best-practices',
      ),
    ).toBe(false);
  });
});
