#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as dotenv from 'dotenv';
import {
  DEFAULT_AI_CONFIG_GUARD_JSON_PATH,
  DEFAULT_AI_CONFIG_GUARD_MD_PATH,
  inspectAiConfigGuard,
  renderAiConfigGuardReport,
} from './lib/ai-config-guard';

dotenv.config();
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

try {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const outputPath = resolve(process.cwd(), readArg('--output') || DEFAULT_AI_CONFIG_GUARD_MD_PATH);
  const jsonOutputPath = resolve(process.cwd(), readArg('--json-output') || DEFAULT_AI_CONFIG_GUARD_JSON_PATH);
  const report = inspectAiConfigGuard();
  const markdown = renderAiConfigGuardReport(report);

  if (!stdoutOnly) {
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    writeFileSync(outputPath, markdown);
    writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
    console.log(`Saved AI config guard report to ${outputPath}`);
    console.log(`Saved AI config guard data to ${jsonOutputPath}`);
    console.log('');
  }

  console.log(markdown);

  if (report.issues.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
