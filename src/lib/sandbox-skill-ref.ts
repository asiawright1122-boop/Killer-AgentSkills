const FALLBACK_SEGMENT = 'unknown';
const MAX_SEGMENT_LENGTH = 100;
const UNSAFE_SEGMENT_CHARS = new Set(Array.from('/\\;&|`$<>(){}[]"\''));

function hasUnsafeSegmentCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || /\s/.test(char) || UNSAFE_SEGMENT_CHARS.has(char)) {
      return true;
    }
  }
  return false;
}

export function normalizeSandboxSkillRefSegment(value: string): string {
  if (hasUnsafeSegmentCharacter(value)) return FALLBACK_SEGMENT;

  const normalized = value
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, MAX_SEGMENT_LENGTH);

  return normalized || FALLBACK_SEGMENT;
}

export function getSafeSandboxSkillRef(owner: string, repo: string): string {
  return `${normalizeSandboxSkillRefSegment(owner)}/${normalizeSandboxSkillRefSegment(repo)}`;
}
