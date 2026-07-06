import type { UnifiedSkill } from './skills';
import { OFFICIAL_REPOS } from './skills-config';

export type SourceKind = 'official' | 'community';

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));
const OFFICIAL_OWNERS = new Set(
  Object.values(OFFICIAL_REPOS)
    .filter((repo) => repo.verified)
    .map((repo) => repo.owner),
);

function scoreForPopularSort(skill: UnifiedSkill): number {
  if (typeof skill.rankScore === 'number') return skill.rankScore;
  if (typeof skill.qualityScore === 'number') return skill.qualityScore;
  return 0;
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
  return [...skills].sort(
    (a, b) =>
      scoreForPopularSort(b) - scoreForPopularSort(a) ||
      (b.stars || 0) - (a.stars || 0) ||
      String(a.name || a.skillName || a.repo).localeCompare(String(b.name || b.skillName || b.repo)),
  );
}

export function sortSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort((a, b) => {
    const byDate = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    if (byDate !== 0) return byDate;
    return sortSkillsPopular([a, b])[0] === a ? -1 : 1;
  });
}
