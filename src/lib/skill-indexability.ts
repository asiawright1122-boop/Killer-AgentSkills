import type { Locale } from '../i18n';

type LocalizedString = string | Record<string, string> | undefined;
type LocalizedStringArray = string[] | Record<string, string[]> | undefined;

type SkillIndexabilityLocaleGovernance = {
  isIndexableLocale: boolean;
  canonicalLocale: Locale;
  detectedBodyLocale: Locale | null;
};

export type SkillIndexabilitySource = {
  qualityScore?: number | null;
  verified?: boolean | null;
  description?: LocalizedString;
  agentAnalysis?: {
    suitability?: LocalizedString;
    recommendation?: LocalizedString;
    useCases?: LocalizedStringArray;
    limitations?: LocalizedStringArray;
  };
  seo?: {
    features?: Record<string, string[]>;
  };
  readmeContent?: string | null;
  localeGovernance?: SkillIndexabilityLocaleGovernance | null;
};

export type SkillIndexabilityAssessment = {
  isIndexable: boolean;
  mode: 'indexable' | 'reference_only';
  score: number;
  threshold: number;
  qualityThreshold: number;
  reasons: string[];
  blockers: string[];
  signals: {
    localeEligible: boolean;
    hasRecommendation: boolean;
    hasSuitability: boolean;
    hasUseCases: boolean;
    hasLimitations: boolean;
    hasFeatureLayer: boolean;
    hasStrongQualitySignal: boolean;
    hasVerifiedSignal: boolean;
    hasSupportingSourceEvidence: boolean;
  };
};

const MIN_SUPPORTING_SOURCE_BYTES = 200;
// Keep a real quality floor, but don't require an editorial-grade score for
// pages that already have recommendation, use cases, limitations, locale
// governance, and supporting source evidence. A 35+ score materially expands
// long-tail indexable supply without opening the door to thin placeholder pages.
const DEFAULT_QUALITY_THRESHOLD = 35;
const DEFAULT_SCORE_THRESHOLD = 7;

const textEncoder = new TextEncoder();

function resolveLocalizedString(value: LocalizedString, locale: Locale): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return value[locale]?.trim() || value.en?.trim() || Object.values(value).find(Boolean)?.trim() || '';
}

function resolveLocalizedArray(value: LocalizedStringArray, locale: Locale): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
  return value[locale] || value.en || Object.values(value).find(Array.isArray) || [];
}

export function buildSkillIndexabilityAssessment(
  source: SkillIndexabilitySource,
  locale: Locale,
  options?: {
    qualityThreshold?: number;
    scoreThreshold?: number;
    minSupportingSourceBytes?: number;
  },
): SkillIndexabilityAssessment {
  const qualityThreshold = options?.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD;
  const scoreThreshold = options?.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  const minSupportingSourceBytes = options?.minSupportingSourceBytes ?? MIN_SUPPORTING_SOURCE_BYTES;

  const qualityScore = Number(source.qualityScore || 0);
  const recommendation = resolveLocalizedString(source.agentAnalysis?.recommendation, locale);
  const suitability = resolveLocalizedString(source.agentAnalysis?.suitability, locale);
  const useCases = resolveLocalizedArray(source.agentAnalysis?.useCases, locale);
  const limitations = resolveLocalizedArray(source.agentAnalysis?.limitations, locale);
  const features = source.seo?.features?.[locale] || source.seo?.features?.en || [];
  const sourceBytes = textEncoder.encode(String(source.readmeContent || '')).length;

  const signals = {
    localeEligible: Boolean(source.localeGovernance?.isIndexableLocale),
    hasRecommendation: recommendation.length >= 80,
    hasSuitability: suitability.length >= 40,
    hasUseCases: useCases.filter(Boolean).length >= 2,
    hasLimitations: limitations.filter(Boolean).length >= 1,
    hasFeatureLayer: features.filter(Boolean).length >= 3,
    hasStrongQualitySignal: Boolean(source.verified) || qualityScore >= qualityThreshold,
    hasVerifiedSignal: Boolean(source.verified),
    hasSupportingSourceEvidence: sourceBytes >= minSupportingSourceBytes,
  };

  let score = 0;
  if (signals.hasRecommendation) score += 2;
  if (signals.hasSuitability) score += 1;
  if (signals.hasUseCases) score += 1;
  if (signals.hasLimitations) score += 2;
  if (signals.hasFeatureLayer) score += 1;
  if (signals.hasStrongQualitySignal) score += 2;
  if (signals.hasVerifiedSignal) score += 1;
  if (signals.hasSupportingSourceEvidence) score += 1;

  const reasons: string[] = [];
  if (signals.hasRecommendation) reasons.push('killer_skills_recommendation_layer');
  if (signals.hasSuitability) reasons.push('killer_skills_fit_judgment');
  if (signals.hasUseCases) reasons.push('killer_skills_use_case_layer');
  if (signals.hasLimitations) reasons.push('killer_skills_limitations_layer');
  if (signals.hasFeatureLayer) reasons.push('killer_skills_feature_summary');
  if (signals.hasStrongQualitySignal) reasons.push('quality_floor_met');
  if (signals.hasVerifiedSignal) reasons.push('verified_signal');
  if (signals.hasSupportingSourceEvidence) reasons.push('supporting_source_material_available');
  if (signals.localeEligible) reasons.push('locale_contract_met');

  const blockers: string[] = [];
  if (!signals.localeEligible) blockers.push('locale_contract_failed');
  if (!signals.hasRecommendation) blockers.push('missing_recommendation_layer');
  if (!signals.hasUseCases) blockers.push('missing_use_case_layer');
  if (!signals.hasLimitations) blockers.push('missing_limitations_layer');
  if (!signals.hasStrongQualitySignal) blockers.push('quality_below_review_floor');
  if (!signals.hasSupportingSourceEvidence) blockers.push('source_material_too_thin');

  const isIndexable =
    signals.localeEligible &&
    signals.hasRecommendation &&
    signals.hasUseCases &&
    signals.hasLimitations &&
    signals.hasStrongQualitySignal &&
    signals.hasSupportingSourceEvidence &&
    score >= scoreThreshold;

  return {
    isIndexable,
    mode: isIndexable ? 'indexable' : 'reference_only',
    score,
    threshold: scoreThreshold,
    qualityThreshold,
    reasons,
    blockers,
    signals,
  };
}
