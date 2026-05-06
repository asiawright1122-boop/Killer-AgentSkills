import { describe, it, expect } from 'vitest';
import { tryParseJSON, robustParseJSON, cleanAndClamp, cleanAndTruncate } from './utils';

describe('utils', () => {
  describe('tryParseJSON', () => {
    it('should parse valid JSON', () => {
      expect(tryParseJSON('{"foo": "bar"}')).toEqual({ foo: 'bar' });
      expect(tryParseJSON('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should return null for invalid JSON', () => {
      expect(tryParseJSON('invalid')).toBeNull();
      expect(tryParseJSON('{foo: "bar"}')).toBeNull(); // Missing quotes around keys
    });
  });

  describe('robustParseJSON', () => {
    it('repairs simple unquoted keys without evaluating JavaScript', () => {
      expect(robustParseJSON('{foo: "bar"}')).toEqual({ foo: 'bar' });
    });

    it('rejects executable JavaScript-shaped objects', () => {
      const key = '__robustParseJsonExecuted';
      (globalThis as Record<string, unknown>)[key] = false;

      expect(robustParseJSON('{foo: (globalThis.__robustParseJsonExecuted = true)}')).toBeNull();
      expect((globalThis as Record<string, unknown>)[key]).toBe(false);

      delete (globalThis as Record<string, unknown>)[key];
    });
  });

  describe('cleanAndTruncate', () => {
    it('should truncate strings exceeding limit', () => {
      const input = {
        short: 'hello',
        long: 'hello world this is long',
      };
      // Limit 10. "hello world this is long" -> "hello w..."
      // substring(0, 7) + '...'
      const result = cleanAndTruncate(input, 10);
      expect(result.short).toBe('hello');
      expect(result.long).toBe('hello w...');
      expect(result.long.length).toBe(10);
    });

    it('should handle empty or null values', () => {
      const input = {
        empty: '',
        nullVal: null,
        undefinedVal: undefined,
      };

      // The function converts null/undefined to empty string
      // @ts-ignore to allow passing null/undefined for testing robustness
      const result = cleanAndTruncate(input as any, 10);
      expect(result.empty).toBe('');
      expect(result.nullVal).toBe('');
      expect(result.undefinedVal).toBe('');
    });
  });

  describe('cleanAndClamp', () => {
    it('should clamp strings without appending ellipsis', () => {
      const input = {
        short: 'hello',
        long: 'Feedback Observing: Operational Pattern Detection | AI Agent Skills',
      };
      const result = cleanAndClamp(input, 60);
      expect(result.short).toBe('hello');
      expect(result.long.includes('...')).toBe(false);
      expect(result.long.length).toBeLessThanOrEqual(60);
    });
  });
});
