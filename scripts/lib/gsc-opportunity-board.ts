import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseGscCsv, type GscRow } from '../../src/lib/gsc-report';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from '../../src/lib/sitemap-blocklist';
import sitemapBlocklistData from '../../data/seo-sitemap-blocklist.json';

export const DEFAULT_GSC_OPPORTUNITY_BOARD_MD_PATH = 'reports/seo/latest-gsc-opportunity-board.md';
export const DEFAULT_GSC_OPPORTUNITY_BOARD_JSON_PATH = 'reports/seo/latest-gsc-opportunity-board.json';
export const DEFAULT_TRAFFIC_REPORT_JSON_PATH = 'reports/gsc/latest-ctr-report.json';

export type GscOpportunityBoardStatus = 'active' | 'blocked' | 'watch';
export type GscOpportunityPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type GscOpportunityLane =
  | 'metadata'
  | 'internal-linking'
  | 'content-refresh'
  | 'query-intent'
  | 'canonicalization'
  | 'measurement';

export type GscOpportunityBoardItem = {
  id: string;
  priority: GscOpportunityPriority;
  lane: GscOpportunityLane;
  entityType: 'page' | 'query';
  entity: string;
  score: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  expectedCtr: number;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  evidence: string[];
  actions: string[];
};

export type GscOpportunityBoardReport = {
  generatedAt: string;
  status: GscOpportunityBoardStatus;
  sourceMode: string | null;
  currentPeriod: { start: string; end: string } | null;
  previousPeriod: { start: string; end: string } | null;
  headline: string;
  seoComplianceChecks: string[];
  items: GscOpportunityBoardItem[];
  nextActions: string[];
  blockers: string[];
};

type TrafficReportJson = {
  status?: string | null;
  sourceMode?: string | null;
  currentPeriod?: { start: string; end: string } | null;
  previousPeriod?: { start: string; end: string } | null;
  failureReason?: string | null;
  nextStep?: string | null;
};

type GscOpportunityBoardFileOptions = {
  trafficJsonPath?: string;
};

type Seo404RulesJson = {
  rules?: {
    redirect301?: Array<{ fromPath?: string; toPath?: string; reason?: string }>;
  };
};

type SkillLocaleGovernanceJson = {
  skills?: Array<{
    owner?: string;
    routePath?: string;
    canonicalLocale?: string | null;
    publishedLocales?: string[];
  }>;
};

const SEO_COMPLIANCE_CHECKS = [
  'Every candidate page should have one accurate, unique title that matches the visible H1 and page intent.',
  'Meta descriptions should be unique, human-readable, and supported by visible body copy instead of keyword stuffing.',
  'Sitemap URLs should resolve directly with 200 responses, self-consistent canonical URLs, and no noindex directive.',
  'Structured data should describe the actual page content and avoid hidden/internal-only claims.',
  'Internal links should point crawlers toward canonical pages that answer the same query intent.',
];
const sitemapBlocklist = compileSitemapBlocklist(sitemapBlocklistData);

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function readTextFile(path: string): string | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return readFileSync(absolutePath, 'utf8');
}

function writeTextFile(path: string, content: string): void {
  const absolutePath = toAbsolutePath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

const explicitRedirectPathMap = (() => {
  const rules = readJsonFile<Seo404RulesJson>('data/seo-404-rules.json');
  const map = new Map<string, string>();

  for (const rule of rules?.rules?.redirect301 ?? []) {
    const fromPath = typeof rule.fromPath === 'string' ? rule.fromPath.trim() : '';
    const toPath = typeof rule.toPath === 'string' ? rule.toPath.trim() : '';
    if (fromPath && toPath) map.set(fromPath, toPath);
  }

  return map;
})();

const skillLocaleGovernanceMap = (() => {
  const governance = readJsonFile<SkillLocaleGovernanceJson>('data/seo-skill-locale-governance.json');
  const map = new Map<string, { canonicalLocale: string | null; publishedLocales: string[] }>();

  for (const record of governance?.skills ?? []) {
    const owner = typeof record.owner === 'string' ? record.owner.trim().toLowerCase() : '';
    const routePath = typeof record.routePath === 'string' ? record.routePath.trim().toLowerCase() : '';
    if (!owner || !routePath) continue;

    map.set(`${owner}/${routePath}`, {
      canonicalLocale:
        typeof record.canonicalLocale === 'string' && record.canonicalLocale.trim()
          ? record.canonicalLocale.trim().toLowerCase()
          : null,
      publishedLocales: Array.isArray(record.publishedLocales)
        ? record.publishedLocales
            .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
            .map((locale) => locale.trim().toLowerCase())
        : [],
    });
  }

  return map;
})();

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function expectedCtrByPosition(position: number): number {
  if (position <= 1) return 0.18;
  if (position <= 3) return 0.08;
  if (position <= 5) return 0.045;
  if (position <= 10) return 0.025;
  if (position <= 20) return 0.012;
  return 0.005;
}

function classifyConfidence(row: GscRow): GscOpportunityBoardItem['confidence'] {
  if (row.impressions >= 10 && row.position <= 10) return 'high';
  if (row.impressions >= 4 && row.position <= 12) return 'medium';
  return 'low';
}

function classifyPriority(row: GscRow, confidence: GscOpportunityBoardItem['confidence']): GscOpportunityPriority {
  if (row.impressions >= 10 && row.position <= 5 && row.clicks === 0) return 'P0';
  if (confidence === 'high') return 'P1';
  if (confidence === 'medium') return 'P2';
  return 'P3';
}

function scoreRow(row: GscRow): number {
  const expectedCtr = expectedCtrByPosition(row.position);
  const gap = Math.max(expectedCtr - row.ctr, 0);
  const positionBoost = row.position <= 5 ? 2 : row.position <= 10 ? 1.5 : row.position <= 20 ? 1 : 0.5;
  const zeroClickBoost = row.clicks === 0 ? 1.35 : 1;
  const sparseSignalBoost = row.impressions < 10 && row.position <= 5 ? 1.2 : 1;
  return (
    (gap * Math.max(row.impressions, 1) * 100 + row.impressions * 0.1) *
    positionBoost *
    zeroClickBoost *
    sparseSignalBoost
  );
}

function isWeakIntentQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  const productIntent =
    /\b(ai|agent|agents|skill|skills|mcp|server|servers|automation|workflow|workflows|claude|cursor|windsurf|codex|opencode|ide|developer|tool|tools)\b/i;
  const cjkProductIntent =
    /(智能体|代理|技能|工具|自动化|工作流|服务器|开发者|エージェント|スキル|自動化|ワークフロー)/;
  return !productIntent.test(normalized) && !cjkProductIntent.test(query);
}

function classifyPageLane(row: GscRow): GscOpportunityLane {
  const pageIssue = classifyPageIndexingIssue(row.entity);
  if (pageIssue) return 'canonicalization';
  if (row.position <= 10) return 'metadata';
  if (row.position <= 20) return 'internal-linking';
  return 'content-refresh';
}

function classifyPageIndexingIssue(entity: string): string | null {
  try {
    const url = new URL(entity);
    if (url.hostname !== 'killer-skills.com') {
      return `Non-canonical host ${url.hostname} appears in GSC.`;
    }

    const explicitRedirectTarget = explicitRedirectPathMap.get(url.pathname);
    if (explicitRedirectTarget) {
      return `Explicit 301 consolidation rule exists for this GSC URL (${url.pathname} -> ${explicitRedirectTarget}).`;
    }

    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      return 'Trailing-slash URL variant appears in GSC; canonical runtime should consolidate it to the extensionless path.';
    }

    const utilityPathPattern = /^\/[a-z]{2}\/(?:favorites|history|cookies|privacy|terms)(?:\/|$)/i;
    if (utilityPathPattern.test(url.pathname)) {
      return 'Utility/legal/account-style page appears in GSC and should be checked for intended indexability.';
    }

    const skillPathMatch = url.pathname.match(/^\/([a-z]{2})\/skills\/([^/]+)\/(.+)$/);
    if (skillPathMatch) {
      const requestedLocale = skillPathMatch[1].toLowerCase();
      const owner = decodeURIComponent(skillPathMatch[2] || '')
        .trim()
        .toLowerCase();
      const routePath = (skillPathMatch[3] || '')
        .split('/')
        .map((segment) => decodeURIComponent(segment).trim())
        .filter(Boolean)
        .join('/')
        .toLowerCase();
      if (isSitemapSkillBlocked(owner, routePath, sitemapBlocklist)) {
        return 'Sitemap-blocklisted skill URL appears in GSC and should be left in recrawl/deindex cleanup.';
      }
      const governance = skillLocaleGovernanceMap.get(`${owner}/${routePath}`);
      if (
        governance?.canonicalLocale &&
        governance.canonicalLocale !== requestedLocale &&
        !governance.publishedLocales.includes(requestedLocale)
      ) {
        return `Suppressed locale variant appears in GSC; canonical locale is ${governance.canonicalLocale}.`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function pageActions(row: GscRow): string[] {
  const indexingIssue = classifyPageIndexingIssue(row.entity);
  if (indexingIssue) {
    return [
      `${indexingIssue} Verify robots, canonical, sitemap exclusion, and non-www redirect behavior before any metadata rewrite.`,
      'If the URL should not receive search traffic, keep it out of sitemaps and make the indexability decision explicit.',
    ];
  }

  const actions = [
    'Inspect the rendered title, meta description, H1, canonical, and JSON-LD before editing copy.',
    'Rewrite the snippet around the page-specific use case, install path, and supported workflow instead of generic AI wording.',
  ];

  if (row.position <= 10) {
    actions.push(
      'Treat this as a CTR test first: change title/meta/H1 alignment only, then monitor the next 28-day window.',
    );
  } else {
    actions.push(
      'Add relevant internal links from collections, solutions, or docs before attempting a larger content refresh.',
    );
  }

  if (row.entity.includes('/skills/')) {
    actions.push('Keep the skill name plus category intent visible near the front of the title.');
  }

  return actions;
}

function queryActions(row: GscRow): string[] {
  if (isWeakIntentQuery(row.entity)) {
    return [
      'Do not chase this query directly unless it maps to a strategic AI agent skill page.',
      'Narrow matching snippets with product-intent terms such as AI agent skill, MCP server, workflow automation, or supported IDE.',
    ];
  }

  return [
    'Map this query to the best matching canonical page before editing any metadata.',
    'Mirror the query intent naturally in the page title, meta description, H1, and first paragraph.',
  ];
}

function slugifyId(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function buildPageItem(row: GscRow): GscOpportunityBoardItem {
  const expectedCtr = expectedCtrByPosition(row.position);
  const confidence = classifyConfidence(row);
  const priority = classifyPriority(row, confidence);
  const lane = classifyPageLane(row);

  return {
    id: `page-${slugifyId(row.entity)}`,
    priority,
    lane,
    entityType: 'page',
    entity: row.entity,
    score: scoreRow(row),
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    expectedCtr,
    confidence,
    summary: `${formatInteger(row.impressions)} impressions at position ${row.position.toFixed(1)} with ${formatPercent(row.ctr)} CTR.`,
    evidence: [
      `Expected CTR by position: ${formatPercent(expectedCtr)}`,
      `Click gap: ${formatPercent(Math.max(expectedCtr - row.ctr, 0))}`,
      `Confidence: ${confidence}`,
    ],
    actions: pageActions(row),
  };
}

function buildQueryItem(row: GscRow): GscOpportunityBoardItem {
  const expectedCtr = expectedCtrByPosition(row.position);
  const confidence = classifyConfidence(row);
  const weakIntent = isWeakIntentQuery(row.entity);

  return {
    id: `query-${slugifyId(row.entity)}`,
    priority: weakIntent ? 'P3' : classifyPriority(row, confidence),
    lane: weakIntent ? 'query-intent' : 'metadata',
    entityType: 'query',
    entity: row.entity,
    score: scoreRow(row) * (weakIntent ? 0.65 : 1),
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    expectedCtr,
    confidence,
    summary: `${formatInteger(row.impressions)} impressions at position ${row.position.toFixed(1)} with ${formatPercent(row.ctr)} CTR${weakIntent ? '; weak product intent.' : '.'}`,
    evidence: [
      `Expected CTR by position: ${formatPercent(expectedCtr)}`,
      `Weak intent: ${weakIntent ? 'yes' : 'no'}`,
      `Confidence: ${confidence}`,
    ],
    actions: queryActions(row),
  };
}

function isCandidate(row: GscRow, minImpressions: number): boolean {
  if (row.impressions < minImpressions) return false;
  if (row.position > 20) return false;
  const expectedCtr = expectedCtrByPosition(row.position);
  return row.clicks === 0 || row.ctr < expectedCtr * 0.55;
}

function buildSnapshotPaths(
  trafficJsonPath: string,
  traffic: TrafficReportJson,
): {
  currentQueriesPath: string;
  currentPagesPath: string;
} | null {
  if (!traffic.currentPeriod) return null;

  const reportDir = resolve(toAbsolutePath(trafficJsonPath), '..');
  const snapshotDir = resolve(reportDir, 'snapshots');
  const currentRangeLabel = `${traffic.currentPeriod.start}-to-${traffic.currentPeriod.end}`;

  return {
    currentQueriesPath: resolve(snapshotDir, `${currentRangeLabel}-queries.csv`),
    currentPagesPath: resolve(snapshotDir, `${currentRangeLabel}-pages.csv`),
  };
}

export function buildGscOpportunityBoardReport(input: {
  traffic?: TrafficReportJson | null;
  currentQueries?: GscRow[];
  currentPages?: GscRow[];
  minImpressions?: number;
  limit?: number;
}): GscOpportunityBoardReport {
  const traffic = input.traffic || null;
  const currentQueries = input.currentQueries || [];
  const currentPages = input.currentPages || [];
  const minImpressions = input.minImpressions ?? 2;
  const limit = input.limit ?? 20;

  if (!traffic || String(traffic.status || '').toLowerCase() === 'blocking') {
    const reason = traffic?.failureReason || 'Search Console evidence is unavailable.';
    const nextStep = traffic?.nextStep || 'Restore Search Console access and rerun the GSC fetch job.';

    return {
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      sourceMode: traffic?.sourceMode || null,
      currentPeriod: traffic?.currentPeriod || null,
      previousPeriod: traffic?.previousPeriod || null,
      headline: 'GSC opportunity ranking is blocked by missing traffic evidence.',
      seoComplianceChecks: SEO_COMPLIANCE_CHECKS,
      items: [],
      nextActions: [nextStep],
      blockers: [reason],
    };
  }

  const pageItems = currentPages.filter((row) => isCandidate(row, minImpressions)).map(buildPageItem);
  const queryItems = currentQueries.filter((row) => isCandidate(row, minImpressions)).map(buildQueryItem);
  const items = [...pageItems, ...queryItems]
    .sort((a, b) => {
      const priorityRank = { P0: 4, P1: 3, P2: 2, P3: 1 };
      const priorityDelta = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return b.score - a.score;
    })
    .slice(0, limit);

  const status: GscOpportunityBoardStatus = items.some((item) => item.priority === 'P0' || item.priority === 'P1')
    ? 'active'
    : items.length > 0
      ? 'watch'
      : 'watch';

  const pageCount = items.filter((item) => item.entityType === 'page').length;
  const queryCount = items.filter((item) => item.entityType === 'query').length;

  return {
    generatedAt: new Date().toISOString(),
    status,
    sourceMode: traffic.sourceMode || null,
    currentPeriod: traffic.currentPeriod || null,
    previousPeriod: traffic.previousPeriod || null,
    headline:
      items.length > 0
        ? `Found ${items.length} sparse-signal CTR opportunities (${pageCount} pages, ${queryCount} queries).`
        : 'No sparse-signal CTR opportunities were found in the current GSC window.',
    seoComplianceChecks: SEO_COMPLIANCE_CHECKS,
    items,
    nextActions: [
      'Review P0/P1 pages first; change only title/meta/H1 alignment when the page already ranks on page one.',
      'Keep weak-intent queries as narrowing signals, not expansion targets.',
      'Rerun production crawl health after metadata changes to confirm canonical, robots, and sitemap compliance.',
    ],
    blockers: [],
  };
}

export function buildGscOpportunityBoardFromFiles(
  options: GscOpportunityBoardFileOptions = {},
): GscOpportunityBoardReport {
  const trafficJsonPath = options.trafficJsonPath || DEFAULT_TRAFFIC_REPORT_JSON_PATH;
  const traffic = readJsonFile<TrafficReportJson>(trafficJsonPath);

  if (!traffic || String(traffic.status || '').toLowerCase() === 'blocking') {
    return buildGscOpportunityBoardReport({ traffic });
  }

  const paths = buildSnapshotPaths(trafficJsonPath, traffic);
  if (!paths) {
    return buildGscOpportunityBoardReport({
      traffic: {
        ...traffic,
        status: 'blocking',
        failureReason: 'GSC report JSON does not include a current period for snapshot lookup.',
        nextStep: 'Regenerate the GSC report with currentPeriod metadata.',
      },
    });
  }

  const queryCsv = readTextFile(paths.currentQueriesPath);
  const pageCsv = readTextFile(paths.currentPagesPath);
  if (!queryCsv || !pageCsv) {
    return buildGscOpportunityBoardReport({
      traffic: {
        ...traffic,
        status: 'blocking',
        failureReason: 'GSC snapshot CSV files are missing for the current period.',
        nextStep: 'Rerun `npm run report:gsc:fetch` so query and page snapshots are available.',
      },
    });
  }

  return buildGscOpportunityBoardReport({
    traffic,
    currentQueries: parseGscCsv(queryCsv),
    currentPages: parseGscCsv(pageCsv),
  });
}

export function renderGscOpportunityBoardReport(report: GscOpportunityBoardReport): string {
  const lines = [
    '# GSC Opportunity Board',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Source mode: ${report.sourceMode || 'n/a'}`,
    `- Current period: ${report.currentPeriod ? `${report.currentPeriod.start} to ${report.currentPeriod.end}` : 'n/a'}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Search Engine Compliance Checks',
    '',
    ...report.seoComplianceChecks.map((check) => `- ${check}`),
    '',
  ];

  if (report.blockers.length > 0) {
    lines.push('## Blockers', '', ...report.blockers.map((blocker) => `- ${blocker}`), '');
  }

  lines.push('## Opportunities', '');
  if (report.items.length === 0) {
    lines.push('No actionable items in this window.', '');
  } else {
    for (const item of report.items) {
      lines.push(`1. [${item.priority}] ${item.entityType}: ${item.entity}`);
      lines.push(`   - Lane: ${item.lane}`);
      lines.push(`   - Score: ${item.score.toFixed(1)}`);
      lines.push(`   - Summary: ${item.summary}`);
      lines.push(`   - Evidence: ${item.evidence.join(' | ')}`);
      for (const action of item.actions) {
        lines.push(`   - Action: ${action}`);
      }
      lines.push('');
    }
  }

  lines.push('## Next Actions', '', ...report.nextActions.map((action) => `- ${action}`), '');
  return lines.join('\n');
}

export function writeGscOpportunityBoardArtifacts(
  report: GscOpportunityBoardReport,
  options: { markdownOutputPath?: string; jsonOutputPath?: string } = {},
): void {
  writeTextFile(
    options.markdownOutputPath || DEFAULT_GSC_OPPORTUNITY_BOARD_MD_PATH,
    renderGscOpportunityBoardReport(report),
  );
  writeTextFile(
    options.jsonOutputPath || DEFAULT_GSC_OPPORTUNITY_BOARD_JSON_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
