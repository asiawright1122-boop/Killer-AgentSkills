#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  compareGscSnapshots,
  findCtrOpportunities,
  findQueryPrecisionRisks,
  formatPercent,
  type GscComparison,
  type GscOpportunity,
  type GscReportType,
  type GscRow,
  type QueryPrecisionRisk,
} from '../src/lib/gsc-report';

dotenv.config();
const localEnv = resolve(process.cwd(), '.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

type Dimension = 'query' | 'page';
type ReportStatus = 'clear' | 'warning' | 'blocking';
type GscSourceMode = 'live-api' | 'missing-config' | 'request-failed';

type Config = {
  clientEmail: string;
  privateKey: string;
  siteUrl: string;
  days: number;
  rowLimit: number;
  outputDir: string;
};

type ConfigResolution = {
  config: Config | null;
  missingEnv: string[];
  outputDir: string;
  siteUrl: string | null;
};

type Period = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
};

type SearchAnalyticsApiRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchAnalyticsApiResponse = {
  rows?: SearchAnalyticsApiRow[];
};

type GscReportArtifact = {
  generatedAt: string;
  status: ReportStatus;
  sourceMode: GscSourceMode;
  site: string | null;
  currentPeriod: { start: string; end: string } | null;
  previousPeriod: { start: string; end: string } | null;
  queryRows: number | null;
  pageRows: number | null;
  priorityQueryOpportunities: number | null;
  priorityPageOpportunities: number | null;
  queryPrecisionRisks: number | null;
  failureReason: string | null;
  nextStep: string | null;
};

function getConfig(): ConfigResolution {
  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const siteUrl = (process.env.GSC_SITE_URL || '').trim();
  const outputDir = resolve(process.env.GSC_OUTPUT_DIR || 'reports/gsc');

  const missingEnv = [
    !clientEmail ? 'GSC_CLIENT_EMAIL' : null,
    !privateKey ? 'GSC_PRIVATE_KEY' : null,
    !siteUrl ? 'GSC_SITE_URL' : null,
  ].filter((value): value is string => Boolean(value));

  if (missingEnv.length > 0) {
    return {
      config: null,
      missingEnv,
      outputDir,
      siteUrl: siteUrl || null,
    };
  }

  return {
    config: {
      clientEmail,
      privateKey,
      siteUrl,
      days: Number(process.env.GSC_REPORT_DAYS || 7) || 7,
      rowLimit: Number(process.env.GSC_ROW_LIMIT || 250) || 250,
      outputDir,
    },
    missingEnv: [],
    outputDir,
    siteUrl,
  };
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getPeriods(days: number): Period {
  const today = new Date();
  const currentEndDate = shiftUtcDays(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
    -1,
  );
  const currentStartDate = shiftUtcDays(currentEndDate, -(days - 1));
  const previousEndDate = shiftUtcDays(currentStartDate, -1);
  const previousStartDate = shiftUtcDays(previousEndDate, -(days - 1));

  return {
    currentStart: formatDateUtc(currentStartDate),
    currentEnd: formatDateUtc(currentEndDate),
    previousStart: formatDateUtc(previousStartDate),
    previousEnd: formatDateUtc(previousEndDate),
  };
}

async function fetchAccessToken(config: Config): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: config.clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = base64UrlEncode(signer.sign(config.privateKey));
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google OAuth token (${response.status})`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Google OAuth token response did not include access_token');
  }

  return data.access_token;
}

async function fetchDimensionRows(
  config: Config,
  accessToken: string,
  dimension: Dimension,
  startDate: string,
  endDate: string,
): Promise<GscRow[]> {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: config.rowLimit,
      dataState: 'final',
      aggregationType: 'auto',
      type: 'web',
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Search Console API request failed for ${dimension} (${response.status}): ${details}`);
  }

  const data = (await response.json()) as SearchAnalyticsApiResponse;
  return (data.rows || []).map((row) => ({
    entity: row.keys?.[0] || '',
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
  }));
}

function quoteCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: GscRow[], type: GscReportType): string {
  const entityHeader = type === 'query' ? 'Query' : 'Page';
  return [
    `${entityHeader},Clicks,Impressions,CTR,Position`,
    ...rows.map((row) =>
      [
        quoteCsv(row.entity),
        row.clicks,
        row.impressions,
        `${(row.ctr * 100).toFixed(2)}%`,
        row.position.toFixed(2),
      ].join(','),
    ),
  ].join('\n');
}

function summarize(opportunities: GscOpportunity[]): string[] {
  return opportunities.slice(0, 5).map((item) => {
    return `- ${item.entity} | ${item.impressions} impressions | ${formatPercent(item.ctr)} CTR | pos ${item.position.toFixed(1)}`;
  });
}

function renderSection(title: string, opportunities: GscOpportunity[]): string {
  if (opportunities.length === 0) {
    return `## ${title}\n\nNo priority opportunities found.\n`;
  }

  const lines = opportunities.map((item, index) =>
    [
      `${index + 1}. \`${item.entity}\``,
      `   - Metrics: ${item.clicks} clicks, ${item.impressions} impressions, ${formatPercent(item.ctr)} CTR, position ${item.position.toFixed(1)}`,
      `   - Gap: expected about ${formatPercent(item.expectedCtr)}, short by ${formatPercent(item.gap)}`,
      `   - Focus: ${item.bucket === 'ctr' ? 'Snippet / title CTR' : item.bucket === 'ranking' ? 'Ranking + snippet' : 'Monitor'}`,
      ...item.actions.map((action) => `   - Action: ${action}`),
    ].join('\n'),
  );

  return `## ${title}\n\n${lines.join('\n\n')}\n`;
}

function renderComparisonSection(title: string, comparisons: GscComparison[]): string {
  if (comparisons.length === 0) {
    return `## ${title}\n\nNo comparable rows found.\n`;
  }

  const lines = comparisons.map((item, index) => {
    const previous = item.previous;
    const previousMetrics = previous
      ? `${previous.clicks} clicks, ${previous.impressions} impressions, ${formatPercent(previous.ctr)} CTR, position ${previous.position.toFixed(1)}`
      : 'no previous row';

    return [
      `${index + 1}. \`${item.entity}\``,
      `   - Status: ${item.status}`,
      `   - Current: ${item.current.clicks} clicks, ${item.current.impressions} impressions, ${formatPercent(item.current.ctr)} CTR, position ${item.current.position.toFixed(1)}`,
      `   - Previous: ${previousMetrics}`,
      `   - Delta: ${item.deltaClicks >= 0 ? '+' : ''}${item.deltaClicks} clicks, ${item.deltaImpressions >= 0 ? '+' : ''}${item.deltaImpressions} impressions, ${item.deltaCtr >= 0 ? '+' : ''}${formatPercent(item.deltaCtr)}, ${item.deltaPosition >= 0 ? '+' : ''}${item.deltaPosition.toFixed(1)} position`,
    ].join('\n');
  });

  return `## ${title}\n\n${lines.join('\n\n')}\n`;
}

function renderPrecisionSection(title: string, risks: QueryPrecisionRisk[]): string {
  if (risks.length === 0) {
    return `## ${title}\n\nNo obvious query-precision risks found in this period.\n`;
  }

  const lines = risks.map((item, index) =>
    [
      `${index + 1}. \`${item.entity}\``,
      `   - Metrics: ${item.clicks} clicks, ${item.impressions} impressions, ${formatPercent(item.ctr)} CTR, position ${item.position.toFixed(1)}`,
      `   - Risk: ${item.issue}`,
      `   - Why: ${item.reason}`,
      ...item.actions.map((action) => `   - Action: ${action}`),
    ].join('\n'),
  );

  return `## ${title}\n\n${lines.join('\n\n')}\n`;
}

function buildSuccessArtifact(
  currentQueries: GscRow[],
  previousQueries: GscRow[],
  currentPages: GscRow[],
  previousPages: GscRow[],
  periods: Period,
  siteUrl: string,
): { artifact: GscReportArtifact; sections: string } {
  const queryOpportunities = findCtrOpportunities(currentQueries, 'query', 15);
  const pageOpportunities = findCtrOpportunities(currentPages, 'page', 15);
  const queryComparisons = compareGscSnapshots(currentQueries, previousQueries, 15);
  const pageComparisons = compareGscSnapshots(currentPages, previousPages, 15);
  const queryPrecisionRisks = findQueryPrecisionRisks(currentQueries, 15);
  const quickWins = [...summarize(queryOpportunities), ...summarize(pageOpportunities).slice(0, 3)];

  return {
    artifact: {
      generatedAt: new Date().toISOString(),
      status: 'clear',
      sourceMode: 'live-api',
      site: siteUrl,
      currentPeriod: { start: periods.currentStart, end: periods.currentEnd },
      previousPeriod: { start: periods.previousStart, end: periods.previousEnd },
      queryRows: currentQueries.length,
      pageRows: currentPages.length,
      priorityQueryOpportunities: queryOpportunities.length,
      priorityPageOpportunities: pageOpportunities.length,
      queryPrecisionRisks: queryPrecisionRisks.length,
      failureReason: null,
      nextStep: null,
    },
    sections: [
      '## Quick Wins',
      '',
      ...(quickWins.length > 0 ? quickWins : ['- No obvious quick wins in the current periods.']),
      '',
      renderPrecisionSection('Query Precision Risks', queryPrecisionRisks),
      renderSection('Query Opportunities', queryOpportunities),
      renderSection('Page Opportunities', pageOpportunities),
      renderComparisonSection('Query Period Comparison', queryComparisons),
      renderComparisonSection('Page Period Comparison', pageComparisons),
    ].join('\n'),
  };
}

function buildBlockingArtifact(options: {
  sourceMode: GscSourceMode;
  siteUrl: string | null;
  reason: string;
  nextStep: string;
}): GscReportArtifact {
  return {
    generatedAt: new Date().toISOString(),
    status: 'blocking',
    sourceMode: options.sourceMode,
    site: options.siteUrl,
    currentPeriod: null,
    previousPeriod: null,
    queryRows: null,
    pageRows: null,
    priorityQueryOpportunities: null,
    priorityPageOpportunities: null,
    queryPrecisionRisks: null,
    failureReason: options.reason,
    nextStep: options.nextStep,
  };
}

function formatOptionalNumber(value: number | null): string {
  return value === null ? 'n/a' : String(value);
}

function formatOptionalPeriod(period: { start: string; end: string } | null): string {
  return period ? `${period.start} to ${period.end}` : 'n/a';
}

function renderReportMarkdown(artifact: GscReportArtifact, sections = ''): string {
  const lines = [
    '# GSC CTR Report',
    '',
    '## Summary',
    '',
    `- Generated: ${artifact.generatedAt}`,
    `- Status: ${artifact.status}`,
    `- Source mode: ${artifact.sourceMode}`,
    `- Site: ${artifact.site || 'n/a'}`,
    `- Current period: ${formatOptionalPeriod(artifact.currentPeriod)}`,
    `- Previous period: ${formatOptionalPeriod(artifact.previousPeriod)}`,
    `- Query rows: ${formatOptionalNumber(artifact.queryRows)}`,
    `- Page rows: ${formatOptionalNumber(artifact.pageRows)}`,
    `- Priority query opportunities: ${formatOptionalNumber(artifact.priorityQueryOpportunities)}`,
    `- Priority page opportunities: ${formatOptionalNumber(artifact.priorityPageOpportunities)}`,
    `- Query precision risks: ${formatOptionalNumber(artifact.queryPrecisionRisks)}`,
  ];

  if (artifact.failureReason) {
    lines.push(`- Failure reason: ${artifact.failureReason}`);
  }
  if (artifact.nextStep) {
    lines.push(`- Next step: ${artifact.nextStep}`);
  }

  if (artifact.status === 'blocking') {
    lines.push('', '## Blocking Reason', '', artifact.failureReason || 'Unknown blocking reason.');
    if (artifact.nextStep) {
      lines.push('', '## Next Step', '', artifact.nextStep);
    }
  } else if (sections.trim()) {
    lines.push('', sections.trimEnd());
  }

  return `${lines.join('\n')}\n`;
}

function renderMonitoringSkippedMarkdown(artifact: GscReportArtifact): string {
  return [
    '# SEO Monitoring Skipped',
    '',
    `- Generated: ${artifact.generatedAt}`,
    `- Status: ${artifact.status}`,
    `- Source mode: ${artifact.sourceMode}`,
    `- Failure reason: ${artifact.failureReason || 'Unknown blocking reason.'}`,
    `- Next step: ${artifact.nextStep || 'Inspect configuration and rerun the report.'}`,
    '',
    artifact.failureReason || 'Unknown blocking reason.',
    '',
    artifact.nextStep || 'Inspect configuration and rerun the report.',
    '',
  ].join('\n');
}

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function writeArtifacts(
  outputDir: string,
  artifact: GscReportArtifact,
  options: {
    datedReportName?: string;
    sections?: string;
  } = {},
): { latestReportPath: string; latestJsonPath: string; datedReportPath: string | null } {
  const latestReportPath = resolve(outputDir, 'latest-ctr-report.md');
  const latestJsonPath = resolve(outputDir, 'latest-ctr-report.json');
  const datedReportPath = options.datedReportName ? resolve(outputDir, options.datedReportName) : null;
  const markdown = renderReportMarkdown(artifact, options.sections);

  writeFile(latestReportPath, markdown);
  writeFile(latestJsonPath, JSON.stringify(artifact, null, 2));
  if (datedReportPath) {
    writeFile(datedReportPath, markdown);
  }
  if (artifact.status === 'blocking') {
    writeFile(resolve(outputDir, 'monitoring-skipped.md'), renderMonitoringSkippedMarkdown(artifact));
  }

  return { latestReportPath, latestJsonPath, datedReportPath };
}

async function main() {
  const resolved = getConfig();

  if (!resolved.config) {
    const missingSettings = resolved.missingEnv.join(', ');
    const artifact = buildBlockingArtifact({
      sourceMode: 'missing-config',
      siteUrl: resolved.siteUrl,
      reason: `Missing one or more required Search Console settings: ${missingSettings}.`,
      nextStep:
        'Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_SITE_URL, then rerun `npx tsx scripts/gsc-fetch-report.ts`.',
    });
    const paths = writeArtifacts(resolved.outputDir, artifact);
    console.log(`Wrote blocking report: ${paths.latestReportPath}`);
    console.log(`Wrote blocking JSON: ${paths.latestJsonPath}`);
    console.log(artifact.failureReason);
    return;
  }

  const config = resolved.config;

  try {
    const periods = getPeriods(config.days);
    const accessToken = await fetchAccessToken(config);

    const [currentQueries, previousQueries, currentPages, previousPages] = await Promise.all([
      fetchDimensionRows(config, accessToken, 'query', periods.currentStart, periods.currentEnd),
      fetchDimensionRows(config, accessToken, 'query', periods.previousStart, periods.previousEnd),
      fetchDimensionRows(config, accessToken, 'page', periods.currentStart, periods.currentEnd),
      fetchDimensionRows(config, accessToken, 'page', periods.previousStart, periods.previousEnd),
    ]);

    const currentRangeLabel = `${periods.currentStart}-to-${periods.currentEnd}`;
    const previousRangeLabel = `${periods.previousStart}-to-${periods.previousEnd}`;
    const snapshotDir = resolve(config.outputDir, 'snapshots');
    const currentQueriesPath = resolve(snapshotDir, `${currentRangeLabel}-queries.csv`);
    const previousQueriesPath = resolve(snapshotDir, `${previousRangeLabel}-queries.csv`);
    const currentPagesPath = resolve(snapshotDir, `${currentRangeLabel}-pages.csv`);
    const previousPagesPath = resolve(snapshotDir, `${previousRangeLabel}-pages.csv`);

    writeFile(currentQueriesPath, toCsv(currentQueries, 'query'));
    writeFile(previousQueriesPath, toCsv(previousQueries, 'query'));
    writeFile(currentPagesPath, toCsv(currentPages, 'page'));
    writeFile(previousPagesPath, toCsv(previousPages, 'page'));

    const { artifact, sections } = buildSuccessArtifact(
      currentQueries,
      previousQueries,
      currentPages,
      previousPages,
      periods,
      config.siteUrl,
    );
    const paths = writeArtifacts(config.outputDir, artifact, {
      datedReportName: `${currentRangeLabel}-ctr-report.md`,
      sections,
    });

    console.log(`Wrote report: ${paths.datedReportPath}`);
    console.log(`Latest report: ${paths.latestReportPath}`);
    console.log(`Latest JSON: ${paths.latestJsonPath}`);
    console.log(`Current query rows: ${currentQueries.length}`);
    console.log(`Current page rows: ${currentPages.length}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const artifact = buildBlockingArtifact({
      sourceMode: 'request-failed',
      siteUrl: config.siteUrl,
      reason,
      nextStep:
        'Check Search Console service-account access, property permissions, and API quota, then rerun `npx tsx scripts/gsc-fetch-report.ts`.',
    });
    const paths = writeArtifacts(config.outputDir, artifact);
    console.error(reason);
    console.log(`Wrote blocking report: ${paths.latestReportPath}`);
    console.log(`Wrote blocking JSON: ${paths.latestJsonPath}`);
  }
}

main();
