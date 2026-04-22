#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  discoverCoverageDrilldownSourceDirectories,
  parseCoverageDrilldownCsv,
  readCoverageDrilldownMetadata,
  resolveCoverageDrilldownCsvPaths,
  type CoverageDrilldownCsvPaths,
} from './lib/coverage-drilldown-source';
import { countExtraSkillSegments, hasRepeatedSegment, isSourceFilePathname } from './lib/coverage-url-classification';

export type RemediationActionType = 'redirect_301' | 'gone_410' | 'manual_review' | 'observe';

export type ClusterId =
  | 'query_parameter'
  | 'legacy_html'
  | 'source_file_path'
  | 'deep_skill_path'
  | 'trailing_slash'
  | 'repeated_segment'
  | 'sandbox_path'
  | 'other';

export type RemediationAction = {
  url: string;
  cluster: ClusterId;
  action: RemediationActionType;
  reason: string;
  targetUrl?: string;
  coveredByMiddleware: boolean;
};

export type RemediationPlan = {
  generatedAt: string;
  sourceDirectory: string;
  issueName: string;
  totalSamples: number;
  redirectCount: number;
  goneCount: number;
  manualReviewCount: number;
  observeCount: number;
  actions: RemediationAction[];
};

type OtherAuditRow = {
  url: string;
  action: RemediationActionType;
  reason: string;
  coveredByMiddleware: boolean;
  targetUrl?: string;
};

type OtherAuditReport = {
  generatedAt: string;
  sourceReport: string;
  sourceGeneratedAt: string;
  sourceIssueName: string;
  totalRows: number;
  actionSummary: Array<{
    action: RemediationActionType;
    count: number;
  }>;
  executionSummary: {
    exactRemoval410Count: number;
    redirectValidationCount: number;
    redirectCoveredByMiddlewareCount: number;
    redirectNeedsValidationCount: number;
    observeCount: number;
    manualReviewCount: number;
  };
  reasonBreakdown: Array<{
    reason: string;
    count: number;
    actionBreakdown: Array<{ action: RemediationActionType; count: number }>;
  }>;
  nextActions: string[];
  rows: OtherAuditRow[];
};

type SourceFileAuditRow = {
  url: string;
  action: RemediationActionType;
  reason: string;
  coveredByMiddleware: boolean;
  targetUrl?: string;
};

type SourceFileAuditReport = {
  generatedAt: string;
  sourceReport: string;
  sourceGeneratedAt: string;
  sourceIssueName: string;
  totalRows: number;
  actionSummary: Array<{
    action: RemediationActionType;
    count: number;
  }>;
  executionSummary: {
    exactRemoval410Count: number;
    redirectValidationCount: number;
    redirectCoveredByMiddlewareCount: number;
    redirectNeedsValidationCount: number;
    observeCount: number;
    manualReviewCount: number;
  };
  reasonBreakdown: Array<{
    reason: string;
    count: number;
    actionBreakdown: Array<{ action: RemediationActionType; count: number }>;
  }>;
  nextActions: string[];
  rows: SourceFileAuditRow[];
};

type SitemapSkillRecord = {
  owner?: string;
  routePath?: string;
};

export type SitemapIndex = {
  map: Map<string, { owner: string; routePath: string }>;
  repoCounts: Map<string, number>;
  repoSingleRoute: Map<string, string>;
  blockedExact: Set<string>;
  blockedRepo: Set<string>;
};

export type ParsedSkillUrl = {
  origin: string;
  locale: string;
  owner: string;
  routePath: string;
  repo: string;
  routeSegments: number;
};

export type OtherClassification =
  | 'blocked_by_sitemap'
  | 'missing_in_data'
  | 'repo_directory_candidate'
  | 'repo_single_skill_redirect'
  | 'unknown_subskill'
  | 'in_sitemap'
  | 'non_skill_site_path'
  | 'malformed_coverage_row';

const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-404-remediation-plan.md');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-404-remediation-plan.json');
const OTHER_AUDIT_MD_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-other-audit.md');
const OTHER_AUDIT_JSON_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-other-audit.json');
const OTHER_AUDIT_CSV_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-other-audit.csv');
const SOURCE_FILE_AUDIT_MD_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-source-file-audit.md');
const SOURCE_FILE_AUDIT_JSON_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-source-file-audit.json');
const SOURCE_FILE_AUDIT_CSV_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-source-file-audit.csv');

const CLUSTER_LABELS: Record<ClusterId, string> = {
  query_parameter: 'Query 参数页',
  legacy_html: '旧版 .html 路径',
  source_file_path: '源码文件型 URL',
  deep_skill_path: '深层技能路径陷阱',
  trailing_slash: '尾斜杠重复 URL',
  repeated_segment: '重复片段路径',
  sandbox_path: 'Sandbox 测试页',
  other: '其他模式',
};
const FILE_EXT_REGEX = /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|xml|txt|ini|csv|lock)$/i;
const COLLECTION_CANONICAL_SLUG_OVERRIDES: Record<string, string> = {
  'top-mcp-mcp-servers': 'top-ai-agent-workflow-skills-integrations-utilities',
  'top-mcp-server-mcp-servers': 'top-ai-agent-integration-frameworks-bridges-infra-tooling',
};
const LEGACY_DOC_SLUG_REDIRECTS = new Map<string, string>([['development/create-skill', 'creating-skills']]);

type LegacyNonSkillRedirect = {
  targetUrl: string;
  reason: string;
  coveredByMiddleware: boolean;
};

function parseArgs(argv: string[]): { inputDir?: string } {
  let inputDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) {
      inputDir = resolve(argv[i + 1]);
      i++;
    }
  }
  return { inputDir };
}

function parseIssueName(csvPaths: CoverageDrilldownCsvPaths): string {
  return readCoverageDrilldownMetadata(csvPaths)['问题名称'] || '未知问题';
}

function listAvailableCoverageIssues(): Array<{ directory: string; issueName: string }> {
  return discoverCoverageDrilldownSourceDirectories().flatMap((source) => {
    try {
      return [
        {
          directory: source.directoryPath,
          issueName: parseIssueName(source.csvPaths),
        },
      ];
    } catch {
      return [];
    }
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCollectionSlug(slug: string): string {
  return String(slug || '')
    .trim()
    .replace(/\.json$/i, '');
}

function buildCollectionLegacyRedirectMap(): Map<string, string> {
  const map = new Map<string, string>();
  const collectionsDir = resolve(process.cwd(), 'src/content/collections');
  if (!existsSync(collectionsDir)) return map;

  for (const entry of readdirSync(collectionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;

    try {
      const raw = JSON.parse(readFileSync(resolve(collectionsDir, entry.name), 'utf8')) as {
        canonicalSlug?: unknown;
        legacySlugs?: unknown;
      };
      const fileSlug = normalizeCollectionSlug(entry.name);
      const explicitCanonicalSlug =
        typeof raw.canonicalSlug === 'string' && raw.canonicalSlug.trim().length > 0
          ? normalizeCollectionSlug(raw.canonicalSlug)
          : '';
      const canonicalSlug = explicitCanonicalSlug || COLLECTION_CANONICAL_SLUG_OVERRIDES[fileSlug] || fileSlug;
      const legacySlugs = new Set<string>();

      if (fileSlug && fileSlug !== canonicalSlug) {
        legacySlugs.add(fileSlug);
      }

      if (Array.isArray(raw.legacySlugs)) {
        for (const legacySlug of raw.legacySlugs) {
          if (typeof legacySlug !== 'string') continue;
          const normalized = normalizeCollectionSlug(legacySlug);
          if (normalized && normalized !== canonicalSlug) {
            legacySlugs.add(normalized);
          }
        }
      }

      for (const legacySlug of legacySlugs) {
        map.set(legacySlug.toLowerCase(), canonicalSlug);
      }
    } catch {
      continue;
    }
  }

  return map;
}

const legacyCollectionRedirectMap = buildCollectionLegacyRedirectMap();

function resolveLegacyNonSkillRedirect(url: string): LegacyNonSkillRedirect | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!['killer-skills.com', 'www.killer-skills.com'].includes(parsed.hostname)) return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || !/^[a-z]{2}$/.test(parts[0])) return null;

  const origin = parsed.origin.replace(/^https?:\/\/www\./, 'https://');
  const locale = parts[0];
  const section = parts[1];
  const slug = parts
    .slice(2)
    .map((segment) => safeDecode(segment).trim())
    .filter(Boolean)
    .join('/');
  if (!slug) return null;

  if (section === 'docs') {
    const canonicalDocSlug = LEGACY_DOC_SLUG_REDIRECTS.get(slug.toLowerCase());
    if (canonicalDocSlug && canonicalDocSlug.toLowerCase() !== slug.toLowerCase()) {
      return {
        targetUrl: `${origin}/${locale}/docs/${canonicalDocSlug}`,
        reason: 'legacy_docs_slug_redirect',
        coveredByMiddleware: true,
      };
    }
  }

  if (section === 'collections' && parts.length === 3) {
    const canonicalCollectionSlug = legacyCollectionRedirectMap.get(slug.toLowerCase());
    if (canonicalCollectionSlug && canonicalCollectionSlug.toLowerCase() !== slug.toLowerCase()) {
      return {
        targetUrl: `${origin}/${locale}/collections/${canonicalCollectionSlug}`,
        reason: 'legacy_collection_slug_redirect',
        coveredByMiddleware: false,
      };
    }
  }

  return null;
}

export function buildSitemapIndex(): SitemapIndex {
  const map = new Map<string, { owner: string; routePath: string }>();
  const repoCounts = new Map<string, number>();
  const repoSingleRoute = new Map<string, string>();
  const blockedExact = new Set<string>();
  const blockedRepo = new Set<string>();

  const sitemapPath = resolve(process.cwd(), 'data/sitemap-skills.json');
  if (existsSync(sitemapPath)) {
    const raw = JSON.parse(readFileSync(sitemapPath, 'utf8')) as SitemapSkillRecord[] | { skills?: SitemapSkillRecord[] };
    const records = Array.isArray(raw) ? raw : raw.skills || [];

    for (const record of records) {
      const owner = typeof record.owner === 'string' ? record.owner.trim() : '';
      const routePath = typeof record.routePath === 'string' ? record.routePath.trim() : '';
      if (!owner || !routePath) continue;
      const key = `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
      map.set(key, { owner, routePath });

      const repo = routePath.split('/')[0]?.trim();
      if (!repo) continue;
      const repoKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
      const nextCount = (repoCounts.get(repoKey) || 0) + 1;
      repoCounts.set(repoKey, nextCount);
      if (nextCount === 1) {
        repoSingleRoute.set(repoKey, routePath);
      } else {
        repoSingleRoute.set(repoKey, '');
      }
    }
  }

  for (const [repoKey, count] of repoCounts.entries()) {
    if (count !== 1 || !repoSingleRoute.get(repoKey)) {
      repoSingleRoute.delete(repoKey);
    }
  }

  const blocklistPath = resolve(process.cwd(), 'data/seo-sitemap-blocklist.json');
  if (existsSync(blocklistPath)) {
    const raw = JSON.parse(readFileSync(blocklistPath, 'utf8')) as {
      rules?: { excludeExact?: string[]; excludeRepo?: string[] };
    };
    const rules = raw?.rules || {};
    for (const entry of rules.excludeExact || []) {
      if (typeof entry === 'string' && entry.trim()) blockedExact.add(entry.trim().toLowerCase());
    }
    for (const entry of rules.excludeRepo || []) {
      if (typeof entry === 'string' && entry.trim()) blockedRepo.add(entry.trim().toLowerCase());
    }
  }

  return { map, repoCounts, repoSingleRoute, blockedExact, blockedRepo };
}

function classifyUrl(url: string): ClusterId {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }

  const pathname = parsed.pathname;
  if (parsed.searchParams.size > 0) return 'query_parameter';
  if (/\/blog\/.+\.html$/i.test(pathname)) return 'legacy_html';
  if (isSourceFilePathname(pathname, FILE_EXT_REGEX)) return 'source_file_path';
  if (countExtraSkillSegments(pathname) >= 2) return 'deep_skill_path';
  if (pathname.length > 1 && pathname.endsWith('/')) return 'trailing_slash';
  if (hasRepeatedSegment(pathname)) return 'repeated_segment';
  if (/\/sandbox\//i.test(pathname)) return 'sandbox_path';
  return 'other';
}

function isOwnerOnlySkillPath(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^\/[a-z]{2}\/skills\/[^/]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function trimSegmentNoise(routePath: string): string {
  return routePath
    .split('/')
    .map((segment) => segment.trim().replace(/[._-]+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function tryResolveCanonicalSkillUrl(
  url: string,
  sitemapIndex: SitemapIndex,
): { targetUrl: string; reason: string } | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const parts = parsedUrl.pathname.split('/').filter(Boolean);
  if (parts.length < 4 || parts[1] !== 'skills') return null;

  const locale = parts[0];
  const owner = safeDecode(parts[2]).trim();
  const routeSegments = parts.slice(3).map((segment) => safeDecode(segment).trim()).filter(Boolean);
  if (!locale || !owner || routeSegments.length === 0) return null;

  const buildTargetUrl = (targetOwner: string, routePath: string) =>
    `${parsedUrl.origin.replace(/^https?:\/\/www\./, 'https://')}/${locale}/skills/${encodeURIComponent(
      targetOwner,
    )}/${routePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}${parsedUrl.search}`;

  const normalizedLastSegment =
    routeSegments.length >= 2 && FILE_EXT_REGEX.test(routeSegments[routeSegments.length - 1])
      ? routeSegments.map((segment, index) =>
          index === routeSegments.length - 1 ? segment.replace(FILE_EXT_REGEX, '') : segment,
        )
      : routeSegments;

  const candidateRoutePaths = Array.from(
    new Set(
      [
        routeSegments.join('/'),
        routeSegments.length >= 2 ? normalizedLastSegment.join('/') : '',
        routeSegments.length >= 2 ? routeSegments.slice(0, 2).join('/') : '',
        routeSegments.length >= 2 ? trimSegmentNoise(normalizedLastSegment.slice(0, 2).join('/')) : '',
        routeSegments[0] || '',
      ].filter(Boolean),
    ),
  );

  for (const candidateRoutePath of candidateRoutePaths) {
    const direct = sitemapIndex.map.get(`${owner.toLowerCase()}/${candidateRoutePath.toLowerCase()}`);
    if (!direct) continue;

    const canonicalPath = buildTargetUrl(direct.owner, direct.routePath);
    if (canonicalPath !== url) {
      return {
        targetUrl: canonicalPath,
        reason:
          candidateRoutePath === routeSegments.join('/') ? 'case_or_encoding_mismatch' : 'nested_skill_parent_redirect',
      };
    }
  }

  const repoKey = `${owner.toLowerCase()}/${routeSegments[0].toLowerCase()}`;
  const fallbackRoute = sitemapIndex.repoSingleRoute.get(repoKey);
  if (fallbackRoute) {
    const targetUrl = buildTargetUrl(owner, fallbackRoute);
    if (targetUrl !== url) {
      return {
        targetUrl,
        reason: 'repo_single_skill_redirect',
      };
    }
  }

  return null;
}

function parseSkillUrl(url: string): ParsedSkillUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!['killer-skills.com', 'www.killer-skills.com'].includes(parsed.hostname)) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 4 || parts[1] !== 'skills') return null;

  const locale = parts[0];
  const owner = safeDecode(parts[2]).trim();
  const routeSegments = parts.slice(3).map((segment) => safeDecode(segment).trim()).filter(Boolean);
  if (!locale || !owner || routeSegments.length === 0) return null;

  const routePath = routeSegments.join('/');
  const repo = routeSegments[0];
  if (!repo) return null;

  return {
    origin: parsed.origin.replace(/^https?:\/\/www\./, 'https://'),
    locale,
    owner,
    routePath,
    repo,
    routeSegments: routeSegments.length,
  };
}

export function classifyOtherUrl(
  url: string,
  sitemapIndex: SitemapIndex,
): { classification: OtherClassification; parsed: ParsedSkillUrl | null } {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { classification: 'malformed_coverage_row', parsed: null };
  }

  if (!['killer-skills.com', 'www.killer-skills.com'].includes(parsedUrl.hostname)) {
    return { classification: 'malformed_coverage_row', parsed: null };
  }

  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && pathParts[0]?.match(/^[a-z]{2}$/) && pathParts[1] !== 'skills') {
    return { classification: 'non_skill_site_path', parsed: null };
  }

  const parsed = parseSkillUrl(url);
  if (!parsed) return { classification: 'malformed_coverage_row', parsed: null };

  const key = `${parsed.owner.toLowerCase()}/${parsed.routePath.toLowerCase()}`;
  const repoKey = `${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
  const inSitemap = sitemapIndex.map.has(key);
  const blocked = sitemapIndex.blockedExact.has(key) || sitemapIndex.blockedRepo.has(repoKey);
  const repoSkillCount = sitemapIndex.repoCounts.get(repoKey) || 0;

  if (blocked) return { classification: 'blocked_by_sitemap', parsed };
  if (inSitemap) return { classification: 'in_sitemap', parsed };

  if (parsed.routeSegments === 1) {
    if (repoSkillCount > 1) return { classification: 'repo_directory_candidate', parsed };
    if (repoSkillCount === 1) return { classification: 'repo_single_skill_redirect', parsed };
    return { classification: 'missing_in_data', parsed };
  }

  if (parsed.routeSegments === 2) {
    if (repoSkillCount >= 1) return { classification: 'unknown_subskill', parsed };
    return { classification: 'missing_in_data', parsed };
  }

  return { classification: 'malformed_coverage_row', parsed };
}

export function suggestAction(
  url: string,
  cluster: ClusterId,
  sitemapIndex: SitemapIndex,
): RemediationAction {
  if (cluster === 'other') {
    const legacyNonSkillRedirect = resolveLegacyNonSkillRedirect(url);
    if (legacyNonSkillRedirect) {
      return {
        url,
        cluster,
        action: 'redirect_301',
        reason: legacyNonSkillRedirect.reason,
        targetUrl: legacyNonSkillRedirect.targetUrl,
        coveredByMiddleware: legacyNonSkillRedirect.coveredByMiddleware,
      };
    }
  }

  const canonicalSkill = tryResolveCanonicalSkillUrl(url, sitemapIndex);
  if (canonicalSkill) {
    return {
      url,
      cluster,
      action: 'redirect_301',
      reason: canonicalSkill.reason,
      targetUrl: canonicalSkill.targetUrl,
      coveredByMiddleware: true,
    };
  }

  if (cluster === 'trailing_slash') {
    if (isOwnerOnlySkillPath(url)) {
      return {
        url,
        cluster,
        action: 'gone_410',
        reason: 'owner_root_skill_trap',
        coveredByMiddleware: true,
      };
    }
    const targetUrl = url.replace(/\/+(\?|#|$)/, '$1');
    return {
      url,
      cluster,
      action: 'redirect_301',
      reason: 'trailing_slash_canonicalization',
      targetUrl,
      coveredByMiddleware: true,
    };
  }

  if (cluster === 'legacy_html') {
    return {
      url,
      cluster,
      action: 'redirect_301',
      reason: 'legacy_html_blog_path',
      targetUrl: url.replace(/\.html(?=([?#]|$))/i, ''),
      coveredByMiddleware: true,
    };
  }

  if (cluster === 'source_file_path' || cluster === 'deep_skill_path' || cluster === 'repeated_segment') {
    return {
      url,
      cluster,
      action: 'gone_410',
      reason: 'crawl_trap_or_invalid_public_route',
      coveredByMiddleware: cluster !== 'repeated_segment',
    };
  }

  if (cluster === 'sandbox_path') {
    return {
      url,
      cluster,
      action: 'gone_410',
      reason: 'sandbox_should_not_be_indexed',
      coveredByMiddleware: false,
    };
  }

  if (cluster === 'query_parameter') {
    return {
      url,
      cluster,
      action: 'manual_review',
      reason: 'parameterized_url_requires_policy_review',
      coveredByMiddleware: false,
    };
  }

  if (cluster === 'other') {
    const other = classifyOtherUrl(url, sitemapIndex);
    switch (other.classification) {
      case 'blocked_by_sitemap':
        return {
          url,
          cluster,
          action: 'gone_410',
          reason: 'blocked_by_sitemap',
          coveredByMiddleware: false,
        };
      case 'missing_in_data':
        return {
          url,
          cluster,
          action: 'gone_410',
          reason: 'missing_from_sitemap_and_cache',
          coveredByMiddleware: false,
        };
      case 'non_skill_site_path':
        return {
          url,
          cluster,
          action: 'manual_review',
          reason: 'non_skill_route_requires_policy_review',
          coveredByMiddleware: false,
        };
      case 'malformed_coverage_row':
        return {
          url,
          cluster,
          action: 'manual_review',
          reason: 'malformed_coverage_export_row',
          coveredByMiddleware: false,
        };
      case 'repo_single_skill_redirect': {
        const parsed = other.parsed;
        if (parsed) {
          const repoKey = `${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
          const routePath = sitemapIndex.repoSingleRoute.get(repoKey);
          if (routePath) {
            const canonicalPath = `/${parsed.locale}/skills/${encodeURIComponent(parsed.owner)}/${routePath
              .split('/')
              .map((segment) => encodeURIComponent(segment))
              .join('/')}`;
            return {
              url,
              cluster,
              action: 'redirect_301',
              reason: 'repo_single_skill_redirect',
              targetUrl: `${parsed.origin}${canonicalPath}`,
              coveredByMiddleware: true,
            };
          }
        }
        return {
          url,
          cluster,
          action: 'manual_review',
          reason: 'repo_single_skill_redirect_missing_route',
          coveredByMiddleware: false,
        };
      }
      case 'repo_directory_candidate':
        return {
          url,
          cluster,
          action: 'gone_410',
          reason: 'repo_directory_skill_trap',
          coveredByMiddleware: true,
        };
      case 'unknown_subskill':
        return {
          url,
          cluster,
          action: 'manual_review',
          reason: 'unknown_subskill_for_known_repo',
          coveredByMiddleware: false,
        };
      case 'in_sitemap':
        return {
          url,
          cluster,
          action: 'observe',
          reason: 'in_sitemap_recrawl_watch',
          coveredByMiddleware: false,
        };
      default:
        break;
    }
  }

  return {
    url,
    cluster,
    action: 'manual_review',
    reason: 'missing_skill_or_unknown_pattern',
    coveredByMiddleware: false,
  };
}

function discover404InputDir(): string | null {
  let selected: { path: string; score: number } | null = null;
  for (const source of discoverCoverageDrilldownSourceDirectories()) {
    const csvPaths = source.csvPaths;
    try {
      const issueName = parseIssueName(csvPaths);
      if (!issueName.includes('未找到')) continue;
      const score = statSync(csvPaths.table).mtimeMs;
      if (!selected || score > selected.score) {
        selected = { path: source.directoryPath, score };
      }
    } catch {
      // ignore invalid candidate
    }
  }

  return selected?.path || null;
}

export function buildPlan(inputDir: string): RemediationPlan {
  const csvPaths = resolveCoverageDrilldownCsvPaths(inputDir);
  if (!csvPaths) {
    throw new Error(`Invalid Coverage Drilldown input directory: ${inputDir}`);
  }

  const issueName = parseIssueName(csvPaths);
  const rows = parseCoverageDrilldownCsv(readFileSync(csvPaths.table, 'utf8')).slice(1);
  const sitemapIndex = buildSitemapIndex();

  const actions: RemediationAction[] = [];
  for (const row of rows) {
    const url = row[0] || '';
    if (!url) continue;
    const cluster = classifyUrl(url);
    actions.push(suggestAction(url, cluster, sitemapIndex));
  }

  const redirectCount = actions.filter((action) => action.action === 'redirect_301').length;
  const goneCount = actions.filter((action) => action.action === 'gone_410').length;
  const manualReviewCount = actions.filter((action) => action.action === 'manual_review').length;
  const observeCount = actions.filter((action) => action.action === 'observe').length;

  return {
    generatedAt: new Date().toISOString(),
    sourceDirectory: inputDir,
    issueName,
    totalSamples: actions.length,
    redirectCount,
    goneCount,
    manualReviewCount,
    observeCount,
    actions,
  };
}

export function buildOtherAuditReport(plan: RemediationPlan): OtherAuditReport {
  const rows = plan.actions
    .filter((action) => action.cluster === 'other')
    .map((action) => ({
      url: action.url,
      action: action.action,
      reason: action.reason,
      coveredByMiddleware: action.coveredByMiddleware,
      ...(action.targetUrl ? { targetUrl: action.targetUrl } : {}),
    }));

  const reasonBreakdown = Array.from(
    rows.reduce((acc, row) => {
      const current = acc.get(row.reason) || [];
      current.push(row);
      acc.set(row.reason, current);
      return acc;
    }, new Map<string, OtherAuditRow[]>()),
  )
    .map(([reason, reasonRows]) => ({
      reason,
      count: reasonRows.length,
      actionBreakdown: Array.from(
        reasonRows.reduce((acc, row) => {
          acc.set(row.action, (acc.get(row.action) || 0) + 1);
          return acc;
        }, new Map<RemediationActionType, number>()),
      )
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action)),
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const actionSummary = Array.from(
    rows.reduce((acc, row) => {
      acc.set(row.action, (acc.get(row.action) || 0) + 1);
      return acc;
    }, new Map<RemediationActionType, number>()),
  )
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));

  const exactRemoval410Count = actionSummary.find((item) => item.action === 'gone_410')?.count || 0;
  const redirectValidationCount = actionSummary.find((item) => item.action === 'redirect_301')?.count || 0;
  const observeCount = actionSummary.find((item) => item.action === 'observe')?.count || 0;
  const manualReviewCount = actionSummary.find((item) => item.action === 'manual_review')?.count || 0;
  const redirectCoveredByMiddlewareCount = rows.filter(
    (row) => row.action === 'redirect_301' && row.coveredByMiddleware,
  ).length;
  const redirectNeedsValidationCount = Math.max(0, redirectValidationCount - redirectCoveredByMiddlewareCount);
  const topReasons = reasonBreakdown.slice(0, 3).map((item) => `${item.reason}=${item.count}`);
  const nextActions: string[] = [];

  if (exactRemoval410Count > 0) {
    nextActions.push(
      `Keep ${exactRemoval410Count} other-cluster URLs on the exact-removal / 410 track first; dominant buckets are ${topReasons.join(', ')}.`,
    );
  }

  if (redirectValidationCount > 0) {
    nextActions.push(
      `Validate ${redirectValidationCount} redirect candidates before relying on recrawl alone (${redirectCoveredByMiddlewareCount} already middleware-covered, ${redirectNeedsValidationCount} still need direct redirect verification).`,
    );
  }

  if (observeCount > 0) {
    nextActions.push(
      `Leave ${observeCount} sitemap-backed URLs in recrawl watch and do not submit temporary removals unless they fall out of governed sitemap coverage.`,
    );
  }

  if (manualReviewCount > 0) {
    nextActions.push(`Work the remaining ${manualReviewCount} manual-review rows before creating any new automated rule.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceReport: 'reports/seo/latest-404-remediation-plan.json',
    sourceGeneratedAt: plan.generatedAt,
    sourceIssueName: plan.issueName,
    totalRows: rows.length,
    actionSummary,
    executionSummary: {
      exactRemoval410Count,
      redirectValidationCount,
      redirectCoveredByMiddlewareCount,
      redirectNeedsValidationCount,
      observeCount,
      manualReviewCount,
    },
    reasonBreakdown,
    nextActions,
    rows,
  };
}

export function buildSourceFileAuditReport(plan: RemediationPlan): SourceFileAuditReport {
  const rows = plan.actions
    .filter((action) => action.cluster === 'source_file_path')
    .map((action) => ({
      url: action.url,
      action: action.action,
      reason: action.reason,
      coveredByMiddleware: action.coveredByMiddleware,
      ...(action.targetUrl ? { targetUrl: action.targetUrl } : {}),
    }));

  const reasonBreakdown = Array.from(
    rows.reduce((acc, row) => {
      const current = acc.get(row.reason) || [];
      current.push(row);
      acc.set(row.reason, current);
      return acc;
    }, new Map<string, SourceFileAuditRow[]>()),
  )
    .map(([reason, reasonRows]) => ({
      reason,
      count: reasonRows.length,
      actionBreakdown: Array.from(
        reasonRows.reduce((acc, row) => {
          acc.set(row.action, (acc.get(row.action) || 0) + 1);
          return acc;
        }, new Map<RemediationActionType, number>()),
      )
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action)),
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const actionSummary = Array.from(
    rows.reduce((acc, row) => {
      acc.set(row.action, (acc.get(row.action) || 0) + 1);
      return acc;
    }, new Map<RemediationActionType, number>()),
  )
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));

  const exactRemoval410Count = actionSummary.find((item) => item.action === 'gone_410')?.count || 0;
  const redirectValidationCount = actionSummary.find((item) => item.action === 'redirect_301')?.count || 0;
  const observeCount = actionSummary.find((item) => item.action === 'observe')?.count || 0;
  const manualReviewCount = actionSummary.find((item) => item.action === 'manual_review')?.count || 0;
  const redirectCoveredByMiddlewareCount = rows.filter(
    (row) => row.action === 'redirect_301' && row.coveredByMiddleware,
  ).length;
  const redirectNeedsValidationCount = Math.max(0, redirectValidationCount - redirectCoveredByMiddlewareCount);
  const repoSingleSkillRedirectCount = reasonBreakdown.find((item) => item.reason === 'repo_single_skill_redirect')?.count || 0;
  const nestedSkillParentRedirectCount =
    reasonBreakdown.find((item) => item.reason === 'nested_skill_parent_redirect')?.count || 0;
  const nextActions: string[] = [];

  if (exactRemoval410Count > 0) {
    nextActions.push(`Keep ${exactRemoval410Count} source-file URLs on the exact-removal / 410 track first.`);
  }

  if (redirectNeedsValidationCount > 0 && redirectCoveredByMiddlewareCount > 0) {
    nextActions.push(
      `Validate ${redirectNeedsValidationCount} explicit 301 candidates and verify ${redirectCoveredByMiddlewareCount} middleware-covered source-file redirects after deploy.`,
    );
  } else if (redirectNeedsValidationCount > 0) {
    nextActions.push(`Validate ${redirectNeedsValidationCount} explicit source-file redirect candidates before relying on recrawl alone.`);
  } else if (redirectCoveredByMiddlewareCount > 0) {
    nextActions.push(
      `Verify ${redirectCoveredByMiddlewareCount} middleware-covered source-file redirects after deploy; this batch currently includes ${repoSingleSkillRedirectCount} repo-single-skill redirects and ${nestedSkillParentRedirectCount} nested-parent redirects.`,
    );
  }

  if (observeCount > 0) {
    nextActions.push(`Leave ${observeCount} source-file URLs in recrawl watch until they stop resurfacing in Coverage exports.`);
  }

  if (manualReviewCount > 0) {
    nextActions.push(`Work the remaining ${manualReviewCount} manual-review source-file rows before adding any new automated redirect rule.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceReport: 'reports/seo/latest-404-remediation-plan.json',
    sourceGeneratedAt: plan.generatedAt,
    sourceIssueName: plan.issueName,
    totalRows: rows.length,
    actionSummary,
    executionSummary: {
      exactRemoval410Count,
      redirectValidationCount,
      redirectCoveredByMiddlewareCount,
      redirectNeedsValidationCount,
      observeCount,
      manualReviewCount,
    },
    reasonBreakdown,
    nextActions,
    rows,
  };
}

function renderMarkdown(plan: RemediationPlan): string {
  const lines: string[] = [];
  lines.push('# SEO 404 Remediation Plan');
  lines.push('');
  lines.push(`- Generated: ${plan.generatedAt}`);
  lines.push(`- Source directory: ${plan.sourceDirectory}`);
  lines.push(`- Issue name: ${plan.issueName}`);
  lines.push(`- Sample URLs analyzed: ${plan.totalSamples}`);
  lines.push(`- 301 candidates: ${plan.redirectCount}`);
  lines.push(`- 410 candidates: ${plan.goneCount}`);
  lines.push(`- Manual review: ${plan.manualReviewCount}`);
  lines.push(`- Observe / recrawl watch: ${plan.observeCount}`);
  lines.push('');

  const byCluster = new Map<ClusterId, number>();
  for (const action of plan.actions) {
    byCluster.set(action.cluster, (byCluster.get(action.cluster) || 0) + 1);
  }

  lines.push('## Cluster Distribution');
  lines.push('');
  for (const [cluster, count] of Array.from(byCluster.entries()).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${CLUSTER_LABELS[cluster]} (${cluster}): ${count}`);
  }
  lines.push('');

  lines.push('## Redirect 301 Candidates');
  lines.push('');
  const redirects = plan.actions.filter((action) => action.action === 'redirect_301').slice(0, 120);
  if (redirects.length === 0) {
    lines.push('- none');
  } else {
    for (const action of redirects) {
      lines.push(
        `- ${action.url} -> ${action.targetUrl || '(missing target)'} | reason=${action.reason} | middleware=${action.coveredByMiddleware ? 'yes' : 'no'}`,
      );
    }
  }
  lines.push('');

  lines.push('## Gone 410 Candidates');
  lines.push('');
  const gone = plan.actions.filter((action) => action.action === 'gone_410').slice(0, 120);
  if (gone.length === 0) {
    lines.push('- none');
  } else {
    for (const action of gone) {
      lines.push(`- ${action.url} | cluster=${action.cluster} | reason=${action.reason}`);
    }
  }
  lines.push('');

  lines.push('## Observe / Recrawl Watch');
  lines.push('');
  const observe = plan.actions.filter((action) => action.action === 'observe').slice(0, 120);
  if (observe.length === 0) {
    lines.push('- none');
  } else {
    for (const action of observe) {
      lines.push(`- ${action.url} | cluster=${action.cluster} | reason=${action.reason}`);
    }
  }
  lines.push('');

  lines.push('## Manual Review Candidates');
  lines.push('');
  const review = plan.actions.filter((action) => action.action === 'manual_review').slice(0, 120);
  if (review.length === 0) {
    lines.push('- none');
  } else {
    for (const action of review) {
      lines.push(`- ${action.url} | cluster=${action.cluster} | reason=${action.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderOtherAuditMarkdown(report: OtherAuditReport): string {
  const lines: string[] = [];
  lines.push('# Coverage Other Cluster Audit');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source report: ${report.sourceReport}`);
  lines.push(`- Source generated at: ${report.sourceGeneratedAt}`);
  lines.push(`- Issue name: ${report.sourceIssueName}`);
  lines.push(`- Rows in other cluster: ${report.totalRows}`);
  lines.push('');
  lines.push('## Action Summary');
  lines.push('');
  for (const item of report.actionSummary) {
    lines.push(`- ${item.action}: ${item.count}`);
  }
  lines.push('');
  lines.push('## Execution Summary');
  lines.push('');
  lines.push(`- Exact-removal / 410 batch: ${report.executionSummary.exactRemoval410Count}`);
  lines.push(
    `- Redirect validation batch: ${report.executionSummary.redirectValidationCount} (middleware-covered=${report.executionSummary.redirectCoveredByMiddlewareCount}, verify-directly=${report.executionSummary.redirectNeedsValidationCount})`,
  );
  lines.push(`- Recrawl watch batch: ${report.executionSummary.observeCount}`);
  lines.push(`- Manual review remainder: ${report.executionSummary.manualReviewCount}`);
  lines.push('');
  lines.push('## Reason Breakdown');
  lines.push('');
  for (const item of report.reasonBreakdown) {
    const actionSummary = item.actionBreakdown.map((action) => `${action.action}=${action.count}`).join(', ');
    lines.push(`- ${item.reason}: ${item.count} (${actionSummary})`);
  }
  lines.push('');
  lines.push('## Operator Next Actions');
  lines.push('');
  if (report.nextActions.length === 0) {
    lines.push('- none');
  } else {
    for (const action of report.nextActions) {
      lines.push(`- ${action}`);
    }
  }
  lines.push('');
  lines.push('## Sample Rows');
  lines.push('');
  for (const row of report.rows.slice(0, 160)) {
    lines.push(
      `- ${row.url} | action=${row.action} | reason=${row.reason} | middleware=${row.coveredByMiddleware ? 'yes' : 'no'}${row.targetUrl ? ` | target=${row.targetUrl}` : ''}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function renderSourceFileAuditMarkdown(report: SourceFileAuditReport): string {
  const lines: string[] = [];
  lines.push('# Coverage Source File Cluster Audit');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source report: ${report.sourceReport}`);
  lines.push(`- Source generated at: ${report.sourceGeneratedAt}`);
  lines.push(`- Issue name: ${report.sourceIssueName}`);
  lines.push(`- Rows in source_file_path cluster: ${report.totalRows}`);
  lines.push('');
  lines.push('## Action Summary');
  lines.push('');
  for (const item of report.actionSummary) {
    lines.push(`- ${item.action}: ${item.count}`);
  }
  lines.push('');
  lines.push('## Execution Summary');
  lines.push('');
  lines.push(`- Exact-removal / 410 batch: ${report.executionSummary.exactRemoval410Count}`);
  lines.push(
    `- Redirect validation batch: ${report.executionSummary.redirectValidationCount} (middleware-covered=${report.executionSummary.redirectCoveredByMiddlewareCount}, verify-directly=${report.executionSummary.redirectNeedsValidationCount})`,
  );
  lines.push(`- Recrawl watch batch: ${report.executionSummary.observeCount}`);
  lines.push(`- Manual review remainder: ${report.executionSummary.manualReviewCount}`);
  lines.push('');
  lines.push('## Reason Breakdown');
  lines.push('');
  for (const item of report.reasonBreakdown) {
    const actionSummary = item.actionBreakdown.map((action) => `${action.action}=${action.count}`).join(', ');
    lines.push(`- ${item.reason}: ${item.count} (${actionSummary})`);
  }
  lines.push('');
  lines.push('## Operator Next Actions');
  lines.push('');
  if (report.nextActions.length === 0) {
    lines.push('- none');
  } else {
    for (const action of report.nextActions) {
      lines.push(`- ${action}`);
    }
  }
  lines.push('');
  lines.push('## Sample Rows');
  lines.push('');
  for (const row of report.rows.slice(0, 160)) {
    lines.push(
      `- ${row.url} | action=${row.action} | reason=${row.reason} | middleware=${row.coveredByMiddleware ? 'yes' : 'no'}${row.targetUrl ? ` | target=${row.targetUrl}` : ''}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function renderOtherAuditCsv(report: OtherAuditReport): string {
  const lines = ['url,action,reason,coveredByMiddleware,targetUrl'];
  for (const row of report.rows) {
    lines.push(
      [
        escapeCsvCell(row.url),
        escapeCsvCell(row.action),
        escapeCsvCell(row.reason),
        row.coveredByMiddleware ? 'true' : 'false',
        escapeCsvCell(row.targetUrl || ''),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderSourceFileAuditCsv(report: SourceFileAuditReport): string {
  const lines = ['url,action,reason,coveredByMiddleware,targetUrl'];
  for (const row of report.rows) {
    lines.push(
      [
        escapeCsvCell(row.url),
        escapeCsvCell(row.action),
        escapeCsvCell(row.reason),
        row.coveredByMiddleware ? 'true' : 'false',
        escapeCsvCell(row.targetUrl || ''),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = args.inputDir || discover404InputDir();

  if (!inputDir) {
    const availableIssues = listAvailableCoverageIssues();
    console.error(
      [
        'No Coverage Drilldown source with issue name containing "未找到" was found in archive or Downloads.',
        availableIssues.length > 0
          ? `Available sources: ${availableIssues.map((item) => `${item.issueName} @ ${item.directory}`).join(' | ')}`
          : 'Available sources: none',
        'Run with explicit input if you exported a dedicated 404 Coverage Drilldown source:',
        'npx tsx scripts/seo-404-remediation-plan.ts --input "/abs/path/to/killer-skills.com-Coverage-Drilldown-YYYY-MM-DD"',
      ].join('\n'),
    );
    process.exit(1);
  }

  if (!existsSync(inputDir) || !statSync(inputDir).isDirectory()) {
    console.error(`Invalid input directory: ${inputDir}`);
    process.exit(1);
  }

  const plan = buildPlan(inputDir);
  const markdown = renderMarkdown(plan);
  const otherAuditReport = buildOtherAuditReport(plan);
  const sourceFileAuditReport = buildSourceFileAuditReport(plan);

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(MD_OUTPUT, markdown, 'utf8');
  writeFileSync(JSON_OUTPUT, JSON.stringify(plan, null, 2), 'utf8');
  writeFileSync(OTHER_AUDIT_MD_OUTPUT, renderOtherAuditMarkdown(otherAuditReport), 'utf8');
  writeFileSync(OTHER_AUDIT_JSON_OUTPUT, JSON.stringify(otherAuditReport, null, 2), 'utf8');
  writeFileSync(OTHER_AUDIT_CSV_OUTPUT, renderOtherAuditCsv(otherAuditReport), 'utf8');
  writeFileSync(SOURCE_FILE_AUDIT_MD_OUTPUT, renderSourceFileAuditMarkdown(sourceFileAuditReport), 'utf8');
  writeFileSync(SOURCE_FILE_AUDIT_JSON_OUTPUT, JSON.stringify(sourceFileAuditReport, null, 2), 'utf8');
  writeFileSync(SOURCE_FILE_AUDIT_CSV_OUTPUT, renderSourceFileAuditCsv(sourceFileAuditReport), 'utf8');

  console.log(`Wrote 404 remediation plan to ${MD_OUTPUT}`);
  console.log(`Wrote 404 remediation JSON to ${JSON_OUTPUT}`);
  console.log(`Wrote other-cluster audit to ${OTHER_AUDIT_MD_OUTPUT}`);
  console.log(`Wrote other-cluster audit JSON to ${OTHER_AUDIT_JSON_OUTPUT}`);
  console.log(`Wrote source-file audit to ${SOURCE_FILE_AUDIT_MD_OUTPUT}`);
  console.log(`Wrote source-file audit JSON to ${SOURCE_FILE_AUDIT_JSON_OUTPUT}`);
  console.log(`Sample URLs analyzed: ${plan.totalSamples}`);
  console.log(
    `301: ${plan.redirectCount} | 410: ${plan.goneCount} | review: ${plan.manualReviewCount} | observe: ${plan.observeCount}`,
  );
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
