#!/usr/bin/env npx tsx

import {
  archivePlanningTraceabilityArtifacts,
  buildPlanningTraceabilityReport,
  DEFAULT_PLANNING_TRACEABILITY_JSON_PATH,
  DEFAULT_PLANNING_TRACEABILITY_MD_PATH,
  renderPlanningTraceabilityReport,
  writePlanningTraceabilityArtifacts,
} from './lib/planning-traceability';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const rootDir = readArg('--root');
  const stdoutOnly = process.argv.includes('--stdout-only');
  const archiveCurrent = process.argv.includes('--archive-current');

  if (!stdoutOnly && archiveCurrent) {
    archivePlanningTraceabilityArtifacts({
      rootDir,
      inputPath: readArg('--output') || DEFAULT_PLANNING_TRACEABILITY_MD_PATH,
      jsonInputPath: readArg('--json-output') || DEFAULT_PLANNING_TRACEABILITY_JSON_PATH,
      outputPath: readArg('--archive-output'),
      jsonOutputPath: readArg('--archive-json-output'),
    });
  }

  const report = buildPlanningTraceabilityReport({ rootDir });

  if (!stdoutOnly) {
    writePlanningTraceabilityArtifacts(report, {
      outputPath: readArg('--output') || DEFAULT_PLANNING_TRACEABILITY_MD_PATH,
      jsonOutputPath: readArg('--json-output') || DEFAULT_PLANNING_TRACEABILITY_JSON_PATH,
    });
  }

  console.log(renderPlanningTraceabilityReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
