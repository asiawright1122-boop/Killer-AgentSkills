/**
 * Skill SEO Quality Assessment
 *
 * Extracted from build-skills-cache.ts — functions that evaluate whether
 * a skill's SEO data is fully optimised or needs regeneration.
 */

import { SUPPORTED_LOCALES } from './constants';
import type { SkillCache } from './types';

// ===== Constants =====

export const LOW_INTENT_SEO_KEYWORD_PATTERNS = [
  /(^|\b)(how to|what is|why|guide|tutorial|vs|versus|alternative|alternatives|best|top\s*\d*|comparison|compare|free|download)\b/i,
  /(是什么|怎么用|如何|教程|指南|对比|替代|最佳|免费)/,
  /(とは|使い方|チュートリアル|ガイド|比較|代替|おすすめ|無料)/,
  /(무엇|사용법|튜토리얼|가이드|비교|대안|추천|무료)/,
];
export const SEO_SNIPPET_TRUNCATION_PATTERN = /(\.\.\.|…)/;
export const ENGLISH_CTA_PATTERN = /\b(Get started|Learn now|Read more)\b/i;
export const TITLE_THEME_TERMS = [
  'agent skill',
  'ai agent',
  'claude code',
  'cursor',
  'windsurf',
  'mcp',
  'killer-skills',
  'agentic',
  'skill guide',
];
export const SEO_THEME_TERMS = [
  'agent skill',
  'ai agent',
  'claude code',
  'cursor',
  'windsurf',
  'mcp',
  'killer-skills',
  'workflow',
  'automation',
  'skill installation',
  '.claude',
  'agentic',
];

export const DEFAULT_REGEN_BATCH_SIZE = 100;

export const REGENERATION_TIER_ORDER = ['tier_1_theme', 'tier_2_localization', 'tier_3_content_risk'] as const;

export const OPTIMIZATION_ISSUE_PRIORITY = [
  'keywords_missing_theme_term',
  'title_missing_theme_identifier',
  'low_intent_en_keywords',
  'stale_or_truncated_seo_snippet',
  'agent_analysis_version_stale',
  'missing_en_seo_title',
  'missing_en_seo_description',
  'empty_en_seo_title_or_description',
  'missing_seo_features',
  'missing_seo_keywords',
  'missing_en_keywords',
  'description_not_localized',
  'missing_description_locale',
  'description_fell_back_to_english',
  'missing_agent_analysis',
  'suitability_not_localized',
  'missing_suitability_locale',
  'suitability_fell_back_to_english',
  'use_cases_not_localized',
  'missing_use_cases_locale',
] as const;

// ===== Types =====

export type RegenerationTier = (typeof REGENERATION_TIER_ORDER)[number];
export type OptimizationIssueCode = (typeof OPTIMIZATION_ISSUE_PRIORITY)[number];

export interface OptimizationIssue {
  code: OptimizationIssueCode;
  category: 'theme' | 'metadata' | 'translation' | 'analysis';
  summary: string;
  detail?: string;
}

export interface ContentRisk {
  code: 'missing_body_or_preview' | 'thin_body_preview';
  summary: string;
  detail?: string;
}

// ===== Internal Constants =====

const MIN_INDEXABLE_SKILL_CONTENT_BYTES = 200;
const skillTextEncoder = new TextEncoder();

const normalizeSeoToken = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

// ===== Public Functions =====

export function hasLowIntentSeoKeyword(keyword: string): boolean {
  const normalized = normalizeSeoToken(keyword || '');
  if (!normalized) return false;
  return LOW_INTENT_SEO_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function hasSeoSnippetArtifact(value: string): boolean {
  const text = value || '';
  return SEO_SNIPPET_TRUNCATION_PATTERN.test(text) || ENGLISH_CTA_PATTERN.test(text);
}

/**
 * Check if a skill is fully optimized (SEO + Translations) to skip expensive AI calls.
 */
export function isSkillFullyOptimized(skill: SkillCache): boolean {
  // 0. Check Prompt Version (v4 = Mar 2026, dedicated English SEO + skill-specific prompts)
  if (!skill.agentAnalysis?.version || skill.agentAnalysis.version < 4) {
    return false;
  }

  // 1. Check for SEO fields: title, description, features (non-empty), keywords (non-empty)
  if (!skill.seo?.description?.en) {
    return false;
  }
  if (!skill.seo?.title?.en) {
    return false;
  }
  const enTitle = skill.seo.title.en.trim();
  const enDescription = skill.seo.description.en.trim();
  if (!enTitle || !enDescription) {
    return false;
  }
  if (hasSeoSnippetArtifact(enTitle) || hasSeoSnippetArtifact(enDescription)) {
    return false;
  }
  if (!TITLE_THEME_TERMS.some((t) => enTitle.toLowerCase().includes(t))) {
    return false;
  }

  const features = skill.seo?.features;
  if (
    !features ||
    typeof features !== 'object' ||
    !Object.values(features).some((arr) => Array.isArray(arr) && arr.length > 0)
  ) {
    return false;
  }

  const keywords = skill.seo?.keywords;
  if (
    !keywords ||
    typeof keywords !== 'object' ||
    !Object.values(keywords).some((arr) => Array.isArray(arr) && arr.length > 0)
  ) {
    return false;
  }
  const enKeywords = Array.isArray(skill.seo?.keywords?.en) ? skill.seo.keywords.en : [];
  if (enKeywords.length === 0) {
    return false;
  }
  if (enKeywords.some((keyword) => hasLowIntentSeoKeyword(String(keyword)))) {
    return false;
  }
  const hasThemeTerm = enKeywords.some((kw) => {
    const kwLower = String(kw).toLowerCase();
    return SEO_THEME_TERMS.some((t) => kwLower.includes(t));
  });
  if (!hasThemeTerm) {
    return false;
  }

  // 2. Check for missing translations in description
  if (typeof skill.description !== 'object') {
    return false;
  }
  for (const loc of SUPPORTED_LOCALES) {
    const val = skill.description[loc];
    if (!val) {
      return false;
    }
    const enVal = skill.description['en'];
    if (loc !== 'en' && typeof val === 'string' && typeof enVal === 'string' && val.length > 10 && val === enVal) {
      return false;
    }
  }

  // 3. Check Agent Analysis (Must exist and be localized)
  if (!skill.agentAnalysis) {
    return false;
  }
  if (typeof skill.agentAnalysis.suitability !== 'object') {
    return false;
  }
  const suitability = skill.agentAnalysis.suitability as Record<string, string>;
  for (const loc of SUPPORTED_LOCALES) {
    const val = suitability[loc];
    if (!val) {
      return false;
    }
    const enVal = suitability['en'];
    if (loc !== 'en' && val.length > 5 && val === enVal) {
      return false;
    }
  }

  // 4. Check Agent Analysis useCases have translations
  if (typeof skill.agentAnalysis.useCases === 'object' && !Array.isArray(skill.agentAnalysis.useCases)) {
    for (const loc of SUPPORTED_LOCALES) {
      const arr = (skill.agentAnalysis.useCases as Record<string, string[]>)[loc];
      if (!arr || arr.length === 0) {
        return false;
      }
    }
  } else {
    return false;
  }

  return true;
}

/**
 * Collect all optimization issues for a skill — used for reporting and prioritisation.
 */
export function collectOptimizationIssues(skill: SkillCache): OptimizationIssue[] {
  const issues: OptimizationIssue[] = [];

  if (!skill.agentAnalysis?.version || skill.agentAnalysis.version < 4) {
    issues.push({
      code: 'agent_analysis_version_stale',
      category: 'theme',
      summary: 'Still on a pre-v4 SEO/agent-analysis prompt version',
      detail: `version=${skill.agentAnalysis?.version ?? 'missing'}`,
    });
  }

  const hasEnSeoDescription = Boolean(skill.seo?.description?.en);
  const hasEnSeoTitle = Boolean(skill.seo?.title?.en);
  const enTitle = skill.seo?.title?.en?.trim() || '';
  const enDescription = skill.seo?.description?.en?.trim() || '';

  if (!hasEnSeoDescription) {
    issues.push({
      code: 'missing_en_seo_description',
      category: 'metadata',
      summary: 'Missing English SEO description',
    });
  }
  if (!hasEnSeoTitle) {
    issues.push({
      code: 'missing_en_seo_title',
      category: 'metadata',
      summary: 'Missing English SEO title',
    });
  }
  if ((hasEnSeoTitle && !enTitle) || (hasEnSeoDescription && !enDescription)) {
    issues.push({
      code: 'empty_en_seo_title_or_description',
      category: 'metadata',
      summary: 'English SEO title or description is blank after trimming',
    });
  }
  if ((enTitle && hasSeoSnippetArtifact(enTitle)) || (enDescription && hasSeoSnippetArtifact(enDescription))) {
    issues.push({
      code: 'stale_or_truncated_seo_snippet',
      category: 'metadata',
      summary: 'SEO title or description still contains truncation or stale CTA artifacts',
    });
  }
  if (enTitle && !TITLE_THEME_TERMS.some((term) => enTitle.toLowerCase().includes(term))) {
    issues.push({
      code: 'title_missing_theme_identifier',
      category: 'theme',
      summary: 'English SEO title is missing a required theme identifier',
    });
  }

  const features = skill.seo?.features;
  if (
    !features ||
    typeof features !== 'object' ||
    !Object.values(features).some((arr) => Array.isArray(arr) && arr.length > 0)
  ) {
    issues.push({
      code: 'missing_seo_features',
      category: 'metadata',
      summary: 'SEO feature bullets are missing across all locales',
    });
  }

  const keywords = skill.seo?.keywords;
  if (
    !keywords ||
    typeof keywords !== 'object' ||
    !Object.values(keywords).some((arr) => Array.isArray(arr) && arr.length > 0)
  ) {
    issues.push({
      code: 'missing_seo_keywords',
      category: 'metadata',
      summary: 'SEO keywords are missing across all locales',
    });
  }

  const enKeywords = Array.isArray(skill.seo?.keywords?.en) ? skill.seo.keywords.en : [];
  if (enKeywords.length === 0) {
    issues.push({
      code: 'missing_en_keywords',
      category: 'metadata',
      summary: 'English SEO keywords are empty',
    });
  }
  if (enKeywords.some((keyword) => hasLowIntentSeoKeyword(String(keyword)))) {
    issues.push({
      code: 'low_intent_en_keywords',
      category: 'theme',
      summary: 'English SEO keywords still contain low-intent query patterns',
    });
  }
  if (
    enKeywords.length > 0 &&
    !enKeywords.some((keyword) => SEO_THEME_TERMS.some((term) => String(keyword).toLowerCase().includes(term)))
  ) {
    issues.push({
      code: 'keywords_missing_theme_term',
      category: 'theme',
      summary: 'English SEO keywords are missing required AI-agent theme anchors',
    });
  }

  if (typeof skill.description !== 'object') {
    issues.push({
      code: 'description_not_localized',
      category: 'translation',
      summary: 'Description is not localized into the supported locale map',
    });
  } else {
    const missingDescriptionLocales: string[] = [];
    const descriptionFallbackLocales: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      const value = skill.description[locale];
      if (!value) {
        missingDescriptionLocales.push(locale);
        continue;
      }
      const englishValue = skill.description.en;
      if (
        locale !== 'en' &&
        typeof value === 'string' &&
        typeof englishValue === 'string' &&
        value.length > 10 &&
        value === englishValue
      ) {
        descriptionFallbackLocales.push(locale);
      }
    }
    if (missingDescriptionLocales.length > 0) {
      issues.push({
        code: 'missing_description_locale',
        category: 'translation',
        summary: 'Description is missing one or more locale entries',
        detail: missingDescriptionLocales.join(', '),
      });
    }
    if (descriptionFallbackLocales.length > 0) {
      issues.push({
        code: 'description_fell_back_to_english',
        category: 'translation',
        summary: 'Description still falls back to English for some non-English locales',
        detail: descriptionFallbackLocales.join(', '),
      });
    }
  }

  if (!skill.agentAnalysis) {
    issues.push({
      code: 'missing_agent_analysis',
      category: 'analysis',
      summary: 'Agent analysis payload is missing',
    });
    return issues;
  }

  if (typeof skill.agentAnalysis.suitability !== 'object') {
    issues.push({
      code: 'suitability_not_localized',
      category: 'analysis',
      summary: 'Agent suitability is not localized into the supported locale map',
    });
  } else {
    const suitability = skill.agentAnalysis.suitability as Record<string, string>;
    const missingSuitabilityLocales: string[] = [];
    const suitabilityFallbackLocales: string[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      const value = suitability[locale];
      if (!value) {
        missingSuitabilityLocales.push(locale);
        continue;
      }
      const englishValue = suitability.en;
      if (locale !== 'en' && englishValue && value.length > 5 && value === englishValue) {
        suitabilityFallbackLocales.push(locale);
      }
    }

    if (missingSuitabilityLocales.length > 0) {
      issues.push({
        code: 'missing_suitability_locale',
        category: 'analysis',
        summary: 'Agent suitability is missing one or more locale entries',
        detail: missingSuitabilityLocales.join(', '),
      });
    }
    if (suitabilityFallbackLocales.length > 0) {
      issues.push({
        code: 'suitability_fell_back_to_english',
        category: 'analysis',
        summary: 'Agent suitability still falls back to English for some locales',
        detail: suitabilityFallbackLocales.join(', '),
      });
    }
  }

  if (typeof skill.agentAnalysis.useCases === 'object' && !Array.isArray(skill.agentAnalysis.useCases)) {
    const useCases = skill.agentAnalysis.useCases as Record<string, string[]>;
    const missingUseCaseLocales = SUPPORTED_LOCALES.filter((locale) => !useCases[locale] || useCases[locale].length === 0);
    if (missingUseCaseLocales.length > 0) {
      issues.push({
        code: 'missing_use_cases_locale',
        category: 'analysis',
        summary: 'Agent use cases are missing one or more locale arrays',
        detail: missingUseCaseLocales.join(', '),
      });
    }
  } else {
    issues.push({
      code: 'use_cases_not_localized',
      category: 'analysis',
      summary: 'Agent use cases are not localized into per-locale arrays',
    });
  }

  return issues;
}

/**
 * Collect content risks (thin/missing body) for a skill.
 */
export function collectContentRisks(skill: SkillCache): { risks: ContentRisk[]; rawBytes: number } {
  const content = skill.skillMd?.body || skill.skillMd?.bodyPreview || '';
  const rawBytes = skillTextEncoder.encode(content).length;
  const risks: ContentRisk[] = [];

  if (!content.trim()) {
    risks.push({
      code: 'missing_body_or_preview',
      summary: 'Missing skill body and bodyPreview content',
    });
  } else if (rawBytes < MIN_INDEXABLE_SKILL_CONTENT_BYTES) {
    risks.push({
      code: 'thin_body_preview',
      summary: `Skill body/bodyPreview is thinner than ${MIN_INDEXABLE_SKILL_CONTENT_BYTES} bytes`,
      detail: `${rawBytes} bytes`,
    });
  }

  return { risks, rawBytes };
}

export function getOptimizationIssuePriority(code: OptimizationIssueCode): number {
  const index = OPTIMIZATION_ISSUE_PRIORITY.indexOf(code);
  return index >= 0 ? index : OPTIMIZATION_ISSUE_PRIORITY.length + 1;
}

export function getPrimaryOptimizationIssue(issues: OptimizationIssue[]): OptimizationIssue {
  return issues
    .slice()
    .sort((left, right) => getOptimizationIssuePriority(left.code) - getOptimizationIssuePriority(right.code))[0];
}

export function getRegenerationTier(issues: OptimizationIssue[], contentRisks: ContentRisk[]): RegenerationTier {
  if (contentRisks.length > 0) return 'tier_3_content_risk';
  if (issues.some((issue) => issue.category === 'theme' || issue.category === 'metadata')) {
    return 'tier_1_theme';
  }
  return 'tier_2_localization';
}

export function getTierLabel(tier: RegenerationTier): string {
  switch (tier) {
    case 'tier_1_theme':
      return 'Tier 1 - theme or metadata repair';
    case 'tier_2_localization':
      return 'Tier 2 - localization or agent-analysis repair';
    case 'tier_3_content_risk':
      return 'Tier 3 - content risk, manual review last';
  }
}
