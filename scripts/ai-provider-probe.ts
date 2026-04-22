#!/usr/bin/env npx tsx

import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import {
  renderAIProviderProbeReport,
  resolveAIProviderProbeExitCode,
  runAIProviderProbe,
  writeAIProviderProbeArtifacts,
  type AIProviderProbeExitPolicy,
} from './lib/ai-provider-probe';

if (existsSync('.env')) dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseExitPolicy(raw: string | undefined): AIProviderProbeExitPolicy {
  switch ((raw || '').trim().toLowerCase()) {
    case 'none':
    case 'all-down':
    case 'nvidia-all-down':
    case 'any-failure':
      return raw!.trim().toLowerCase() as AIProviderProbeExitPolicy;
    default:
      return 'nvidia-all-down';
  }
}

async function main(): Promise<void> {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const timeoutMs = parsePositiveInt(readArg('--timeout-ms'), 20_000);
  const concurrency = parsePositiveInt(readArg('--concurrency'), 2);
  const failOn = parseExitPolicy(readArg('--fail-on'));
  const jsonOutput = readArg('--json-output');
  const mdOutput = readArg('--md-output');

  const report = await runAIProviderProbe({
    timeoutMs,
    concurrency,
  });
  const markdown = renderAIProviderProbeReport(report);

  if (!stdoutOnly) {
    const paths = writeAIProviderProbeArtifacts(report, {
      jsonPath: jsonOutput,
      mdPath: mdOutput,
    });
    console.log(`Saved AI provider probe data to ${paths.jsonPath}`);
    console.log(`Saved AI provider probe report to ${paths.mdPath}`);
  }

  console.log('');
  console.log(markdown);

  const exitCode = resolveAIProviderProbeExitCode(report, failOn);
  if (exitCode !== 0) {
    console.error('');
    console.error(
      `AI provider probe failed under policy ${failOn}. NVIDIA healthy=${report.summary.nvidiaHealthy}/${report.targets.nvidia}, total healthy=${report.summary.healthy}/${report.summary.total}`,
    );
    process.exitCode = exitCode;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
