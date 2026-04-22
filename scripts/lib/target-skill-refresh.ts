import type { SkillCache } from './types';

export type ExpandedGithubSkill = {
  owner?: string;
  repo?: string;
  filePath?: string | null;
};

export function getSkillIdParts(skillId: string): { owner: string; repo: string; slug: string | null } | null {
  const parts = String(skillId || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 3) return null;

  const [owner, repo, slug] = parts;
  if (!owner || !repo) return null;

  return {
    owner,
    repo,
    slug: slug || null,
  };
}

export function pickPrimaryText(value: string | Record<string, string> | undefined | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();

  const preferred = [value.en, value.zh, ...Object.values(value)];
  for (const candidate of preferred) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return '';
}

export function buildTargetSkillFilePathCandidates(skill: SkillCache): string[] {
  const fromCache = String(skill.filePath || '').trim();
  const parts = getSkillIdParts(skill.id);
  const slug = parts?.slug || skill.name || '';
  const normalizedSlug = String(slug || '').trim();

  const candidates = new Set<string>();

  if (fromCache) {
    candidates.add(fromCache);
  }

  if (normalizedSlug) {
    candidates.add(`.claude/skills/${normalizedSlug}/SKILL.md`);
    candidates.add(`.codex/skills/${normalizedSlug}/SKILL.md`);
    candidates.add(`.agent/skills/${normalizedSlug}/SKILL.md`);
    candidates.add(`skills/${normalizedSlug}/SKILL.md`);
    candidates.add(`${normalizedSlug}/SKILL.md`);
    candidates.add(`${normalizedSlug}/README.md`);
  }

  candidates.add('');

  return Array.from(candidates);
}

export function resolveExpandedSkillFilePath(
  expandedSkills: ExpandedGithubSkill[],
  owner: string,
  repo: string,
  skillId: string,
): string | null {
  const parts = getSkillIdParts(skillId);
  const slug = parts?.slug;
  if (!slug) return null;

  for (const item of expandedSkills) {
    if (String(item.owner || '').trim() !== owner) continue;
    if (String(item.repo || '').trim() !== repo) continue;

    const filePath = String(item.filePath || '').trim();
    if (!filePath) continue;

    const normalized = filePath
      .replace(/\\/g, '/')
      .replace(/\/?SKILL\.md$/i, '')
      .replace(/\/?README\.md$/i, '');
    const rawSlug = normalized.split('/').filter(Boolean).pop() || '';

    if (rawSlug === slug) {
      return filePath;
    }
  }

  return null;
}
