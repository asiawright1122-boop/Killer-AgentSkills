#!/usr/bin/env npx tsx

import {
  buildRecoveryScorecardFromFiles,
  DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH,
  DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
  DEFAULT_CRAWL_HEALTH_JSON_PATH,
  DEFAULT_INDEX_DRIFT_JSON_PATH,
  DEFAULT_RECOVERY_SCORECARD_JSON_PATH,
  DEFAULT_RECOVERY_SCORECARD_MD_PATH,
  DEFAULT_TRAFFIC_REPORT_MD_PATH,
  renderRecoveryScorecardReport,
  writeRecoveryScorecardArtifacts,
} from './lib/recovery-scorecard';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const stdoutOnly = process.argv.includes('--stdout-only');
  const report = buildRecoveryScorecardFromFiles({
    crawlJsonPath: readArg('--crawl-json') || DEFAULT_CRAWL_HEALTH_JSON_PATH,
    coverageJsonPath: readArg('--coverage-json') || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
    indexJsonPath: readArg('--index-json') || DEFAULT_INDEX_DRIFT_JSON_PATH,
    trafficReportPath: readArg('--traffic-md') || DEFAULT_TRAFFIC_REPORT_MD_PATH,
    aiJsonPath: readArg('--ai-json') || DEFAULT_AI_PROVIDER_HEALTH_JSON_PATH,
    now: readArg('--now'),
  });

  if (!stdoutOnly) {
    writeRecoveryScorecardArtifacts(report, {
      markdownOutputPath: readArg('--output') || DEFAULT_RECOVERY_SCORECARD_MD_PATH,
      jsonOutputPath: readArg('--json-output') || DEFAULT_RECOVERY_SCORECARD_JSON_PATH,
    });
  }

  console.log(renderRecoveryScorecardReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
