import { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES, isSupportedLocale } from '../config/locales.mjs';

export { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES };
export type Locale = (typeof SUPPORTED_LOCALES)[number];

import ar from './messages/ar.json';
import de from './messages/de.json';
import en from './messages/en.json';
import es from './messages/es.json';
import fr from './messages/fr.json';
import hi from './messages/hi.json';
import ja from './messages/ja.json';
import ko from './messages/ko.json';
import pt from './messages/pt.json';
import ru from './messages/ru.json';
import zh from './messages/zh.json';

const MESSAGES_MAP: Record<string, any> = {
  ar,
  de,
  en,
  es,
  fr,
  hi,
  ja,
  ko,
  pt,
  ru,
  zh,
};

export async function loadMessages(locale: Locale): Promise<Record<string, any>> {
  return MESSAGES_MAP[locale] || en;
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
