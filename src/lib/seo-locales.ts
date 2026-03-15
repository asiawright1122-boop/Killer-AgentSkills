import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../i18n';

type LocalizedField = string | Record<string, string> | undefined;

type CollectionLocaleSource = {
  title?: LocalizedField;
  description?: LocalizedField;
};

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
