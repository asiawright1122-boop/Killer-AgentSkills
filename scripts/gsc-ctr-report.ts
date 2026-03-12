#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import {
  compareGscSnapshots,
  findCtrOpportunities,
  formatPercent,
  parseGscCsv,
  type GscComparison,
  type GscOpportunity,
  type GscReportType,
} from '../src/lib/gsc-report';

type CliOptions = {
  queries?: string;
  queriesPrev?: string;
  pages?: string;
  pagesPrev?: string;
  output?: string;
  limit: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { limit: 15 };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--queries' && next) {
      options.queries = next;
      i++;
    } else if (arg === '--queries-prev' && next) {
      options.queriesPrev = next;
      i++;
    } else if (arg === '--pages' && next) {
      options.pages = next;
      i++;
    } else if (arg === '--pages-prev' && next) {
      options.pagesPrev = next;
      i++;
    } else if (arg === '--output' && next) {
      options.output = next;
      i++;
    } else if (arg === '--limit' && next) {
      options.limit = Number(next) || 15;
      i++;
    }
  }

  return options;
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

  const lines = opportunities.map((item, index) => {
    return [
      `${index + 1}. \`${item.entity}\``,
      `   - Metrics: ${item.clicks} clicks, ${item.impressions} impressions, ${formatPercent(item.ctr)} CTR, position ${item.position.toFixed(1)}`,
      `   - Gap: expected about ${formatPercent(item.expectedCtr)}, short by ${formatPercent(item.gap)}`,
      `   - Focus: ${item.bucket === 'ctr' ? 'Snippet / title CTR' : item.bucket === 'ranking' ? 'Ranking + snippet' : 'Monitor'}`,
      ...item.actions.map((action) => `   - Action: ${action}`),
    ].join('\n');
  });

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

function loadReport(filePath: string, type: GscReportType, limit: number): { path: string; rows: ReturnType<typeof parseGscCsv>; opportunities: GscOpportunity[] } {
  const absolutePath = resolve(filePath);
  const csv = readFileSync(absolutePath, 'utf8');
  const rows = parseGscCsv(csv);
  const opportunities = findCtrOpportunities(rows, type, limit);
  return { path: absolutePath, rows, opportunities };
}

function defaultOutputPath(options: CliOptions): string {
  const name = options.queries && options.pages ? 'combined' : basename(options.queries || options.pages || 'gsc-report.csv').replace(/\.csv$/i, '');
  return resolve(process.cwd(), `reports/gsc/${name}-ctr-report.md`);
}

function buildReport(
  queryReport: { path: string; rows: ReturnType<typeof parseGscCsv>; opportunities: GscOpportunity[] } | null,
  pageReport: { path: string; rows: ReturnType<typeof parseGscCsv>; opportunities: GscOpportunity[] } | null,
  queryPrevReport: { path: string; rows: ReturnType<typeof parseGscCsv>; opportunities: GscOpportunity[] } | null,
  pagePrevReport: { path: string; rows: ReturnType<typeof parseGscCsv>; opportunities: GscOpportunity[] } | null,
  limit: number,
): string {
  const generatedAt = new Date().toISOString();
  const queryCount = queryReport?.opportunities.length || 0;
  const pageCount = pageReport?.opportunities.length || 0;
  const queryComparisons =
    queryReport && queryPrevReport ? compareGscSnapshots(queryReport.rows, queryPrevReport.rows, limit) : [];
  const pageComparisons =
    pageReport && pagePrevReport ? compareGscSnapshots(pageReport.rows, pagePrevReport.rows, limit) : [];

  const summaryLines = [
    `Generated: ${generatedAt}`,
    queryReport ? `Query CSV: ${queryReport.path}` : '',
    queryPrevReport ? `Previous query CSV: ${queryPrevReport.path}` : '',
    pageReport ? `Page CSV: ${pageReport.path}` : '',
    pagePrevReport ? `Previous page CSV: ${pagePrevReport.path}` : '',
    `Priority query opportunities: ${queryCount}`,
    `Priority page opportunities: ${pageCount}`,
    queryComparisons.length > 0 ? `Comparable query rows: ${queryComparisons.length}` : '',
    pageComparisons.length > 0 ? `Comparable page rows: ${pageComparisons.length}` : '',
  ].filter(Boolean);

  const quickWins = [
    ...(queryReport ? summarize(queryReport.opportunities) : []),
    ...(pageReport ? summarize(pageReport.opportunities).slice(0, 3) : []),
  ];

  return [
    '# GSC CTR Report',
    '',
    '## Summary',
    '',
    ...summaryLines.map((line) => `- ${line}`),
    '',
    '## Quick Wins',
    '',
    ...(quickWins.length > 0 ? quickWins : ['- No obvious quick wins in the supplied exports.']),
    '',
    queryReport ? renderSection('Query Opportunities', queryReport.opportunities) : '',
    pageReport ? renderSection('Page Opportunities', pageReport.opportunities) : '',
    queryComparisons.length > 0 ? renderComparisonSection('Query Period Comparison', queryComparisons) : '',
    pageComparisons.length > 0 ? renderComparisonSection('Page Period Comparison', pageComparisons) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.queries && !options.pages) {
    console.error(
      'Usage: npx tsx scripts/gsc-ctr-report.ts --queries queries.csv --pages pages.csv [--queries-prev prev-queries.csv] [--pages-prev prev-pages.csv] [--output report.md] [--limit 15]',
    );
    process.exit(1);
  }

  const queryReport = options.queries ? loadReport(options.queries, 'query', options.limit) : null;
  const queryPrevReport = options.queriesPrev ? loadReport(options.queriesPrev, 'query', options.limit) : null;
  const pageReport = options.pages ? loadReport(options.pages, 'page', options.limit) : null;
  const pagePrevReport = options.pagesPrev ? loadReport(options.pagesPrev, 'page', options.limit) : null;
  const outputPath = resolve(options.output || defaultOutputPath(options));
  const report = buildReport(queryReport, pageReport, queryPrevReport, pagePrevReport, options.limit);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, report, 'utf8');

  console.log(`Wrote GSC CTR report to ${outputPath}`);
  if (queryReport) {
    console.log(`Top query opportunities: ${queryReport.opportunities.length}`);
  }
  if (pageReport) {
    console.log(`Top page opportunities: ${pageReport.opportunities.length}`);
  }
  if (queryPrevReport) {
    console.log(`Loaded previous query snapshot: ${queryPrevReport.rows.length} rows`);
  }
  if (pagePrevReport) {
    console.log(`Loaded previous page snapshot: ${pagePrevReport.rows.length} rows`);
  }
}

main();
