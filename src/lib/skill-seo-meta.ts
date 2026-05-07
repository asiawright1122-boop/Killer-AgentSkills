/**
 * Pure decision helpers for skill detail page SEO metadata.
 *
 * These functions are extracted from `[locale]/skills/[owner]/[...repo].astro`
 * so the title / description / keyword fallback logic is unit-testable and
 * free of Astro/runtime coupling. They contain no side effects.
 */

import { isLowValueSkillSeoTitle, sanitizeSkillKeywords, type SkillSeoIntent } from './skill-seo-intent';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 158;

/** Normalise whitespace to a single space and trim. */
export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Case/whitespace-insensitive comparison helper. */
export function normalizeForMatch(text: string): string {
  return normalizeSpace(text).toLowerCase();
}

/**
 * Truncate to a display length with a soft word/punctuation boundary.
 * Mirrors the inline helper previously used on the detail page.
 */
export function truncateText(text: string, maxLen: number): string {
  const normalized = normalizeSpace(text);
  if (normalized.length <= maxLen) return normalized;
  const sliced = normalized.slice(0, maxLen + 1);
  const boundary = Math.max(sliced.lastIndexOf(' '), sliced.lastIndexOf(','), sliced.lastIndexOf('、'));
  const end = boundary > maxLen * 0.6 ? boundary : maxLen;
  return `${normalized.slice(0, end).trim()}...`;
}

/** Returns true if any intent signal string appears (case-insensitive) inside `text`. */
export function matchesIntentSignals(text: string | undefined, signals: ReadonlyArray<string | undefined>): boolean {
  if (!text) return false;
  const normalizedText = normalizeForMatch(text);
  return signals.some((signal) => {
    if (!signal) return false;
    const needle = normalizeForMatch(signal);
    return needle.length > 0 && normalizedText.includes(needle);
  });
}

export interface ResolveSkillSeoTitleInput {
  /** Raw SEO title coming from the skill payload (if any). */
  rawSeoTitle?: string;
  /** Fully formatted skill name (already run through `formatSkillNameForSeo`). */
  skillDisplayName: string;
  /** Raw skill name (before display formatting) — used for low-value detection. */
  skillName: string;
  /** Resolved skill SEO intent (category-driven labels). */
  intent: Pick<SkillSeoIntent, 'titleLabel' | 'keywords' | 'supportTerm'>;
  /** Localised category label. */
  category: string;
  /** Optional hard override (e.g. brand-specific hand-tuned titles). */
  override?: string;
  /** Force the template path regardless of raw title quality. */
  forceTemplate?: boolean;
}

export interface ResolveSkillSeoTitleResult {
  title: string;
  usedTemplate: boolean;
}

/**
 * Decide the final `<title>`-ready string for a skill detail page.
 *
 * Rule order:
 *  1. If `override` is non-empty, use it (still truncated).
 *  2. Else if `forceTemplate` or raw is missing/low-value/doesn't match intent → template.
 *  3. Else use the raw SEO title.
 */
export function resolveSkillSeoTitle(input: ResolveSkillSeoTitleInput): ResolveSkillSeoTitleResult {
  const { rawSeoTitle, skillDisplayName, skillName, intent, category, override, forceTemplate } = input;

  const templateTitle = `${skillDisplayName} ${intent.titleLabel}`.trim();

  if (override && override.trim().length > 0) {
    return { title: truncateText(override, TITLE_MAX), usedTemplate: false };
  }

  const signals = [intent.titleLabel, category, intent.supportTerm, ...intent.keywords];
  const shouldUseTemplate =
    !!forceTemplate ||
    !rawSeoTitle ||
    isLowValueSkillSeoTitle(rawSeoTitle, skillName) ||
    !matchesIntentSignals(rawSeoTitle, signals);

  const chosen = shouldUseTemplate ? templateTitle : rawSeoTitle!;
  return { title: truncateText(chosen, TITLE_MAX), usedTemplate: shouldUseTemplate };
}

export interface ResolveSkillSeoDescriptionInput {
  rawSeoDescription?: string;
  /** Description already composed from suitability + base description; used as a secondary fallback. */
  composedDescription?: string;
  /** Template description to use when the raw description is missing or off-intent. */
  templateDescription: string;
  intent: Pick<SkillSeoIntent, 'useCaseLabel' | 'keywords' | 'supportTerm'>;
  /** Tagline or primary keyword to boost match (e.g. hero tagline). */
  tagline?: string;
  /** Optional hard override. */
  override?: string;
  /** Default fallback used when every other source is empty. */
  defaultDescription: string;
  forceTemplate?: boolean;
}

export interface ResolveSkillSeoDescriptionResult {
  description: string;
  usedTemplate: boolean;
}

export function resolveSkillSeoDescription(input: ResolveSkillSeoDescriptionInput): ResolveSkillSeoDescriptionResult {
  const {
    rawSeoDescription,
    composedDescription,
    templateDescription,
    intent,
    tagline,
    override,
    defaultDescription,
    forceTemplate,
  } = input;

  if (override && override.trim().length > 0) {
    return { description: truncateText(override, DESCRIPTION_MAX), usedTemplate: false };
  }

  const signals = [intent.useCaseLabel, intent.supportTerm, tagline, ...intent.keywords];
  const shouldUseTemplate = !!forceTemplate || !rawSeoDescription || !matchesIntentSignals(rawSeoDescription, signals);

  const chosen = shouldUseTemplate
    ? templateDescription
    : rawSeoDescription || composedDescription || templateDescription;

  const firstNonEmpty = [chosen, composedDescription, templateDescription, defaultDescription].find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );

  return {
    description: truncateText(firstNonEmpty || defaultDescription, DESCRIPTION_MAX),
    usedTemplate: shouldUseTemplate,
  };
}

export interface BuildSkillKeywordSeedInput {
  skillName: string;
  skillDisplayName: string;
  repo: string;
  category: string;
  intent: Pick<SkillSeoIntent, 'keywords' | 'supportTerm'>;
  extraKeywords?: string[];
  /** Additional brand-specific seed keywords (e.g. "n8n workflow automation"). */
  brandKeywords?: string[];
  /** Upper bound for the sanitised output (default 10). */
  max?: number;
}

/**
 * Build the final sanitised keyword list for meta keywords + og:keywords.
 * Centralises the "entity + intent" ordering so it matches the on-page H1/H2 signals.
 */
export function buildSkillKeywordSeed(input: BuildSkillKeywordSeedInput): string[] {
  const { skillName, skillDisplayName, repo, category, intent, extraKeywords, brandKeywords, max = 10 } = input;
  const seed = [
    skillName,
    skillDisplayName,
    repo,
    category,
    ...(brandKeywords || []),
    intent.supportTerm,
    ...intent.keywords,
    ...(extraKeywords || []).slice(0, 8),
  ];
  return sanitizeSkillKeywords(
    seed.map((k) => (k == null ? '' : String(k).trim())).filter((k) => k.length > 0),
    { max },
  );
}

export const SKILL_SEO_TITLE_MAX = TITLE_MAX;
export const SKILL_SEO_DESCRIPTION_MAX = DESCRIPTION_MAX;
