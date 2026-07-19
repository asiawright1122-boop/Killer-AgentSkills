import type { SkillInteractionMetrics } from './skill-interaction-store';
import { compareMarketplaceSkillsPopular, getPublicMarketplaceSkills } from './marketplace-policy';
import { getSkillRoutePath } from './skill-route-paths';
import type { UnifiedSkill } from './skills';

function getSkillMetrics(
  skill: UnifiedSkill,
  metrics: Map<string, SkillInteractionMetrics>,
): SkillInteractionMetrics | undefined {
  const canonicalMetrics = metrics.get(skill.id);
  if (canonicalMetrics) return canonicalMetrics;

  const routePath = getSkillRoutePath(skill);
  if (!routePath) return undefined;
  return metrics.get(`${skill.owner}/${routePath}`);
}

export function attachSkillActivity(
  skills: UnifiedSkill[],
  metrics: Map<string, SkillInteractionMetrics>,
): UnifiedSkill[] {
  return skills.map((skill) => {
    const activity = getSkillMetrics(skill, metrics);
    if (!activity) return skill;

    return {
      ...skill,
      cliInstalls7d: activity.cliInstalls7d,
      cliInstalls30d: activity.cliInstalls30d,
      installActions7d: activity.installActions7d,
      installActions30d: activity.installActions30d,
      trendScore: activity.trendScore,
    };
  });
}

export function sortSkillsTrending(skills: UnifiedSkill[]): UnifiedSkill[] {
  const admitted = getPublicMarketplaceSkills(skills);
  if (!admitted.some((skill) => Number(skill.trendScore || 0) > 0)) {
    return admitted.sort(compareMarketplaceSkillsPopular);
  }

  return admitted.sort(
    (a, b) =>
      Number(b.trendScore || 0) - Number(a.trendScore || 0) ||
      Number(b.cliInstalls7d || 0) - Number(a.cliInstalls7d || 0) ||
      compareMarketplaceSkillsPopular(a, b),
  );
}
