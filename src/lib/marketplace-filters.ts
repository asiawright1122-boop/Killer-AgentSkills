import type { UnifiedSkill } from './skills';
import { OFFICIAL_REPOS } from './skills-config';

export type SourceKind = 'official' | 'community';

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));
const OFFICIAL_OWNERS = new Set(
  Object.values(OFFICIAL_REPOS)
    .filter((repo) => repo.verified)
    .map((repo) => repo.owner),
);

function numericSortValue(value: number | null | undefined): number {
  return typeof value === 'number' ? value : 0;
}

function skillDisplayName(skill: UnifiedSkill): string {
  return String(skill.name || skill.skillName || skill.repo);
}

function compareSkillsPopular(a: UnifiedSkill, b: UnifiedSkill): number {
  return (
    numericSortValue(b.rankScore) - numericSortValue(a.rankScore) ||
    numericSortValue(b.qualityScore) - numericSortValue(a.qualityScore) ||
    numericSortValue(b.stars) - numericSortValue(a.stars) ||
    skillDisplayName(a).localeCompare(skillDisplayName(b))
  );
}

export function getSkillSourceKind(skill: UnifiedSkill): SourceKind {
  if (skill.sourceKind) return skill.sourceKind;

  const key = `${skill.owner}/${skill.repo}`;
  if (skill.source === 'verified' || OFFICIAL_REPO_KEYS.has(key) || OFFICIAL_OWNERS.has(skill.owner)) {
    return 'official';
  }

  return 'community';
}

export function isMarketplaceApprovedSkill(skill: UnifiedSkill): boolean {
  if (skill.securityLevel === 'D') return false;
  if (skill.isTrustedRankingEligible === false) return false;
  return true;
}

export function getMarketplaceSkills(skills: UnifiedSkill[]): UnifiedSkill[] {
  return skills.filter(isMarketplaceApprovedSkill).map((skill) => ({
    ...skill,
    sourceKind: getSkillSourceKind(skill),
  }));
}

export function sortSkillsPopular(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort(compareSkillsPopular);
}

export function sortSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort((a, b) => {
    const byDate = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    if (byDate !== 0) return byDate;
    return compareSkillsPopular(a, b);
  });
}
