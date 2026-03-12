#!/usr/bin/env npx tsx

import { createSign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  compareGscSnapshots,
  findCtrOpportunities,
  formatPercent,
  type GscComparison,
  type GscOpportunity,
  type GscReportType,
  type GscRow,
} from '../src/lib/gsc-report';

type Dimension = 'query' | 'page';

type Config = {
  clientEmail: string;
  privateKey: string;
  siteUrl: string;
  days: number;
  rowLimit: number;
  outputDir: string;
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

function getConfig(): Config | null {
  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim();
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const siteUrl = (process.env.GSC_SITE_URL || '').trim();

  if (!clientEmail || !privateKey || !siteUrl) {
    return null;
  }

  return {
    clientEmail,
    privateKey,
    siteUrl,
    days: Number(process.env.GSC_REPORT_DAYS || 7) || 7,
    rowLimit: Number(process.env.GSC_ROW_LIMIT || 250) || 250,
    outputDir: resolve(process.env.GSC_OUTPUT_DIR || 'reports/gsc'),
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

function buildReport(
  currentQueries: GscRow[],
  previousQueries: GscRow[],
  currentPages: GscRow[],
  previousPages: GscRow[],
  periods: Period,
  siteUrl: string,
): string {
  const queryOpportunities = findCtrOpportunities(currentQueries, 'query', 15);
  const pageOpportunities = findCtrOpportunities(currentPages, 'page', 15);
  const queryComparisons = compareGscSnapshots(currentQueries, previousQueries, 15);
  const pageComparisons = compareGscSnapshots(currentPages, previousPages, 15);
  const quickWins = [...summarize(queryOpportunities), ...summarize(pageOpportunities).slice(0, 3)];

  return [
    '# GSC CTR Report',
    '',
    '## Summary',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Site: ${siteUrl}`,
    `- Current period: ${periods.currentStart} to ${periods.currentEnd}`,
    `- Previous period: ${periods.previousStart} to ${periods.previousEnd}`,
    `- Query rows: ${currentQueries.length}`,
    `- Page rows: ${currentPages.length}`,
    `- Priority query opportunities: ${queryOpportunities.length}`,
    `- Priority page opportunities: ${pageOpportunities.length}`,
    '',
    '## Quick Wins',
    '',
    ...(quickWins.length > 0 ? quickWins : ['- No obvious quick wins in the current periods.']),
    '',
    renderSection('Query Opportunities', queryOpportunities),
    renderSection('Page Opportunities', pageOpportunities),
    renderComparisonSection('Query Period Comparison', queryComparisons),
    renderComparisonSection('Page Period Comparison', pageComparisons),
  ].join('\n');
}

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

async function main() {
  const config = getConfig();
  if (!config) {
    console.log('Skipping GSC fetch report: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, or GSC_SITE_URL is missing.');
    process.exit(0);
  }

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
  const reportPath = resolve(config.outputDir, `${currentRangeLabel}-ctr-report.md`);
  const latestReportPath = resolve(config.outputDir, 'latest-ctr-report.md');

  writeFile(currentQueriesPath, toCsv(currentQueries, 'query'));
  writeFile(previousQueriesPath, toCsv(previousQueries, 'query'));
  writeFile(currentPagesPath, toCsv(currentPages, 'page'));
  writeFile(previousPagesPath, toCsv(previousPages, 'page'));

  const report = buildReport(currentQueries, previousQueries, currentPages, previousPages, periods, config.siteUrl);
  writeFile(reportPath, report);
  writeFile(latestReportPath, report);

  console.log(`Wrote report: ${reportPath}`);
  console.log(`Latest report: ${latestReportPath}`);
  console.log(`Current query rows: ${currentQueries.length}`);
  console.log(`Current page rows: ${currentPages.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
