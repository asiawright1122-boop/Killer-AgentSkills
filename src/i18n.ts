import { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES, isSupportedLocale } from '../config/locales.mjs';

export { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES };
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export async function loadMessages(locale: Locale): Promise<Record<string, any>> {
  const messages = await import(`./messages/${locale}.json`);
  return messages.default;
}

export function getLangFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (isSupportedLocale(lang)) return lang as Locale;
  return DEFAULT_LOCALE;
}

function resolveTranslationValue(messages: Record<string, any>, key: string): string | undefined {
  const keys = key.split('.');
  let value: any = messages;

  for (const segment of keys) {
    if (value && typeof value === 'object' && segment in value) {
      value = value[segment];
      continue;
    }

    return undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

export function hasTranslation(messages: Record<string, any>, key: string): boolean {
  return resolveTranslationValue(messages, key) !== undefined;
}

export function translateOr(messages: Record<string, any>, key: string, fallback: string): string {
  return resolveTranslationValue(messages, key) ?? fallback;
}

export function useTranslations(messages: Record<string, any>) {
  return function t(key: string): string {
    return translateOr(messages, key, key);
  };
}
