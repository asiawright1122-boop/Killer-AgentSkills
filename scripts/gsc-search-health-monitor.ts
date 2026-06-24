#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type SearchHealthAlertCode =
  | 'gsc_freshness_sla_breach'
  | 'gsc_freshness_sla_warning'
  | 'gsc_clicks_collapse'
  | 'gsc_clicks_drop_warning'
  | 'gsc_crawl_error_spike'
  | 'gsc_crawl_error_warning'
  | 'gsc_unexpected_cluster_spike'
  | 'gsc_unexpected_cluster_warning'
  | 'gsc_index_shrink_critical'
  | 'gsc_index_shrink_warning';

export type SearchHealthAlert = {
  code: SearchHealthAlertCode;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
};

export type SearchHealthAnalysisResult = {
  status: 'clear' | 'warning' | 'blocking';
  generatedAt: string;
  alerts: SearchHealthAlert[];
  metrics: {
    coverageAgeDays: number;
    clicksDropRate: number;
    crawlErrorsCount: number;
    unexpectedClusterCount: number;
  };
};

export function analyzeSearchHealth(ctrData: any, coverageData: any): SearchHealthAnalysisResult {
  const alerts: SearchHealthAlert[] = [];

  // 1. Freshness SLA checks
  const ageDays = typeof coverageData?.sourceFreshnessDays === 'number' ? coverageData.sourceFreshnessDays : 0;
  if (ageDays > 30) {
    alerts.push({
      code: 'gsc_freshness_sla_breach',
      severity: 'critical',
      title: 'Coverage Data Stale SLA Breach',
      message: `The GSC Coverage Drilldown data is ${ageDays} days old, breaching the 30-day SLA window.`,
    });
  } else if (ageDays > 15) {
    alerts.push({
      code: 'gsc_freshness_sla_warning',
      severity: 'warning',
      title: 'Coverage Data Stale Warning',
      message: `The GSC Coverage Drilldown data is ${ageDays} days old, exceeding the 15-day warning window.`,
    });
  }

  // 2. Click drop checks (Week-over-week)
  let clicksDropRate = 0;
  if (typeof ctrData?.clicksDropRate === 'number') {
    clicksDropRate = ctrData.clicksDropRate;
  } else if (
    typeof ctrData?.currentClicks === 'number' &&
    typeof ctrData?.previousClicks === 'number' &&
    ctrData.previousClicks > 0
  ) {
    clicksDropRate = (ctrData.previousClicks - ctrData.currentClicks) / ctrData.previousClicks;
  }

  if (clicksDropRate > 0.3) {
    alerts.push({
      code: 'gsc_clicks_collapse',
      severity: 'critical',
      title: 'GSC Clicks Collapse',
      message: `Week-over-week Google Search clicks dropped by ${(clicksDropRate * 100).toFixed(1)}%, breaching the 30% critical threshold.`,
    });
  } else if (clicksDropRate > 0.15) {
    alerts.push({
      code: 'gsc_clicks_drop_warning',
      severity: 'warning',
      title: 'GSC Clicks Drop Warning',
      message: `Week-over-week Google Search clicks dropped by ${(clicksDropRate * 100).toFixed(1)}%, exceeding the 15% warning threshold.`,
    });
  }

  // 3. Server crawl errors (5xx/Server Errors)
  let crawlErrorsCount = 0;
  if (typeof coverageData?.crawlErrorsCount === 'number') {
    crawlErrorsCount = coverageData.crawlErrorsCount;
  } else {
    const issues = Array.isArray(coverageData?.issueSummaries) ? coverageData.issueSummaries : [];
    for (const issue of issues) {
      const name = issue.issueName || '';
      if (name.toLowerCase().includes('5xx') || name.includes('服务器') || name.includes('server')) {
        crawlErrorsCount += typeof issue.affectedPages === 'number' ? issue.affectedPages : 0;
      }
    }
  }

  if (crawlErrorsCount > 150) {
    alerts.push({
      code: 'gsc_crawl_error_spike',
      severity: 'critical',
      title: 'GSC Server Crawl Error Spike',
      message: `Detected ${crawlErrorsCount} server (5xx) crawl errors, breaching the 150 pages critical limit.`,
    });
  } else if (crawlErrorsCount > 50) {
    alerts.push({
      code: 'gsc_crawl_error_warning',
      severity: 'warning',
      title: 'GSC Server Crawl Error Warning',
      message: `Detected ${crawlErrorsCount} server (5xx) crawl errors, exceeding the 50 pages warning threshold.`,
    });
  }

  // 4. Unexpected other clusters checks
  let unexpectedClusterCount = 0;
  if (typeof coverageData?.unexpectedClusterCount === 'number') {
    unexpectedClusterCount = coverageData.unexpectedClusterCount;
  } else {
    const clusters = Array.isArray(coverageData?.clusterPriorities) ? coverageData.clusterPriorities : [];
    const otherCluster = clusters.find((c: any) => c.cluster === 'other');
    if (otherCluster) {
      unexpectedClusterCount =
        typeof otherCluster.estimatedAffected === 'number'
          ? otherCluster.estimatedAffected
          : typeof otherCluster.sampleCount === 'number'
            ? otherCluster.sampleCount
            : 0;
    }
  }

  if (unexpectedClusterCount > 200) {
    alerts.push({
      code: 'gsc_unexpected_cluster_spike',
      severity: 'critical',
      title: 'Unexpected Crawl Cluster Spike',
      message: `Estimated affected pages in "other" cluster is ${unexpectedClusterCount.toFixed(1)}, breaching the 200 limit.`,
    });
  } else if (unexpectedClusterCount > 50) {
    alerts.push({
      code: 'gsc_unexpected_cluster_warning',
      severity: 'warning',
      title: 'Unexpected Crawl Cluster Warning',
      message: `Estimated affected pages in "other" cluster is ${unexpectedClusterCount.toFixed(1)}, exceeding the 50 limit.`,
    });
  }

  // 5. Index shrink signal — flags if GSC indexed page count drops too low
  // after intentional Tier 1 slimdown. Expected range is 300-500 Tier 1 pages.
  const pageRows = typeof ctrData?.pageRows === 'number' ? ctrData.pageRows : 0;
  if (pageRows > 0 && pageRows < 50) {
    alerts.push({
      code: 'gsc_index_shrink_critical',
      severity: 'critical',
      title: 'Index Shrink Signal — Critical',
      message: `Only ${pageRows} pages in GSC index — possible over-shrinkage beyond Tier 1 intent. Verify tier boundaries and sitemap output.`,
    });
  } else if (pageRows > 0 && pageRows < 150) {
    alerts.push({
      code: 'gsc_index_shrink_warning',
      severity: 'warning',
      title: 'Index Shrink Signal — Warning',
      message: `Low page count in GSC index: ${pageRows} pages. Monitor to ensure Tier 1 pages are being discovered.`,
    });
  }

  // Overall status resolve
  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const hasWarning = alerts.some((a) => a.severity === 'warning');
  const status = hasCritical ? 'blocking' : hasWarning ? 'warning' : 'clear';

  return {
    status,
    generatedAt: new Date().toISOString(),
    alerts,
    metrics: {
      coverageAgeDays: ageDays,
      clicksDropRate,
      crawlErrorsCount,
      unexpectedClusterCount,
    },
  };
}

export function renderMarkdownReport(result: SearchHealthAnalysisResult): string {
  const emoji = result.status === 'blocking' ? '🔴' : result.status === 'warning' ? '🟡' : '🟢';
  const statusText = result.status.toUpperCase();

  const lines = [
    '# Google Search Console Search Health Monitor Report',
    '',
    `- Generated At: ${result.generatedAt}`,
    `- Status: ${emoji} **${statusText}**`,
    '',
    '## Checked Metrics',
    `- Coverage Freshness Age: \`${result.metrics.coverageAgeDays}\` days`,
    `- Week-over-week Clicks Drop: \`${(result.metrics.clicksDropRate * 100).toFixed(1)}%\``,
    `- Server (5xx) Crawl Errors: \`${result.metrics.crawlErrorsCount}\` pages`,
    `- Unexpected "Other" Cluster Count: \`${result.metrics.unexpectedClusterCount.toFixed(1)}\` pages`,
    '',
    '## Active Alerts',
  ];

  if (result.alerts.length === 0) {
    lines.push('✓ No active warnings or blocking search health alerts.');
  } else {
    for (const alert of result.alerts) {
      const severityEmoji = alert.severity === 'critical' ? '❌' : '⚠️';
      lines.push(`### ${severityEmoji} [${alert.severity.toUpperCase()}] ${alert.title}`);
      lines.push(`- **Code:** \`${alert.code}\``);
      lines.push(`- **Message:** ${alert.message}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

async function main() {
  const isMain = process.argv[1] && existsSync(process.argv[1]) && readFileSync(process.argv[1], 'utf8').includes('analyzeSearchHealth');
  if (!isMain) return;

  // Extract arguments
  const args = process.argv.slice(2);
  const mockCtrPath = args.find((a) => a.startsWith('--mock-ctr-json='))?.split('=')[1];
  const mockCoveragePath = args.find((a) => a.startsWith('--mock-coverage-json='))?.split('=')[1];
  const allowWarnings = args.includes('--allow-warnings');

  const ctrReportPath = mockCtrPath ? resolve(mockCtrPath) : resolve(process.cwd(), 'reports/gsc/latest-ctr-report.json');
  const coverageReportPath = mockCoveragePath
    ? resolve(mockCoveragePath)
    : resolve(process.cwd(), 'reports/seo/latest-coverage-drilldown.json');

  let ctrData: any = {};
  let coverageData: any = {};

  try {
    if (existsSync(ctrReportPath)) {
      ctrData = JSON.parse(readFileSync(ctrReportPath, 'utf8'));
    }
  } catch (err) {
    console.warn(`[GSC-Monitor] Warning: Could not read GSC CTR report: ${(err as Error).message}`);
  }

  try {
    if (existsSync(coverageReportPath)) {
      coverageData = JSON.parse(readFileSync(coverageReportPath, 'utf8'));
    }
  } catch (err) {
    console.warn(`[GSC-Monitor] Warning: Could not read Coverage Drilldown report: ${(err as Error).message}`);
  }

  const result = analyzeSearchHealth(ctrData, coverageData);
  const mdReport = renderMarkdownReport(result);

  const outDir = resolve(process.cwd(), 'reports/gsc');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'search-health-alerts.md'), mdReport, 'utf8');

  console.log(mdReport);

  if (result.status === 'blocking' && !allowWarnings) {
    console.error('\n🔴 [GSC-Monitor] Failed: Critical search health alerts are active.');
    process.exit(1);
  }

  console.log('\n🟢 [GSC-Monitor] Completed successfully.');
  process.exit(0);
}

// Run CLI
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // ESM or tsx runtime fallback check
  const isDirectRun = process.argv[1]?.endsWith('gsc-search-health-monitor.ts') || process.argv[1]?.endsWith('gsc-search-health-monitor.js');
  if (isDirectRun) {
    main().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
