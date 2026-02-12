export const SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
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
};

export async function loadMessages(locale: Locale): Promise<Record<string, any>> {
  const messages = await import(`./messages/${locale}.json`);
  return messages.default;
}

export function getLangFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split('/');
  if (SUPPORTED_LOCALES.includes(lang as Locale)) return lang as Locale;
  return DEFAULT_LOCALE;
}

export function useTranslations(messages: Record<string, any>) {
  return function t(key: string): string {
    const keys = key.split('.');
    let value: any = messages;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // fallback to key name
      }
    }
    return typeof value === 'string' ? value : key;
  };
}
