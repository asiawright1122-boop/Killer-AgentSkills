import { sanitizePublicAIOutput } from './public-ai-output';

const INSTRUCTION_LINE_PATTERNS = [
  /\bcritical\s+guidelines?\b/i,
  /\brequired\s+features?\b/i,
  /\bvariable\s*\(/i,
  /^\s*(?:phase|pass)\s+\d+\s*[:—-]/i,
  /\bavoid\s+redundancy\b/i,
  /\bavoid\s+repeating\b/i,
  /\bavoid\s+copying\b/i,
  /\bdo\s+not\s+copy\b/i,
  /\bdo\s+not\s+pad\b/i,
  /\bmust\s+emphasize\b/i,
  /\buse\s+when\b/i,
  /\byou\s+are\s+auditing\b/i,
  /\bdispatch\b[^.。!?]*\bsubagents?\b/i,
  /\bshared\s+instructions?\b/i,
  /\beach\s+reference\s+file\s+follows\b/i,
  /\bquick\s+(?:pattern|command|config|reference)\b/i,
  /\bdeep\s+dive\b/i,
  /\bimpact\s+ratings?\b/i,
  /\breview\s+guardrails?\b/i,
  /\bpriority-ordered\s+guidelines?\b/i,
  /\bfollow\s+these\s+\d+\s+steps?\s+exactly\b/i,
];

const BLOCKED_PUBLIC_COPY_PATTERNS = [
  /\breference-only\b/i,
  /\btrusted\s+next\s+steps?\b/i,
  /\brecovery\s+(?:strategy|control\s+board|board|heavy)\b/i,
  /恢复期话术|(?:恢复|SEO|运营|审查|编辑部|内部|站点)\s*控制台|控制台\s*(?:视图|看板|复核|审查)|复核清单|编辑部审查/i,
];

const SOURCE_INSTRUCTION_SECTION_PATTERNS = [
  /^(?:#{1,6}\s*)?critical\s+guidelines?\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?required\s+features?\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?variables?\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?fixed\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?skill\s+format\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?output\s+schema\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?review\s+guardrails?\s*:?\s*$/i,
  /^(?:#{1,6}\s*)?priority-ordered\s+guidelines?\s*:?\s*$/i,
];

const SOURCE_INSTRUCTION_LINE_PATTERNS = [
  ...INSTRUCTION_LINE_PATTERNS,
  ...BLOCKED_PUBLIC_COPY_PATTERNS,
  /^\s*(?:[-*]\s*)?(?:variable|fixed)\s*(?:\(|:)/i,
  /\bthe\s+template\s+is\s+the\s+starting\s+point\b/i,
  /\boutput\s+\.(?:md|html|js)\s+files?\b/i,
  /\beach\s+\w+[^.。!?]*\bshould\s+be\s+mentioned\b/i,
  /\byou\s+orchestrate\s+a\s+pr\s+code\s+review\s+debate\b/i,
];

const LOW_VALUE_FRAGMENT_PATTERNS = [
  /\bthis\s+happens\s+in\s+two\s+steps\s*:?\s*\.?/gi,
  /\bthat\s+need\s+this\s+happens\s+in\s+two\s+steps\s*:?\s*\.?/gi,
  /\bapplying\s+this\s+happens\s+in\s+two\s+steps\s*:?\s*\.?/gi,
  /\bthis\s+ai\s+agent\s+skill\s+supports\s*[.。!?]?/gi,
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
    .replace(/\bIdeal for AI agents that need\s+[^.。!?]*[.。!?]\s+(?=[\w-]+\s+is\s+an\s+AI\s+agent\s+skill\b)/gi, '')
    .replace(/\bIdeal for AI agents\s*[.:;]\s*/i, '')
    .replace(/\bIdeal for AI agents that need\s*[.:;]\s*/i, '')
    .replace(/\bIdeal for AI agents that need\s+/gi, '')
    .replace(/\bKey use cases include:\s*[.:;]\s*/i, '')
    .replace(/\bApplying\s+/gi, '')
    .replace(/\s*\((?:\.md|\.html|\.js|markdown|html|javascript)\s+files?\)\s*/gi, ' ')
    .replace(/\s*\((?:\.md|\.html|\.js)\s+file\)\s*/gi, ' ');
}

export function sanitizePublicSkillCopy(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  if (BLOCKED_PUBLIC_COPY_PATTERNS.some((pattern) => pattern.test(value))) return fallback;

  const safeValue = sanitizePublicAIOutput(value);
  const cleaned = normalizeCopyWhitespace(polishCopy(stripInstructionSentences(stripInstructionFragments(safeValue))));
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

export function sanitizePublicSkillSourceExcerpt(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;

  const sanitizedLines: string[] = [];
  let skippingInstructionBlock = false;

  for (const line of sanitizePublicAIOutput(value).split(/\r?\n/)) {
    const trimmed = line.trim();
    const isMarkdownHeading = /^#{1,6}\s+\S/.test(trimmed);

    if (skippingInstructionBlock) {
      if (!trimmed) {
        skippingInstructionBlock = false;
      } else if (!isMarkdownHeading) {
        continue;
      } else {
        skippingInstructionBlock = false;
      }
    }

    if (SOURCE_INSTRUCTION_SECTION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      skippingInstructionBlock = true;
      continue;
    }

    const withoutFragments = stripInstructionFragments(line).replace(/[ \t]+$/g, '');
    const cleanedLine = withoutFragments.trim();

    if (!cleanedLine) {
      sanitizedLines.push('');
      continue;
    }

    if (SOURCE_INSTRUCTION_LINE_PATTERNS.some((pattern) => pattern.test(cleanedLine))) {
      continue;
    }

    sanitizedLines.push(withoutFragments);
  }

  const cleaned = sanitizedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned || cleaned.length < 3) return fallback;

  return cleaned;
}
