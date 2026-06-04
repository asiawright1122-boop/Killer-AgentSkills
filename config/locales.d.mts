export const DEFAULT_LOCALE: "en";
export const SUPPORTED_LOCALES: readonly ["en", "zh", "ja", "ko", "es", "fr", "de", "pt", "ru", "ar"];
export const NON_DEFAULT_LOCALES: string[];
export const LOCALE_NAMES: {
  readonly en: "English";
  readonly zh: "简体中文";
  readonly ja: "日本語";
  readonly ko: "한국어";
  readonly es: "Español";
  readonly fr: "Français";
  readonly de: "Deutsch";
  readonly pt: "Português";
  readonly ru: "Русский";
  readonly ar: "العربية";
};
export const SUPPORTED_LOCALE_SET: Set<string>;
export function isSupportedLocale(locale: string | undefined | null): boolean;
