#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildLocalizedSkillPath, isValidPublicSkillRouteSegment } from '../src/lib/skill-route-paths';

type RemediationAction = {
  url?: string;
  cluster?: string;
  action?: 'redirect_301' | 'gone_410' | 'manual_review' | 'observe';
  reason?: string;
};

type RemediationPlan = {
  generatedAt?: string;
  issueName?: string;
  actions?: RemediationAction[];
};

type IndexabilitySkill = {
  owner?: string;
  repo?: string;
  routePath?: string;
  canonicalLocale?: string;
  canonicalUrl?: string;
  isIndexable?: boolean;
  mode?: string;
  blockers?: string[];
  qualityScore?: number;
};

type IndexabilityReport = {
  generatedAt?: string;
  skills?: IndexabilitySkill[];
};

type LocaleGovernanceSkill = {
  owner?: string;
  repo?: string;
  routePath?: string;
  canonicalLocale?: string;
  eligibleLocales?: string[];
  publishedLocales?: string[];
  metadataEligibleLocales?: string[];
  suppressedMetadataLocales?: string[];
  updatedAt?: string;
};

type LocaleGovernanceReport = {
  generatedAt?: string;
  skills?: LocaleGovernanceSkill[];
};

type ExpandedGithubSkill = {
  owner?: string;
  repo?: string;
  filePath?: string;
  updatedAt?: string;
};

type ParsedSkillUrl = {
  url: string;
  locale: string;
  owner: string;
  repo: string;
  routePath: string;
  routeSegments: number;
};

type MissingAuditClassification =
  | 'restore_published_locale'
  | 'redirect_to_canonical_locale'
  | 'restore_exact_raw_skill'
  | 'repo_root_to_single_raw_skill'
  | 'manual_review_target_noindex'
  | 'manual_review_multi_raw_skills'
  | 'manual_review_route_mismatch'
  | 'manual_review_raw_repo_without_public_slug'
  | 'keep410_target_noindex_until_promotion'
  | 'keep410_multi_raw_repo_root'
  | 'keep410_route_mismatch'
  | 'keep410_raw_repo_without_public_slug'
  | 'keep410_target_not_public_corpus'
  | 'keep410_absent_from_all_corpora';

type MissingAuditDecision = 'restore' | 'redirect' | 'keep410' | 'manual_review';
type GovernedRouteBucket = 'keep' | 'noindex' | 'remove';
export type MissingAuditManualWorkstream =
  | 'promote_noindex_target'
  | 'resolve_multi_skill_repo_root'
  | 'resolve_route_mismatch'
  | 'confirm_repo_structure';

type CandidateRouteSignal = {
  routePath: string;
  routeBucket: GovernedRouteBucket | null;
  canonicalLocale: string | null;
  canonicalUrl: string | null;
  eligibleLocales: string[];
  publishedLocales: string[];
  indexabilityMode: string | null;
  isIndexable: boolean | null;
  qualityScore: number | null;
  blockers: string[];
};

type MissingAuditRow = {
  url: string;
  locale: string;
  owner: string;
  repo: string;
  routePath: string;
  classification: MissingAuditClassification;
  decision: MissingAuditDecision;
  recommendedAction: string;
  canonicalLocale: string | null;
  canonicalUrl: string | null;
  candidateRoutePaths: string[];
  expandedRepoSkillCount: number;
  publicRouteBucket: GovernedRouteBucket | null;
  governanceEligibleLocales: string[];
  governancePublishedLocales: string[];
  indexabilityMode: string | null;
  indexabilityBlockers: string[];
  qualityScore: number | null;
  candidateSignals: CandidateRouteSignal[];
  redirectCoveredByMiddleware: boolean;
  manualWorkstream: MissingAuditManualWorkstream | null;
  manualNextStep: string | null;
  evidence: string[];
};

type MissingClusterAuditReport = {
  generatedAt: string;
  sourceReport: string;
  sourceGeneratedAt: string | null;
  totalRows: number;
  summary: {
    restore: number;
    redirect: number;
    redirectCoveredByMiddleware: number;
    keep410: number;
    manualReview: number;
  };
  classifications: Array<{
    classification: MissingAuditClassification;
    decision: MissingAuditDecision;
    count: number;
  }>;
  manualReviewBreakdown: Array<{
    workstream: MissingAuditManualWorkstream;
    count: number;
    summary: string;
  }>;
  rows: MissingAuditRow[];
};

type RepoRawSignal = {
  owner: string;
  repo: string;
  routePaths: Set<string>;
  updatedAt?: string;
};

type CorpusGovernanceRoute = {
  owner?: string;
  routePath?: string;
  routeBucket?: GovernedRouteBucket;
};

type CorpusGovernanceReport = {
  generatedAt?: string;
  routes?: CorpusGovernanceRoute[];
};

const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const REMEDIATION_PLAN_PATH = resolve(REPORT_DIR, 'latest-404-remediation-plan.json');
const INDEXABILITY_PATH = resolve(REPORT_DIR, 'latest-skill-indexability.json');
const LOCALE_GOVERNANCE_PATH = resolve(REPORT_DIR, 'latest-skill-locale-governance.json');
const CORPUS_GOVERNANCE_PATH = resolve(REPORT_DIR, 'latest-corpus-governance.json');
const EXPANDED_SKILLS_PATH = resolve(process.cwd(), 'data/expanded-github-skills.json');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-404-missing-cluster-audit.json');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-404-missing-cluster-audit.md');

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function parseSkillUrl(rawUrl: string): ParsedSkillUrl | null {
  try {
    const parsed = new URL(rawUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 4 || parts[1] !== 'skills') return null;
    const locale = parts[0]?.trim().toLowerCase();
    const owner = decodeURIComponent(parts[2] || '').trim();
    const routeSegments = parts.slice(3).map((segment) => decodeURIComponent(segment).trim()).filter(Boolean);
    if (!locale || !owner || routeSegments.length === 0) return null;

    return {
      url: rawUrl,
      locale,
      owner,
      repo: routeSegments[0],
      routePath: routeSegments.join('/'),
      routeSegments: routeSegments.length,
    };
  } catch {
    return null;
  }
}

function toKey(owner: string, routePath: string): string {
  return `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
}

function toRepoKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean);
}

function extractRawSkillSlug(filePath: string): string | null {
  const normalized = String(filePath || '').trim().replace(/\\/g, '/');
  if (!normalized) return null;

  const withoutFile = normalized.replace(/\/?SKILL\.md$/i, '').replace(/\/?README\.md$/i, '');
  if (!withoutFile) return null;

  const parts = withoutFile.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const leaf = parts[parts.length - 1];
  if (!leaf || !isValidPublicSkillRouteSegment(leaf)) return null;
  return leaf;
}

function buildExpandedRepoSignals(items: ExpandedGithubSkill[]): Map<string, RepoRawSignal> {
  const map = new Map<string, RepoRawSignal>();

  for (const item of items) {
    const owner = typeof item.owner === 'string' ? item.owner.trim() : '';
    const repo = typeof item.repo === 'string' ? item.repo.trim() : '';
    if (!owner || !repo) continue;

    const repoKey = toRepoKey(owner, repo);
    const signal = map.get(repoKey) || { owner, repo, routePaths: new Set<string>() };

    const slug = extractRawSkillSlug(typeof item.filePath === 'string' ? item.filePath : '');
    if (slug) {
      signal.routePaths.add(`${repo}/${slug}`);
    }

    if (!signal.updatedAt && typeof item.updatedAt === 'string' && item.updatedAt.trim()) {
      signal.updatedAt = item.updatedAt.trim();
    }

    map.set(repoKey, signal);
  }

  return map;
}

function buildIndexabilityMap(skills: IndexabilitySkill[]): Map<string, IndexabilitySkill> {
  const map = new Map<string, IndexabilitySkill>();
  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const routePath = typeof skill.routePath === 'string' ? skill.routePath.trim() : '';
    if (!owner || !routePath) continue;
    map.set(toKey(owner, routePath), skill);
  }
  return map;
}

function buildLocaleGovernanceMap(skills: LocaleGovernanceSkill[]): Map<string, LocaleGovernanceSkill> {
  const map = new Map<string, LocaleGovernanceSkill>();
  for (const skill of skills) {
    const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
    const routePath = typeof skill.routePath === 'string' ? skill.routePath.trim() : '';
    if (!owner || !routePath) continue;
    map.set(toKey(owner, routePath), skill);
  }
  return map;
}

function buildGovernedRouteMap(routes: CorpusGovernanceRoute[]): Map<string, GovernedRouteBucket> {
  const map = new Map<string, GovernedRouteBucket>();
  for (const route of routes) {
    const owner = typeof route.owner === 'string' ? route.owner.trim() : '';
    const routePath = typeof route.routePath === 'string' ? route.routePath.trim() : '';
    const routeBucket =
      route.routeBucket === 'keep' || route.routeBucket === 'noindex' || route.routeBucket === 'remove'
        ? route.routeBucket
        : null;
    if (!owner || !routePath || !routeBucket) continue;
    map.set(toKey(owner, routePath), routeBucket);
  }
  return map;
}

function buildCandidateSignals(input: {
  owner: string;
  candidateRoutePaths: string[];
  indexabilityMap: Map<string, IndexabilitySkill>;
  localeGovernanceMap: Map<string, LocaleGovernanceSkill>;
  governedRouteMap: Map<string, GovernedRouteBucket>;
}): CandidateRouteSignal[] {
  return input.candidateRoutePaths.map((routePath) => {
    const key = toKey(input.owner, routePath);
    const indexability = input.indexabilityMap.get(key) || null;
    const governance = input.localeGovernanceMap.get(key) || null;
    return {
      routePath,
      routeBucket: input.governedRouteMap.get(key) || null,
      canonicalLocale:
        (typeof governance?.canonicalLocale === 'string' && governance.canonicalLocale.trim().toLowerCase()) ||
        (typeof indexability?.canonicalLocale === 'string' && indexability.canonicalLocale.trim().toLowerCase()) ||
        null,
      canonicalUrl: typeof indexability?.canonicalUrl === 'string' && indexability.canonicalUrl.trim() ? indexability.canonicalUrl.trim() : null,
      eligibleLocales: normalizeLocaleList(governance?.eligibleLocales),
      publishedLocales: normalizeLocaleList(governance?.publishedLocales),
      indexabilityMode: typeof indexability?.mode === 'string' && indexability.mode.trim() ? indexability.mode.trim() : null,
      isIndexable: typeof indexability?.isIndexable === 'boolean' ? indexability.isIndexable : null,
      qualityScore: typeof indexability?.qualityScore === 'number' ? indexability.qualityScore : null,
      blockers: Array.isArray(indexability?.blockers)
        ? indexability!.blockers!.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
    };
  });
}

export function describeManualReviewWorkstream(workstream: MissingAuditManualWorkstream): string {
  switch (workstream) {
    case 'promote_noindex_target':
      return '单候选技能存在，但仍是 `noindex/reference_only`，要先过质量门槛，才谈 301 或恢复。';
    case 'resolve_multi_skill_repo_root':
      return 'repo root 对应多个 raw 技能，但没有可公开承接的 `keep` 目标，继续 410 直到明确 hub 或提升具体技能。';
    case 'resolve_route_mismatch':
      return '当前命中的 routePath 与 raw slug 不匹配，继续 410，除非明确发布替代路由或做精确 301。';
    case 'confirm_repo_structure':
      return 'raw repo 有信号，但还推不出稳定公开 slug，需要确认仓库结构或重新发布。';
  }
}

export function buildManualReviewDetails(input: {
  classification: MissingAuditClassification;
  candidateSignals: CandidateRouteSignal[];
}): { manualWorkstream: MissingAuditManualWorkstream | null; manualNextStep: string | null } {
  const candidateSummary = input.candidateSignals
    .map((signal) => {
      const pieces = [
        signal.routePath,
        signal.routeBucket ? `bucket=${signal.routeBucket}` : null,
        signal.indexabilityMode ? `mode=${signal.indexabilityMode}` : null,
        signal.qualityScore !== null ? `quality=${signal.qualityScore}` : null,
        signal.blockers.length > 0 ? `blockers=${signal.blockers.join('+')}` : null,
      ].filter(Boolean);
      return pieces.join(', ');
    })
    .join(' | ');

  switch (input.classification) {
    case 'manual_review_target_noindex': {
      const bestCandidate = [...input.candidateSignals].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))[0] || null;
      if (!bestCandidate) {
        return {
          manualWorkstream: 'promote_noindex_target',
          manualNextStep: '存在单目标 noindex 案例，但缺少候选技能详情；先补齐目标页治理与质量数据。',
        };
      }
      return {
        manualWorkstream: 'promote_noindex_target',
        manualNextStep: `候选 ${bestCandidate.routePath} 当前为 ${bestCandidate.routeBucket || 'unknown'} / ${
          bestCandidate.indexabilityMode || 'unknown'
        }，质量分 ${bestCandidate.qualityScore ?? 'n/a'}；在解除 ${bestCandidate.blockers.join(', ') || 'noindex'} 前继续保持 410。`,
      };
    }
    case 'manual_review_multi_raw_skills':
      return {
        manualWorkstream: 'resolve_multi_skill_repo_root',
        manualNextStep:
          input.candidateSignals.length > 0
            ? `repo root 命中多个 raw 候选，但没有可直接公开承接的 keep 目标；当前候选：${candidateSummary}。继续 410，除非后续做 repo hub 或把某个候选提升到 keep。`
            : 'repo root 命中多个 raw 候选，但当前缺少可公开承接的治理信号；继续 410。',
      };
    case 'manual_review_route_mismatch':
      return {
        manualWorkstream: 'resolve_route_mismatch',
        manualNextStep:
          input.candidateSignals.length > 0
            ? `当前 URL slug 与 raw 候选不匹配；候选为 ${candidateSummary}。继续 410，除非后续发布精确替代路由或做明确 301。`
            : '当前 URL slug 与 raw 候选不匹配，且缺少稳定替代目标；继续 410。',
      };
    case 'manual_review_raw_repo_without_public_slug':
      return {
        manualWorkstream: 'confirm_repo_structure',
        manualNextStep: 'raw repo 仍有信号，但无法稳定推出公开 slug；确认仓库结构后再决定恢复、301 或继续 410。',
      };
    default:
      return { manualWorkstream: null, manualNextStep: null };
  }
}

export function summarizeManualReviewWorkstreams(rows: MissingAuditRow[]): Array<{
  workstream: MissingAuditManualWorkstream;
  count: number;
  summary: string;
}> {
  const counts = new Map<MissingAuditManualWorkstream, number>();
  for (const row of rows) {
    if (!row.manualWorkstream) continue;
    counts.set(row.manualWorkstream, (counts.get(row.manualWorkstream) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([workstream, count]) => ({
      workstream,
      count,
      summary: describeManualReviewWorkstream(workstream),
    }))
    .sort((a, b) => b.count - a.count || a.workstream.localeCompare(b.workstream));
}

function classifyMissingRow(input: {
  parsed: ParsedSkillUrl;
  rawSignal: RepoRawSignal | null;
  governance: LocaleGovernanceSkill | null;
  indexability: IndexabilitySkill | null;
  indexabilityMap: Map<string, IndexabilitySkill>;
  localeGovernanceMap: Map<string, LocaleGovernanceSkill>;
  governedRouteMap: Map<string, GovernedRouteBucket>;
}): MissingAuditRow {
  const { parsed, rawSignal, governance, indexability, indexabilityMap, localeGovernanceMap, governedRouteMap } = input;
  const canonicalLocale =
    (typeof governance?.canonicalLocale === 'string' && governance.canonicalLocale.trim().toLowerCase()) ||
    (typeof indexability?.canonicalLocale === 'string' && indexability.canonicalLocale.trim().toLowerCase()) ||
    null;
  const canonicalUrl =
    (typeof indexability?.canonicalUrl === 'string' && indexability.canonicalUrl.trim()) ||
    (canonicalLocale ? `https://killer-skills.com${buildLocalizedSkillPath(canonicalLocale, parsed.owner, parsed.routePath)}` : null);
  const eligibleLocales = normalizeLocaleList(governance?.eligibleLocales);
  const publishedLocales = normalizeLocaleList(governance?.publishedLocales);
  const candidateRoutePaths = rawSignal ? Array.from(rawSignal.routePaths).sort((a, b) => a.localeCompare(b)) : [];
  const candidateSignals = buildCandidateSignals({
    owner: parsed.owner,
    candidateRoutePaths,
    indexabilityMap,
    localeGovernanceMap,
    governedRouteMap,
  });
  const publicRouteBucket = governedRouteMap.get(toKey(parsed.owner, parsed.routePath)) || null;
  const candidatePublicRouteBucket =
    candidateRoutePaths.length === 1 ? governedRouteMap.get(toKey(parsed.owner, candidateRoutePaths[0])) || null : null;
  const qualityScore = typeof indexability?.qualityScore === 'number' ? indexability.qualityScore : null;
  const blockers = Array.isArray(indexability?.blockers)
    ? indexability!.blockers!.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const evidence: string[] = [];

  if (governance) {
    evidence.push(`governance canonical=${canonicalLocale || 'unknown'}`);
    if (eligibleLocales.length > 0) evidence.push(`eligibleLocales=${eligibleLocales.join(',')}`);
    if (publishedLocales.length > 0) evidence.push(`publishedLocales=${publishedLocales.join(',')}`);
  }
  if (indexability) {
    evidence.push(`indexability mode=${indexability.mode || 'unknown'}`);
    if (typeof indexability.isIndexable === 'boolean') evidence.push(`isIndexable=${indexability.isIndexable ? 'yes' : 'no'}`);
    if (qualityScore !== null) evidence.push(`qualityScore=${qualityScore}`);
    if (blockers.length > 0) evidence.push(`blockers=${blockers.join(',')}`);
  }
  if (rawSignal) {
    evidence.push(`expandedRepoSkills=${candidateRoutePaths.length}`);
  }
  if (publicRouteBucket) {
    evidence.push(`publicRouteBucket=${publicRouteBucket}`);
  }
  if (!publicRouteBucket && candidatePublicRouteBucket) {
    evidence.push(`candidatePublicRouteBucket=${candidatePublicRouteBucket}`);
  }

  if (governance || indexability) {
    const localeEligible = eligibleLocales.includes(parsed.locale) || publishedLocales.includes(parsed.locale);
    const localePublished = publishedLocales.includes(parsed.locale);
    const localeIsCanonical = canonicalLocale === parsed.locale;
    const urlIsCanonical = canonicalUrl === parsed.url;
    if (
      (localeEligible || localePublished || (indexability?.isIndexable && (localeIsCanonical || urlIsCanonical))) &&
      publicRouteBucket === 'keep'
    ) {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'restore_published_locale',
        decision: 'restore',
        recommendedAction: '该路由在治理或索引能力报告中已有明确技能定义，当前 locale 应恢复到 sitemap/cache/SSR 产线。',
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: false,
        manualWorkstream: null,
        manualNextStep: null,
        evidence,
      };
    }

    if (canonicalLocale && canonicalUrl && (!localeIsCanonical || !urlIsCanonical) && publicRouteBucket === 'keep') {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'redirect_to_canonical_locale',
        decision: 'redirect',
        recommendedAction: `当前 locale 不属于可发布集合，建议优先评估是否 301 到 canonical locale：${canonicalLocale}。`,
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: false,
        manualWorkstream: null,
        manualNextStep: null,
        evidence,
      };
    }

    if (publicRouteBucket === 'noindex') {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'keep410_target_noindex_until_promotion',
        decision: 'keep410',
        recommendedAction: '目标技能当前只在 noindex / reference_only 路径中存在；在通过质量门槛并提升为公开可索引页前继续保持 410。',
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: false,
        manualWorkstream: 'promote_noindex_target',
        manualNextStep: buildManualReviewDetails({
          classification: 'manual_review_target_noindex',
          candidateSignals,
        }).manualNextStep,
        evidence,
      };
    }
  }

  if (!rawSignal) {
    return {
      url: parsed.url,
      locale: parsed.locale,
      owner: parsed.owner,
      repo: parsed.repo,
      routePath: parsed.routePath,
      classification: 'keep410_absent_from_all_corpora',
      decision: 'keep410',
      recommendedAction: '在 expanded corpus、locale governance、indexability 中都找不到支撑信号，继续保持 410。',
      canonicalLocale,
      canonicalUrl,
      candidateRoutePaths,
      expandedRepoSkillCount: 0,
      publicRouteBucket,
      governanceEligibleLocales: eligibleLocales,
      governancePublishedLocales: publishedLocales,
      indexabilityMode: indexability?.mode || null,
      indexabilityBlockers: blockers,
      qualityScore,
      candidateSignals,
      redirectCoveredByMiddleware: false,
      manualWorkstream: null,
      manualNextStep: null,
      evidence,
    };
  }

  const exactRawMatch = candidateRoutePaths.includes(parsed.routePath);
  if (exactRawMatch) {
    if (publicRouteBucket === 'keep') {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'restore_exact_raw_skill',
        decision: 'restore',
        recommendedAction: 'raw corpus 与公开治理语料都存在该技能，当前 URL 应恢复到 sitemap/cache/SSR 产线。',
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: false,
        manualWorkstream: null,
        manualNextStep: null,
        evidence,
      };
    }

    if (publicRouteBucket === 'noindex') {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'keep410_target_noindex_until_promotion',
        decision: 'keep410',
        recommendedAction: 'raw corpus 中存在该技能，但公开治理结果仍是 noindex；在解除质量门槛并提升前继续保持 410。',
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: false,
        manualWorkstream: 'promote_noindex_target',
        manualNextStep: buildManualReviewDetails({
          classification: 'manual_review_target_noindex',
          candidateSignals,
        }).manualNextStep,
        evidence,
      };
    }

    return {
      url: parsed.url,
      locale: parsed.locale,
      owner: parsed.owner,
      repo: parsed.repo,
      routePath: parsed.routePath,
      classification: 'keep410_target_not_public_corpus',
      decision: 'keep410',
      recommendedAction: 'raw corpus 中虽有完全匹配的 slug，但目标技能尚未进入公开 corpus；在发布链恢复前继续保持 410。',
      canonicalLocale,
      canonicalUrl,
      candidateRoutePaths,
      expandedRepoSkillCount: candidateRoutePaths.length,
      publicRouteBucket,
      governanceEligibleLocales: eligibleLocales,
      governancePublishedLocales: publishedLocales,
      indexabilityMode: indexability?.mode || null,
      indexabilityBlockers: blockers,
      qualityScore,
      candidateSignals,
      redirectCoveredByMiddleware: false,
      manualWorkstream: null,
      manualNextStep: null,
      evidence,
    };
  }

  if (parsed.routeSegments === 1 && candidateRoutePaths.length === 1) {
    if (candidatePublicRouteBucket === 'keep') {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'repo_root_to_single_raw_skill',
        decision: 'redirect',
        recommendedAction: `该 repo 在公开 corpus 中只有一个可承接技能；现有 middleware 已可将 repo root 跳转到 ${candidateRoutePaths[0]}，优先验证部署与回流。`,
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket: candidatePublicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: true,
        manualWorkstream: null,
        manualNextStep: null,
        evidence,
      };
    }

    if (candidatePublicRouteBucket === 'noindex') {
      return {
        url: parsed.url,
        locale: parsed.locale,
        owner: parsed.owner,
        repo: parsed.repo,
        routePath: parsed.routePath,
        classification: 'keep410_target_noindex_until_promotion',
        decision: 'keep410',
        recommendedAction: `repo root 只对应一个技能，但该目标当前仍是 noindex；在目标页提升为公开可索引页前继续保持 410。`,
        canonicalLocale,
        canonicalUrl,
        candidateRoutePaths,
        expandedRepoSkillCount: candidateRoutePaths.length,
        publicRouteBucket: candidatePublicRouteBucket,
        governanceEligibleLocales: eligibleLocales,
        governancePublishedLocales: publishedLocales,
        indexabilityMode: indexability?.mode || null,
        indexabilityBlockers: blockers,
        qualityScore,
        candidateSignals,
        redirectCoveredByMiddleware: false,
        manualWorkstream: 'promote_noindex_target',
        manualNextStep: buildManualReviewDetails({
          classification: 'manual_review_target_noindex',
          candidateSignals,
        }).manualNextStep,
        evidence,
      };
    }

    return {
      url: parsed.url,
      locale: parsed.locale,
      owner: parsed.owner,
      repo: parsed.repo,
      routePath: parsed.routePath,
      classification: 'keep410_target_not_public_corpus',
      decision: 'keep410',
      recommendedAction: 'repo root 虽可映射到单个 raw skill，但该目标尚未进入公开 corpus；在目标页可公开承接前继续保持 410。',
      canonicalLocale,
      canonicalUrl,
      candidateRoutePaths,
      expandedRepoSkillCount: candidateRoutePaths.length,
      publicRouteBucket: candidatePublicRouteBucket,
      governanceEligibleLocales: eligibleLocales,
      governancePublishedLocales: publishedLocales,
      indexabilityMode: indexability?.mode || null,
      indexabilityBlockers: blockers,
      qualityScore,
      candidateSignals,
      redirectCoveredByMiddleware: false,
      manualWorkstream: null,
      manualNextStep: null,
      evidence,
    };
  }

  if (parsed.routeSegments === 1 && candidateRoutePaths.length > 1) {
    const manual = buildManualReviewDetails({
      classification: 'manual_review_multi_raw_skills',
      candidateSignals,
    });
    return {
      url: parsed.url,
      locale: parsed.locale,
      owner: parsed.owner,
      repo: parsed.repo,
      routePath: parsed.routePath,
      classification: 'keep410_multi_raw_repo_root',
      decision: 'keep410',
      recommendedAction: 'repo root 在 raw corpus 中对应多个 skill，当前没有唯一公开承接页；在明确 repo hub 或唯一 keep 目标前继续保持 410。',
      canonicalLocale,
      canonicalUrl,
      candidateRoutePaths,
      expandedRepoSkillCount: candidateRoutePaths.length,
      publicRouteBucket,
      governanceEligibleLocales: eligibleLocales,
      governancePublishedLocales: publishedLocales,
      indexabilityMode: indexability?.mode || null,
      indexabilityBlockers: blockers,
      qualityScore,
      candidateSignals,
      redirectCoveredByMiddleware: false,
      manualWorkstream: manual.manualWorkstream,
      manualNextStep: manual.manualNextStep,
      evidence,
    };
  }

  if (candidateRoutePaths.length === 0) {
    const manual = buildManualReviewDetails({
      classification: 'manual_review_raw_repo_without_public_slug',
      candidateSignals,
    });
    return {
      url: parsed.url,
      locale: parsed.locale,
      owner: parsed.owner,
      repo: parsed.repo,
      routePath: parsed.routePath,
      classification: 'keep410_raw_repo_without_public_slug',
      decision: 'keep410',
      recommendedAction: 'repo 在 raw corpus 中存在，但无法从 filePath 安全推出公开 skill slug；在确认仓库结构前继续保持 410。',
      canonicalLocale,
      canonicalUrl,
      candidateRoutePaths,
      expandedRepoSkillCount: candidateRoutePaths.length,
      publicRouteBucket,
      governanceEligibleLocales: eligibleLocales,
      governancePublishedLocales: publishedLocales,
      indexabilityMode: indexability?.mode || null,
      indexabilityBlockers: blockers,
      qualityScore,
      candidateSignals,
      redirectCoveredByMiddleware: false,
      manualWorkstream: manual.manualWorkstream,
      manualNextStep: manual.manualNextStep,
      evidence,
    };
  }

  const manual = buildManualReviewDetails({
    classification: 'manual_review_route_mismatch',
    candidateSignals,
  });
  return {
    url: parsed.url,
    locale: parsed.locale,
    owner: parsed.owner,
    repo: parsed.repo,
    routePath: parsed.routePath,
    classification: 'keep410_route_mismatch',
    decision: 'keep410',
    recommendedAction: 'repo 在 raw corpus 中存在，但当前 routePath 与可推导 skill slug 不匹配；在发布精确替代路由前继续保持 410。',
    canonicalLocale,
    canonicalUrl,
    candidateRoutePaths,
    expandedRepoSkillCount: candidateRoutePaths.length,
    publicRouteBucket,
    governanceEligibleLocales: eligibleLocales,
    governancePublishedLocales: publishedLocales,
    indexabilityMode: indexability?.mode || null,
    indexabilityBlockers: blockers,
    qualityScore,
    candidateSignals,
    redirectCoveredByMiddleware: false,
    manualWorkstream: manual.manualWorkstream,
    manualNextStep: manual.manualNextStep,
    evidence,
  };
}

function renderMarkdown(report: MissingClusterAuditReport): string {
  const lines: string[] = [];
  lines.push('# 404 Missing Cluster Audit');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source report: ${report.sourceReport}`);
  lines.push(`- Source generated at: ${report.sourceGeneratedAt || 'unknown'}`);
  lines.push(`- Total rows: ${report.totalRows}`);
  lines.push(`- Restore candidates: ${report.summary.restore}`);
  lines.push(
    report.summary.redirectCoveredByMiddleware > 0
      ? `- Redirect candidates: ${report.summary.redirect} (${report.summary.redirectCoveredByMiddleware} already covered by middleware)`
      : `- Redirect candidates: ${report.summary.redirect}`,
  );
  lines.push(`- Keep 410 candidates: ${report.summary.keep410}`);
  lines.push(`- Manual review: ${report.summary.manualReview}`);
  lines.push('');
  lines.push('## Classification Summary');
  lines.push('');
  for (const item of report.classifications) {
    lines.push(`- ${item.classification}: ${item.count} (${item.decision})`);
  }
  lines.push('');

  lines.push('## Manual Review Workstreams');
  lines.push('');
  if (report.manualReviewBreakdown.length === 0) {
    lines.push('- none');
  } else {
    for (const item of report.manualReviewBreakdown) {
      lines.push(`- ${item.workstream}: ${item.count} | ${item.summary}`);
    }
  }
  lines.push('');

  const sections: Array<{ title: string; decision: MissingAuditDecision }> = [
    { title: 'Restore', decision: 'restore' },
    { title: 'Redirect', decision: 'redirect' },
    { title: 'Keep 410', decision: 'keep410' },
    { title: 'Manual Review', decision: 'manual_review' },
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    const rows = report.rows.filter((row) => row.decision === section.decision);
    if (rows.length === 0) {
      lines.push('- none');
      lines.push('');
      continue;
    }
    for (const row of rows.slice(0, 120)) {
      const candidateSignalSummary =
        row.candidateSignals.length > 0
          ? ` | candidateSignals=${row.candidateSignals
              .map((signal) =>
                [
                  signal.routePath,
                  signal.routeBucket ? `bucket=${signal.routeBucket}` : null,
                  signal.indexabilityMode ? `mode=${signal.indexabilityMode}` : null,
                  signal.qualityScore !== null ? `quality=${signal.qualityScore}` : null,
                  signal.blockers.length > 0 ? `blockers=${signal.blockers.join('+')}` : null,
                ]
                  .filter(Boolean)
                  .join(',')
              )
              .join('; ')}`
          : '';
      const manualSummary = `${row.manualWorkstream ? ` | followup=${row.manualWorkstream}` : ''}${row.manualNextStep ? ` | next=${row.manualNextStep}` : ''}`;
      const middlewareSummary = row.redirectCoveredByMiddleware ? ' | middleware=covered' : '';
      lines.push(
        `- ${row.url} | classification=${row.classification} | action=${row.recommendedAction}${middlewareSummary}${manualSummary}${row.canonicalUrl ? ` | canonical=${row.canonicalUrl}` : ''}${row.candidateRoutePaths.length > 0 ? ` | raw=${row.candidateRoutePaths.join('; ')}` : ''}${candidateSignalSummary}`,
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export function main() {
  if (!existsSync(REMEDIATION_PLAN_PATH)) {
    throw new Error(`Missing remediation plan: ${REMEDIATION_PLAN_PATH}`);
  }
  if (!existsSync(INDEXABILITY_PATH)) {
    throw new Error(`Missing indexability report: ${INDEXABILITY_PATH}`);
  }
  if (!existsSync(LOCALE_GOVERNANCE_PATH)) {
    throw new Error(`Missing locale governance report: ${LOCALE_GOVERNANCE_PATH}`);
  }
  if (!existsSync(EXPANDED_SKILLS_PATH)) {
    throw new Error(`Missing expanded skills data: ${EXPANDED_SKILLS_PATH}`);
  }
  if (!existsSync(CORPUS_GOVERNANCE_PATH)) {
    throw new Error(`Missing corpus governance report: ${CORPUS_GOVERNANCE_PATH}`);
  }

  const plan = readJsonFile<RemediationPlan>(REMEDIATION_PLAN_PATH);
  const indexability = readJsonFile<IndexabilityReport>(INDEXABILITY_PATH);
  const localeGovernance = readJsonFile<LocaleGovernanceReport>(LOCALE_GOVERNANCE_PATH);
  const corpusGovernance = readJsonFile<CorpusGovernanceReport>(CORPUS_GOVERNANCE_PATH);
  const expandedSkills = readJsonFile<ExpandedGithubSkill[]>(EXPANDED_SKILLS_PATH);

  const indexabilityMap = buildIndexabilityMap(indexability.skills || []);
  const localeGovernanceMap = buildLocaleGovernanceMap(localeGovernance.skills || []);
  const governedRouteMap = buildGovernedRouteMap(corpusGovernance.routes || []);
  const rawRepoSignals = buildExpandedRepoSignals(expandedSkills);

  const rows: MissingAuditRow[] = [];
  for (const action of plan.actions || []) {
    if (action.cluster !== 'other' || action.reason !== 'missing_from_sitemap_and_cache') continue;
    const url = typeof action.url === 'string' ? action.url : '';
    if (!url) continue;
    const parsed = parseSkillUrl(url);
    if (!parsed) continue;

    const key = toKey(parsed.owner, parsed.routePath);
    const repoKey = toRepoKey(parsed.owner, parsed.repo);
    rows.push(
      classifyMissingRow({
        parsed,
        rawSignal: rawRepoSignals.get(repoKey) || null,
        governance: localeGovernanceMap.get(key) || null,
        indexability: indexabilityMap.get(key) || null,
        indexabilityMap,
        localeGovernanceMap,
        governedRouteMap,
      }),
    );
  }

  const report: MissingClusterAuditReport = {
    generatedAt: new Date().toISOString(),
    sourceReport: 'reports/seo/latest-404-remediation-plan.json',
    sourceGeneratedAt: plan.generatedAt || null,
    totalRows: rows.length,
    summary: {
      restore: rows.filter((row) => row.decision === 'restore').length,
      redirect: rows.filter((row) => row.decision === 'redirect').length,
      redirectCoveredByMiddleware: rows.filter((row) => row.decision === 'redirect' && row.redirectCoveredByMiddleware).length,
      keep410: rows.filter((row) => row.decision === 'keep410').length,
      manualReview: rows.filter((row) => row.decision === 'manual_review').length,
    },
    classifications: Array.from(
      rows.reduce((acc, row) => {
        const key = `${row.classification}__${row.decision}`;
        acc.set(key, {
          classification: row.classification,
          decision: row.decision,
          count: (acc.get(key)?.count || 0) + 1,
        });
        return acc;
      }, new Map<string, { classification: MissingAuditClassification; decision: MissingAuditDecision; count: number }>()),
    )
      .map(([, value]) => value)
      .sort((a, b) => b.count - a.count || a.classification.localeCompare(b.classification)),
    manualReviewBreakdown: summarizeManualReviewWorkstreams(rows.filter((row) => row.decision === 'manual_review')),
    rows,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT, renderMarkdown(report), 'utf8');

  console.log(`Wrote missing-cluster audit JSON to ${JSON_OUTPUT}`);
  console.log(`Wrote missing-cluster audit markdown to ${MD_OUTPUT}`);
  console.log(
    `summary => restore: ${report.summary.restore}, redirect: ${report.summary.redirect} (middleware: ${report.summary.redirectCoveredByMiddleware}), keep410: ${report.summary.keep410}, manual: ${report.summary.manualReview}`,
  );
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
