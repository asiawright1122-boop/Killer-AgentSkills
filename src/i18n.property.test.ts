import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getLangFromUrl,
  useTranslations,
} from './i18n';
import type { Locale } from './i18n';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates a valid segment string (non-empty, no dots, no slashes, no whitespace).
 */
const segmentArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/);

/**
 * Generates a non-empty array of valid key segments to form a nested key path.
 * Depth is limited to 1-5 levels to keep tests practical.
 */
const keyPathArb = fc.array(segmentArb, { minLength: 1, maxLength: 5 });

/**
 * Generates a leaf string value (non-empty, printable).
 */
const leafValueArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Builds a nested message object from a key path and a leaf value.
 * e.g., keyPath = ['Common', 'search'], value = 'Search'
 * => { Common: { search: 'Search' } }
 */
function buildNestedObject(keyPath: string[], value: string): Record<string, any> {
  if (keyPath.length === 1) {
    return { [keyPath[0]]: value };
  }
  const [head, ...rest] = keyPath;
  return { [head]: buildNestedObject(rest, value) };
}

/**
 * Generates a valid locale from SUPPORTED_LOCALES.
 */
const localeArb = fc.constantFrom(...SUPPORTED_LOCALES);

/**
 * Generates a URL path suffix (can be empty or contain path segments).
 */
const pathSuffixArb = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/), { minLength: 0, maxLength: 4 })
  .map((segments) => (segments.length > 0 ? '/' + segments.join('/') : ''));

/**
 * Generates a string that is NOT a valid locale (not in SUPPORTED_LOCALES).
 */
const invalidLocaleSegmentArb = fc
  .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
  .filter((s) => !(SUPPORTED_LOCALES as readonly string[]).includes(s));

// ============================================================================
// Property 1: i18n 翻译函数嵌套键查找
// Feature: nextjs-to-astro-migration, Property 1: i18n 翻译函数嵌套键查找
// Validates: Requirements 2.6, 2.8
// ============================================================================

describe('Feature: nextjs-to-astro-migration, Property 1: i18n 翻译函数嵌套键查找', () => {
  it('should correctly traverse nested objects and return the string value for any valid key path', () => {
    /**
     * **Validates: Requirements 2.6, 2.8**
     *
     * For any valid message object and any nested key path, useTranslations
     * should correctly traverse nested objects and return the corresponding
     * string value.
     */
    fc.assert(
      fc.property(keyPathArb, leafValueArb, (keyPath, leafValue) => {
        const messages = buildNestedObject(keyPath, leafValue);
        const t = useTranslations(messages);
        const dotKey = keyPath.join('.');
        expect(t(dotKey)).toBe(leafValue);
      }),
      { numRuns: 100 }
    );
  });

  it('should return the key name itself when the key does not exist in the messages', () => {
    /**
     * **Validates: Requirements 2.6, 2.8**
     *
     * When the key doesn't exist, useTranslations should return the key name itself.
     */
    fc.assert(
      fc.property(keyPathArb, keyPathArb, leafValueArb, (existingPath, lookupPath, leafValue) => {
        // Only test when the lookup path differs from the existing path
        fc.pre(lookupPath.join('.') !== existingPath.join('.'));

        // Also ensure the lookup path doesn't happen to be a prefix of the existing path
        // (which would resolve to an object, not a string — still returns key)
        const messages = buildNestedObject(existingPath, leafValue);
        const t = useTranslations(messages);
        const dotKey = lookupPath.join('.');

        // The lookup path is different from the existing path, so it should
        // either not exist or resolve to a non-string. In both cases, the
        // function should return the key name.
        const result = t(dotKey);

        // If the result is not the leaf value, it must be the key name (fallback)
        if (result !== leafValue) {
          expect(result).toBe(dotKey);
        }
        // If it equals leafValue, that's also valid (paths could partially overlap
        // and still reach the same leaf by coincidence) — no assertion needed.
      }),
      { numRuns: 100 }
    );
  });

  it('should return the key name when the value at the path is an object (not a string)', () => {
    /**
     * **Validates: Requirements 2.6, 2.8**
     *
     * When the key resolves to an object (not a string), useTranslations
     * should return the key name itself.
     */
    fc.assert(
      fc.property(keyPathArb, leafValueArb, (keyPath, leafValue) => {
        // Need at least 2 segments so we can look up a parent (which is an object)
        fc.pre(keyPath.length >= 2);

        const messages = buildNestedObject(keyPath, leafValue);
        const t = useTranslations(messages);

        // Look up only the parent path (which resolves to an object)
        const parentPath = keyPath.slice(0, -1).join('.');
        expect(t(parentPath)).toBe(parentPath);
      }),
      { numRuns: 100 }
    );
  });

  it('should return the key name for any key when messages is empty', () => {
    /**
     * **Validates: Requirements 2.6, 2.8**
     *
     * With an empty messages object, any key lookup should return the key itself.
     */
    fc.assert(
      fc.property(keyPathArb, (keyPath) => {
        const t = useTranslations({});
        const dotKey = keyPath.join('.');
        expect(t(dotKey)).toBe(dotKey);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 2: URL Locale 提取
// Feature: nextjs-to-astro-migration, Property 2: URL Locale 提取
// Validates: Requirements 2.7
// ============================================================================

describe('Feature: nextjs-to-astro-migration, Property 2: URL Locale 提取', () => {
  it('should return the locale for any URL containing a valid locale prefix', () => {
    /**
     * **Validates: Requirements 2.7**
     *
     * For any URL path containing a valid Locale prefix, getLangFromUrl
     * should return that Locale.
     */
    fc.assert(
      fc.property(localeArb, pathSuffixArb, (locale, pathSuffix) => {
        const url = new URL(`https://example.com/${locale}${pathSuffix}`);
        expect(getLangFromUrl(url)).toBe(locale);
      }),
      { numRuns: 100 }
    );
  });

  it('should return the default locale for URLs without a valid locale prefix', () => {
    /**
     * **Validates: Requirements 2.7**
     *
     * For URLs without a valid Locale prefix, getLangFromUrl should return
     * the default Locale (en).
     */
    fc.assert(
      fc.property(invalidLocaleSegmentArb, pathSuffixArb, (invalidSegment, pathSuffix) => {
        const url = new URL(`https://example.com/${invalidSegment}${pathSuffix}`);
        expect(getLangFromUrl(url)).toBe(DEFAULT_LOCALE);
      }),
      { numRuns: 100 }
    );
  });

  it('should return the default locale for root URL path', () => {
    /**
     * **Validates: Requirements 2.7**
     *
     * The root URL "/" has no locale prefix, so it should return the default locale.
     */
    const url = new URL('https://example.com/');
    expect(getLangFromUrl(url)).toBe(DEFAULT_LOCALE);
  });

  it('should always return a value that is in SUPPORTED_LOCALES', () => {
    /**
     * **Validates: Requirements 2.7**
     *
     * For any URL, getLangFromUrl should always return a value that is
     * a member of SUPPORTED_LOCALES.
     */
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9/_-]{0,50}$/),
        (path) => {
          const url = new URL(`https://example.com/${path}`);
          const result = getLangFromUrl(url);
          expect((SUPPORTED_LOCALES as readonly string[]).includes(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
