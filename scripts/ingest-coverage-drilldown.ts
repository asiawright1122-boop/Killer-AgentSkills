#!/usr/bin/env npx tsx

import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const MAX_BATCH_SIZE = 100;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function escapeSql(str: string | undefined | null): string {
  if (str === undefined || str === null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function main() {
  const args = process.argv.slice(2);
  const csvPathArg = args[0];

  if (!csvPathArg) {
    console.error('❌ Please specify the GSC CSV path. Usage: npm run ingest:coverage <path-to-csv>');
    process.exit(1);
  }

  const csvPath = resolve(csvPathArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`🌀 Reading GSC Coverage CSV: ${csvPath}...`);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const records: Array<{ url: string; status: string; reason: string; lastCrawled: string }> = [];
  let latestCrawlDateMs = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    
    // GSC exported URL rows typically start with http:// or https:// or "http...
    if (!line.startsWith('http') && !line.startsWith('"http')) continue;

    const parts = parseCSVLine(line).map(p => p.replace(/^"|"$/g, ''));
    if (parts.length < 3) continue;

    const [url, status, reason, lastCrawled] = parts;
    if (!url) continue;

    records.push({
      url,
      status: status || 'unknown',
      reason: reason || 'N/A',
      lastCrawled: lastCrawled || 'unknown'
    });

    // Parse date to check SLA
    if (lastCrawled) {
      const parsedMs = Date.parse(lastCrawled);
      if (!isNaN(parsedMs) && parsedMs > latestCrawlDateMs) {
        latestCrawlDateMs = parsedMs;
      }
    }
  }

  if (records.length === 0) {
    console.error('❌ No valid GSC URL records found in CSV file.');
    process.exit(1);
  }

  console.log(`📋 Discovered ${records.length} records in CSV.`);

  // Verify SLA (7-day freshness limit)
  if (latestCrawlDateMs > 0) {
    const ageDays = (Date.now() - latestCrawlDateMs) / (1000 * 60 * 60 * 24);
    if (ageDays > 7) {
      console.warn(`⚠️ WARNING: GSC Coverage dataset violates 7-day SLA (latest crawl was ${(ageDays).toFixed(1)} days ago: ${new Date(latestCrawlDateMs).toDateString()})`);
    } else {
      console.log(`✅ SLA Freshness Check Passed: Latest crawl is ${(ageDays).toFixed(1)} days old.`);
    }
  } else {
    console.warn('⚠️ Could not determine latest crawl date for SLA verification.');
  }

  console.log('🔄 Syncing records to D1...');
  const ingestedAt = new Date().toISOString();

  // Batch insert into D1
  for (let i = 0; i < records.length; i += MAX_BATCH_SIZE) {
    const chunk = records.slice(i, i + MAX_BATCH_SIZE);
    
    let sql = 'INSERT OR REPLACE INTO gsc_coverage_drilldown (url, status, reason, last_crawled, ingested_at) VALUES ';
    const values = chunk.map(r => {
      return `(${escapeSql(r.url)}, ${escapeSql(r.status)}, ${escapeSql(r.reason)}, ${escapeSql(r.lastCrawled)}, ${escapeSql(ingestedAt)})`;
    });
    sql += values.join(', ') + ';';

    try {
      execFileSync('npx', ['wrangler', 'd1', 'execute', 'killer-skills-db', '--remote', '--command', sql], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      console.log(`✅ Upserted batch ${Math.min(i + MAX_BATCH_SIZE, records.length)} / ${records.length}`);
    } catch (err) {
      console.error(`❌ Failed to upsert batch starting at index ${i}:`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  console.log('🎉 GSC Coverage ingestion pipeline complete!');
}

try {
  main();
} catch (error) {
  console.error('❌ Pipeline error:', error);
  process.exit(1);
}
