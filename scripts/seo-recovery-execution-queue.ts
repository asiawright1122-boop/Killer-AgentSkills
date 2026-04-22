#!/usr/bin/env npx tsx

import {
  buildRecoveryExecutionQueueFromFiles,
  DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
  DEFAULT_RECOVERY_EXECUTION_QUEUE_MD_PATH,
  renderRecoveryExecutionQueueReport,
  writeRecoveryExecutionQueueArtifacts,
} from './lib/recovery-execution-queue';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildRecoveryExecutionQueueFromFiles({
    controlBoardJsonPath: readArg('--board-json'),
    scorecardJsonPath: readArg('--scorecard-json'),
    missingClusterAuditJsonPath: readArg('--missing-cluster-json'),
  });

  if (!stdoutOnly) {
    writeRecoveryExecutionQueueArtifacts(report, {
      markdownOutputPath: readArg('--output') || DEFAULT_RECOVERY_EXECUTION_QUEUE_MD_PATH,
      jsonOutputPath: readArg('--json-output') || DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
    });
  }

  console.log(renderRecoveryExecutionQueueReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
