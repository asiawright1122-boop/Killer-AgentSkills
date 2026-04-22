import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildGscCanonicalDriftContext,
  findLatestGscPagesSnapshot,
  loadCollectionsFromDirectory,
  loadRowsFromGscPagesCsv,
  renderGscCanonicalDriftMarkdown,
  summarizeGscCanonicalDrift,
} from './lib/gsc-canonical-drift';

const ROOT = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT, 'reports/gsc/snapshots');
const OUTPUT_DIR = path.join(ROOT, 'reports/gsc');
const SITEMAP_SKILLS_PATH = path.join(ROOT, 'data/sitemap-skills.json');
const BLOCKLIST_PATH = path.join(ROOT, 'data/seo-sitemap-blocklist.json');
const LOCALE_GOVERNANCE_PATH = path.join(ROOT, 'data/seo-skill-locale-governance.json');
const COLLECTIONS_DIR = path.join(ROOT, 'src/content/collections');

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function parseArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const explicitCsvPath = parseArg('--pages-csv');
const snapshot = explicitCsvPath
  ? {
      csvPath: path.resolve(ROOT, explicitCsvPath),
      snapshotLabel: path.basename(explicitCsvPath).replace(/-pages\.csv$/i, ''),
    }
  : findLatestGscPagesSnapshot(SNAPSHOT_DIR);

const skills = readJson<Array<{ owner: string; repo: string; routePath: string; updatedAt?: string }>>(SITEMAP_SKILLS_PATH);
const blocklist = readJson<unknown>(BLOCKLIST_PATH);
const localeGovernance = readJson<{ skills?: unknown[]; records?: unknown[] }>(LOCALE_GOVERNANCE_PATH);
const collections = loadCollectionsFromDirectory(COLLECTIONS_DIR);
const rows = loadRowsFromGscPagesCsv(snapshot.csvPath);

const context = buildGscCanonicalDriftContext({
  skills,
  blocklistData: blocklist,
  localeGovernanceRecords: ((localeGovernance.skills || localeGovernance.records || []) as Array<Record<string, unknown>>).map(
    (record) => ({
      owner: typeof record.owner === 'string' ? record.owner : undefined,
      routePath: typeof record.routePath === 'string' ? record.routePath : undefined,
      eligibleLocales: Array.isArray(record.eligibleLocales)
        ? record.eligibleLocales.filter((value): value is string => typeof value === 'string')
        : undefined,
      canonicalLocale: typeof record.canonicalLocale === 'string' ? record.canonicalLocale : null,
    }),
  ),
  collections,
});

const summary = summarizeGscCanonicalDrift(rows, context, {
  sourceCsvPath: path.relative(ROOT, snapshot.csvPath),
  snapshotLabel: snapshot.snapshotLabel,
});
const markdown = renderGscCanonicalDriftMarkdown(summary);

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, `latest-canonical-drift.json`), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(path.join(OUTPUT_DIR, `latest-canonical-drift.md`), `${markdown}\n`);
writeFileSync(path.join(OUTPUT_DIR, `${snapshot.snapshotLabel}-canonical-drift.json`), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(path.join(OUTPUT_DIR, `${snapshot.snapshotLabel}-canonical-drift.md`), `${markdown}\n`);

console.log(`# GSC Canonical Drift Audit`);
console.log(`- Snapshot: ${summary.snapshotLabel}`);
console.log(`- Source CSV: ${summary.sourceCsvPath}`);
console.log(`- Total rows: ${summary.totalRows}`);
console.log(`- Top actions:`);
for (const action of summary.actionSummary.slice(0, 5)) {
  console.log(`  - ${action.action}: ${action.count} URLs / ${action.impressions} impressions / ${action.clicks} clicks`);
}
console.log(`- Top clusters:`);
for (const cluster of summary.kindSummary.slice(0, 8)) {
  console.log(`  - ${cluster.kind}: ${cluster.count} URLs / ${cluster.impressions} impressions / action=${cluster.action}`);
}
