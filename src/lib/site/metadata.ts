import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../../i18n';
import { normalizePublicSummary } from '../public-text';

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
  brandSuffix?: 'full' | 'short';
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

function buildDocumentTitle(title: string, appendBrand: boolean, brandSuffix: 'full' | 'short'): string {
  const MAX_TITLE_LEN = 85;
  const ELLIPSIS = '…';

  function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    // Find the last separator before the limit to avoid cutting mid-word
    const cut = str.lastIndexOf(' — ', max - 1);
    if (cut > max * 0.4) return str.slice(0, cut) + ELLIPSIS;
    const dash = str.lastIndexOf('–', max - 2);
    if (dash > max * 0.4) return str.slice(0, dash) + ELLIPSIS;
    const space = str.lastIndexOf(' ', max - 2);
    if (space > max * 0.4) return str.slice(0, space) + ELLIPSIS;
    return str.slice(0, max - 1) + ELLIPSIS;
  }

  if (!appendBrand) {
    return truncate(title, MAX_TITLE_LEN);
  }

  if (title.includes('Killer-Skills')) {
    return truncate(title, MAX_TITLE_LEN);
  }

  const isSubpage = title !== 'Killer-Skills';
  const fullBrand = ' | Killer-Skills - AI Agent Directory';
  const shortBrand = ' | Killer-Skills';

  if (brandSuffix === 'short') {
    const withBrand = title + shortBrand;
    return withBrand.length <= 60 ? withBrand : truncate(title, MAX_TITLE_LEN);
  }

  if ((title + fullBrand).length <= 60) {
    return isSubpage ? title + fullBrand : title + shortBrand;
  }

  if ((title + shortBrand).length <= 60) {
    return title + shortBrand;
  }

  // Title too long for any brand suffix — truncate the raw title
  return truncate(title, MAX_TITLE_LEN);
}

const DEFAULT_DESCRIPTION =
  'Browse and install 3,400+ verified AI agent skills and MCP servers. Connect Cursor, Claude Code, and Windsurf to tools for browser, PDF, and database automation.';

function normalizeDescription(description?: string): string {
  const cleanDescription = description || DEFAULT_DESCRIPTION;
  const normalized = normalizePublicSummary(cleanDescription, 155);
  // Guard against normalization stripping the input to empty (e.g. inputs that
  // contain only punctuation or non-printable characters). SEO audits flag
  // pages with empty <meta name="description">, so always emit a non-empty
  // fallback here.
  return normalized || normalizePublicSummary(DEFAULT_DESCRIPTION, 155) || DEFAULT_DESCRIPTION;
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
  brandSuffix = 'full',
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
    documentTitle: buildDocumentTitle(title, appendBrand, brandSuffix),
    socialTitle: title,
    description: normalizeDescription(description),
    ogLocale: OG_LOCALE_MAP[locale] || locale,
    ogAlternateLocales: effectiveLocales
      .filter((candidate) => candidate !== locale)
      .map((candidate) => OG_LOCALE_MAP[candidate] || candidate),
  };
}
