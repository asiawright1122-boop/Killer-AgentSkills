import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../../i18n';

const DEFAULT_SITE_URL = 'https://killer-skills.com';

export const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  pt: 'pt_BR',
  ru: 'ru_RU',
  ar: 'ar_SA',
};

export interface PageMetadataInput {
  pathname: string;
  locale: string;
  title: string;
  description?: string;
  customCanonical?: string;
  availableLocales?: readonly string[];
  xDefaultLocale?: string;
  appendBrand?: boolean;
  siteUrl?: string;
}

function stripTrailingSlash(url: string): string {
  if (url === DEFAULT_SITE_URL || url === `${DEFAULT_SITE_URL}/`) {
    return DEFAULT_SITE_URL;
  }

  return url.replace(/\/+$/, '');
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function toAbsoluteUrl(siteUrl: string, value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return stripTrailingSlash(value);
  }

  return stripTrailingSlash(`${siteUrl}${value.startsWith('/') ? value : `/${value}`}`);
}

function replaceLocaleSegment(pathname: string, currentLocale: string, nextLocale: string): string {
  const normalizedPathname = normalizePathname(pathname);
  const localePattern = new RegExp(`^/${currentLocale}(/|$)`);

  if (!localePattern.test(normalizedPathname)) {
    return `/${nextLocale}`;
  }

  return normalizedPathname.replace(localePattern, `/${nextLocale}$1`);
}

function buildDocumentTitle(title: string, appendBrand: boolean): string {
  if (!appendBrand) {
    return title;
  }

  const isSubpage = title !== 'Killer-Skills' && !title.includes('Killer-Skills');
  const fullBrand = ' | Killer-Skills - AI Agent Directory';
  const shortBrand = ' | Killer-Skills';

  if ((title + fullBrand).length <= 60) {
    return isSubpage ? title + fullBrand : title + shortBrand;
  }

  if ((title + shortBrand).length <= 60) {
    return title + shortBrand;
  }

  return title;
}

function normalizeDescription(description?: string): string {
  const cleanDescription = description || 'The ultimate directory of AI Development Skills for Agents.';
  return cleanDescription.length > 155 ? `${cleanDescription.slice(0, 152).trim()}...` : cleanDescription;
}

export function buildPageMetadata({
  pathname,
  locale,
  title,
  description,
  customCanonical,
  availableLocales,
  xDefaultLocale,
  appendBrand = true,
  siteUrl = DEFAULT_SITE_URL,
}: PageMetadataInput) {
  const normalizedSiteUrl = stripTrailingSlash(siteUrl);
  const normalizedPathname = normalizePathname(pathname);
  const canonicalUrl = customCanonical
    ? stripTrailingSlash(customCanonical)
    : toAbsoluteUrl(normalizedSiteUrl, normalizedPathname);
  const normalizedAvailableLocales = SUPPORTED_LOCALES.filter(
    (candidate) => availableLocales?.includes(candidate) ?? true,
  );
  const effectiveLocales = normalizedAvailableLocales.length > 0 ? normalizedAvailableLocales : [locale as Locale];
  const resolvedXDefaultLocale =
    xDefaultLocale && effectiveLocales.includes(xDefaultLocale as Locale)
      ? (xDefaultLocale as Locale)
      : effectiveLocales.includes(DEFAULT_LOCALE)
        ? DEFAULT_LOCALE
        : effectiveLocales[0];

  const alternates = effectiveLocales.map((candidate) => ({
    locale: candidate,
    href: toAbsoluteUrl(normalizedSiteUrl, replaceLocaleSegment(normalizedPathname, locale, candidate)),
  }));

  return {
    canonicalUrl,
    alternates,
    xDefaultUrl: toAbsoluteUrl(
      normalizedSiteUrl,
      replaceLocaleSegment(normalizedPathname, locale, resolvedXDefaultLocale),
    ),
    resolvedXDefaultLocale,
    effectiveLocales,
    documentTitle: buildDocumentTitle(title, appendBrand),
    socialTitle: title,
    description: normalizeDescription(description),
    ogLocale: OG_LOCALE_MAP[locale] || locale,
    ogAlternateLocales: effectiveLocales
      .filter((candidate) => candidate !== locale)
      .map((candidate) => OG_LOCALE_MAP[candidate] || candidate),
  };
}
