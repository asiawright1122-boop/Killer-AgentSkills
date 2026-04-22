import { describe, expect, it } from 'vitest';
import {
  buildCrawlerVisibleSkillBody,
  buildSkillLocaleGovernanceIndex,
  buildSkillLocaleGovernanceRecord,
} from './skill-locale-governance';

describe('skill-locale-governance', () => {
  it('builds crawler-visible fallback content when the readme is too thin', () => {
    const content = buildCrawlerVisibleSkillBody({
      name: 'Prompt Optimizer',
      repo: 'prompt-optimizer',
      description: {
        en: 'Improve prompts for Claude Code.',
      },
      skillMd: {
        bodyPreview: 'tiny',
      },
    } as any);

    expect(content).toContain('# Prompt Optimizer');
    expect(content).toContain('Improve prompts for Claude Code.');
  });

  it('suppresses localized metadata variants when the body is still english', () => {
    const record = buildSkillLocaleGovernanceRecord({
      id: 'team/prompt-optimizer',
      owner: 'team',
      repo: 'prompt-optimizer',
      name: 'Prompt Optimizer',
      description: {
        en: 'Improve prompts for Claude Code.',
        zh: '优化 Claude Code 提示词。',
      },
      seo: {
        title: {
          en: 'Prompt Optimizer for Claude Code',
          zh: 'Claude Code 提示词优化器',
        },
        description: {
          en: 'Improve prompts for Claude Code workflows.',
          zh: '优化 Claude Code 工作流中的提示词。',
        },
        definition: {
          en: 'Prompt optimizer',
          zh: '提示词优化器',
        },
        features: {
          en: [],
          zh: [],
        },
        keywords: {
          en: [],
          zh: [],
        },
      },
      skillMd: {
        body:
          'Install this skill and use it with Claude Code to improve prompts, rewrite instructions, and iterate faster on daily workflows.',
      },
      updatedAt: '2026-04-16T00:00:00Z',
    } as any);

    expect(record).not.toBeNull();
    expect(record?.eligibleLocales).toEqual(['en']);
    expect(record?.publishedLocales).toEqual(['en']);
    expect(record?.canonicalLocale).toBe('en');
    expect(record?.suppressedMetadataLocales).toEqual(['zh']);
  });

  it('summarizes canonical and suppressed locale counts across records', () => {
    const index = buildSkillLocaleGovernanceIndex([
      {
        id: 'team/prompt-optimizer',
        owner: 'team',
        repo: 'prompt-optimizer',
        name: 'Prompt Optimizer',
        description: {
          en: 'Improve prompts for Claude Code.',
          zh: '优化 Claude Code 提示词。',
        },
        seo: {
          title: {
            en: 'Prompt Optimizer for Claude Code',
            zh: 'Claude Code 提示词优化器',
          },
          description: {
            en: 'Improve prompts for Claude Code workflows.',
            zh: '优化 Claude Code 工作流中的提示词。',
          },
          definition: {
            en: 'Prompt optimizer',
            zh: '提示词优化器',
          },
          features: {
            en: [],
            zh: [],
          },
          keywords: {
            en: [],
            zh: [],
          },
        },
        skillMd: {
          body:
            'Install this skill and use it with Claude Code to improve prompts, rewrite instructions, and iterate faster on daily workflows.',
        },
      },
      {
        id: 'team/ja-skill',
        owner: 'team',
        repo: 'ja-skill',
        name: 'Japanese Skill',
        description: {
          en: 'Japanese workflow helper.',
          ja: '日本語ワークフローヘルパー。',
        },
        seo: {
          title: {
            en: 'Japanese workflow helper',
            ja: '日本語ワークフローヘルパー',
          },
          description: {
            en: 'Help with Japanese workflows.',
            ja: '日本語のワークフローを支援します。',
          },
          definition: {
            en: 'Japanese helper',
            ja: '日本語ヘルパー',
          },
          features: {
            en: [],
            ja: [],
          },
          keywords: {
            en: [],
            ja: [],
          },
        },
        skillMd: {
          body: 'このスキルは日本語のワークフローを整理し、導入手順と利用方法を日本語で説明します。',
        },
      },
    ] as any);

    expect(index.summary.totalSkills).toBe(2);
    expect(index.summary.eligibleVariants).toBe(2);
    expect(index.summary.suppressedMetadataVariants).toBe(2);
    expect(index.summary.canonicalLocaleCounts.en).toBe(1);
    expect(index.summary.canonicalLocaleCounts.ja).toBe(1);
    expect(index.summary.suppressedMetadataLocaleCounts.en).toBe(1);
    expect(index.summary.suppressedMetadataLocaleCounts.zh).toBe(1);
  });
});
