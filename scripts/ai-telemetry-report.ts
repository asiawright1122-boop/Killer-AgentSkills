#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  getDefaultAiTelemetryOutputPath,
  loadAiTelemetryCheckpoint,
  renderAiTelemetryReport,
  resolveAiTelemetryCheckpoint,
} from './lib/ai-telemetry-report';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const positionalPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const checkpointArg = readArg('--checkpoint-file') || positionalPath;
  const outputArg = readArg('--output');
  const stdoutOnly = process.argv.includes('--stdout-only');

  const checkpointPath = resolveAiTelemetryCheckpoint(checkpointArg);
  const checkpoint = loadAiTelemetryCheckpoint(checkpointPath);
  const report = renderAiTelemetryReport(checkpoint, checkpointPath);

  if (!stdoutOnly) {
    const outputPath = resolve(process.cwd(), outputArg || getDefaultAiTelemetryOutputPath(checkpointPath));
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, report);
    console.log(`Saved AI telemetry summary to ${outputPath}`);
  }

  console.log('');
  console.log(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
