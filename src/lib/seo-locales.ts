import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../i18n';

type LocalizedField = string | Record<string, string> | undefined;

type CollectionLocaleSource = {
  title?: LocalizedField;
  description?: LocalizedField;
};

export type SkillLocaleSource = CollectionLocaleSource & {
  body?: string | null;
  bodyLocale?: Locale | null;
  reviewSummary?: LocalizedField;
  selectionReason?: LocalizedField;
};

export type SkillSeoLocaleGovernance = {
  metadataEligibleLocales: Locale[];
  bodyEligibleLocales: Locale[];
  eligibleLocales: Locale[];
  publishedLocales: Locale[];
  canonicalLocale: Locale;
  detectedBodyLocale: Locale | null;
  isIndexableLocale: boolean;
};

const LATIN_STOPWORDS: Partial<Record<Locale, readonly string[]>> = {
  en: ['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'use', 'install', 'to', 'of', 'in'],
  es: ['para', 'con', 'una', 'este', 'esta', 'instalar', 'usar', 'desde', 'como', 'que', 'los', 'las', 'del'],
  fr: ['pour', 'avec', 'une', 'des', 'dans', 'installer', 'utiliser', 'vous', 'votre', 'cette', 'sur', 'les'],
  de: ['und', 'mit', 'für', 'die', 'der', 'das', 'eine', 'einen', 'installieren', 'verwenden', 'dieser', 'dieses'],
  pt: ['para', 'com', 'uma', 'instalar', 'usar', 'você', 'seu', 'esta', 'este', 'das', 'dos', 'que'],
};

function dedupeLocales(locales: readonly Locale[]): Locale[] {
  return locales.filter((locale, index) => locales.indexOf(locale) === index);
}

function hasDirectLocalizedValue(field: LocalizedField, locale: Locale): boolean {
  if (!field) return false;

  if (typeof field === 'string') {
    return locale === DEFAULT_LOCALE && field.trim().length > 0;
  }

  return typeof field[locale] === 'string' && field[locale].trim().length > 0;
}

export function getLocalizedSeoEligibleLocales(
  source: CollectionLocaleSource,
  locales: readonly Locale[] = SUPPORTED_LOCALES,
): Locale[] {
  return locales.filter(
    (locale) => hasDirectLocalizedValue(source.title, locale) && hasDirectLocalizedValue(source.description, locale),
  );
}

export function getPreferredCanonicalLocale(
  locales: readonly string[],
  fallbackLocale: Locale = DEFAULT_LOCALE,
): string {
  if (locales.includes(fallbackLocale)) return fallbackLocale;
  return locales[0] || fallbackLocale;
}

export function isDirectlyLocalizedVariant(locales: readonly string[], locale: string): boolean {
  return locales.includes(locale);
}

function stripMarkdownForLocaleDetection(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_[\]()~|]/g, ' ')
    .replace(/-{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function detectScriptLocale(sample: string): Locale | null {
  const kanaCount = countMatches(sample, /[\u3040-\u30ff]/g);
  const hangulCount = countMatches(sample, /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g);
  const hanCount = countMatches(sample, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
  const cyrillicCount = countMatches(sample, /[\u0400-\u04ff]/g);
  const arabicCount = countMatches(sample, /[\u0600-\u06ff]/g);

  if (arabicCount >= 8) return 'ar';
  if (cyrillicCount >= 8) return 'ru';
  if (hangulCount >= 8) return 'ko';
  if (kanaCount >= 4) return 'ja';
  if (hanCount >= 8) return 'zh';

  return null;
}

function detectLatinLocale(sample: string, fallbackLocale: Locale): Locale | null {
  const tokens = sample
    .toLowerCase()
    .split(/[^a-z\u00c0-\u024f]+/u)
    .filter(Boolean);

  if (tokens.length === 0) return fallbackLocale;

  const tokenCounts = new Map<string, number>();
  for (const token of tokens) {
    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  }

  const scored = (Object.entries(LATIN_STOPWORDS) as Array<[Locale, readonly string[]]>)
    .map(([locale, words]) => ({
      locale,
      score: words.reduce((total, word) => total + (tokenCounts.get(word) || 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const next = scored[1];

  if (!top || top.score === 0) return fallbackLocale;
  if (top.score < 3) return fallbackLocale;
  if (next && top.score < next.score + 2) return fallbackLocale;

  return top.locale;
}

export function detectPrimaryContentLocale(
  text: string | null | undefined,
  fallbackLocale: Locale = DEFAULT_LOCALE,
): Locale | null {
  const sample = stripMarkdownForLocaleDetection(String(text || ''));
  if (!sample) return fallbackLocale;

  const scriptLocale = detectScriptLocale(sample);
  if (scriptLocale) return scriptLocale;

  return detectLatinLocale(sample, fallbackLocale);
}

export function getSkillSeoEligibleLocales(
  source: SkillLocaleSource,
  locales: readonly Locale[] = SUPPORTED_LOCALES,
): Locale[] {
  const metadataEligibleLocales = dedupeLocales(getLocalizedSeoEligibleLocales(source, locales));
  const detectedBodyLocale = source.bodyLocale || detectPrimaryContentLocale(source.body, DEFAULT_LOCALE);
  const bodyEligibleLocales =
    detectedBodyLocale && locales.includes(detectedBodyLocale) ? ([detectedBodyLocale] as Locale[]) : [];

  return metadataEligibleLocales.filter((candidate) => {
    if (bodyEligibleLocales.includes(candidate)) {
      return true;
    }
    const hasHighQualityTranslation =
      hasDirectLocalizedValue(source.reviewSummary, candidate) &&
      hasDirectLocalizedValue(source.selectionReason, candidate);
    return hasHighQualityTranslation;
  });
}

export function getSkillSeoLocaleGovernance(
  source: SkillLocaleSource,
  locale: Locale,
  locales: readonly Locale[] = SUPPORTED_LOCALES,
): SkillSeoLocaleGovernance {
  const metadataEligibleLocales = dedupeLocales(getLocalizedSeoEligibleLocales(source, locales));
  const detectedBodyLocale = source.bodyLocale || detectPrimaryContentLocale(source.body, DEFAULT_LOCALE);
  const bodyEligibleLocales =
    detectedBodyLocale && locales.includes(detectedBodyLocale) ? ([detectedBodyLocale] as Locale[]) : [];
  const eligibleLocales = metadataEligibleLocales.filter((candidate) => {
    if (bodyEligibleLocales.includes(candidate)) {
      return true;
    }
    const hasHighQualityTranslation =
      hasDirectLocalizedValue(source.reviewSummary, candidate) &&
      hasDirectLocalizedValue(source.selectionReason, candidate);
    return hasHighQualityTranslation;
  });

  const publishedLocales: Locale[] =
    eligibleLocales.length > 0
      ? eligibleLocales
      : bodyEligibleLocales.length > 0
        ? bodyEligibleLocales
        : metadataEligibleLocales.length > 0
          ? metadataEligibleLocales
          : [DEFAULT_LOCALE];
  const canonicalLocale = getPreferredCanonicalLocale(publishedLocales, DEFAULT_LOCALE) as Locale;

  return {
    metadataEligibleLocales,
    bodyEligibleLocales,
    eligibleLocales,
    publishedLocales,
    canonicalLocale,
    detectedBodyLocale,
    isIndexableLocale: eligibleLocales.includes(locale),
  };
}
