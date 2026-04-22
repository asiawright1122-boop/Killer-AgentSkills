#!/usr/bin/env npx tsx

import { existsSync } from 'node:fs';
import * as dotenv from 'dotenv';
import {
  DEFAULT_OPS_HANDOFF_JSON_PATH,
  DEFAULT_OPS_HANDOFF_PUBLICATION_JSON_PATH,
  DEFAULT_OPS_HANDOFF_PUBLICATION_MD_PATH,
  loadOperatorRemediationHandoffReport,
  publishOperatorRemediationHandoffReport,
  renderOperatorRemediationHandoffPublicationReport,
  writeOperatorRemediationHandoffPublicationReport,
} from './lib/operator-ops-handoff';

dotenv.config();
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main(): Promise<void> {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const dryRun = process.argv.includes('--dry-run');
  const handoffJsonPath = readArg('--handoff-json') || DEFAULT_OPS_HANDOFF_JSON_PATH;
  const outputPath = readArg('--output') || DEFAULT_OPS_HANDOFF_PUBLICATION_MD_PATH;
  const jsonOutputPath = readArg('--json-output') || DEFAULT_OPS_HANDOFF_PUBLICATION_JSON_PATH;
  const apiBaseUrl = readArg('--api-base-url');
  const githubToken = readArg('--github-token') || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

  const handoffReport = loadOperatorRemediationHandoffReport(handoffJsonPath);
  const publication = await publishOperatorRemediationHandoffReport({
    handoffReport,
    sourceReportPath: handoffJsonPath,
    githubToken,
    apiBaseUrl,
    dryRun,
  });

  if (!stdoutOnly) {
    writeOperatorRemediationHandoffPublicationReport(publication, {
      outputPath,
      jsonOutputPath,
    });
  }

  console.log(renderOperatorRemediationHandoffPublicationReport(publication));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
