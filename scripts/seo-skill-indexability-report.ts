#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOCALE, type Locale } from '../src/i18n';
import { buildSkillIndexabilityAssessment } from '../src/lib/skill-indexability';
import { buildLocalizedSkillPath, getSkillRoutePath, type SitemapSkillEntry } from '../src/lib/skill-route-paths';
import { buildCrawlerVisibleSkillBody } from './lib/skill-locale-governance';
import type { CacheData, SkillCache } from './lib/types';

type LocaleGovernanceRecord = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  canonicalLocale: Locale;
  detectedBodyLocale: Locale | null;
  eligibleLocales: Locale[];
  publishedLocales: Locale[];
};

type IndexabilityRecord = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  canonicalLocale: Locale;
  detectedBodyLocale: Locale | null;
  canonicalUrl: string;
  qualityScore: number;
  isIndexable: boolean;
  tier: 1 | 2 | 3;
  mode: 'indexable' | 'support' | 'reference_only';
  score: number;
  threshold: number;
  reasons: string[];
  blockers: string[];
};

type RepoDirectoryIndexabilityRecord = {
  id: string;
  owner: string;
  repo: string;
  canonicalUrl: string;
  isIndexable: boolean;
  blockers: string[];
};

type IndexabilityReport = {
  generatedAt: string;
  summary: {
    sourceMode: 'full' | 'governance_fallback';
    totalSkills: number;
    indexableSkills: number;
    referenceOnlySkills: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    canonicalLocaleCounts: Record<string, number>;
    indexableCanonicalLocaleCounts: Record<string, number>;
    blockerCounts: Record<string, number>;
    totalRepoDirectories: number;
    indexableRepoDirectories: number;
    referenceOnlyRepoDirectories: number;
  };
  skills: IndexabilityRecord[];
  repoDirectories: RepoDirectoryIndexabilityRecord[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readSkillsCache(path: string): SkillCache[] | null {
  if (!existsSync(path)) return null;
  const raw = readJson<CacheData | SkillCache[]>(path);
  return Array.isArray(raw) ? raw : raw.skills || [];
}

function incrementCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] || 0) + 1;
}

function renderMarkdown(report: IndexabilityReport): string {
  const blockerLines = Object.entries(report.summary.blockerCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([blocker, count]) => `- ${blocker}: ${count}`);
  const localeLines = Object.entries(report.summary.indexableCanonicalLocaleCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([locale, count]) => `- ${locale}: ${count}`);
  const samples = report.skills.filter((item) => !item.isIndexable).slice(0, 20);
  const repoSample = report.repoDirectories.slice(0, 20);

  return [
    '# Skill Indexability Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    `- Source mode: ${report.summary.sourceMode}`,
    `- Skills analyzed: ${report.summary.totalSkills}`,
    `- Indexable canonical pages (Tier 1): ${report.summary.indexableSkills}`,
    `- Reference-only canonical pages: ${report.summary.referenceOnlySkills}`,
    `- Tier 1 (indexable): ${report.summary.tier1Count}`,
    `- Tier 2 (support, noindex): ${report.summary.tier2Count}`,
    `- Tier 3 (reference only, noindex): ${report.summary.tier3Count}`,
    `- Total repo directories: ${report.summary.totalRepoDirectories}`,
    `- Indexable repo directories: ${report.summary.indexableRepoDirectories}`,
    `- Reference-only repo directories: ${report.summary.referenceOnlyRepoDirectories}`,
    '',
    '## Indexable Canonical Locale Counts',
    ...localeLines,
    '',
    '## Blocker Counts',
    ...blockerLines,
    '',
    '## Sample Reference-Only Skills',
    ...(samples.length > 0
      ? samples.map(
          (item) =>
            `- ${item.id} -> ${item.canonicalUrl} | quality=${item.qualityScore} | blockers=${item.blockers.join(', ') || 'none'}`,
        )
      : ['- none']),
    '',
    '## Repository Directories Indexability (Crawl Expansion Boundary)',
    '| Repo Key | Canonical URL | Indexable | Blockers |',
    '|---|---|---|---|',
    ...repoSample.map(
      (item) =>
        `| ${item.id} | ${item.canonicalUrl} | ${item.isIndexable ? '✓' : '✗'} | ${item.blockers.join(', ') || 'none'} |`,
    ),
    '',
  ].join('\n');
}

const workspaceRoot = process.cwd();
const dataDir = resolve(workspaceRoot, 'data');
const reportDir = resolve(workspaceRoot, 'reports/seo');
const skillsCachePath = resolve(dataDir, 'skills-cache.json');
const sitemapSkillsPath = resolve(dataDir, 'sitemap-skills.json');
const localeGovernancePath = resolve(dataDir, 'seo-skill-locale-governance.json');
const reportJsonPath = resolve(reportDir, 'latest-skill-indexability.json');
const reportMarkdownPath = resolve(reportDir, 'latest-skill-indexability.md');

const skills = readSkillsCache(skillsCachePath);
const sitemapSkillsRaw = readJson<SitemapSkillEntry[] | { skills?: SitemapSkillEntry[] }>(sitemapSkillsPath);
const sitemapSkills = Array.isArray(sitemapSkillsRaw) ? sitemapSkillsRaw : sitemapSkillsRaw.skills || [];
const localeGovernanceRaw = readJson<{ skills?: LocaleGovernanceRecord[] } | LocaleGovernanceRecord[]>(
  localeGovernancePath,
);
const localeGovernance = Array.isArray(localeGovernanceRaw) ? localeGovernanceRaw : localeGovernanceRaw.skills || [];
const localeGovernanceMap = new Map(localeGovernance.map((item) => [item.id, item]));
const generatedAt = new Date().toISOString();

const records: IndexabilityRecord[] = (
  skills
    ? skills
        .map((skill) => {
          const governance = localeGovernanceMap.get(skill.id);
          const canonicalLocale = governance?.canonicalLocale || DEFAULT_LOCALE;
          const routePath = governance?.routePath || skill.id.split('/').slice(1).join('/');
          if (!routePath) return null;

          const assessment = buildSkillIndexabilityAssessment(
            {
              qualityScore: skill.qualityScore,
              verified: (skill as SkillCache & { verified?: boolean }).verified,
              stars: skill.stars,
              description: skill.description,
              agentAnalysis: skill.agentAnalysis,
              seo: {
                features: skill.seo?.features,
              },
              readmeContent: buildCrawlerVisibleSkillBody(skill),
              localeGovernance: {
                isIndexableLocale: governance
                  ? governance.eligibleLocales.includes(canonicalLocale)
                  : canonicalLocale === DEFAULT_LOCALE,
                canonicalLocale,
                detectedBodyLocale: governance?.detectedBodyLocale || null,
              },
            },
            canonicalLocale,
          );

          return {
            id: skill.id,
            owner: skill.owner,
            repo: skill.repo,
            routePath,
            canonicalLocale,
            detectedBodyLocale: governance?.detectedBodyLocale || null,
            canonicalUrl: `https://killer-skills.com${buildLocalizedSkillPath(canonicalLocale, skill.owner, routePath)}`,
            qualityScore: Number(skill.qualityScore || 0),
            isIndexable: assessment.isIndexable,
            tier: assessment.tier,
            mode: assessment.mode,
            score: assessment.score,
            threshold: assessment.threshold,
            reasons: assessment.reasons,
            blockers: assessment.blockers,
          };
        })
        .filter((record): record is IndexabilityRecord => Boolean(record))
    : sitemapSkills
        .map((skill) => {
          const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
          const repo = typeof skill.repo === 'string' ? skill.repo.trim() : '';
          const routePath = getSkillRoutePath({
            owner,
            repo,
            routePath: typeof skill.routePath === 'string' ? skill.routePath.trim() : '',
          });
          if (!owner || !repo || !routePath) return null;

          const governanceKey = `/${owner}/${routePath}`;
          const governance = localeGovernanceMap.get(governanceKey);
          const canonicalLocale = governance?.canonicalLocale || DEFAULT_LOCALE;
          const isIndexable = governance ? governance.eligibleLocales.includes(canonicalLocale) : true;

          return {
            id: governanceKey,
            owner,
            repo,
            routePath,
            canonicalLocale,
            detectedBodyLocale: governance?.detectedBodyLocale || null,
            canonicalUrl: `https://killer-skills.com${buildLocalizedSkillPath(canonicalLocale, owner, routePath)}`,
            qualityScore: 0,
            isIndexable,
            tier: (isIndexable ? 2 : 3) as 1 | 2 | 3,
            mode: isIndexable ? ('support' as const) : ('reference_only' as const),
            score: 0,
            threshold: 0,
            reasons: ['Derived from locale governance because data/skills-cache.json is unavailable.'],
            blockers: isIndexable ? [] : ['canonical_locale_not_published'],
          };
        })
        .filter((record): record is IndexabilityRecord => Boolean(record))
).sort(
  (a, b) =>
    Number(a.isIndexable) - Number(b.isIndexable) || a.qualityScore - b.qualityScore || a.id.localeCompare(b.id),
);

const sitemapBlocklistPath = resolve(dataDir, 'seo-sitemap-blocklist.json');
const sitemapBlocklistData = existsSync(sitemapBlocklistPath)
  ? readJson<{ blocked_owners?: string[]; blocked_repos?: string[] } | string[]>(sitemapBlocklistPath)
  : { blocked_owners: [], blocked_repos: [] };
const blockedOwners = new Set(
  (Array.isArray(sitemapBlocklistData) ? [] : sitemapBlocklistData.blocked_owners || []).map((o) => o.toLowerCase()),
);
const blockedRepos = new Set(
  (Array.isArray(sitemapBlocklistData) ? [] : sitemapBlocklistData.blocked_repos || []).map((r) => r.toLowerCase()),
);

const isForcedOpen =
  process.env.OVERRIDE_EXPANSION_BOUNDARY === 'open' || process.env.SEO_FORCE_EXPANSION_OPEN === 'true';

const knownRepoKeySet = new Set<string>();
const repoDirs: RepoDirectoryIndexabilityRecord[] = [];

for (const skill of sitemapSkills) {
  const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
  const rawRoutePath = typeof skill.routePath === 'string' ? skill.routePath.trim() : '';
  if (!owner || !rawRoutePath) continue;

  if (blockedOwners.has(owner.toLowerCase())) continue;
  if (blockedRepos.has(`${owner.toLowerCase()}/${rawRoutePath.toLowerCase()}`)) continue;

  const repo = rawRoutePath.split('/').filter(Boolean)[0];
  if (!repo) continue;

  const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  if (knownRepoKeySet.has(repoKey)) continue;
  knownRepoKeySet.add(repoKey);

  const canonicalUrl = `https://killer-skills.com/${DEFAULT_LOCALE}/skills/${owner}/${repo}`;
  const isIndexable = isForcedOpen;
  const blockers = isIndexable ? [] : ['crawler_boundary_locked_noindex'];

  repoDirs.push({
    id: repoKey,
    owner,
    repo,
    canonicalUrl,
    isIndexable,
    blockers,
  });
}

const report: IndexabilityReport = {
  generatedAt,
  summary: {
    sourceMode: skills ? 'full' : 'governance_fallback',
    totalSkills: records.length,
    indexableSkills: 0,
    referenceOnlySkills: 0,
    tier1Count: 0,
    tier2Count: 0,
    tier3Count: 0,
    canonicalLocaleCounts: {},
    indexableCanonicalLocaleCounts: {},
    blockerCounts: {},
    totalRepoDirectories: repoDirs.length,
    indexableRepoDirectories: repoDirs.filter((r) => r.isIndexable).length,
    referenceOnlyRepoDirectories: repoDirs.filter((r) => !r.isIndexable).length,
  },
  skills: records,
  repoDirectories: repoDirs,
};

for (const record of records) {
  incrementCount(report.summary.canonicalLocaleCounts, record.canonicalLocale);

  // Tier counting
  if (record.tier === 1) {
    report.summary.tier1Count += 1;
  } else if (record.tier === 2) {
    report.summary.tier2Count += 1;
  } else {
    report.summary.tier3Count += 1;
  }

  if (record.isIndexable) {
    report.summary.indexableSkills += 1;
    incrementCount(report.summary.indexableCanonicalLocaleCounts, record.canonicalLocale);
  } else {
    report.summary.referenceOnlySkills += 1;
  }

  for (const blocker of record.blockers) {
    incrementCount(report.summary.blockerCounts, blocker);
  }
}

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
writeFileSync(reportMarkdownPath, renderMarkdown(report), 'utf8');

console.log(
  [
    'skill indexability report generated',
    `skills=${report.summary.totalSkills}`,
    `indexable=${report.summary.indexableSkills}`,
    `referenceOnly=${report.summary.referenceOnlySkills}`,
    `totalRepos=${report.summary.totalRepoDirectories}`,
    `indexableRepos=${report.summary.indexableRepoDirectories}`,
    `json=${reportJsonPath}`,
    `md=${reportMarkdownPath}`,
  ].join(' | '),
);
