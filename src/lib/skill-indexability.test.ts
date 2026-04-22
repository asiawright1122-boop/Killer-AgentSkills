import { describe, expect, it } from 'vitest';
import { buildSkillIndexabilityAssessment } from './skill-indexability';

describe('skill-indexability', () => {
  it('keeps a locale-eligible skill indexable when first-party judgment and quality floor exist', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 72,
        verified: false,
        agentAnalysis: {
          suitability:
            'Best for coding agents that need prompt refinement before running high-risk repository changes.',
          recommendation:
            'Killer-Skills recommends this skill when you need a repeatable prompt-review step before execution, especially for repository-aware coding workflows.',
          useCases: ['Prompt review before execution', 'Repository-aware drafting', 'Instruction cleanup'],
          limitations: ['Does not execute work directly', 'Needs a draft prompt from the operator'],
        },
        seo: {
          features: {
            en: ['Prompt review workflow', 'Project detection', 'Execution-ready output'],
          },
        },
        readmeContent:
          '# Prompt Optimizer\n\nInstall this skill and use it to review prompts before execution in Claude Code workflows. It inspects draft instructions, surfaces risky assumptions, highlights missing repository context, and produces a cleaner operator-ready version before any code changes happen.',
        localeGovernance: {
          isIndexableLocale: true,
          canonicalLocale: 'en',
          detectedBodyLocale: 'en',
        },
      },
      'en',
    );

    expect(assessment.isIndexable).toBe(true);
    expect(assessment.mode).toBe('indexable');
    expect(assessment.blockers).toEqual([]);
    expect(assessment.reasons).toContain('killer_skills_limitations_layer');
    expect(assessment.reasons).toContain('quality_floor_met');
  });

  it('drops to reference-only when locale governance fails', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 90,
        agentAnalysis: {
          suitability: '适合需要提示词优化的代理。',
          recommendation: 'Killer-Skills 建议在复杂代码修改前先运行该提示优化技能，以提高执行稳定性。',
          useCases: ['提示优化', '复杂任务前检查'],
          limitations: ['不会直接执行任务'],
        },
        seo: {
          features: {
            zh: ['提示优化', '工作流检查', '执行前准备'],
          },
        },
        readmeContent: 'Install this skill to optimize prompts before coding tasks.',
        localeGovernance: {
          isIndexableLocale: false,
          canonicalLocale: 'en',
          detectedBodyLocale: 'en',
        },
      },
      'zh',
    );

    expect(assessment.isIndexable).toBe(false);
    expect(assessment.mode).toBe('reference_only');
    expect(assessment.blockers).toContain('locale_contract_failed');
  });

  it('drops to reference-only when quality floor is below the review threshold', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 38,
        agentAnalysis: {
          suitability:
            'Best for coding agents that need prompt refinement before running high-risk repository changes.',
          recommendation:
            'Killer-Skills recommends this skill when you need a repeatable prompt-review step before execution, especially for repository-aware coding workflows.',
          useCases: ['Prompt review before execution', 'Repository-aware drafting', 'Instruction cleanup'],
          limitations: ['Does not execute work directly', 'Needs a draft prompt from the operator'],
        },
        seo: {
          features: {
            en: ['Prompt review workflow', 'Project detection', 'Execution-ready output'],
          },
        },
        readmeContent:
          '# Prompt Optimizer\n\nInstall this skill and use it to review prompts before execution in Claude Code workflows. It inspects draft instructions, surfaces risky assumptions, highlights missing repository context, and produces a cleaner operator-ready version before any code changes happen.',
        localeGovernance: {
          isIndexableLocale: true,
          canonicalLocale: 'en',
          detectedBodyLocale: 'en',
        },
      },
      'en',
    );

    expect(assessment.isIndexable).toBe(false);
    expect(assessment.blockers).toContain('quality_below_review_floor');
  });
});
