#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  discoverCoverageDrilldownSourceDirectories,
  parseCoverageDrilldownCsv,
  parseCoverageDrilldownDirectoryDate,
  resolveCoverageDrilldownCsvPaths,
  type CoverageDrilldownCsvPaths,
} from './lib/coverage-drilldown-source';
import { countExtraSkillSegments, hasRepeatedSegment, isSourceFilePathname } from './lib/coverage-url-classification';

type CsvRow = string[];

type FreshnessStatus = 'fresh' | 'warning' | 'blocking' | 'missing';

type CoverageIssue = {
  folderName: string;
  folderPath: string;
  issueName: string;
  sourceLabel: string;
  affectedPages: number;
  sampleRows: CoverageUrlRow[];
  detectedDate: string | null;
  detectedAgeDays: number | null;
  newestFileModifiedAt: string | null;
  freshness: FreshnessStatus;
};

type CoverageUrlRow = {
  url: string;
  lastCrawled: string;
  cluster: ClusterId;
};

type ClusterId =
  | 'query_parameter'
  | 'legacy_html'
  | 'source_file_path'
  | 'deep_skill_path'
  | 'trailing_slash'
  | 'repeated_segment'
  | 'sandbox_path'
  | 'other';

type ClusterStats = {
  cluster: ClusterId;
  sampleCount: number;
  estimatedAffected: number;
  weightedImpact: number;
  issueNames: string[];
  topSamples: string[];
};

type IssueScoreConfig = {
  severityWeight: number;
  label: string;
};

type CoverageSourceSnapshot = {
  directory: string;
  folderName: string;
  issueName: string;
  sourceLabel: string;
  affectedPages: number;
  detectedDate: string | null;
  ageDays: number | null;
  newestFileModifiedAt: string | null;
  freshness: FreshnessStatus;
};

type DrilldownReport = {
  generatedAt: string;
  directories: string[];
  issueCount: number;
  totalAffectedPages: number;
  sourceFreshnessStatus: FreshnessStatus;
  sourceFreshnessDate: string | null;
  sourceFreshnessDays: number | null;
  sourcePreferredWindowDays: number;
  sourceMaxWindowDays: number;
  sourceFreshnessSummary: string;
  sources: CoverageSourceSnapshot[];
  issueSummaries: Array<{
    issueName: string;
    sourceLabel: string;
    affectedPages: number;
    sampleCount: number;
    detectedDate: string | null;
    freshness: FreshnessStatus;
    topClusters: Array<{ cluster: ClusterId; sampleCount: number; estimatedAffected: number }>;
  }>;
  clusterPriorities: ClusterStats[];
  recommendations: Array<{ cluster: ClusterId; title: string; action: string }>;
};

const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-drilldown.md');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-drilldown.json');

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_WARNING_AFTER_DAYS = Number(process.env.SEO_COVERAGE_SOURCE_WARNING_DAYS || 3) || 3;
const SOURCE_MAX_AFTER_DAYS = Number(process.env.SEO_COVERAGE_SOURCE_MAX_DAYS || 7) || 7;

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

const CLUSTER_RECOMMENDATIONS: Record<ClusterId, { title: string; action: string }> = {
  query_parameter: {
    title: '收敛参数索引入口',
    action:
      '仅保留白名单参数（q/query/category/view/owner/topic/page），其余参数 301 到干净 URL；继续对参数页维持 noindex,follow。',
  },
  legacy_html: {
    title: '清理旧 .html 链接',
    action: '将 /blog/*.html 统一 301 到无扩展名路径，并修正站内历史链接与 sitemap 来源。',
  },
  source_file_path: {
    title: '阻断源码文件抓取',
    action: '保持 404/410 + X-Robots-Tag:noindex，并在入口页避免输出指向源码文件的技能详情链接。',
  },
  deep_skill_path: {
    title: '压制深层技能路径陷阱',
    action: '继续拦截 owner/repo 之后 2 段以上路径；对可判定父路径的请求返回 301 到父技能页。',
  },
  trailing_slash: {
    title: '统一尾斜杠规范',
    action: '保持全站 trailing-slash never 的 301 规则，同时确保 canonical 和内部链接不再带末尾斜杠。',
  },
  repeated_segment: {
    title: '修复重复片段 URL',
    action: '识别并 301 到去重后的规范路径；无法判定映射时返回 410，减少重复抓取消耗。',
  },
  sandbox_path: {
    title: '隔离 sandbox 抓取',
    action: '为 sandbox 路径统一 noindex，并从对外入口和 sitemap 中移除该路径。',
  },
  other: {
    title: '补充人工归因',
    action: '对其余样本按最后抓取时间和访问来源做二次抽样，沉淀新的自动规则。',
  },
};

function parseArgs(argv: string[]): { inputDirs: string[]; now?: string } {
  const dirs: string[] = [];
  let now: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      dirs.push(resolve(argv[i + 1]));
      i++;
      continue;
    }
    if (arg === '--now' && argv[i + 1]) {
      now = argv[i + 1];
      i++;
    }
  }

  return { inputDirs: dirs, now };
}

function normalizeNow(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function findDefaultInputDirs(): string[] {
  return discoverCoverageDrilldownSourceDirectories().map((source) => source.directoryPath);
}

function parseMetadata(csvPaths: CoverageDrilldownCsvPaths): { issueName: string; sourceLabel: string } {
  const rows = parseCoverageDrilldownCsv(readFileSync(csvPaths.metadata, 'utf8')) as CsvRow[];
  const metadata = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const key = row[0] || '';
    const value = row[1] || '';
    if (key) metadata.set(key, value);
  }
  return {
    issueName: metadata.get('问题名称') || '未知问题',
    sourceLabel: metadata.get('站点地图') || '未知来源',
  };
}

function parseAffectedPages(csvPaths: CoverageDrilldownCsvPaths): number {
  const rows = parseCoverageDrilldownCsv(readFileSync(csvPaths.chart, 'utf8')) as CsvRow[];
  if (rows.length <= 1) return 0;

  let latestCount = 0;
  for (const row of rows.slice(1)) {
    const value = Number(row[1] || '0');
    if (Number.isFinite(value)) latestCount = value;
  }
  return latestCount;
}

function classifyUrl(url: string): ClusterId {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }

  const pathname = parsed.pathname;
  const hasQuery = parsed.searchParams.size > 0;

  if (hasQuery) return 'query_parameter';
  if (/\/blog\/.+\.html$/i.test(pathname)) return 'legacy_html';
  if (isSourceFilePathname(pathname, /\.(md|ts|js|py|json|go|yaml|yml|toml|rs|rb|css|xml|txt)$/i))
    return 'source_file_path';
  if (countExtraSkillSegments(pathname) >= 2) return 'deep_skill_path';
  if (pathname.length > 1 && pathname.endsWith('/')) return 'trailing_slash';
  if (hasRepeatedSegment(pathname)) return 'repeated_segment';
  if (/\/sandbox\//i.test(pathname)) return 'sandbox_path';
  return 'other';
}

function parseSampleRows(csvPaths: CoverageDrilldownCsvPaths): CoverageUrlRow[] {
  const rows = parseCoverageDrilldownCsv(readFileSync(csvPaths.table, 'utf8')) as CsvRow[];
  const dataRows: CoverageUrlRow[] = [];
  for (const row of rows.slice(1)) {
    const url = row[0] || '';
    if (!url) continue;
    dataRows.push({
      url,
      lastCrawled: row[1] || '',
      cluster: classifyUrl(url),
    });
  }
  return dataRows;
}

function toDateAgeDays(now: Date, value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / DAY_MS));
}

function detectNewestFileModifiedAt(csvPaths: CoverageDrilldownCsvPaths): string | null {
  let newestTime = 0;
  for (const filePath of Object.values(csvPaths)) {
    try {
      const stat = statSync(filePath);
      newestTime = Math.max(newestTime, stat.mtime.getTime());
    } catch {
      continue;
    }
  }

  return newestTime > 0 ? new Date(newestTime).toISOString() : null;
}

function classifyFreshness(ageDays: number | null): FreshnessStatus {
  if (ageDays === null) return 'missing';
  if (ageDays > SOURCE_MAX_AFTER_DAYS) return 'blocking';
  if (ageDays > SOURCE_WARNING_AFTER_DAYS) return 'warning';
  return 'fresh';
}

function freshnessLabel(status: FreshnessStatus): string {
  switch (status) {
    case 'fresh':
      return 'FRESH';
    case 'warning':
      return 'WARNING';
    case 'blocking':
      return 'BLOCKING';
    default:
      return 'MISSING';
  }
}

function formatAgeDays(ageDays: number | null): string {
  return ageDays === null ? 'n/a' : `${ageDays} day(s)`;
}

function buildFreshnessSummary(status: FreshnessStatus, date: string | null, ageDays: number | null): string {
  if (!date) {
    return 'No raw Coverage Drilldown export date could be detected from the local source directories.';
  }
  if (status === 'fresh') {
    return `Newest raw Coverage Drilldown export is ${date} (${formatAgeDays(ageDays)} old), inside the preferred freshness window.`;
  }
  if (status === 'warning') {
    return `Newest raw Coverage Drilldown export is ${date} (${formatAgeDays(ageDays)} old), inside the hard 7-day SLA but outside the preferred freshness window.`;
  }
  return `Newest raw Coverage Drilldown export is ${date} (${formatAgeDays(ageDays)} old), outside the hard 7-day freshness SLA.`;
}

function getIssueScoreConfig(issueName: string): IssueScoreConfig {
  if (issueName.includes('服务器错误')) return { severityWeight: 1.9, label: 'P0 可用性' };
  if (issueName.includes('未找到')) return { severityWeight: 1.7, label: 'P0 索引损耗' };
  if (issueName.includes('已抓取 - 尚未编入索引')) return { severityWeight: 1.35, label: 'P1 质量/稳定性' };
  if (issueName.includes('自动重定向')) return { severityWeight: 1.2, label: 'P1 规范化' };
  if (issueName.includes('Google 选择的规范网页与用户指定的不同'))
    return { severityWeight: 1.15, label: 'P1 规范冲突' };
  if (issueName.includes('用户未选定规范网页')) return { severityWeight: 1.05, label: 'P2 去重' };
  if (issueName.includes('noindex')) return { severityWeight: 0.95, label: 'P2 索引策略' };
  if (issueName.includes('备用网页')) return { severityWeight: 0.9, label: 'P3 观察项' };
  return { severityWeight: 1, label: 'P2 通用' };
}

function loadIssues(inputDirs: string[], now: Date): CoverageIssue[] {
  return inputDirs.flatMap((dir) => {
    const csvPaths = resolveCoverageDrilldownCsvPaths(dir);
    if (!csvPaths) return [];

    const metadata = parseMetadata(csvPaths);
    const detectedDate = parseCoverageDrilldownDirectoryDate(dir);
    const detectedAgeDays = toDateAgeDays(now, detectedDate);
    return [
      {
        folderName: basename(dir),
        folderPath: dir,
        issueName: metadata.issueName,
        sourceLabel: metadata.sourceLabel,
        affectedPages: parseAffectedPages(csvPaths),
        sampleRows: parseSampleRows(csvPaths),
        detectedDate,
        detectedAgeDays,
        newestFileModifiedAt: detectNewestFileModifiedAt(csvPaths),
        freshness: classifyFreshness(detectedAgeDays),
      },
    ];
  });
}

function buildClusterPriorities(issues: CoverageIssue[]): ClusterStats[] {
  const clusterMap = new Map<ClusterId, ClusterStats>();
  const issueNamesByCluster = new Map<ClusterId, Set<string>>();
  const samplesByCluster = new Map<ClusterId, Set<string>>();

  for (const issue of issues) {
    const issueSampleCount = issue.sampleRows.length;
    if (issueSampleCount === 0) continue;

    const scoreConfig = getIssueScoreConfig(issue.issueName);
    const clusterCounts = new Map<ClusterId, number>();
    for (const row of issue.sampleRows) {
      clusterCounts.set(row.cluster, (clusterCounts.get(row.cluster) || 0) + 1);
    }

    for (const [cluster, sampleCount] of clusterCounts.entries()) {
      const estimatedAffected = issueSampleCount > 0 ? (issue.affectedPages * sampleCount) / issueSampleCount : 0;
      const weightedImpact = estimatedAffected * scoreConfig.severityWeight;
      const current = clusterMap.get(cluster) || {
        cluster,
        sampleCount: 0,
        estimatedAffected: 0,
        weightedImpact: 0,
        issueNames: [],
        topSamples: [],
      };

      current.sampleCount += sampleCount;
      current.estimatedAffected += estimatedAffected;
      current.weightedImpact += weightedImpact;
      clusterMap.set(cluster, current);

      if (!issueNamesByCluster.has(cluster)) issueNamesByCluster.set(cluster, new Set<string>());
      issueNamesByCluster.get(cluster)!.add(`${issue.issueName}（${scoreConfig.label}）`);

      if (!samplesByCluster.has(cluster)) samplesByCluster.set(cluster, new Set<string>());
      const clusterSamples = issue.sampleRows.filter((row) => row.cluster === cluster).map((row) => row.url);
      for (const sample of clusterSamples.slice(0, 6)) {
        samplesByCluster.get(cluster)!.add(sample);
      }
    }
  }

  return Array.from(clusterMap.values())
    .map((item) => ({
      ...item,
      issueNames: Array.from(issueNamesByCluster.get(item.cluster) || []),
      topSamples: Array.from(samplesByCluster.get(item.cluster) || []).slice(0, 6),
      estimatedAffected: Number(item.estimatedAffected.toFixed(1)),
      weightedImpact: Number(item.weightedImpact.toFixed(1)),
    }))
    .sort((a, b) => b.weightedImpact - a.weightedImpact);
}

function summarizeIssue(issue: CoverageIssue) {
  const issueSampleCount = issue.sampleRows.length;
  const clusterCounts = new Map<ClusterId, number>();
  for (const row of issue.sampleRows) {
    clusterCounts.set(row.cluster, (clusterCounts.get(row.cluster) || 0) + 1);
  }

  const topClusters = Array.from(clusterCounts.entries())
    .map(([cluster, sampleCount]) => ({
      cluster,
      sampleCount,
      estimatedAffected:
        issueSampleCount > 0 ? Number(((issue.affectedPages * sampleCount) / issueSampleCount).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount)
    .slice(0, 4);

  return {
    issueName: issue.issueName,
    sourceLabel: issue.sourceLabel,
    affectedPages: issue.affectedPages,
    sampleCount: issueSampleCount,
    detectedDate: issue.detectedDate,
    freshness: issue.freshness,
    topClusters,
  };
}

function compareSourceSnapshots(a: CoverageSourceSnapshot, b: CoverageSourceSnapshot): number {
  const aDate = a.detectedDate || '';
  const bDate = b.detectedDate || '';
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  return a.folderName.localeCompare(b.folderName, 'zh-Hans-CN');
}

function buildReport(issues: CoverageIssue[], inputDirs: string[], now: Date): DrilldownReport {
  const clusterPriorities = buildClusterPriorities(issues);
  const sources = issues
    .map<CoverageSourceSnapshot>((issue) => ({
      directory: issue.folderPath,
      folderName: issue.folderName,
      issueName: issue.issueName,
      sourceLabel: issue.sourceLabel,
      affectedPages: issue.affectedPages,
      detectedDate: issue.detectedDate,
      ageDays: issue.detectedAgeDays,
      newestFileModifiedAt: issue.newestFileModifiedAt,
      freshness: issue.freshness,
    }))
    .sort(compareSourceSnapshots);

  const freshestSource = sources.find((source) => Boolean(source.detectedDate)) || null;
  const sourceFreshnessDate = freshestSource?.detectedDate || null;
  const sourceFreshnessDays = freshestSource?.ageDays ?? null;
  const sourceFreshnessStatus = sources.length === 0 ? 'missing' : freshestSource?.freshness || 'missing';

  return {
    generatedAt: now.toISOString(),
    directories: inputDirs,
    issueCount: issues.length,
    totalAffectedPages: issues.reduce((sum, issue) => sum + issue.affectedPages, 0),
    sourceFreshnessStatus,
    sourceFreshnessDate,
    sourceFreshnessDays,
    sourcePreferredWindowDays: SOURCE_WARNING_AFTER_DAYS,
    sourceMaxWindowDays: SOURCE_MAX_AFTER_DAYS,
    sourceFreshnessSummary: buildFreshnessSummary(sourceFreshnessStatus, sourceFreshnessDate, sourceFreshnessDays),
    sources,
    issueSummaries: issues.map((issue) => summarizeIssue(issue)).sort((a, b) => b.affectedPages - a.affectedPages),
    clusterPriorities,
    recommendations: clusterPriorities.slice(0, 6).map((item) => ({
      cluster: item.cluster,
      title: CLUSTER_RECOMMENDATIONS[item.cluster].title,
      action: CLUSTER_RECOMMENDATIONS[item.cluster].action,
    })),
  };
}

function renderMarkdown(report: DrilldownReport): string {
  const lines: string[] = [];
  lines.push('# SEO Coverage Drilldown Report');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Drilldown folders: ${report.issueCount}`);
  lines.push(`- Total affected pages (GSC issue totals): ${report.totalAffectedPages}`);
  lines.push(`- Source directories scanned: ${report.directories.length}`);
  lines.push(
    `- Raw-source freshness: ${freshnessLabel(report.sourceFreshnessStatus)} (${report.sourceFreshnessStatus})`,
  );
  lines.push(`- Freshest raw export: ${report.sourceFreshnessDate || 'missing'}`);
  lines.push(`- Freshest raw export age: ${formatAgeDays(report.sourceFreshnessDays)}`);
  lines.push(
    `- Freshness SLA: preferred <= ${report.sourcePreferredWindowDays} day(s); blocking > ${report.sourceMaxWindowDays} day(s)`,
  );
  lines.push('');
  lines.push('## Source Freshness');
  lines.push('');
  lines.push(`- Summary: ${report.sourceFreshnessSummary}`);
  for (const source of report.sources) {
    lines.push(
      `- ${source.folderName} | freshness=${source.freshness} | detectedDate=${source.detectedDate || 'missing'} | age=${formatAgeDays(source.ageDays)} | affected=${source.affectedPages}`,
    );
    lines.push(`  - Issue: ${source.issueName} | Source label: ${source.sourceLabel}`);
    lines.push(`  - Directory: ${source.directory}`);
    if (source.newestFileModifiedAt) {
      lines.push(`  - Newest CSV modified: ${source.newestFileModifiedAt}`);
    }
  }
  lines.push('');
  lines.push('## Issue Snapshot');
  lines.push('');
  for (const issue of report.issueSummaries) {
    const scoreConfig = getIssueScoreConfig(issue.issueName);
    lines.push(
      `- ${issue.issueName} | affected=${issue.affectedPages} | sample=${issue.sampleCount} | severity=${scoreConfig.label} | rawDate=${issue.detectedDate || 'missing'} | freshness=${issue.freshness}`,
    );
  }
  lines.push('');
  lines.push('## Cluster Priority');
  lines.push('');
  for (const cluster of report.clusterPriorities) {
    lines.push(
      `- ${CLUSTER_LABELS[cluster.cluster]} (${cluster.cluster}) | weightedImpact=${cluster.weightedImpact} | estimatedAffected=${cluster.estimatedAffected} | sample=${cluster.sampleCount}`,
    );
    lines.push(`  - Issue scope: ${cluster.issueNames.join('；') || 'n/a'}`);
    if (cluster.topSamples.length > 0) {
      lines.push(`  - Sample URLs: ${cluster.topSamples.slice(0, 3).join(' | ')}`);
    }
  }
  lines.push('');
  lines.push('## Recommended Actions');
  lines.push('');
  for (const recommendation of report.recommendations) {
    lines.push(`1. [${CLUSTER_LABELS[recommendation.cluster]}] ${recommendation.title}`);
    lines.push(recommendation.action);
  }

  return `${lines.join('\n')}\n`;
}

function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = normalizeNow(args.now);
  const inputDirs = args.inputDirs.length > 0 ? args.inputDirs : findDefaultInputDirs();

  if (inputDirs.length === 0) {
    console.error(
      [
        'No coverage drilldown directories found.',
        'Pass inputs explicitly, for example:',
        'npx tsx scripts/seo-coverage-drilldown.ts --input "/Users/<you>/Downloads/killer-skills.com-Coverage-Drilldown-2026-04-08"',
      ].join('\n'),
    );
    process.exit(1);
  }

  const validatedDirs = inputDirs.filter((dir) => Boolean(resolveCoverageDrilldownCsvPaths(dir)));

  if (validatedDirs.length === 0) {
    console.error('No valid input directories remain after validation.');
    process.exit(1);
  }

  const issues = loadIssues(validatedDirs, now);
  const report = buildReport(issues, validatedDirs, now);
  const markdown = renderMarkdown(report);

  ensureDirectory(REPORT_DIR);
  writeFileSync(MD_OUTPUT, markdown, 'utf8');
  writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Wrote coverage drilldown report to ${MD_OUTPUT}`);
  console.log(`Wrote coverage drilldown JSON to ${JSON_OUTPUT}`);
  console.log(`Issues analyzed: ${report.issueCount}`);
  console.log(
    `Raw-source freshness: ${freshnessLabel(report.sourceFreshnessStatus)} (${report.sourceFreshnessDate || 'missing'})`,
  );
  console.log(
    `Top cluster: ${report.clusterPriorities[0] ? CLUSTER_LABELS[report.clusterPriorities[0].cluster] : 'n/a'}`,
  );
}

main();
