#!/usr/bin/env npx tsx

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import 'dotenv/config';

// 1. Fetch KV keys count
// 2. Fetch D1 row count
// 3. Generate Markdown

const DASHBOARD_PATH = resolve(process.cwd(), '.planning', 'dashboards', 'sync-observability.md');

function execWranglerCommand(args: string[]): string {
  try {
    return execFileSync('npx', ['wrangler', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    console.error(`❌ Wrangler command failed: npx wrangler ${args.join(' ')}`);
    console.error(error instanceof Error ? error.message : String(error));
    return '';
  }
}

async function fetchKVKeyCount(): Promise<number | null> {
  // Using Cloudflare API directly or wrangler.
  // We can just rely on KVService to fetch keys and count them.
  try {
    const { KVService } = await import('./lib/kv');
    const kv = new KVService();
    if (!kv.isConfigured) return null;
    const keys = await kv.fetchAllKeys();
    return keys.length;
  } catch (e) {
    console.error('Failed to fetch KV keys', e);
    return null;
  }
}

function fetchD1RowCount(): number | null {
  const output = execWranglerCommand(['d1', 'execute', 'killer-skills-db', '--remote', '--command', 'SELECT COUNT(*) as count FROM skills;', '--json']);
  if (!output) return null;
  try {
    const parsed = JSON.parse(output);
    return parsed?.[0]?.results?.[0]?.count ?? null;
  } catch {
    return null;
  }
}

async function generateDashboard() {
  console.log('📊 Gathering Observability Data...');
  
  const kvCount = await fetchKVKeyCount();
  const d1Count = fetchD1RowCount();
  const timestamp = new Date().toISOString();

  let markdown = `# D1 & KV Sync Observability Dashboard\n\n`;
  markdown += `*Last Updated: ${timestamp}*\n\n`;
  
  markdown += `## 🗄️ Storage Metrics\n\n`;
  markdown += `| Datastore | Resource Type | Total Items / Rows | Status |\n`;
  markdown += `|---|---|---|---|\n`;
  
  const kvStatus = kvCount !== null ? (kvCount > 0 ? '✅ Healthy' : '⚠️ Empty') : '❌ Error / Unconfigured';
  markdown += `| Cloudflare KV | Cache Storage | **${kvCount ?? 'N/A'}** | ${kvStatus} |\n`;

  const d1Status = d1Count !== null ? (d1Count > 0 ? '✅ Healthy' : '⚠️ Empty') : '❌ Error / Unconfigured';
  markdown += `| Cloudflare D1 | SQL Database | **${d1Count ?? 'N/A'}** | ${d1Status} |\n`;

  markdown += `\n## 🔄 Sync Health Summary\n\n`;
  
  if (kvCount !== null && d1Count !== null) {
      const diff = Math.abs(kvCount - d1Count);
      if (diff === 0) {
          markdown += `> [!TIP]\n> **Perfect Sync**: KV and D1 row counts match exactly (${kvCount}).\n`;
      } else if (diff < 10) {
          markdown += `> [!NOTE]\n> **Minor Discrepancy**: KV has ${kvCount} keys, D1 has ${d1Count} rows (diff: ${diff}). This is normal during active ingestion.\n`;
      } else {
          markdown += `> [!WARNING]\n> **Large Discrepancy**: KV has ${kvCount} keys, D1 has ${d1Count} rows (diff: ${diff}). You may need to run \`sync:d1\` or \`sync:kv\`.\n`;
      }
  } else {
      markdown += `> [!CAUTION]\n> **Missing Data**: Unable to retrieve metrics for one or both datastores. Check API tokens and Wrangler authentication.\n`;
  }

  if (!existsSync(dirname(DASHBOARD_PATH))) {
    mkdirSync(dirname(DASHBOARD_PATH), { recursive: true });
  }

  writeFileSync(DASHBOARD_PATH, markdown, 'utf8');
  console.log(`✅ Observability Dashboard updated at ${DASHBOARD_PATH}`);
}

generateDashboard().catch(console.error);
