const INSTRUCTION_LINE_PATTERNS = [
  /\bcritical\s+guidelines?\b/i,
  /\brequired\s+features?\b/i,
  /\bvariable\s*\(/i,
  /\bavoid\s+redundancy\b/i,
  /\bdo\s+not\s+copy\b/i,
  /\bmust\s+emphasize\b/i,
];

const LOW_VALUE_FRAGMENT_PATTERNS = [
  /\bthis\s+happens\s+in\s+two\s+steps\s*:?\s*\.?/gi,
  /\bthat\s+need\s+this\s+happens\s+in\s+two\s+steps\s*:?\s*\.?/gi,
  /\bapplying\s+this\s+happens\s+in\s+two\s+steps\s*:?\s*\.?/gi,
  /\boutput\s+\.(?:md|html|js)\s+files?\b[^.。!?]*[.。!?]?/gi,
  /\bthe\s+template\s+is\s+the\s+starting\s+point\b[^.。!?]*[.。!?]?/gi,
];

function normalizeCopyWhitespace(value: string): string {
  return value
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([。！？、；：])/g, '$1')
    .trim();
}

function stripInstructionFragments(value: string): string {
  return LOW_VALUE_FRAGMENT_PATTERNS.reduce((text, pattern) => text.replace(pattern, ' '), value);
}

function stripInstructionSentences(value: string): string {
  return value
    .split(/(?<=[.!?。！？])\s+/u)
    .filter((sentence) => !INSTRUCTION_LINE_PATTERNS.some((pattern) => pattern.test(sentence)))
    .join(' ');
}

function polishCopy(value: string): string {
  return value
    .replace(/\bIdeal for AI agents that need\s+(?=[A-Z])/g, '')
    .replace(/\bIdeal for AI agents\s*[.:;]\s*/i, '')
    .replace(/\bIdeal for AI agents that need\s*[.:;]\s*/i, '')
    .replace(/\bKey use cases include:\s*[.:;]\s*/i, '')
    .replace(/\bApplying\s+/gi, '')
    .replace(/\s*\((?:\.md|\.html|\.js|markdown|html|javascript)\s+files?\)\s*/gi, ' ')
    .replace(/\s*\((?:\.md|\.html|\.js)\s+file\)\s*/gi, ' ');
}

export function sanitizePublicSkillCopy(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;

  const cleaned = normalizeCopyWhitespace(polishCopy(stripInstructionSentences(stripInstructionFragments(value))));
  if (!cleaned || cleaned.length < 3) return fallback;

  return cleaned;
}

export function sanitizePublicSkillCopyList(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return fallback;

  const sanitized = values
    .map((value) => sanitizePublicSkillCopy(value))
    .filter((value) => value.length > 0)
    .filter(
      (value, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index,
    );

  return sanitized.length > 0 ? sanitized : fallback;
}
