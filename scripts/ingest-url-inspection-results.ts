#!/usr/bin/env npx tsx
/**
 * Ingest URL Inspection Coverage Sweep results into D1
 *
 * Reads the latest URL Inspection sweep JSON report and upserts
 * individual inspection records into the gsc_url_inspection D1 table.
 *
 * Usage:
 *   npx tsx scripts/ingest-url-inspection-results.ts [--remote]
 *
 * Options:
 *   --remote   Use remote D1 database (default is local)
 *   --input    Custom path to sweep JSON (default: reports/seo/latest-url-inspection-coverage-sweep.json)
 */
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const MAX_BATCH_SIZE = 50;

type InspectionRecord = {
  url: string;
  cluster: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
  lastCrawlTime: string | null;
  pageFetchState: string;
  googleCanonical: string | null;
  robotsTxtState: string;
  inspectedAt: string;
};

type SweepJson = {
  generatedAt?: string;
  sourceMode?: string;
  totalSampled?: number;
  records?: InspectionRecord[];
};

function escapeSql(str: string | undefined | null): string {
  if (str === undefined || str === null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function main() {
  const args = process.argv.slice(2);
  const useRemote = args.includes('--remote');
  const inputArg = args.find((a) => a.startsWith('--input='));
  const inputPath = inputArg ? resolve(inputArg.split('=')[1]) : resolve(process.cwd(), 'reports/seo/latest-url-inspection-coverage-sweep.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Sweep JSON not found: ${inputPath}`);
    console.error('Run `npm run report:seo:coverage-sweep:p0` first.');
    process.exit(1);
  }

  const sweep: SweepJson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const records = sweep.records || [];

  if (records.length === 0) {
    console.error('❌ No inspection records found in sweep JSON.');
    process.exit(1);
  }

  console.log(`🌀 Ingesting ${records.length} URL Inspection records from ${sweep.sourceMode || 'unknown'} sweep...`);

  const ingestedAt = new Date().toISOString();
  const d1Flags = useRemote ? ['--remote'] : [];
  let upserted = 0;

  for (let i = 0; i < records.length; i += MAX_BATCH_SIZE) {
    const chunk = records.slice(i, i + MAX_BATCH_SIZE);

    const values = chunk.map((r) => {
      return `(${escapeSql(r.url)}, ${escapeSql(r.verdict)}, ${escapeSql(r.coverageState)}, ${escapeSql(r.indexingState)}, ${escapeSql(r.lastCrawlTime)}, ${escapeSql(r.pageFetchState)}, ${escapeSql(r.googleCanonical)}, ${escapeSql(r.robotsTxtState)}, ${escapeSql(r.cluster)}, ${escapeSql(r.inspectedAt)}, ${escapeSql(ingestedAt)})`;
    });

    const sql = `INSERT OR REPLACE INTO gsc_url_inspection (url, verdict, coverage_state, indexing_state, last_crawl_time, page_fetch_state, google_canonical, robots_txt_state, cluster, inspected_at, ingested_at) VALUES ${values.join(', ')}`;

    try {
      execFileSync('npx', ['wrangler', 'd1', 'execute', 'killer-skills-db', ...d1Flags, '--command', sql], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      upserted += chunk.length;
      console.log(`  ✅ Upserted ${upserted} / ${records.length}`);
    } catch (err) {
      console.error(`  ❌ Failed to upsert batch starting at index ${i}:`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  // Verify 7-day freshness SLA
  const sweepAge = sweep.generatedAt ? (Date.now() - new Date(sweep.generatedAt).getTime()) / (24 * 60 * 60 * 1000) : Infinity;
  if (sweepAge > 7) {
    console.warn(`⚠️ WARNING: Sweep data violates 7-day SLA (age=${sweepAge.toFixed(1)} days).`);
  } else {
    console.log(`✅ SLA Freshness Check Passed: Sweep is ${sweepAge.toFixed(1)} days old.`);
  }

  console.log(`🎉 URL Inspection ingestion pipeline complete! ${upserted} records upserted.`);
}

try {
  main();
} catch (error) {
  console.error('❌ Pipeline error:', error);
  process.exit(1);
}
