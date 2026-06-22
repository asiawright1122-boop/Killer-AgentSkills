/**
 * Public AI output must never expose model-internal deliberation.
 *
 * This sanitizer is intentionally narrow: it removes common hidden-reasoning
 * containers and explicitly labeled scratchpad sections while preserving normal
 * public copy that may discuss reasoning as a product capability.
 */
export type PublicAIOutputLeakPattern = {
  label: string;
  pattern: RegExp;
};

export const HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS: readonly PublicAIOutputLeakPattern[] = [
  { label: 'thinking tag', pattern: /<\/?thinking>/i },
  { label: 'reasoning tag', pattern: /<\/?reasoning>/i },
  { label: 'analysis tag', pattern: /<\/?analysis>/i },
  { label: 'chain-of-thought section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?chain[- ]of[- ]thought\s*[:：]/i },
  { label: 'hidden reasoning section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?hidden\s+reasoning\s*[:：]/i },
  { label: 'private analysis section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?private\s+analysis\s*[:：]/i },
  { label: 'scratchpad section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?scratchpad\s*[:：]/i },
  { label: 'internal monologue section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?internal\s+monologue\s*[:：]/i },
  { label: '内部思考 section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?内部思考\s*[:：]/ },
  { label: '思考链 section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?思考链\s*[:：]/ },
  { label: '推理过程 section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?推理过程\s*[:：]/ },
  { label: '思维链 section', pattern: /(^|\n)\s*(?:#{1,6}\s*)?思维链\s*[:：]/ },
];

export function findHiddenReasoningPublicOutputMatches(output: string): string[] {
  return HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS.map((entry) => output.match(entry.pattern)?.[0]).filter(
    (match): match is string => Boolean(match),
  );
}

export function sanitizePublicAIOutput(output: string): string {
  return output
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<(?:thinking|reasoning|analysis)>[\s\S]*$/gi, '')
    .replace(/<\/?(?:thinking|reasoning|analysis)>/gi, '')
    .replace(
      /(^|\n)[^\S\r\n]*(?:#{1,6}[^\S\r\n]+)?(?:chain[- ]of[- ]thought|hidden reasoning|private analysis|scratchpad|internal monologue|内部思考|思考链|推理过程|思维链)[^\S\r\n]*[:：]?[^\n]*(?:\n(?![^\S\r\n]*(?:\n|#{1,6}\s+\S|---+[^\S\r\n]*$))[^\n]*)*/gi,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isPlainPublicOutputObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizePublicAIOutputValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizePublicAIOutput(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizePublicAIOutputValue(entry));
  if (!value || typeof value !== 'object') return value;
  if (!isPlainPublicOutputObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      sanitizePublicAIOutput(key),
      sanitizePublicAIOutputValue(entry),
    ]),
  );
}

export function createPublicAIOutputStreamSanitizer() {
  let rawOutput = '';
  let publicOutput = '';

  return {
    push(chunk: string): string {
      if (!chunk) return '';

      rawOutput += chunk;
      const nextPublicOutput = sanitizePublicAIOutput(rawOutput);
      const delta = nextPublicOutput.startsWith(publicOutput) ? nextPublicOutput.slice(publicOutput.length) : '';
      publicOutput = nextPublicOutput;
      return delta;
    },
    getPublicOutput(): string {
      return publicOutput;
    },
  };
}

export function appendNoHiddenReasoningInstruction(prompt: string): string {
  return `${prompt}

PUBLIC OUTPUT BOUNDARY:
Never reveal hidden reasoning, chain-of-thought, private analysis, scratchpad notes, or <thinking>/<reasoning>/<analysis> blocks.
If reasoning is useful, provide only a concise user-facing rationale, checklist, or evidence summary.`;
}
