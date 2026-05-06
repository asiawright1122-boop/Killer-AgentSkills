#!/usr/bin/env npx tsx

import {
  buildP0UrlRecoveryPreflightReportFromFiles,
  DEFAULT_P0_URL_RECOVERY_PREFLIGHT_JSON_PATH,
  DEFAULT_P0_URL_RECOVERY_PREFLIGHT_MD_PATH,
  renderP0UrlRecoveryPreflightReport,
  writeP0UrlRecoveryPreflightArtifacts,
} from './lib/p0-url-recovery-preflight';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildP0UrlRecoveryPreflightReportFromFiles({
    coverageJsonPath: readArg('--coverage-json'),
    executionQueueJsonPath: readArg('--queue-json'),
    otherAuditJsonPath: readArg('--other-json'),
    sourceFileAuditJsonPath: readArg('--source-file-json'),
    missingClusterAuditJsonPath: readArg('--missing-cluster-json'),
  });

  const finalizedReport = stdoutOnly
    ? report
    : writeP0UrlRecoveryPreflightArtifacts(report, {
        markdownOutputPath: readArg('--output') || DEFAULT_P0_URL_RECOVERY_PREFLIGHT_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_P0_URL_RECOVERY_PREFLIGHT_JSON_PATH,
      });

  console.log(renderP0UrlRecoveryPreflightReport(finalizedReport));
}

main();
