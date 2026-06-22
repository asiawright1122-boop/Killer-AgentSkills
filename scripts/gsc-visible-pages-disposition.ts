#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type DiagnosisBucket = 'index' | 'noindex' | 'redirect' | 'error' | 'other';
type Disposition = 'keep_recover' | 'consolidate' | 'retire' | 'manual_review';

type DiagnosisRow = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  bucket: DiagnosisBucket;
  currentStatus: number | null;
  redirectLocation: string | null;
  robotsHeader: string | null;
  metaRobots: string | null;
  canonicalHref: string | null;
  contentLanguage: string | null;
  governanceCanonicalUrl: string | null;
  governanceCanonicalLocale: string | null;
  governanceEligibleLocales: string[];
  indexabilityCanonicalUrl: string | null;
  indexabilityMode: string | null;
  isIndexable: boolean | null;
  qualityScore: number | null;
  blockers: string[];
  notes: string[];
};

type DiagnosisReport = {
  generatedAt: string;
  sourceCsv: string;
  totals: {
    pages: number;
    clicks: number;
    impressions: number;
  };
  buckets: Record<DiagnosisBucket, number>;
  notes: string[];
  rows: DiagnosisRow[];
};

type DispositionRow = {
  url: string;
  impressions: number;
  clicks: number;
  position: number;
  liveBucket: DiagnosisBucket;
  disposition: Disposition;
  targetUrl: string | null;
  rationale: string;
  evidence: string[];
};

type DispositionReport = {
  generatedAt: string;
  sourceReport: string;
  summary: {
    keep_recover: number;
    consolidate: number;
    retire: number;
    manual_review: number;
  };
  rows: DispositionRow[];
};

const REPORT_DIR = resolve(process.cwd(), 'reports', 'seo');
const INPUT_PATH = resolve(REPORT_DIR, 'latest-gsc-visible-pages-diagnosis.json');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-gsc-visible-pages-disposition.json');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-gsc-visible-pages-disposition.md');

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function chooseTargetUrl(row: DiagnosisRow): string | null {
  return row.redirectLocation || row.indexabilityCanonicalUrl || row.governanceCanonicalUrl || row.canonicalHref || null;
}

function decideDisposition(row: DiagnosisRow): DispositionRow {
  const targetUrl = chooseTargetUrl(row);
  const evidence = uniq([
    row.robotsHeader ? `robots=${row.robotsHeader}` : '',
    row.metaRobots ? `meta=${row.metaRobots}` : '',
    row.redirectLocation ? `redirect=${row.redirectLocation}` : '',
    row.indexabilityMode ? `indexability=${row.indexabilityMode}` : '',
    typeof row.isIndexable === 'boolean' ? `isIndexable=${row.isIndexable ? 'yes' : 'no'}` : '',
    row.governanceCanonicalLocale ? `canonicalLocale=${row.governanceCanonicalLocale}` : '',
    ...(row.blockers || []).map((blocker) => `blocker=${blocker}`),
    ...(row.notes || []),
  ]);

  if (row.bucket === 'index') {
    return {
      url: row.url,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      liveBucket: row.bucket,
      disposition: 'keep_recover',
      targetUrl: targetUrl || row.url,
      rationale: 'This page is still indexable live and should remain part of the recovery set.',
      evidence,
    };
  }

  if (row.bucket === 'redirect') {
    return {
      url: row.url,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      liveBucket: row.bucket,
      disposition: 'consolidate',
      targetUrl,
      rationale: 'This URL is already a redirect residual. Keep consolidation in place and do not treat it as an active landing page.',
      evidence,
    };
  }

  if (
    row.bucket === 'noindex' &&
    row.isIndexable === true &&
    row.governanceCanonicalLocale &&
    row.url.includes(`/${row.governanceCanonicalLocale}/`)
  ) {
    return {
      url: row.url,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      liveBucket: row.bucket,
      disposition: 'manual_review',
      targetUrl: targetUrl || row.url,
      rationale: 'The governance layer says this route is indexable, but live output is noindex. This is a real mismatch worth auditing.',
      evidence,
    };
  }

  if (row.bucket === 'noindex' && row.isIndexable === true) {
    return {
      url: row.url,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      liveBucket: row.bucket,
      disposition: 'consolidate',
      targetUrl: targetUrl,
      rationale: 'The visible URL is noindex and points to another canonical target. Recover the canonical target instead of reopening this residual URL.',
      evidence,
    };
  }

  if (row.bucket === 'noindex') {
    const blockerSummary = row.blockers.join(', ');
    return {
      url: row.url,
      impressions: row.impressions,
      clicks: row.clicks,
      position: row.position,
      liveBucket: row.bucket,
      disposition: 'retire',
      targetUrl: targetUrl,
      rationale: blockerSummary
        ? `This URL is intentionally out of the index set and still fails governance gates (${blockerSummary}). Treat impressions as residual noise.`
        : 'This URL is intentionally noindex. Treat remaining impressions as residual noise rather than a recovery target.',
      evidence,
    };
  }

  return {
    url: row.url,
    impressions: row.impressions,
    clicks: row.clicks,
    position: row.position,
    liveBucket: row.bucket,
    disposition: 'manual_review',
    targetUrl,
    rationale: 'This URL does not fit the normal index/noindex/redirect buckets cleanly and needs direct inspection.',
    evidence,
  };
}

function renderMarkdown(report: DispositionReport): string {
  const lines: string[] = [];
  lines.push('# GSC Visible Pages Disposition');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source report: \`${report.sourceReport.replace(`${process.cwd()}/`, '')}\``);
  lines.push(`- Keep / recover: ${report.summary.keep_recover}`);
  lines.push(`- Consolidate: ${report.summary.consolidate}`);
  lines.push(`- Retire: ${report.summary.retire}`);
  lines.push(`- Manual review: ${report.summary.manual_review}`);
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| URL | Disposition | Live bucket | Impr | Pos | Target | Rationale |');
  lines.push('| --- | --- | --- | ---: | ---: | --- | --- |');
  for (const row of report.rows) {
    lines.push(
      `| ${row.url} | ${row.disposition} | ${row.liveBucket} | ${row.impressions} | ${row.position.toFixed(2)} | ${row.targetUrl || '-'} | ${row.rationale} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const diagnosis = JSON.parse(readFileSync(INPUT_PATH, 'utf8')) as DiagnosisReport;
  const rows = diagnosis.rows.map(decideDisposition);
  rows.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.url.localeCompare(b.url));

  const report: DispositionReport = {
    generatedAt: new Date().toISOString(),
    sourceReport: INPUT_PATH,
    summary: {
      keep_recover: rows.filter((row) => row.disposition === 'keep_recover').length,
      consolidate: rows.filter((row) => row.disposition === 'consolidate').length,
      retire: rows.filter((row) => row.disposition === 'retire').length,
      manual_review: rows.filter((row) => row.disposition === 'manual_review').length,
    },
    rows,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(MD_OUTPUT, renderMarkdown(report), 'utf8');

  console.log(`Wrote JSON: ${JSON_OUTPUT}`);
  console.log(`Wrote Markdown: ${MD_OUTPUT}`);
  console.log(
    `keep_recover=${report.summary.keep_recover} consolidate=${report.summary.consolidate} retire=${report.summary.retire} manual_review=${report.summary.manual_review}`,
  );
}

main();
