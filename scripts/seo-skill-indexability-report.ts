#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOCALE, type Locale } from '../src/i18n';
import { buildSkillIndexabilityAssessment } from '../src/lib/skill-indexability';
import { buildLocalizedSkillPath, getSkillRoutePath } from '../src/lib/skill-route-paths';
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
  mode: 'indexable' | 'reference_only';
  score: number;
  threshold: number;
  reasons: string[];
  blockers: string[];
};

type IndexabilityReport = {
  generatedAt: string;
  summary: {
    sourceMode: 'full' | 'governance_fallback';
    totalSkills: number;
    indexableSkills: number;
    referenceOnlySkills: number;
    canonicalLocaleCounts: Record<string, number>;
    indexableCanonicalLocaleCounts: Record<string, number>;
    blockerCounts: Record<string, number>;
  };
  skills: IndexabilityRecord[];
};

type SitemapSkillRecord = {
  owner?: string;
  repo?: string;
  routePath?: string;
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

  return [
    '# Skill Indexability Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    `- Source mode: ${report.summary.sourceMode}`,
    `- Skills analyzed: ${report.summary.totalSkills}`,
    `- Indexable canonical pages: ${report.summary.indexableSkills}`,
    `- Reference-only canonical pages: ${report.summary.referenceOnlySkills}`,
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
const sitemapSkillsRaw = readJson<SitemapSkillRecord[] | { skills?: SitemapSkillRecord[] }>(sitemapSkillsPath);
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
            mode: isIndexable ? 'indexable' : 'reference_only',
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

const report: IndexabilityReport = {
  generatedAt,
  summary: {
    sourceMode: skills ? 'full' : 'governance_fallback',
    totalSkills: records.length,
    indexableSkills: 0,
    referenceOnlySkills: 0,
    canonicalLocaleCounts: {},
    indexableCanonicalLocaleCounts: {},
    blockerCounts: {},
  },
  skills: records,
};

for (const record of records) {
  incrementCount(report.summary.canonicalLocaleCounts, record.canonicalLocale);

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
    `json=${reportJsonPath}`,
    `md=${reportMarkdownPath}`,
  ].join(' | '),
);
