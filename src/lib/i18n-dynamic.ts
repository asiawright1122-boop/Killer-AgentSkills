import type { Env } from './kv';
import { getKV, setKV } from './kv';
import { translateText } from './nvidia';
import { sanitizePublicAIOutput } from './public-ai-output';

// The delimiter used to safely join arrays of strings for bulk translation
const ARRAY_DELIMITER = '\n|||\n';
// For SSR reads (allowRealtime=false), skip KV hash/lookups for very large payloads.
// This avoids CPU-heavy key generation on huge markdown bodies during crawl spikes.
const MAX_NON_REALTIME_TRANSLATION_CHARS = 4000;
const MAX_NON_REALTIME_ARRAY_CHARS = 6000;

function generateTranslationKey(text: string, lang: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // To avoid collisions, append length and first few chars
  const shortPreview = text.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');
  const finalHash = Math.abs(hash).toString(36);
  return `i18n:ssr:${lang}:${finalHash}-${text.length}-${shortPreview}`;
}

/**
 * Translates a single string dynamically with KV caching.
 * If the string is already cached, returns immediately.
 * Otherwise calls the LLM, caches the result, and returns.
 */
export async function translateString(
  env: Env,
  text: string | undefined | null,
  targetLang: string,
  type: 'text' | 'markdown' = 'text',
  allowRealtime: boolean = false,
): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  if (targetLang === 'en') return text; // Skip for default English assuming source is mostly English
  if (!allowRealtime && text.length > MAX_NON_REALTIME_TRANSLATION_CHARS) return text;

  const cacheKey = generateTranslationKey(text, targetLang);

  try {
    const cached = await getKV(env, cacheKey);
    if (cached && typeof cached === 'string') {
      return sanitizePublicAIOutput(cached);
    }
  } catch (e) {
    console.warn('[i18n-dynamic] KV read failed:', e);
  }

  if (allowRealtime) {
    try {
      // We use standard translation without streaming because SSR needs the complete string
      const translated = await translateText(text, targetLang, type, env);
      if (translated && translated.trim().length > 0) {
        const safeTranslated = sanitizePublicAIOutput(translated);
        // Cache indefinitely since source text is hashed
        await setKV(env, cacheKey, safeTranslated).catch((e) => console.warn('[i18n-dynamic] KV set failed:', e));
        return safeTranslated;
      }
    } catch (e) {
      console.error(`[i18n-dynamic] LLM translation failed for string of length ${text.length}:`, e);
    }
  }

  // Fallback to original text on failure
  return text;
}

/**
 * Translates an array of strings dynamically with KV caching.
 * Joins items together to dramatically reduce LLM inference latency during SSR.
 */
export async function translateArray(
  env: Env,
  items: string[] | undefined | null,
  targetLang: string,
  allowRealtime: boolean = false,
): Promise<string[]> {
  if (!items || items.length === 0) return [];
  if (targetLang === 'en') return items; // Skip for default English

  // Filter out empties
  const validItems = items.filter((i) => typeof i === 'string' && i.trim().length > 0);
  if (validItems.length === 0) return [];

  const combinedText = validItems.join(ARRAY_DELIMITER);
  if (!allowRealtime && combinedText.length > MAX_NON_REALTIME_ARRAY_CHARS) return validItems;
  const cacheKey = generateTranslationKey(combinedText, targetLang);

  try {
    const cached = await getKV(env, cacheKey);
    if (cached && typeof cached === 'string') {
      return sanitizePublicAIOutput(cached)
        .split(ARRAY_DELIMITER.trim())
        .map((s) => s.trim());
    }
  } catch (e) {
    console.warn('[i18n-dynamic] KV read failed for array:', e);
  }

  if (allowRealtime) {
    try {
      const translated = await translateText(
        `Translate the following list of terms/phrases. MAINTAIN the exactly same "${ARRAY_DELIMITER.trim()}" delimiters between each item!\n\n${combinedText}`,
        targetLang,
        'text',
        env,
      );

      if (translated && translated.trim().length > 0) {
        const safeTranslated = sanitizePublicAIOutput(translated);
        // Sometimes the LLM might strip the newlines around the delimiter or format differently
        // Let's attempt to dynamically split
        let splitTranslated = safeTranslated.split(ARRAY_DELIMITER);
        if (splitTranslated.length !== validItems.length) {
          // Fallback to simpler split mechanism if the LLM messed up the exact token
          splitTranslated = translated.split(/\|\|\|/g).map((s) => s.trim());
        }

        if (splitTranslated.length >= validItems.length) {
          const finalResult = splitTranslated.slice(0, validItems.length).map((s) => s.trim());
          await setKV(env, cacheKey, finalResult.join(ARRAY_DELIMITER)).catch((e) =>
            console.warn('[i18n-dynamic] KV set array failed:', e),
          );
          return finalResult;
        }
      }
    } catch (e) {
      console.error(`[i18n-dynamic] LLM translation failed for array of ${validItems.length} items:`, e);
    }
  }

  // Fallback to original array on failure
  return validItems;
}
