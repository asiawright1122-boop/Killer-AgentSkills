import { describe, expect, it } from 'vitest';
import {
  detectPrimaryContentLocale,
  getLocalizedSeoEligibleLocales,
  getPreferredCanonicalLocale,
  getSkillSeoEligibleLocales,
  getSkillSeoLocaleGovernance,
  isDirectlyLocalizedVariant,
} from './seo-locales';

describe('seo-locales', () => {
  it('returns only locales with direct title and description coverage', () => {
    const locales = getLocalizedSeoEligibleLocales({
      title: {
        en: 'Top Agentic AI Tools',
        zh: '顶级 Agentic AI 工具',
        ja: 'トップ Agentic AI ツール',
      },
      description: {
        en: 'English summary',
        zh: '中文摘要',
      },
    });

    expect(locales).toEqual(['en', 'zh']);
  });

  it('treats plain strings as default-locale-only content', () => {
    const locales = getLocalizedSeoEligibleLocales({
      title: 'English only title',
      description: 'English only description',
    });

    expect(locales).toEqual(['en']);
  });

  it('prefers english for canonical locale when available', () => {
    expect(getPreferredCanonicalLocale(['zh', 'en', 'ja'])).toBe('en');
  });

  it('falls back to the first localized variant when english is unavailable', () => {
    expect(getPreferredCanonicalLocale(['ja', 'ko'])).toBe('ja');
  });

  it('checks whether a locale is directly localized', () => {
    expect(isDirectlyLocalizedVariant(['en', 'zh'], 'zh')).toBe(true);
    expect(isDirectlyLocalizedVariant(['en', 'zh'], 'fr')).toBe(false);
  });

  it('detects english primary content from latin stopwords', () => {
    expect(
      detectPrimaryContentLocale(
        'Install this skill for your workflow and use it with Claude Code to automate your daily tasks.',
      ),
    ).toBe('en');
  });

  it('detects chinese primary content from han script', () => {
    expect(detectPrimaryContentLocale('这是一个中文技能，用于自动化工作流和代码生成，支持安装与配置。')).toBe('zh');
  });

  it('detects japanese primary content from kana', () => {
    expect(detectPrimaryContentLocale('このスキルは日本語で書かれており、インストール方法と使用例を説明します。')).toBe(
      'ja',
    );
  });

  it('keeps only locales where metadata and body locale intersect for skill SEO', () => {
    const locales = getSkillSeoEligibleLocales({
      title: {
        en: 'Prompt Optimizer for Claude Code',
        zh: 'Claude Code 提示词优化器',
        ja: 'Claude Code 向けプロンプト最適化',
      },
      description: {
        en: 'Improve prompts for Claude Code workflows.',
        zh: '优化 Claude Code 工作流中的提示词。',
        ja: 'Claude Code のプロンプトを改善します。',
      },
      body: 'Install this skill and use it with Claude Code to improve prompts for your workflow.',
    });

    expect(locales).toEqual(['en']);
  });

  it('marks non-matching locales as noindex and canonicalizes to the body-matching locale', () => {
    const governance = getSkillSeoLocaleGovernance(
      {
        title: {
          en: 'Prompt Optimizer for Claude Code',
          zh: 'Claude Code 提示词优化器',
        },
        description: {
          en: 'Improve prompts for Claude Code workflows.',
          zh: '优化 Claude Code 工作流中的提示词。',
        },
        body: 'Install this skill and use it with Claude Code to improve prompts for your workflow.',
      },
      'zh',
    );

    expect(governance.detectedBodyLocale).toBe('en');
    expect(governance.metadataEligibleLocales).toEqual(['en', 'zh']);
    expect(governance.eligibleLocales).toEqual(['en']);
    expect(governance.publishedLocales).toEqual(['en']);
    expect(governance.canonicalLocale).toBe('en');
    expect(governance.isIndexableLocale).toBe(false);
  });

  it('falls back canonical locale to the body locale when metadata and body disagree completely', () => {
    const governance = getSkillSeoLocaleGovernance(
      {
        title: {
          zh: '中文技能标题',
        },
        description: {
          zh: '中文技能描述',
        },
        body: 'Install this skill for your daily workflow in Claude Code.',
      },
      'zh',
    );

    expect(governance.detectedBodyLocale).toBe('en');
    expect(governance.metadataEligibleLocales).toEqual(['zh']);
    expect(governance.bodyEligibleLocales).toEqual(['en']);
    expect(governance.eligibleLocales).toEqual([]);
    expect(governance.publishedLocales).toEqual(['en']);
    expect(governance.canonicalLocale).toBe('en');
    expect(governance.isIndexableLocale).toBe(false);
  });

  it('bypasses body-locale checks for non-matching locales when high-quality translation metadata is present', () => {
    const governance = getSkillSeoLocaleGovernance(
      {
        title: {
          en: 'Prompt Optimizer for Claude Code',
          zh: 'Claude Code 提示词优化器',
        },
        description: {
          en: 'Improve prompts for Claude Code workflows.',
          zh: '优化 Claude Code 工作流中的提示词。',
        },
        body: 'Install this skill and use it with Claude Code to improve prompts for your workflow.',
        reviewSummary: {
          zh: '该技能能够优化 Claude Code 代理的提示词，提升任务执行效率。',
        },
        selectionReason: {
          zh: '适合需要精细化控制代码编写提示词的开发者。',
        },
      },
      'zh',
    );

    expect(governance.detectedBodyLocale).toBe('en');
    expect(governance.metadataEligibleLocales).toEqual(['en', 'zh']);
    expect(governance.eligibleLocales).toEqual(['en', 'zh']);
    expect(governance.publishedLocales).toEqual(['en', 'zh']);
    expect(governance.canonicalLocale).toBe('en');
    expect(governance.isIndexableLocale).toBe(true);
  });
});
