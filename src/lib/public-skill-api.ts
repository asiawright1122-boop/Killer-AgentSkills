import type { UnifiedSkill } from './skills';

type SkillMdLike =
  | {
      name?: unknown;
      description?: unknown;
      version?: unknown;
      author?: unknown;
      tags?: unknown;
      body?: unknown;
      bodyPreview?: unknown;
    }
  | null
  | undefined;

export const PUBLIC_API_ROBOTS_VALUE = 'noindex, nofollow';

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
  return items.length > 0 ? items : undefined;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/#+\s+/g, ' ')
    .replace(/[>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBodyPreview(text: unknown, maxLength = 320): string | undefined {
  const normalized = typeof text === 'string' ? stripMarkdown(text) : '';
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function withPublicApiHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    'X-Robots-Tag': PUBLIC_API_ROBOTS_VALUE,
    ...headers,
  };
}

export function sanitizePublicSkillMd(
  skillMd: SkillMdLike,
  options: { includeBodyPreview?: boolean } = {},
): Record<string, unknown> | null {
  if (!skillMd || typeof skillMd !== 'object') return null;

  const bodyPreview =
    options.includeBodyPreview === true
      ? buildBodyPreview((skillMd as { bodyPreview?: unknown; body?: unknown }).bodyPreview ?? skillMd.body)
      : undefined;

  const sanitized = {
    ...(toOptionalString(skillMd.name) && { name: toOptionalString(skillMd.name) }),
    ...(toOptionalString(skillMd.description) && { description: toOptionalString(skillMd.description) }),
    ...(toOptionalString(skillMd.version) && { version: toOptionalString(skillMd.version) }),
    ...(toOptionalString(skillMd.author) && { author: toOptionalString(skillMd.author) }),
    ...(toOptionalStringArray(skillMd.tags) && { tags: toOptionalStringArray(skillMd.tags) }),
    ...(bodyPreview && { bodyPreview }),
  };

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function sanitizePublicSkill(skill: UnifiedSkill): Record<string, unknown> {
  const { filePath: _filePath, skillMd, ...rest } = skill;
  const sanitizedSkillMd = sanitizePublicSkillMd(skillMd, { includeBodyPreview: false });
  return sanitizedSkillMd ? { ...rest, skillMd: sanitizedSkillMd } : rest;
}

export function sanitizePublicSkillLikeRecord(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((entry) => sanitizePublicSkillLikeRecord(entry));
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  const {
    filePath: _filePath,
    skillPath: _skillPath,
    rawSkillMd: _rawSkillMd,
    ...rest
  } = input as Record<string, unknown>;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (key === 'skillMd') {
      const skillMd = sanitizePublicSkillMd(value as SkillMdLike, { includeBodyPreview: false });
      if (skillMd) sanitized[key] = skillMd;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}
