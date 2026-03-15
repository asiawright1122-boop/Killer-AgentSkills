import { describe, expect, it } from 'vitest';
import { getLocalizedSeoEligibleLocales, getPreferredCanonicalLocale, isDirectlyLocalizedVariant } from './seo-locales';

describe('seo-locales', () => {
  it('returns only locales with direct title and description coverage', () => {
    const locales = getLocalizedSeoEligibleLocales({
      title: {
        en: 'Top Agentic AI Tools',
        zh: '顶级 Agentic AI 工具',
        ja: 'トップ Agentic AI ツール',
      },
      description: {
        en: 'English summary',
        zh: '中文摘要',
      },
    });

    expect(locales).toEqual(['en', 'zh']);
  });

  it('treats plain strings as default-locale-only content', () => {
    const locales = getLocalizedSeoEligibleLocales({
      title: 'English only title',
      description: 'English only description',
    });

    expect(locales).toEqual(['en']);
  });

  it('prefers english for canonical locale when available', () => {
    expect(getPreferredCanonicalLocale(['zh', 'en', 'ja'])).toBe('en');
  });

  it('falls back to the first localized variant when english is unavailable', () => {
    expect(getPreferredCanonicalLocale(['ja', 'ko'])).toBe('ja');
  });

  it('checks whether a locale is directly localized', () => {
    expect(isDirectlyLocalizedVariant(['en', 'zh'], 'zh')).toBe(true);
    expect(isDirectlyLocalizedVariant(['en', 'zh'], 'fr')).toBe(false);
  });
});
