#!/usr/bin/env npx tsx

import {
  buildPlanningPhaseLifecycleReport,
  DEFAULT_PLANNING_PHASE_LIFECYCLE_JSON_PATH,
  DEFAULT_PLANNING_PHASE_LIFECYCLE_MD_PATH,
  renderPlanningPhaseLifecycleReport,
  syncPlanningPhaseLifecycle,
  writePlanningPhaseLifecycleArtifacts,
} from './lib/planning-phase-lifecycle';

function readArg(flag: string): string | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return value ? value.slice(flag.length + 1) : undefined;
}

async function main() {
  const rootDir = readArg('--root');
  const stdoutOnly = process.argv.includes('--stdout-only');
  const apply = process.argv.includes('--apply');

  const report = apply
    ? syncPlanningPhaseLifecycle({
        rootDir,
        outputPath: readArg('--output') || DEFAULT_PLANNING_PHASE_LIFECYCLE_MD_PATH,
        jsonOutputPath: readArg('--json-output') || DEFAULT_PLANNING_PHASE_LIFECYCLE_JSON_PATH,
      })
    : buildPlanningPhaseLifecycleReport({ rootDir });

  if (!stdoutOnly && !apply) {
    writePlanningPhaseLifecycleArtifacts(report, {
      outputPath: readArg('--output') || DEFAULT_PLANNING_PHASE_LIFECYCLE_MD_PATH,
      jsonOutputPath: readArg('--json-output') || DEFAULT_PLANNING_PHASE_LIFECYCLE_JSON_PATH,
    });
  }

  console.log(renderPlanningPhaseLifecycleReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
