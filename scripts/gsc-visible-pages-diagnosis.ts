#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type GscPageRow = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type LocaleGovernanceRow = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  canonicalLocale: string;
  detectedBodyLocale: string | null;
  eligibleLocales: string[];
  publishedLocales?: string[];
};

type IndexabilityRow = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  canonicalLocale: string;
  canonicalUrl: string;
  qualityScore: number;
  isIndexable: boolean;
  mode: 'indexable' | 'reference_only';
  blockers: string[];
};

type LiveUrlInspection = {
  url: string;
  status: number | null;
  redirectLocation: string | null;
  robotsHeader: string | null;
  metaRobots: string | null;
  canonicalHref: string | null;
  contentLanguage: string | null;
  fetchError: string | null;
};

type VisiblePageDiagnosisRow = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  bucket: 'index' | 'noindex' | 'redirect' | 'error' | 'other';
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
  buckets: Record<VisiblePageDiagnosisRow['bucket'], number>;
  notes: string[];
  rows: VisiblePageDiagnosisRow[];
};

const REPORT_DIR = resolve(process.cwd(), 'reports', 'seo');
const GSC_DIR = resolve(process.cwd(), 'reports', 'gsc');
const DEFAULT_CSV_PATH = resolve(GSC_DIR, 'latest-pages.csv');
const FALLBACK_JSON_PATH = resolve(GSC_DIR, 'latest-ctr-report.json');
const GOVERNANCE_PATH = resolve(process.cwd(), 'data', 'seo-skill-locale-governance.json');
const INDEXABILITY_PATH = resolve(REPORT_DIR, 'latest-skill-indexability.json');
const JSON_OUTPUT_PATH = resolve(REPORT_DIR, 'latest-gsc-visible-pages-diagnosis.json');
const MD_OUTPUT_PATH = resolve(REPORT_DIR, 'latest-gsc-visible-pages-diagnosis.md');
const SITE_ORIGIN = 'https://killer-skills.com';

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parsePercent(value: string): number {
  const trimmed = String(value || '').replace(/%/g, '').trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function parseNumber(value: string): number {
  const parsed = Number(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function absoluteUrlMaybe(url: string): string | null {
  const trimmed = String(url || '').trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, SITE_ORIGIN).toString();
  } catch {
    return null;
  }
}

function loadLatestPagesCsvPath(): string {
  if (existsSync(DEFAULT_CSV_PATH)) return DEFAULT_CSV_PATH;
  if (!existsSync(FALLBACK_JSON_PATH)) {
    throw new Error(`Missing both ${DEFAULT_CSV_PATH} and ${FALLBACK_JSON_PATH}`);
  }

  const latestCtr = JSON.parse(readFileSync(FALLBACK_JSON_PATH, 'utf8')) as {
    currentPeriod?: { start?: string; end?: string };
  };
  const start = latestCtr.currentPeriod?.start;
  const end = latestCtr.currentPeriod?.end;
  if (!start || !end) {
    throw new Error(`Could not infer current period from ${FALLBACK_JSON_PATH}`);
  }
  const snapshotPath = resolve(GSC_DIR, 'snapshots', `${start}-to-${end}-pages.csv`);
  if (!existsSync(snapshotPath)) {
    throw new Error(`Missing inferred snapshot CSV: ${snapshotPath}`);
  }
  return snapshotPath;
}

function loadGscPageRows(csvPath: string): GscPageRow[] {
  const lines = readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const rows: GscPageRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [page, clicks, impressions, ctr, position] = parseCsvLine(line);
    const url = page.replace(/^"|"$/g, '');
    rows.push({
      url,
      clicks: parseNumber(clicks),
      impressions: parseNumber(impressions),
      ctr: parsePercent(ctr),
      position: parseNumber(position),
    });
  }
  return rows;
}

function loadLocaleGovernanceRows(): LocaleGovernanceRow[] {
  const raw = JSON.parse(readFileSync(GOVERNANCE_PATH, 'utf8')) as {
    skills?: LocaleGovernanceRow[];
    rows?: LocaleGovernanceRow[];
    records?: LocaleGovernanceRow[];
  };
  return raw.records || raw.rows || raw.skills || [];
}

function loadIndexabilityRows(): IndexabilityRow[] {
  const raw = JSON.parse(readFileSync(INDEXABILITY_PATH, 'utf8')) as {
    skills?: IndexabilityRow[];
  };
  return raw.skills || [];
}

async function fetchLiveUrlInspection(url: string): Promise<LiveUrlInspection> {
  const inspection: LiveUrlInspection = {
    url,
    status: null,
    redirectLocation: null,
    robotsHeader: null,
    metaRobots: null,
    canonicalHref: null,
    contentLanguage: null,
    fetchError: null,
  };

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; KillerSkillsDiagnosis/1.0; +https://killer-skills.com)',
      },
    });
    inspection.status = response.status;
    inspection.redirectLocation = response.headers.get('location');
    inspection.robotsHeader = response.headers.get('x-robots-tag');
    inspection.contentLanguage = response.headers.get('content-language');
    const html = await response.text();
    inspection.metaRobots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1] || null;
    inspection.canonicalHref = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || null;
  } catch (error) {
    inspection.fetchError = error instanceof Error ? error.message : String(error);
  }

  return inspection;
}

function classifyBucket(live: LiveUrlInspection): VisiblePageDiagnosisRow['bucket'] {
  if (live.fetchError) return 'error';
  if (live.redirectLocation) return 'redirect';
  const robots = `${live.robotsHeader || ''} ${live.metaRobots || ''}`.toLowerCase();
  if (robots.includes('noindex')) return 'noindex';
  if (robots.includes('index')) return 'index';
  return 'other';
}

function buildNotes(params: {
  url: string;
  live: LiveUrlInspection;
  governance: LocaleGovernanceRow | null;
  indexability: IndexabilityRow | null;
}): string[] {
  const notes: string[] = [];
  const { live, governance, indexability } = params;
  const liveCanonical = absoluteUrlMaybe(live.canonicalHref || '');

  if (live.redirectLocation) {
    notes.push(`redirects to ${live.redirectLocation}`);
  }

  if (governance && liveCanonical && normalizeUrl(liveCanonical) !== normalizeUrl(live.url)) {
    notes.push(`canonical points to ${liveCanonical}`);
  }

  if (governance && governance.canonicalLocale && !normalizeUrl(params.url).includes(`/${governance.canonicalLocale}/`)) {
    notes.push(`non-canonical locale; canonical locale is ${governance.canonicalLocale}`);
  }

  if (indexability?.isIndexable === false) {
    notes.push(`indexability=${indexability.mode}`);
  }

  for (const blocker of indexability?.blockers || []) {
    if (blocker === 'quality_below_review_floor') notes.push('blocked by quality floor');
    if (blocker === 'locale_contract_failed') notes.push('blocked by locale contract');
    if (blocker === 'missing_recommendation_layer') notes.push('missing recommendation layer');
    if (blocker === 'missing_use_case_layer') notes.push('missing use-case layer');
    if (blocker === 'missing_limitations_layer') notes.push('missing limitations layer');
    if (blocker === 'source_material_too_thin') notes.push('source material too thin');
  }

  if (!governance && !indexability && params.url.includes('/skills/')) {
    notes.push('not present in local governance/indexability artifacts');
  }

  return Array.from(new Set(notes));
}

function renderMarkdown(report: DiagnosisReport): string {
  const lines: string[] = [];
  lines.push('# GSC Visible Pages Diagnosis');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source CSV: \`${report.sourceCsv.replace(`${process.cwd()}/`, '')}\``);
  lines.push(`- Pages: ${report.totals.pages}`);
  lines.push(`- Clicks: ${report.totals.clicks}`);
  lines.push(`- Impressions: ${report.totals.impressions}`);
  lines.push('');
  lines.push('## Buckets');
  lines.push('');
  lines.push(`- index: ${report.buckets.index}`);
  lines.push(`- noindex: ${report.buckets.noindex}`);
  lines.push(`- redirect: ${report.buckets.redirect}`);
  lines.push(`- error: ${report.buckets.error}`);
  lines.push(`- other: ${report.buckets.other}`);
  lines.push('');

  if (report.notes.length > 0) {
    lines.push('## Headline Notes');
    lines.push('');
    for (const note of report.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  lines.push('## Rows');
  lines.push('');
  lines.push('| URL | Bucket | Impr | Clicks | Pos | Robots | Canonical | Governance | Indexability | Notes |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |');
  for (const row of report.rows) {
    const robots = row.robotsHeader || row.metaRobots || 'missing';
    const canonical = row.canonicalHref || row.redirectLocation || 'missing';
    const governance = row.governanceCanonicalLocale
      ? `${row.governanceCanonicalLocale} (${row.governanceEligibleLocales.join(',') || 'n/a'})`
      : 'missing';
    const indexability =
      row.isIndexable === null
        ? 'missing'
        : `${row.indexabilityMode}/${row.isIndexable ? 'indexable' : 'noindex'}${row.qualityScore !== null ? ` q=${row.qualityScore}` : ''}`;
    lines.push(
      `| ${row.url} | ${row.bucket} | ${row.impressions} | ${row.clicks} | ${row.position.toFixed(2)} | ${robots} | ${canonical} | ${governance} | ${indexability} | ${row.notes.join('; ') || '-'} |`,
    );
  }
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const csvPath = loadLatestPagesCsvPath();
  const gscRows = loadGscPageRows(csvPath);
  const governanceRows = loadLocaleGovernanceRows();
  const indexabilityRows = loadIndexabilityRows();

  const governanceByCanonicalUrl = new Map<string, LocaleGovernanceRow>();
  for (const row of governanceRows) {
    const canonicalUrl = `https://killer-skills.com/${row.canonicalLocale}/skills/${row.owner}/${row.routePath}`;
    governanceByCanonicalUrl.set(normalizeUrl(canonicalUrl), row);
  }

  const indexabilityByCanonicalUrl = new Map<string, IndexabilityRow>();
  for (const row of indexabilityRows) {
    indexabilityByCanonicalUrl.set(normalizeUrl(row.canonicalUrl), row);
  }

  const rows: VisiblePageDiagnosisRow[] = [];
  for (const gscRow of gscRows) {
    const live = await fetchLiveUrlInspection(gscRow.url);
    const rowCanonicalCandidate = normalizeUrl(absoluteUrlMaybe(live.canonicalHref || gscRow.url) || gscRow.url);
    const governance =
      governanceByCanonicalUrl.get(normalizeUrl(gscRow.url)) || governanceByCanonicalUrl.get(rowCanonicalCandidate) || null;
    const indexability =
      indexabilityByCanonicalUrl.get(normalizeUrl(gscRow.url)) || indexabilityByCanonicalUrl.get(rowCanonicalCandidate) || null;
    const notes = buildNotes({
      url: gscRow.url,
      live,
      governance,
      indexability,
    });

    rows.push({
      url: gscRow.url,
      clicks: gscRow.clicks,
      impressions: gscRow.impressions,
      ctr: gscRow.ctr,
      position: gscRow.position,
      bucket: classifyBucket(live),
      currentStatus: live.status,
      redirectLocation: live.redirectLocation,
      robotsHeader: live.robotsHeader,
      metaRobots: live.metaRobots,
      canonicalHref: live.canonicalHref,
      contentLanguage: live.contentLanguage,
      governanceCanonicalUrl: governance
        ? `https://killer-skills.com/${governance.canonicalLocale}/skills/${governance.owner}/${governance.routePath}`
        : null,
      governanceCanonicalLocale: governance?.canonicalLocale || null,
      governanceEligibleLocales: governance?.eligibleLocales || [],
      indexabilityCanonicalUrl: indexability?.canonicalUrl || null,
      indexabilityMode: indexability?.mode || null,
      isIndexable: typeof indexability?.isIndexable === 'boolean' ? indexability.isIndexable : null,
      qualityScore: typeof indexability?.qualityScore === 'number' ? indexability.qualityScore : null,
      blockers: indexability?.blockers || [],
      notes,
    });
  }

  rows.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.url.localeCompare(b.url));

  const report: DiagnosisReport = {
    generatedAt: new Date().toISOString(),
    sourceCsv: csvPath,
    totals: {
      pages: rows.length,
      clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    },
    buckets: {
      index: rows.filter((row) => row.bucket === 'index').length,
      noindex: rows.filter((row) => row.bucket === 'noindex').length,
      redirect: rows.filter((row) => row.bucket === 'redirect').length,
      error: rows.filter((row) => row.bucket === 'error').length,
      other: rows.filter((row) => row.bucket === 'other').length,
    },
    notes: [
      'This report maps GSC-visible pages to their current live robots/canonical state.',
      'A page showing impressions in GSC can still be a residual URL if it now redirects or carries noindex.',
    ],
    rows,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(MD_OUTPUT_PATH, renderMarkdown(report), 'utf8');

  console.log(`Wrote JSON: ${JSON_OUTPUT_PATH}`);
  console.log(`Wrote Markdown: ${MD_OUTPUT_PATH}`);
  console.log(
    `pages=${report.totals.pages} impressions=${report.totals.impressions} index=${report.buckets.index} noindex=${report.buckets.noindex} redirect=${report.buckets.redirect} error=${report.buckets.error}`,
  );
}

await main();
