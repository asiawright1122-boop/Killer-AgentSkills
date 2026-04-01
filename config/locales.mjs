// @ts-check

export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = /** @type {const} */ (['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar']);

export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

export const LOCALE_NAMES = /** @type {const} */ ({
  en: 'English',
  zh: '简体中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
});

export const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES);

/**
 * @param {string | undefined | null} locale
 */
export function isSupportedLocale(locale) {
  // @ts-ignore: Set.has supports strings but TS strict literal types complain
  return typeof locale === 'string' && SUPPORTED_LOCALE_SET.has(locale);
}
