import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  getLangFromUrl,
  useTranslations,
} from './i18n';
import type { Locale } from './i18n';

describe('SUPPORTED_LOCALES', () => {
  it('should contain exactly 10 locales', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(10);
  });

  it('should contain all expected locales', () => {
    const expected = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];
    expect([...SUPPORTED_LOCALES]).toEqual(expected);
  });
});

describe('DEFAULT_LOCALE', () => {
  it('should be "en"', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('LOCALE_NAMES', () => {
  it('should have a name for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeDefined();
      expect(typeof LOCALE_NAMES[locale]).toBe('string');
      expect(LOCALE_NAMES[locale].length).toBeGreaterThan(0);
    }
  });

  it('should have correct display names', () => {
    expect(LOCALE_NAMES.en).toBe('English');
    expect(LOCALE_NAMES.zh).toBe('简体中文');
    expect(LOCALE_NAMES.ja).toBe('日本語');
  });
});

describe('getLangFromUrl', () => {
  it('should extract locale from URL with valid locale prefix', () => {
    expect(getLangFromUrl(new URL('https://example.com/en/skills'))).toBe('en');
    expect(getLangFromUrl(new URL('https://example.com/zh/skills'))).toBe('zh');
    expect(getLangFromUrl(new URL('https://example.com/ja/'))).toBe('ja');
    expect(getLangFromUrl(new URL('https://example.com/ar/categories'))).toBe('ar');
  });

  it('should return DEFAULT_LOCALE for URLs without valid locale prefix', () => {
    expect(getLangFromUrl(new URL('https://example.com/skills'))).toBe('en');
    expect(getLangFromUrl(new URL('https://example.com/'))).toBe('en');
    expect(getLangFromUrl(new URL('https://example.com/invalid/path'))).toBe('en');
  });

  it('should return DEFAULT_LOCALE for root URL', () => {
    expect(getLangFromUrl(new URL('https://example.com/'))).toBe('en');
  });
});

describe('useTranslations', () => {
  const messages = {
    Common: {
      search: 'Search',
      home: 'Home',
    },
    Home: {
      title: 'Welcome',
      nested: {
        deep: 'Deep Value',
      },
    },
    simple: 'Simple Value',
  };

  it('should return value for top-level key', () => {
    const t = useTranslations(messages);
    expect(t('simple')).toBe('Simple Value');
  });

  it('should return value for nested key using dot notation', () => {
    const t = useTranslations(messages);
    expect(t('Common.search')).toBe('Search');
    expect(t('Common.home')).toBe('Home');
    expect(t('Home.title')).toBe('Welcome');
  });

  it('should return value for deeply nested key', () => {
    const t = useTranslations(messages);
    expect(t('Home.nested.deep')).toBe('Deep Value');
  });

  it('should fallback to key name when key does not exist', () => {
    const t = useTranslations(messages);
    expect(t('nonexistent')).toBe('nonexistent');
    expect(t('Common.nonexistent')).toBe('Common.nonexistent');
    expect(t('a.b.c.d')).toBe('a.b.c.d');
  });

  it('should fallback to key name when value is not a string', () => {
    const t = useTranslations(messages);
    // 'Common' resolves to an object, not a string
    expect(t('Common')).toBe('Common');
    // 'Home.nested' resolves to an object, not a string
    expect(t('Home.nested')).toBe('Home.nested');
  });

  it('should work with empty messages', () => {
    const t = useTranslations({});
    expect(t('any.key')).toBe('any.key');
  });
});
