#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  type AiTelemetryAlertSeverity,
  buildAiTelemetryTrend,
  DEFAULT_AI_TREND_JSON_PATH,
  DEFAULT_AI_TREND_MD_PATH,
  filterAiTelemetryAlertsAtOrAboveSeverity,
  listAiTelemetrySamples,
  renderAiTelemetryTrendReport,
} from './lib/ai-telemetry-trend';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

function parseFailOnSeverity(raw: string | undefined): AiTelemetryAlertSeverity | null {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized || normalized === 'none' || normalized === 'off') return null;
  if (normalized === 'warning' || normalized === 'critical') return normalized;
  throw new Error(`Invalid --fail-on severity "${raw}". Use warning, critical, or none.`);
}

async function main() {
  const reportsDir = resolve(process.cwd(), readArg('--reports-dir') || 'reports/seo');
  const limitArg = readArg('--limit');
  const limit = limitArg ? Math.max(Number.parseInt(limitArg, 10) || 0, 0) : 20;
  const stdoutOnly = process.argv.includes('--stdout-only');
  const outputPath = resolve(process.cwd(), readArg('--output') || DEFAULT_AI_TREND_MD_PATH);
  const jsonOutputPath = resolve(process.cwd(), readArg('--json-output') || DEFAULT_AI_TREND_JSON_PATH);
  const failOnSeverity = parseFailOnSeverity(readArg('--fail-on') || process.env.AI_ALERT_FAIL_ON_SEVERITY);

  const allSamples = listAiTelemetrySamples(reportsDir);
  const samples = limit > 0 ? allSamples.slice(-limit) : allSamples;
  if (samples.length === 0) {
    throw new Error(`No AI telemetry samples found under ${reportsDir}.`);
  }

  const trend = buildAiTelemetryTrend(samples, reportsDir);
  const markdown = renderAiTelemetryTrendReport(trend);

  if (!stdoutOnly) {
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    writeFileSync(outputPath, markdown);
    writeFileSync(jsonOutputPath, JSON.stringify(trend, null, 2));
    console.log(`Saved AI telemetry trend report to ${outputPath}`);
    console.log(`Saved AI telemetry trend data to ${jsonOutputPath}`);
  }

  console.log('');
  console.log(markdown);

  if (failOnSeverity) {
    const blockingAlerts = filterAiTelemetryAlertsAtOrAboveSeverity(trend.alerts, failOnSeverity);
    if (blockingAlerts.length > 0) {
      console.error('');
      console.error(
        `AI telemetry alert gate triggered at severity >= ${failOnSeverity}: ${blockingAlerts.map((alert) => alert.title).join('; ')}`,
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
