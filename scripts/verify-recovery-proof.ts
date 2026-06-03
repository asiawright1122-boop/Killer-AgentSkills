#!/usr/bin/env npx tsx

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const SCORECARD_PATH = resolve(process.cwd(), '.planning', 'dashboards', 'recovery-scorecard.md');

function execWranglerCommand(args: string[]): string {
  try {
    return execFileSync('npx', ['wrangler', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    console.error(`❌ Wrangler query failed: npx wrangler ${args.join(' ')}`);
    console.error(error instanceof Error ? error.message : String(error));
    return '';
  }
}

interface StatusRow {
  status: string;
  count: number;
}

interface ReasonRow {
  reason: string;
  count: number;
}

function main() {
  console.log('🔍 Querying D1 GSC Coverage records...');

  const statusOutput = execWranglerCommand([
    'd1', 'execute', 'killer-skills-db', '--remote',
    '--command', 'SELECT status, count(*) as count FROM gsc_coverage_drilldown GROUP BY status;',
    '--json'
  ]);

  const reasonOutput = execWranglerCommand([
    'd1', 'execute', 'killer-skills-db', '--remote',
    '--command', "SELECT reason, count(*) as count FROM gsc_coverage_drilldown WHERE status = 'Excluded' GROUP BY reason;",
    '--json'
  ]);

  if (!statusOutput || !reasonOutput) {
    console.error('❌ Failed to retrieve coverage metrics from D1.');
    process.exit(1);
  }

  let statusRows: StatusRow[] = [];
  let reasonRows: ReasonRow[] = [];

  try {
    const parsedStatus = JSON.parse(statusOutput);
    statusRows = parsedStatus?.[0]?.results || [];

    const parsedReason = JSON.parse(reasonOutput);
    reasonRows = parsedReason?.[0]?.results || [];
  } catch (err) {
    console.error('❌ Failed to parse D1 output:', err);
    process.exit(1);
  }

  let total = 0;
  let indexed = 0;
  let excluded = 0;

  for (const row of statusRows) {
    total += row.count;
    if (row.status.toLowerCase() === 'indexed') {
      indexed = row.count;
    } else if (row.status.toLowerCase() === 'excluded') {
      excluded = row.count;
    }
  }

  const recoveryRate = total > 0 ? (indexed / total) * 100 : 0;
  const timestamp = new Date().toISOString();

  let md = `# Post-Intervention Recovery Scorecard\n\n`;
  md += `*Last Verified: ${timestamp}*\n\n`;
  md += `## 📈 Overall Recovery Progress\n\n`;
  md += `| Metric | Value | Breakdown / Notes |\n`;
  md += `|---|---|---|\n`;
  md += `| **Total Coverage Checked** | **${total}** | URLs tracked in Google Search Console |\n`;
  md += `| **Indexed URLs** | **${indexed}** | Target search-accessible URL set |\n`;
  md += `| **Excluded URLs** | **${excluded}** | Blocked or unindexed URL set |\n`;
  md += `| **Technical Recovery Rate** | **${recoveryRate.toFixed(2)}%** | Threshold requirement: **>= 95%** |\n\n`;

  if (recoveryRate >= 95) {
    md += `> [!TIP]\n> **Technical Recovery Threshold Cleared**: Indexation recovery rate is at **${recoveryRate.toFixed(2)}%** (>= 95%).\n\n`;
  } else {
    md += `> [!WARNING]\n> **Technical Recovery Threshold Blocked**: Current recovery rate is **${recoveryRate.toFixed(2)}%** (needs >= 95% to unlock automation).\n\n`;
  }

  md += `## ❌ Exclusion Reasons Analysis\n\n`;
  if (reasonRows.length > 0) {
    md += `| Reason | Affected URLs | Action Item |\n`;
    md += `|---|---|---|\n`;
    for (const r of reasonRows) {
      let action = 'Needs investigation';
      if (r.reason.includes('404')) {
        action = 'Review 404 remediation redirects';
      } else if (r.reason.toLowerCase().includes('noindex')) {
        action = 'Verify page edge noindex headers';
      } else if (r.reason.toLowerCase().includes('canonical')) {
        action = 'Check canonical link match in page template';
      }
      md += `| ${r.reason} | ${r.count} | ${action} |\n`;
    }
  } else {
    md += `*No excluded URLs found. Great job!*\n`;
  }

  if (!existsSync(dirname(SCORECARD_PATH))) {
    mkdirSync(dirname(SCORECARD_PATH), { recursive: true });
  }

  writeFileSync(SCORECARD_PATH, md, 'utf8');
  console.log(`✅ Recovery scorecard generated at: ${SCORECARD_PATH}`);
}

main();
