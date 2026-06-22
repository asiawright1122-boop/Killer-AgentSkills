import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseFrontmatter } from './planning-traceability';

export const DEFAULT_PLANNING_PHASE_LIFECYCLE_MD_PATH = '.planning/phase-lifecycle/latest-phase-lifecycle.md';
export const DEFAULT_PLANNING_PHASE_LIFECYCLE_JSON_PATH = '.planning/phase-lifecycle/latest-phase-lifecycle.json';

type ParsedRoadmapPhase = {
  phaseNumber: string;
  slug: string;
};

export type PlanningPhaseLifecycleAction = {
  type: 'archive' | 'restore' | 'create';
  milestone: string;
  phaseNumber: string;
  slug: string;
  dirName: string;
  fromPath: string | null;
  toPath: string;
  reason: string;
};

export type PlanningPhaseLifecyclePhaseStatus = {
  phaseNumber: string;
  slug: string;
  dirName: string;
  status: 'present' | 'archived' | 'missing' | 'conflict';
  activePaths: string[];
  archivePaths: string[];
};

export type PlanningPhaseLifecycleArchivedMilestone = {
  milestone: string;
  phaseArchivePath: string;
  archivedDirs: string[];
  expectedPhaseDirs: string[];
};

export type PlanningPhaseLifecycleConflict = {
  milestone: string;
  phaseNumber: string;
  slug: string;
  activePaths: string[];
  archivePaths: string[];
  reason: string;
};

export type PlanningPhaseLifecycleReport = {
  generatedAt: string;
  projectRoot: string;
  activeMilestone: string | null;
  activeMilestoneName: string | null;
  status: 'clean' | 'pending' | 'warning';
  activePhaseArchivePath: string | null;
  activePhases: PlanningPhaseLifecyclePhaseStatus[];
  archivedMilestones: PlanningPhaseLifecycleArchivedMilestone[];
  archiveActions: PlanningPhaseLifecycleAction[];
  restoreActions: PlanningPhaseLifecycleAction[];
  createActions: PlanningPhaseLifecycleAction[];
  unmanagedPhaseDirs: string[];
  conflicts: PlanningPhaseLifecycleConflict[];
  rewrittenFiles: string[];
};

function readFileIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function parseCurrentMilestone(rootDir: string): { milestone: string | null; milestoneName: string | null } {
  const statePath = join(rootDir, '.planning', 'STATE.md');
  const { attributes } = parseFrontmatter(readFileIfExists(statePath));

  return {
    milestone: typeof attributes.milestone === 'string' ? attributes.milestone : null,
    milestoneName: typeof attributes.milestone_name === 'string' ? attributes.milestone_name : null,
  };
}

function parseRoadmapPhasesFromContent(content: string): ParsedRoadmapPhase[] {
  return Array.from(content.matchAll(/^### Phase ([^:]+): ([^\n]+)$/gm)).map((match) => ({
    phaseNumber: match[1].trim(),
    slug: match[2].trim(),
  }));
}

function parseActiveRoadmapPhases(rootDir: string): ParsedRoadmapPhase[] {
  return parseRoadmapPhasesFromContent(readFileIfExists(join(rootDir, '.planning', 'ROADMAP.md')));
}

function parseArchivedMilestonePhases(rootDir: string): Array<{ milestone: string; phases: ParsedRoadmapPhase[] }> {
  const milestonesDir = join(rootDir, '.planning', 'milestones');
  if (!existsSync(milestonesDir)) return [];

  return readdirSync(milestonesDir)
    .filter((name) => name.endsWith('-ROADMAP.md'))
    .sort()
    .map((name) => ({
      milestone: name.replace(/-ROADMAP\.md$/, ''),
      phases: parseRoadmapPhasesFromContent(readFileIfExists(join(milestonesDir, name))),
    }));
}

function listDirectories(path: string): string[] {
  if (!existsSync(path)) return [];

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function getPhasePrefix(dirName: string): string | null {
  return dirName.match(/^([^/]+?)-/)?.[1] || null;
}

function normalizePhaseSegment(segment: string): string {
  const trimmed = segment.trim();
  const match = trimmed.match(/^0*(\d+)([A-Za-z])?$/);
  if (!match) return trimmed.toUpperCase();

  const value = String(Number(match[1]));
  return `${value}${match[2] ? match[2].toUpperCase() : ''}`;
}

function normalizePhaseNumber(value: string): string {
  return value
    .split('.')
    .map((segment) => normalizePhaseSegment(segment))
    .join('.');
}

function normalizePhaseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function matchesPhaseDirectory(dirName: string, phase: ParsedRoadmapPhase): boolean {
  const prefix = getPhasePrefix(dirName);
  if (!prefix) return false;

  if (normalizePhaseNumber(prefix) !== normalizePhaseNumber(phase.phaseNumber)) {
    return false;
  }

  const slug = dirName.slice(prefix.length + 1);
  return slug === phase.slug || normalizePhaseSlug(slug) === normalizePhaseSlug(phase.slug);
}

function findMatchingDirectories(dirNames: string[], phase: ParsedRoadmapPhase): string[] {
  return dirNames.filter((dirName) => matchesPhaseDirectory(dirName, phase));
}

function getPhaseArchivePath(milestone: string): string {
  return `.planning/milestones/${milestone}-phases`;
}

function isPhaseLikeDirectory(dirName: string): boolean {
  return /^\d/.test(dirName);
}

function walkPlanningFiles(rootDir: string): string[] {
  const planningRoot = join(rootDir, '.planning');
  if (!existsSync(planningRoot)) return [];

  const files: string[] = [];
  const stack = [planningRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && (fullPath.endsWith('.md') || fullPath.endsWith('.json'))) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function rewritePlanningReferences(rootDir: string, replacements: Array<{ from: string; to: string }>): string[] {
  if (replacements.length === 0) return [];

  const rewrittenFiles: string[] = [];

  for (const filePath of walkPlanningFiles(rootDir)) {
    const original = readFileSync(filePath, 'utf8');
    let updated = original;

    for (const replacement of replacements) {
      updated = updated.split(replacement.from).join(replacement.to);
    }

    if (updated !== original) {
      writeFileSync(filePath, updated);
      rewrittenFiles.push(filePath.replace(`${rootDir}/`, ''));
    }
  }

  return rewrittenFiles;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function dedupeActions(actions: PlanningPhaseLifecycleAction[]): PlanningPhaseLifecycleAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = [
      action.type,
      action.milestone,
      action.phaseNumber,
      action.dirName,
      action.fromPath,
      action.toPath,
    ].join('::');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deriveDirName(phase: ParsedRoadmapPhase): string {
  const normalizedSlug = normalizePhaseSlug(phase.slug);
  return `${phase.phaseNumber}-${normalizedSlug || phase.slug}`;
}

export function buildPlanningPhaseLifecycleReport(options?: {
  rootDir?: string;
  generatedAt?: string;
  rewrittenFiles?: string[];
}): PlanningPhaseLifecycleReport {
  const rootDir = resolve(options?.rootDir || process.cwd());
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const { milestone: activeMilestone, milestoneName: activeMilestoneName } = parseCurrentMilestone(rootDir);
  const activePhases = parseActiveRoadmapPhases(rootDir);
  const archivedMilestones = parseArchivedMilestonePhases(rootDir).filter(
    (entry) => entry.milestone !== activeMilestone,
  );
  const activePhaseDirs = listDirectories(join(rootDir, '.planning', 'phases'));
  const activeArchiveDirs = activeMilestone ? listDirectories(join(rootDir, getPhaseArchivePath(activeMilestone))) : [];

  const phaseStatuses: PlanningPhaseLifecyclePhaseStatus[] = [];
  const restoreActions: PlanningPhaseLifecycleAction[] = [];
  const createActions: PlanningPhaseLifecycleAction[] = [];
  const archiveActions: PlanningPhaseLifecycleAction[] = [];
  const conflicts: PlanningPhaseLifecycleConflict[] = [];
  const managedActiveDirs = new Set<string>();

  for (const phase of activePhases) {
    const matchingActiveDirs = findMatchingDirectories(activePhaseDirs, phase);
    const matchingArchivedDirs = findMatchingDirectories(activeArchiveDirs, phase);
    matchingActiveDirs.forEach((dirName) => managedActiveDirs.add(dirName));

    const activePaths = matchingActiveDirs.map((dirName) => `.planning/phases/${dirName}`);
    const archivePaths = matchingArchivedDirs.map(
      (dirName) => `${getPhaseArchivePath(activeMilestone || 'unknown')}/${dirName}`,
    );
    const dirName = matchingActiveDirs[0] || matchingArchivedDirs[0] || deriveDirName(phase);

    let status: PlanningPhaseLifecyclePhaseStatus['status'] = 'missing';

    if (matchingActiveDirs.length === 1 && matchingArchivedDirs.length === 0) {
      status = 'present';
    } else if (matchingActiveDirs.length === 0 && matchingArchivedDirs.length === 1) {
      status = 'archived';
      if (activeMilestone) {
        restoreActions.push({
          type: 'restore',
          milestone: activeMilestone,
          phaseNumber: phase.phaseNumber,
          slug: phase.slug,
          dirName,
          fromPath: `${getPhaseArchivePath(activeMilestone)}/${dirName}`,
          toPath: `.planning/phases/${dirName}`,
          reason: 'Active milestone phase exists only in the archive path and must be restored.',
        });
      }
    } else if (matchingActiveDirs.length === 0 && matchingArchivedDirs.length === 0) {
      status = 'missing';
      createActions.push({
        type: 'create',
        milestone: activeMilestone || 'active',
        phaseNumber: phase.phaseNumber,
        slug: phase.slug,
        dirName,
        fromPath: null,
        toPath: `.planning/phases/${dirName}`,
        reason: 'Active milestone phase directory is missing and should be created.',
      });
    } else {
      status = 'conflict';
      conflicts.push({
        milestone: activeMilestone || 'active',
        phaseNumber: phase.phaseNumber,
        slug: phase.slug,
        activePaths,
        archivePaths,
        reason: 'Multiple active/archive copies exist for the same active milestone phase.',
      });
    }

    phaseStatuses.push({
      phaseNumber: phase.phaseNumber,
      slug: phase.slug,
      dirName,
      status,
      activePaths,
      archivePaths,
    });
  }

  const archivedMilestoneSummaries: PlanningPhaseLifecycleArchivedMilestone[] = [];

  for (const archivedMilestone of archivedMilestones) {
    const archiveRoot = getPhaseArchivePath(archivedMilestone.milestone);
    const archivedDirs = listDirectories(join(rootDir, archiveRoot));
    const expectedPhaseDirs: string[] = [];

    for (const phase of archivedMilestone.phases) {
      const matchingActiveDirs = findMatchingDirectories(activePhaseDirs, phase);
      const matchingArchivedDirs = findMatchingDirectories(archivedDirs, phase);
      matchingActiveDirs.forEach((dirName) => managedActiveDirs.add(dirName));
      const dirName = matchingActiveDirs[0] || matchingArchivedDirs[0] || deriveDirName(phase);
      expectedPhaseDirs.push(`${archiveRoot}/${dirName}`);

      if (matchingActiveDirs.length === 1 && matchingArchivedDirs.length === 0) {
        archiveActions.push({
          type: 'archive',
          milestone: archivedMilestone.milestone,
          phaseNumber: phase.phaseNumber,
          slug: phase.slug,
          dirName,
          fromPath: `.planning/phases/${dirName}`,
          toPath: `${archiveRoot}/${dirName}`,
          reason: 'Shipped milestone phase directory is still in the active path and should be archived.',
        });
      } else if (matchingActiveDirs.length > 1 || matchingArchivedDirs.length > 1) {
        conflicts.push({
          milestone: archivedMilestone.milestone,
          phaseNumber: phase.phaseNumber,
          slug: phase.slug,
          activePaths: matchingActiveDirs.map((dirName) => `.planning/phases/${dirName}`),
          archivePaths: matchingArchivedDirs.map((dirName) => `${archiveRoot}/${dirName}`),
          reason: 'Multiple active/archive copies exist for the same shipped milestone phase.',
        });
      } else if (matchingActiveDirs.length === 1 && matchingArchivedDirs.length === 1) {
        conflicts.push({
          milestone: archivedMilestone.milestone,
          phaseNumber: phase.phaseNumber,
          slug: phase.slug,
          activePaths: matchingActiveDirs.map((dirName) => `.planning/phases/${dirName}`),
          archivePaths: matchingArchivedDirs.map((dirName) => `${archiveRoot}/${dirName}`),
          reason: 'Both active and archived copies exist for the same shipped milestone phase.',
        });
      }
    }

    archivedMilestoneSummaries.push({
      milestone: archivedMilestone.milestone,
      phaseArchivePath: archiveRoot,
      archivedDirs: archivedDirs.map((dirName) => `${archiveRoot}/${dirName}`),
      expectedPhaseDirs: dedupeStrings(expectedPhaseDirs),
    });
  }

  const unmanagedPhaseDirs = activePhaseDirs
    .filter((dirName) => !managedActiveDirs.has(dirName))
    .filter((dirName) => isPhaseLikeDirectory(dirName));

  const dedupedArchiveActions = dedupeActions(archiveActions);
  const dedupedRestoreActions = dedupeActions(restoreActions);
  const dedupedCreateActions = dedupeActions(createActions);

  let status: PlanningPhaseLifecycleReport['status'] = 'clean';
  if (conflicts.length > 0 || unmanagedPhaseDirs.length > 0) {
    status = 'warning';
  } else if (dedupedArchiveActions.length > 0 || dedupedRestoreActions.length > 0 || dedupedCreateActions.length > 0) {
    status = 'pending';
  }

  return {
    generatedAt,
    projectRoot: rootDir,
    activeMilestone,
    activeMilestoneName,
    status,
    activePhaseArchivePath: activeMilestone ? getPhaseArchivePath(activeMilestone) : null,
    activePhases: phaseStatuses,
    archivedMilestones: archivedMilestoneSummaries,
    archiveActions: dedupedArchiveActions,
    restoreActions: dedupedRestoreActions,
    createActions: dedupedCreateActions,
    unmanagedPhaseDirs,
    conflicts,
    rewrittenFiles: dedupeStrings(options?.rewrittenFiles || []),
  };
}

export function renderPlanningPhaseLifecycleReport(report: PlanningPhaseLifecycleReport): string {
  const actionCount = report.archiveActions.length + report.restoreActions.length + report.createActions.length;

  return [
    '# Planning Phase Lifecycle Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Active milestone: ${report.activeMilestone || 'n/a'}${report.activeMilestoneName ? ` (${report.activeMilestoneName})` : ''}`,
    `- Status: ${report.status}`,
    `- Pending actions: ${actionCount}`,
    `- Active archive path: ${report.activePhaseArchivePath || 'n/a'}`,
    '',
    '## Active Phase Set',
    '',
    '| Phase | Directory | Status | Active Path | Archive Path |',
    '|---|---|---|---|---|',
    ...report.activePhases.map(
      (phase) =>
        `| ${phase.phaseNumber} | ${phase.dirName} | ${phase.status} | ${phase.activePaths.join(', ') || 'missing'} | ${phase.archivePaths.join(', ') || 'missing'} |`,
    ),
    '',
    '## Archive Actions',
    '',
    ...(report.archiveActions.length > 0
      ? report.archiveActions.map(
          (action) => `- ${action.phaseNumber} -> archive ${action.fromPath} => ${action.toPath} (${action.reason})`,
        )
      : ['- none']),
    '',
    '## Restore Actions',
    '',
    ...(report.restoreActions.length > 0
      ? report.restoreActions.map(
          (action) => `- ${action.phaseNumber} -> restore ${action.fromPath} => ${action.toPath} (${action.reason})`,
        )
      : ['- none']),
    '',
    '## Create Actions',
    '',
    ...(report.createActions.length > 0
      ? report.createActions.map((action) => `- ${action.phaseNumber} -> create ${action.toPath} (${action.reason})`)
      : ['- none']),
    '',
    '## Archived Milestone Paths',
    '',
    ...(report.archivedMilestones.length > 0
      ? report.archivedMilestones.flatMap((milestone) => [
          `### ${milestone.milestone}`,
          `- Archive root: ${milestone.phaseArchivePath}`,
          `- Archived dirs: ${milestone.archivedDirs.join(', ') || 'none'}`,
          `- Expected dirs: ${milestone.expectedPhaseDirs.join(', ') || 'none'}`,
          '',
        ])
      : ['- none', '']),
    '## Conflicts',
    '',
    ...(report.conflicts.length > 0
      ? report.conflicts.map(
          (conflict) =>
            `- ${conflict.milestone} phase ${conflict.phaseNumber}: ${conflict.reason} (active=${conflict.activePaths.join(', ') || 'none'}; archive=${conflict.archivePaths.join(', ') || 'none'})`,
        )
      : ['- none']),
    '',
    '## Unmanaged Active Phase Directories',
    '',
    ...(report.unmanagedPhaseDirs.length > 0 ? report.unmanagedPhaseDirs.map((dir) => `- ${dir}`) : ['- none']),
    '',
    '## Rewritten Planning Files',
    '',
    ...(report.rewrittenFiles.length > 0 ? report.rewrittenFiles.map((file) => `- ${file}`) : ['- none']),
  ].join('\n');
}

export function writePlanningPhaseLifecycleArtifacts(
  report: PlanningPhaseLifecycleReport,
  options?: { outputPath?: string; jsonOutputPath?: string },
): void {
  const outputPath = resolve(report.projectRoot, options?.outputPath || DEFAULT_PLANNING_PHASE_LIFECYCLE_MD_PATH);
  const jsonOutputPath = resolve(
    report.projectRoot,
    options?.jsonOutputPath || DEFAULT_PLANNING_PHASE_LIFECYCLE_JSON_PATH,
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  writeFileSync(outputPath, renderPlanningPhaseLifecycleReport(report));
  writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
}

function removeDirectoryIfEmpty(path: string): void {
  if (!existsSync(path)) return;
  if (readdirSync(path).length === 0) {
    rmSync(path, { recursive: true, force: true });
  }
}

export function syncPlanningPhaseLifecycle(options?: {
  rootDir?: string;
  generatedAt?: string;
  outputPath?: string;
  jsonOutputPath?: string;
}): PlanningPhaseLifecycleReport {
  const rootDir = resolve(options?.rootDir || process.cwd());
  const initialReport = buildPlanningPhaseLifecycleReport({ rootDir, generatedAt: options?.generatedAt });

  if (initialReport.conflicts.length > 0 || initialReport.unmanagedPhaseDirs.length > 0) {
    writePlanningPhaseLifecycleArtifacts(initialReport, {
      outputPath: options?.outputPath,
      jsonOutputPath: options?.jsonOutputPath,
    });
    return initialReport;
  }

  const replacements: Array<{ from: string; to: string }> = [];

  for (const action of initialReport.archiveActions) {
    if (!action.fromPath) continue;
    const sourcePath = join(rootDir, action.fromPath);
    const targetPath = join(rootDir, action.toPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    renameSync(sourcePath, targetPath);
    replacements.push({ from: action.fromPath, to: action.toPath });
  }

  for (const action of initialReport.restoreActions) {
    if (!action.fromPath) continue;
    const sourcePath = join(rootDir, action.fromPath);
    const targetPath = join(rootDir, action.toPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    renameSync(sourcePath, targetPath);
    replacements.push({ from: action.fromPath, to: action.toPath });
  }

  for (const action of initialReport.createActions) {
    mkdirSync(join(rootDir, action.toPath), { recursive: true });
  }

  const rewrittenFiles = rewritePlanningReferences(rootDir, replacements);

  for (const milestone of initialReport.archivedMilestones) {
    removeDirectoryIfEmpty(join(rootDir, milestone.phaseArchivePath));
  }

  const finalReport = buildPlanningPhaseLifecycleReport({
    rootDir,
    generatedAt: options?.generatedAt,
    rewrittenFiles,
  });

  writePlanningPhaseLifecycleArtifacts(finalReport, {
    outputPath: options?.outputPath,
    jsonOutputPath: options?.jsonOutputPath,
  });

  return finalReport;
}
