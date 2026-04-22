#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH,
  DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH,
} from './lib/ai-provider-probe';
import {
  buildAiProviderHealthArtifacts,
  buildAiProviderHealthReport,
  DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH,
  DEFAULT_AI_PROVIDER_HEALTH_MD_PATH,
  DEFAULT_AI_TELEMETRY_SUMMARY_MD_PATH,
  parseAiAlertSeverity,
} from './lib/ai-provider-health';
import { DEFAULT_AI_TREND_JSON_PATH, DEFAULT_AI_TREND_MD_PATH } from './lib/ai-telemetry-trend';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const positionalPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const reportsDir = resolve(process.cwd(), readArg('--reports-dir') || 'reports/seo');
  const checkpointArg = readArg('--checkpoint-file') || positionalPath;
  const limitArg = readArg('--limit');
  const limit = limitArg ? Math.max(Number.parseInt(limitArg, 10) || 0, 0) : 20;
  const stdoutOnly = process.argv.includes('--stdout-only');
  const outputPath = resolve(process.cwd(), readArg('--output') || DEFAULT_AI_PROVIDER_HEALTH_MD_PATH);
  const jsonOutputPath = resolve(process.cwd(), readArg('--json-output') || DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH);
  const telemetryOutputPath = resolve(
    process.cwd(),
    readArg('--telemetry-output') || DEFAULT_AI_TELEMETRY_SUMMARY_MD_PATH,
  );
  const trendOutputPath = resolve(process.cwd(), readArg('--trend-output') || DEFAULT_AI_TREND_MD_PATH);
  const trendJsonOutputPath = resolve(process.cwd(), readArg('--trend-json-output') || DEFAULT_AI_TREND_JSON_PATH);
  const probeTrendOutputPath = resolve(
    process.cwd(),
    readArg('--probe-trend-output') || DEFAULT_AI_PROVIDER_PROBE_TREND_MD_PATH,
  );
  const probeTrendJsonOutputPath = resolve(
    process.cwd(),
    readArg('--probe-trend-json-output') || DEFAULT_AI_PROVIDER_PROBE_TREND_JSON_PATH,
  );
  const failOnSeverity = parseAiAlertSeverity(readArg('--fail-on') || process.env.AI_ALERT_FAIL_ON_SEVERITY);

  const report = buildAiProviderHealthReport({
    checkpointPath: checkpointArg,
    reportsDir,
    limit,
    failOnSeverity,
  });
  const artifacts = buildAiProviderHealthArtifacts(report);

  if (!stdoutOnly) {
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    mkdirSync(dirname(telemetryOutputPath), { recursive: true });
    mkdirSync(dirname(trendOutputPath), { recursive: true });
    mkdirSync(dirname(trendJsonOutputPath), { recursive: true });
    mkdirSync(dirname(probeTrendOutputPath), { recursive: true });
    mkdirSync(dirname(probeTrendJsonOutputPath), { recursive: true });

    writeFileSync(outputPath, artifacts.healthMarkdown);
    writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
    writeFileSync(telemetryOutputPath, artifacts.telemetryMarkdown);
    writeFileSync(trendOutputPath, artifacts.trendMarkdown);
    writeFileSync(trendJsonOutputPath, JSON.stringify(report.trend, null, 2));
    writeFileSync(probeTrendOutputPath, artifacts.probeTrendMarkdown);
    writeFileSync(probeTrendJsonOutputPath, JSON.stringify(report.directProbeTrend, null, 2));

    console.log(`Saved AI provider health report to ${outputPath}`);
    console.log(`Saved AI provider health data to ${jsonOutputPath}`);
    console.log(`Saved AI telemetry summary to ${telemetryOutputPath}`);
    console.log(`Saved AI telemetry trend report to ${trendOutputPath}`);
    console.log(`Saved AI telemetry trend data to ${trendJsonOutputPath}`);
    console.log(`Saved AI provider probe trend report to ${probeTrendOutputPath}`);
    console.log(`Saved AI provider probe trend data to ${probeTrendJsonOutputPath}`);
  }

  console.log('');
  console.log(artifacts.healthMarkdown);

  if (report.gate.blocking) {
    console.error('');
    console.error(
      `AI provider health gate triggered at severity >= ${report.gate.failOnSeverity}: ${report.gate.blockingAlertTitles.join('; ')}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
