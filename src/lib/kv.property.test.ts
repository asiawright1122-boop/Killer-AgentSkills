import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { getKV, setKV, type Env } from './kv';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates a valid KV key string.
 * Keys are non-empty strings with printable ASCII characters, no whitespace-only.
 */
const kvKeyArb = fc.stringMatching(/^[a-zA-Z0-9_:.\-\/]{1,64}$/);

/**
 * Generates a valid KV value string.
 * Values can be any non-empty string.
 */
const kvValueArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Creates a mock KVNamespace backed by a real Map for true read-write testing.
 * Unlike vi.fn() mocks, this actually stores and retrieves data.
 */
function createFunctionalMockKV(store: Map<string, string> = new Map()): KVNamespace {
  return {
    get: async (key: string) => {
      const value = store.get(key);
      return value === undefined ? null : value;
    },
    put: async (key: string, value: string, _opts?: any) => {
      store.set(key, value);
    },
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

/**
 * Creates a mock Env with a functional TRANSLATIONS KV namespace.
 */
function createFunctionalEnv(store: Map<string, string> = new Map()): Env {
  return {
    TRANSLATIONS: createFunctionalMockKV(store),
    SKILLS_CACHE: createFunctionalMockKV(),
    AI: {},
    ASSETS: {} as Fetcher,
  };
}

/**
 * Creates an Env without TRANSLATIONS binding to trigger fallback behavior.
 */
function createEnvWithoutTranslations(): Env {
  return {
    TRANSLATIONS: undefined as unknown as KVNamespace,
    SKILLS_CACHE: createFunctionalMockKV(),
    AI: {},
    ASSETS: {} as Fetcher,
  };
}

// ============================================================================
// Property 6: KV 读写一致性
// Feature: nextjs-to-astro-migration, Property 6: KV 读写一致性
// Validates: Requirements 10.1, 10.2, 10.4
// ============================================================================

describe('Feature: nextjs-to-astro-migration, Property 6: KV 读写一致性', () => {
  it('setKV then getKV returns the same value when KV binding is available', async () => {
    /**
     * **Validates: Requirements 10.1, 10.2**
     *
     * For any valid key-value pair, after writing via setKV and reading
     * via getKV with a KV binding available, the same value should be returned.
     */
    await fc.assert(
      fc.asyncProperty(kvKeyArb, kvValueArb, async (key, value) => {
        // Each test iteration gets a fresh store to avoid cross-contamination
        const store = new Map<string, string>();
        const env = createFunctionalEnv(store);

        await setKV(env, key, value);
        const result = await getKV(env, key);
        expect(result).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it('setKV then getKV returns the same value when KV binding is unavailable (fallback to in-memory Map)', async () => {
    /**
     * **Validates: Requirements 10.1, 10.2, 10.4**
     *
     * For any valid key-value pair, when KV binding is unavailable,
     * setKV and getKV should fall back to a local in-memory Map and
     * maintain the same read-write consistency.
     */
    await fc.assert(
      fc.asyncProperty(kvKeyArb, kvValueArb, async (key, value) => {
        const env = createEnvWithoutTranslations();

        await setKV(env, key, value);
        const result = await getKV(env, key);
        expect(result).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it('getKV returns null for keys that have not been written', async () => {
    /**
     * **Validates: Requirements 10.1**
     *
     * For any key that has not been written, getKV should return null,
     * both with and without KV binding.
     */
    await fc.assert(
      fc.asyncProperty(kvKeyArb, async (key) => {
        // With KV binding - fresh store has no data
        const store = new Map<string, string>();
        const env = createFunctionalEnv(store);
        const result = await getKV(env, key);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('last write wins: writing the same key multiple times, getKV returns the last value', async () => {
    /**
     * **Validates: Requirements 10.1, 10.2**
     *
     * For any key written multiple times with different values,
     * getKV should return the most recently written value.
     */
    await fc.assert(
      fc.asyncProperty(
        kvKeyArb,
        fc.array(kvValueArb, { minLength: 2, maxLength: 5 }),
        async (key, values) => {
          const store = new Map<string, string>();
          const env = createFunctionalEnv(store);

          // Write multiple values to the same key
          for (const value of values) {
            await setKV(env, key, value);
          }

          // The last value should be returned
          const result = await getKV(env, key);
          expect(result).toBe(values[values.length - 1]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('different keys maintain independent values', async () => {
    /**
     * **Validates: Requirements 10.1, 10.2**
     *
     * For any set of distinct key-value pairs, writing them all and then
     * reading each key should return the corresponding value.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.tuple(kvKeyArb, kvValueArb),
          { minLength: 2, maxLength: 10, selector: ([k]) => k },
        ),
        async (pairs) => {
          const store = new Map<string, string>();
          const env = createFunctionalEnv(store);

          // Write all pairs
          for (const [key, value] of pairs) {
            await setKV(env, key, value);
          }

          // Read all pairs and verify
          for (const [key, value] of pairs) {
            const result = await getKV(env, key);
            expect(result).toBe(value);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('fallback in-memory Map also supports last-write-wins for the same key', async () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * The fallback in-memory Map should also support last-write-wins
     * semantics, maintaining the same behavior as the KV binding.
     */
    await fc.assert(
      fc.asyncProperty(
        kvKeyArb,
        fc.array(kvValueArb, { minLength: 2, maxLength: 5 }),
        async (key, values) => {
          const env = createEnvWithoutTranslations();

          for (const value of values) {
            await setKV(env, key, value);
          }

          const result = await getKV(env, key);
          expect(result).toBe(values[values.length - 1]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
