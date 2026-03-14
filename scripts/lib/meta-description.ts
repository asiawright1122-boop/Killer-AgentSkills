const DENSE_SCRIPT_LOCALES = new Set(['ar', 'ja', 'ko', 'zh']);

export const TRUNCATION_MARKER_PATTERN = /(\.\.\.|…)/;
export const ENGLISH_CTA_PATTERN = /\b(Get started|Learn now|Read more|Learn more|Read now)\b/i;

function normalizeLocale(locale: string): string {
  return locale.toLowerCase().split(/[-_]/)[0] ?? locale.toLowerCase();
}

export function getDescriptionLengthRange(locale: string): { min: number; max: number } {
  const normalizedLocale = normalizeLocale(locale);
  if (DENSE_SCRIPT_LOCALES.has(normalizedLocale)) {
    return { min: 40, max: 200 };
  }
  return { min: 120, max: 158 };
}

export function normalizeMetaWhitespace(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function trimDescriptionToMax(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const sliced = value.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');

  const candidate = lastSpace >= Math.floor(maxLength * 0.65) ? sliced.slice(0, lastSpace) : sliced;

  return normalizeMetaWhitespace(candidate.replace(/[,:;，、\-–—]+$/g, ''));
}

export function sanitizeMetaDescription(value: string, locale: string): string {
  const normalizedLocale = normalizeLocale(locale);

  let cleaned = value.trim();

  cleaned = cleaned.replace(/(?:\.\.\.|…)+\s*$/g, '');
  cleaned = cleaned.replace(/\s*(?:\.\.\.|…)\s*/g, ' ');

  if (normalizedLocale !== 'en') {
    cleaned = cleaned.replace(/\b(Get started|Learn now|Read more|Learn more|Read now)\b[.!。!！]*/gi, ' ');
  }

  cleaned = cleaned.replace(/\s*[,;:，、]+\s*$/g, '');
  return normalizeMetaWhitespace(cleaned);
}
