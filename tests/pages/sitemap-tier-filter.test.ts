import { describe, expect, it } from 'vitest';
import { buildSkillIndexabilityAssessment } from '../../src/lib/skill-indexability';

describe('sitemap tier filtering', () => {
  it('Tier 1 skill qualifies for sitemap inclusion', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 72,
        verified: false,
        stars: 85,
        agentAnalysis: {
          suitability:
            'Best for coding agents that need prompt refinement before running high-risk repository changes.',
          recommendation:
            'Killer-Skills recommends this skill for workflow automation and code review cycles.',
          useCases: ['Code review automation', 'Workflow integration', 'CI/CD pipeline enhancement'],
          limitations: ['Requires Node.js 18+', 'No Windows support yet'],
        },
        readmeContent:
          '# Code Review Skill\n\nInstall this skill to automate code review in your CI/CD pipeline. It analyzes pull requests, identifies potential issues, and suggests improvements based on best practices. Works with GitHub Actions, GitLab CI, and Jenkins. Supports TypeScript, Python, Go, and Rust projects.',
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );
    expect(assessment.tier).toBe(1);
    expect(assessment.isIndexable).toBe(true);
  });

  it('Tier 2 skill is excluded from sitemap', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 45,
        verified: false,
        stars: 5,
        agentAnalysis: {
          suitability:
            'Best for coding agents that need prompt refinement before running high-risk repository changes.',
          recommendation:
            'Killer-Skills recommends this skill for workflow automation and code review cycles.',
          useCases: ['Code review automation', 'Workflow integration'],
          limitations: ['Requires Node.js 18+'],
        },
        readmeContent:
          '# Code Review Skill\n\nInstall this skill to automate code review in your CI/CD pipeline. It analyzes pull requests, identifies potential issues, and suggests improvements based on best practices. Works with GitHub Actions, GitLab CI, and Jenkins. Supports TypeScript, Python, Go, and Rust projects.',
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );
    expect(assessment.tier).toBe(2);
    expect(assessment.isIndexable).toBe(false);
  });

  it('Tier 3 skill is excluded from sitemap', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 15,
        verified: false,
        stars: 0,
        readmeContent: 'tiny',
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );
    expect(assessment.tier).toBe(3);
    expect(assessment.isIndexable).toBe(false);
  });
});
