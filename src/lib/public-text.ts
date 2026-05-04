const terminalPunctuationPattern = /[.!?。！？؟]$/u;
const danglingTailPatterns = [
  /\b(get started|learn more|start now|read more|see how|discover more)$/i,
  /\b(and|or|with|for|to|in|of|the|a|an)$/i,
  /\b(und|oder|mit|für|zu|im|der|die|das|ein|eine)$/i,
  /\b(et|ou|avec|pour|dans|de|du|des|un|une)$/i,
  /\b(y|o|con|para|en|de|del|un|una)$/i,
  /\b(e|ou|com|para|em|de|do|da|um|uma)$/i,
];

const normalizeSpace = (text: string) => text.replace(/\s+/g, ' ').trim();

const trimAtWordBoundary = (text: string, maxLength: number) => {
  if ([...text].length <= maxLength) return text;

  const sliced = text.slice(0, maxLength + 1);
  const boundary = Math.max(
    sliced.lastIndexOf('.'),
    sliced.lastIndexOf('!'),
    sliced.lastIndexOf('?'),
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('！'),
    sliced.lastIndexOf('？'),
    sliced.lastIndexOf('؟'),
    sliced.lastIndexOf(','),
    sliced.lastIndexOf('،'),
    sliced.lastIndexOf(' '),
  );

  return sliced.slice(0, boundary > maxLength * 0.55 ? boundary : maxLength).trim();
};

const removeDanglingTail = (text: string) => {
  let cleaned = text
    .trim()
    .replace(/[,:;，、؛-]+$/u, '')
    .trim();

  for (let i = 0; i < 3; i += 1) {
    const withoutIncompleteConnectorTail = cleaned
      .replace(/\b(and|or|und|oder|et|ou|y|o|e)\s+\p{Ll}{1,4}$/u, '')
      .trim();
    const next = danglingTailPatterns.reduce(
      (value, pattern) => value.replace(pattern, '').trim(),
      withoutIncompleteConnectorTail,
    );
    if (next === cleaned) break;
    cleaned = next.replace(/[,:;，、؛-]+$/u, '').trim();
  }

  return cleaned;
};

export const normalizePublicSummary = (value: string | undefined, maxLength = 158) => {
  const normalized = normalizeSpace(value || '');
  if (!normalized) return '';

  const shortened = trimAtWordBoundary(normalized, maxLength);
  const cleaned = removeDanglingTail(shortened);
  if (!cleaned) return '';

  return terminalPunctuationPattern.test(cleaned) ? cleaned : `${cleaned}.`;
};

export const normalizePublicTitle = (value: string | undefined, maxLength = 68) => {
  const normalized = normalizeSpace(value || '');
  if (!normalized) return '';

  return removeDanglingTail(trimAtWordBoundary(normalized, maxLength))
    .replace(/[|:;，、؛-]+$/u, '')
    .trim();
};
