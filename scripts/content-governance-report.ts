#!/usr/bin/env npx tsx

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  buildContentGovernanceReport,
  DEFAULT_CONTENT_GOVERNANCE_JSON_PATH,
  DEFAULT_CONTENT_GOVERNANCE_MD_PATH,
  parseContentGovernanceThreshold,
  renderContentGovernanceReport,
  type ContentGovernanceRouteContracts,
} from './lib/content-governance';
import { buildSeoCollectionDriftReport } from './lib/seo-collection-drift';
import { buildSeoCollectionLocaleGapReport } from './lib/seo-collection-locale-gaps';

const execFileAsync = promisify(execFile);
const ROUTE_CONTRACT_COMMAND = [
  'npx',
  'vitest',
  'run',
  'tests/pages/public-links.test.ts',
  'src/messages/public-copy.test.ts',
  'src/lib/markdown-headings.test.ts',
  'src/lib/site/breadcrumbs.test.ts',
  'src/lib/site/metadata.test.ts',
] as const;

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function runRouteContracts(cwd: string): Promise<ContentGovernanceRouteContracts> {
  try {
    const { stdout, stderr } = await execFileAsync(ROUTE_CONTRACT_COMMAND[0], ROUTE_CONTRACT_COMMAND.slice(1), {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      command: ROUTE_CONTRACT_COMMAND.join(' '),
      passed: true,
      exitCode: 0,
      summary: 'Representative localized public-route contracts passed',
      details: [stdout, stderr].filter(Boolean).join('\n').trim() || null,
    };
  } catch (error: any) {
    return {
      command: ROUTE_CONTRACT_COMMAND.join(' '),
      passed: false,
      exitCode: typeof error?.code === 'number' ? error.code : 1,
      summary: 'Representative localized public-route contracts failed',
      details: [error?.stdout, error?.stderr, error?.message].filter(Boolean).join('\n').trim() || null,
    };
  }
}

async function main() {
  const cwd = resolve(process.cwd(), readArg('--root') || '.');
  const stdoutOnly = process.argv.includes('--stdout-only');
  const failOnSeverity = parseContentGovernanceThreshold(
    readArg('--fail-on') || process.env.CONTENT_GOVERNANCE_FAIL_ON_SEVERITY || 'blocking',
  );
  const outputPath = resolve(cwd, readArg('--output') || DEFAULT_CONTENT_GOVERNANCE_MD_PATH);
  const jsonOutputPath = resolve(cwd, readArg('--json-output') || DEFAULT_CONTENT_GOVERNANCE_JSON_PATH);

  const localeGaps = buildSeoCollectionLocaleGapReport({ workspaceRoot: cwd });
  const collectionDrift = buildSeoCollectionDriftReport({ workspaceRoot: cwd });
  const routeContracts = await runRouteContracts(cwd);

  const report = buildContentGovernanceReport({
    failOnSeverity,
    localeGaps,
    collectionDrift,
    routeContracts,
  });
  const markdown = renderContentGovernanceReport(report);

  if (!stdoutOnly) {
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    writeFileSync(outputPath, markdown);
    writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
  }

  console.log(markdown);

  if (report.gate.blocking) {
    console.error('');
    console.error(
      `Content governance gate triggered at severity >= ${report.gate.failOnSeverity}: ${report.gate.triggeredChecks.join(', ')}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
