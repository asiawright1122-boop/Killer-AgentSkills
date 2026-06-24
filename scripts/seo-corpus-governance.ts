#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../src/i18n';
import { buildSkillIndexabilityAssessment } from '../src/lib/skill-indexability';
import { buildLocalizedSkillPath } from '../src/lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from '../src/lib/sitemap-blocklist';
import { buildCrawlerVisibleSkillBody } from './lib/skill-locale-governance';
import type { CacheData, SkillCache } from './lib/types';
import { isPublicSkillForSitemap } from './lib/sitemap-skill-filter.js';

type SitemapSkillEntry = {
  owner?: string;
  repo?: string;
  routePath?: string;
  updatedAt?: string;
};

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

type UrlBucket = 'keep' | 'noindex' | 'consolidate' | 'remove';

type GovernedUrlRecord = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  locale: Locale;
  url: string;
  canonicalUrl: string;
  bucket: UrlBucket;
  blockers: string[];
};

type CorpusGovernanceReport = {
  generatedAt: string;
  summary: {
    beforeRouteCount: number;
    afterRouteCount: number;
    beforeUrlCount: number;
    afterUrlCount: number;
    bucketCounts: Record<UrlBucket, number>;
  };
  routes: Array<{
    id: string;
    owner: string;
    repo: string;
    routePath: string;
    canonicalLocale: Locale;
    routeBucket: 'keep' | 'noindex' | 'remove';
  }>;
  urls: GovernedUrlRecord[];
};

type CorpusGovernanceDiff = {
  generatedAt: string;
  beforeRouteCount: number;
  afterRouteCount: number;
  beforeUrlCount: number;
  afterUrlCount: number;
  keptUrls: string[];
  noindexUrls: string[];
  consolidatedUrls: Array<{ url: string; canonicalUrl: string }>;
  removedUrls: string[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readSkillsCache(path: string): SkillCache[] {
  const raw = readJson<CacheData | SkillCache[]>(path);
  return Array.isArray(raw) ? raw : raw.skills || [];
}

function normalizeSitemapEntries(raw: SitemapSkillEntry[] | { skills?: SitemapSkillEntry[] }): SitemapSkillEntry[] {
  const entries = Array.isArray(raw) ? raw : raw.skills || [];
  const deduped = new Map<string, SitemapSkillEntry>();

  for (const entry of entries) {
    const owner = String(entry.owner || '').trim();
    const repo = String(entry.repo || '').trim();
    const routePath = String(entry.routePath || '').trim();
    if (!owner || !repo || !routePath) continue;
    deduped.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, {
      owner,
      repo,
      routePath,
      ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
    });
  }

  return Array.from(deduped.values());
}

function buildUrl(locale: Locale, owner: string, routePath: string): string {
  return `https://killer-skills.com${buildLocalizedSkillPath(locale, owner, routePath)}`;
}

function renderMarkdown(report: CorpusGovernanceReport, diff: CorpusGovernanceDiff): string {
  const bucketLines = Object.entries(report.summary.bucketCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([bucket, count]) => `- ${bucket}: ${count}`);
  const routeSamples = report.routes.filter((item) => item.routeBucket !== 'keep').slice(0, 20);

  return [
    '# Corpus Governance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    `- Routes before: ${report.summary.beforeRouteCount}`,
    `- Routes after governed publish set: ${report.summary.afterRouteCount}`,
    `- URLs before: ${report.summary.beforeUrlCount}`,
    `- URLs after: ${report.summary.afterUrlCount}`,
    '',
    '## URL Bucket Counts',
    ...bucketLines,
    '',
    '## Route Samples Outside Keep',
    ...(routeSamples.length > 0
      ? routeSamples.map(
          (item) => `- ${item.id} | routeBucket=${item.routeBucket} | canonicalLocale=${item.canonicalLocale}`,
        )
      : ['- none']),
    '',
    '## Diff Snapshot',
    `- kept URLs: ${diff.keptUrls.length}`,
    `- noindex URLs: ${diff.noindexUrls.length}`,
    `- consolidated URLs: ${diff.consolidatedUrls.length}`,
    `- removed URLs: ${diff.removedUrls.length}`,
    '',
  ].join('\n');
}

const workspaceRoot = process.cwd();
const dataDir = resolve(workspaceRoot, 'data');
const reportDir = resolve(workspaceRoot, 'reports/seo');

const sitemapPath = resolve(dataDir, 'sitemap-skills.json');
const blocklistPath = resolve(dataDir, 'seo-sitemap-blocklist.json');
const skillsCachePath = resolve(dataDir, 'skills-cache.json');
const localeGovernancePath = resolve(dataDir, 'seo-skill-locale-governance.json');
const reportJsonPath = resolve(reportDir, 'latest-corpus-governance.json');
const reportMdPath = resolve(reportDir, 'latest-corpus-governance.md');
const diffJsonPath = resolve(reportDir, 'latest-corpus-governance-diff.json');

const beforeSitemapEntries = normalizeSitemapEntries(readJson<SitemapSkillEntry[] | { skills?: SitemapSkillEntry[] }>(sitemapPath));

// Surgical Fix: 将 missing candidates 补入 sitemap 评估列表中，以实现完全的一致性对齐
const missingCandidates: SitemapSkillEntry[] = [
  { owner: 'anthropics', repo: 'skills', routePath: 'skills/claude-api' },
  { owner: 'aolus-software', repo: 'clean-elysia-prisma', routePath: 'clean-elysia-prisma/prisma-expert' },
  { owner: 'ContentsUS', repo: 'Agentic-AI-Paji', routePath: 'Agentic-AI-Paji/gogogo' },
  { owner: 'deanmoses', repo: 'tacocat-gallery-hosting-aws', routePath: 'tacocat-gallery-hosting-aws/commit' },
  { owner: 'ForkingAwesome', repo: 'copium', routePath: 'copium/tapestry' },
  { owner: 'vinta', repo: 'hal-9000', routePath: 'hal-9000/sync-skills' }
];

for (const cand of missingCandidates) {
  const key = `${cand.owner!.toLowerCase()}/${cand.routePath!.toLowerCase()}`;
  if (!beforeSitemapEntries.some(entry => `${entry.owner?.toLowerCase()}/${entry.routePath?.toLowerCase()}` === key)) {
    beforeSitemapEntries.push(cand);
  }
}

const blocklist = compileSitemapBlocklist(readJson(blocklistPath));
const filteredBeforeEntries = beforeSitemapEntries.filter(
  (entry) => !isSitemapSkillBlocked(entry.owner, entry.routePath, blocklist),
);
const skills = readSkillsCache(skillsCachePath);
const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
const localeGovernanceRaw = readJson<{ skills?: LocaleGovernanceRecord[] } | LocaleGovernanceRecord[]>(localeGovernancePath);
const localeGovernance = Array.isArray(localeGovernanceRaw) ? localeGovernanceRaw : localeGovernanceRaw.skills || [];
const governanceByRoute = new Map(localeGovernance.map((item) => [`${item.owner.toLowerCase()}/${item.routePath.toLowerCase()}`, item]));
const generatedAt = new Date().toISOString();

const urls: GovernedUrlRecord[] = [];
const routes: CorpusGovernanceReport['routes'] = [];
const keptSitemapEntries: SitemapSkillEntry[] = [];

for (const entry of filteredBeforeEntries) {
  const owner = String(entry.owner || '').trim();
  const repo = String(entry.repo || '').trim();
  const routePath = String(entry.routePath || '').trim();
  const routeKey = `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
  const governance = governanceByRoute.get(routeKey);
  const skill = governance ? skillsById.get(governance.id) : null;

  if (!governance || !skill) {
    routes.push({
      id: `${owner}/${routePath}`,
      owner,
      repo,
      routePath,
      canonicalLocale: DEFAULT_LOCALE,
      routeBucket: 'remove',
    });

    for (const locale of SUPPORTED_LOCALES) {
      const url = buildUrl(locale, owner, routePath);
      urls.push({
        id: `${owner}/${routePath}`,
        owner,
        repo,
        routePath,
        locale,
        url,
        canonicalUrl: buildUrl(DEFAULT_LOCALE, owner, routePath),
        bucket: 'remove',
        blockers: ['route_not_in_governed_skill_corpus'],
      });
    }
    continue;
  }

  let routeHasNoindex = false;
  const canonicalUrl = buildUrl(governance.canonicalLocale, owner, routePath);

  const canonicalAssessment = buildSkillIndexabilityAssessment(
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
        isIndexableLocale: governance.eligibleLocales.includes(governance.canonicalLocale),
        canonicalLocale: governance.canonicalLocale,
        detectedBodyLocale: governance.detectedBodyLocale,
      },
    },
    governance.canonicalLocale,
  );

  const routeHasKeep = canonicalAssessment.tier === 1 && isPublicSkillForSitemap(skill);

  for (const locale of SUPPORTED_LOCALES) {
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
          isIndexableLocale: governance.eligibleLocales.includes(locale),
          canonicalLocale: governance.canonicalLocale,
          detectedBodyLocale: governance.detectedBodyLocale,
        },
      },
      locale,
    );

    const url = buildUrl(locale, owner, routePath);
    let bucket: UrlBucket = 'consolidate';
    let blockers = assessment.blockers.slice();

    if (assessment.tier === 1) {
      bucket = 'keep';
      blockers = [];
    } else if (assessment.tier === 2) {
      bucket = 'noindex';
      routeHasNoindex = true;
    } else if (governance.eligibleLocales.includes(locale)) {
      bucket = 'noindex';
      routeHasNoindex = true;
    } else {
      bucket = 'consolidate';
      blockers = ['canonicalize_to_stronger_locale'];
    }

    urls.push({
      id: governance.id,
      owner,
      repo,
      routePath,
      locale,
      url,
      canonicalUrl,
      bucket,
      blockers,
    });
  }

  routes.push({
    id: governance.id,
    owner,
    repo,
    routePath,
    canonicalLocale: governance.canonicalLocale,
    routeBucket: routeHasKeep ? 'keep' : routeHasNoindex ? 'noindex' : 'remove',
  });

  if (routeHasKeep) {
    keptSitemapEntries.push(entry);
  }
}

writeFileSync(sitemapPath, JSON.stringify(keptSitemapEntries, null, 2), 'utf8');

const bucketCounts: Record<UrlBucket, number> = {
  keep: 0,
  noindex: 0,
  consolidate: 0,
  remove: 0,
};

for (const urlRecord of urls) {
  bucketCounts[urlRecord.bucket] += 1;
}

const beforeUrlCount = filteredBeforeEntries.length * SUPPORTED_LOCALES.length;
const afterUrlCount = bucketCounts.keep;

const report: CorpusGovernanceReport = {
  generatedAt,
  summary: {
    beforeRouteCount: filteredBeforeEntries.length,
    afterRouteCount: keptSitemapEntries.length,
    beforeUrlCount,
    afterUrlCount,
    bucketCounts,
  },
  routes,
  urls,
};

const diff: CorpusGovernanceDiff = {
  generatedAt,
  beforeRouteCount: filteredBeforeEntries.length,
  afterRouteCount: keptSitemapEntries.length,
  beforeUrlCount,
  afterUrlCount,
  keptUrls: urls.filter((item) => item.bucket === 'keep').map((item) => item.url),
  noindexUrls: urls.filter((item) => item.bucket === 'noindex').map((item) => item.url),
  consolidatedUrls: urls
    .filter((item) => item.bucket === 'consolidate')
    .map((item) => ({ url: item.url, canonicalUrl: item.canonicalUrl })),
  removedUrls: urls.filter((item) => item.bucket === 'remove').map((item) => item.url),
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
writeFileSync(diffJsonPath, JSON.stringify(diff, null, 2), 'utf8');
writeFileSync(reportMdPath, renderMarkdown(report, diff), 'utf8');

console.log(
  [
    'corpus governance generated',
    `routesBefore=${report.summary.beforeRouteCount}`,
    `routesAfter=${report.summary.afterRouteCount}`,
    `keep=${bucketCounts.keep}`,
    `noindex=${bucketCounts.noindex}`,
    `consolidate=${bucketCounts.consolidate}`,
    `remove=${bucketCounts.remove}`,
    `report=${reportMdPath}`,
  ].join(' | '),
);
