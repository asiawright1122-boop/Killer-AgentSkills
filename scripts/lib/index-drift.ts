import { buildSkillIndexabilityAssessment } from '../../src/lib/skill-indexability';
import { compileSitemapBlocklist, isSitemapSkillBlocked, type SitemapBlocklistData } from '../../src/lib/sitemap-blocklist';
import { normalizeSitemapSkillEntry } from '../../src/lib/skill-route-paths';
import { buildCrawlerVisibleSkillBody } from './skill-locale-governance';
import { isPublicSkillForSitemap } from './sitemap-skill-filter.js';
import type { SkillCache } from './types';

type SitemapSkill = {
  owner?: string;
  repo?: string;
  routePath?: string;
  id?: string;
};

type LocaleGovernanceRecord = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  canonicalLocale: string;
  detectedBodyLocale: string | null;
  eligibleLocales: string[];
};

export type IndexDriftSnapshot = {
  counts: {
    onlyInSitemap: number;
    onlyInIndexableCache: number;
  };
  onlyInSitemap: string[];
  onlyInIndexableCache: string[];
};

function normalizeRouteKey(owner: unknown, routePath: unknown): string {
  const ownerPart = typeof owner === 'string' ? owner.trim().toLowerCase() : '';
  const routePart = typeof routePath === 'string' ? routePath.trim().toLowerCase() : '';
  return ownerPart && routePart ? `${ownerPart}/${routePart}` : '';
}

function sortKeys(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function buildGovernedIndexableRouteKeys(params: {
  skills: SkillCache[];
  localeGovernance: LocaleGovernanceRecord[];
  blocklistData?: SitemapBlocklistData | null;
}): string[] {
  const blocklist = compileSitemapBlocklist(params.blocklistData || {});
  const skillsById = new Map(params.skills.map((skill) => [skill.id, skill]));
  const routeKeys = new Set<string>();

  for (const record of params.localeGovernance) {
    const routeKey = normalizeRouteKey(record.owner, record.routePath);
    if (!routeKey) continue;
    if (isSitemapSkillBlocked(record.owner, record.routePath, blocklist)) continue;

    const skill = skillsById.get(record.id);
    if (!skill) continue;
    if (!isPublicSkillForSitemap(skill)) continue;

    const canonicalLocale = record.canonicalLocale || 'en';
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: skill.qualityScore,
        verified: skill.verified,
        description: skill.description,
        agentAnalysis: skill.agentAnalysis,
        seo: {
          features: skill.seo?.features,
        },
        readmeContent: buildCrawlerVisibleSkillBody(skill),
        localeGovernance: {
          isIndexableLocale: record.eligibleLocales.includes(canonicalLocale),
          canonicalLocale: canonicalLocale as any,
          detectedBodyLocale: (record.detectedBodyLocale || null) as any,
        },
      },
      canonicalLocale as any,
    );

    if (assessment.isIndexable) {
      routeKeys.add(routeKey);
    }
  }

  return sortKeys(routeKeys);
}

export function buildSitemapRouteKeys(params: {
  sitemapSkills: SitemapSkill[];
  blocklistData?: SitemapBlocklistData | null;
}): string[] {
  const blocklist = compileSitemapBlocklist(params.blocklistData || {});
  const routeKeys = new Set<string>();

  for (const item of params.sitemapSkills) {
    const normalized = normalizeSitemapSkillEntry(item);
    if (!normalized) continue;
    if (isSitemapSkillBlocked(normalized.owner, normalized.routePath, blocklist)) continue;

    routeKeys.add(normalizeRouteKey(normalized.owner, normalized.routePath));
  }

  return sortKeys(routeKeys);
}

export function buildIndexDriftSnapshot(params: {
  skills: SkillCache[];
  localeGovernance: LocaleGovernanceRecord[];
  sitemapSkills: SitemapSkill[];
  blocklistData?: SitemapBlocklistData | null;
}): IndexDriftSnapshot {
  const sitemapRouteKeys = buildSitemapRouteKeys({
    sitemapSkills: params.sitemapSkills,
    blocklistData: params.blocklistData,
  });
  const governedIndexableRouteKeys = buildGovernedIndexableRouteKeys({
    skills: params.skills,
    localeGovernance: params.localeGovernance,
    blocklistData: params.blocklistData,
  });

  const sitemapSet = new Set(sitemapRouteKeys);
  const governedSet = new Set(governedIndexableRouteKeys);

  const onlyInSitemap = sitemapRouteKeys.filter((key) => !governedSet.has(key));
  const onlyInIndexableCache = governedIndexableRouteKeys.filter((key) => !sitemapSet.has(key));

  return {
    counts: {
      onlyInSitemap: onlyInSitemap.length,
      onlyInIndexableCache: onlyInIndexableCache.length,
    },
    onlyInSitemap,
    onlyInIndexableCache,
  };
}
