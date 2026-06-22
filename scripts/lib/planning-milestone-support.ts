import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildPlanningPhaseLifecycleReport } from './planning-phase-lifecycle';
import { buildPlanningTraceabilityReport, parseFrontmatter } from './planning-traceability';

export const DEFAULT_MILESTONES_INDEX_PATH = '.planning/MILESTONES.md';

export type MilestoneArtifactPaths = {
  bootstrapMarkdownPath: string;
  bootstrapJsonPath: string;
  closeoutMarkdownPath: string;
  closeoutJsonPath: string;
};

export type PlanningMilestoneRegistryEntry = {
  version: string;
  name: string;
  status: 'active' | 'shipped';
  statusLabel: string;
  summary: string;
  phasesLabel: string;
  totalPlans: number | null;
  requirementsSatisfied: number;
  requirementsTotal: number;
  auditStatus: 'passed' | 'pending' | 'n/a';
  roadmapPath: string;
  requirementsPath: string;
  auditPath: string | null;
  bootstrapPath: string | null;
  closeoutPath: string | null;
  accomplishments: string[];
  carryForward: string[];
};

export type PlanningMilestoneBootstrapReport = {
  milestone: string;
  milestoneName: string;
  goal: string | null;
  sourceMilestone: string | null;
  sourceMilestoneName: string | null;
  sourceArtifacts: string[];
  carriedForward: string[];
  indexArtifacts: string[];
  phases: Array<{
    number: string;
    slug: string;
    requirements: string[];
  }>;
  requirements: string[];
};

export type PlanningMilestoneCloseoutReport = {
  milestone: string;
  milestoneName: string;
  status: 'ready' | 'in_progress';
  blockers: string[];
  phaseCounts: {
    total: number;
    completed: number;
  };
  requirementCounts: {
    satisfied: number;
    partial: number;
    pending: number;
    total: number;
  };
  hygieneStatus: 'clean' | 'warning';
  evidenceFiles: string[];
  archiveTargets: string[];
};

export type PlanningMilestoneSupportReport = {
  generatedAt: string;
  projectRoot: string;
  projectName: string;
  activeMilestone: PlanningMilestoneRegistryEntry | null;
  archivedMilestones: PlanningMilestoneRegistryEntry[];
  bootstrap: PlanningMilestoneBootstrapReport | null;
  closeout: PlanningMilestoneCloseoutReport | null;
  paths: MilestoneArtifactPaths | null;
};

type ParsedRoadmapPhase = {
  number: string;
  slug: string;
  requirements: string[];
  plansCompleted: number;
  plansTotal: number;
};

function readFileIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function parseRoadmapLineValue(block: string, label: string): string | null {
  const pattern = new RegExp(`^[ \\t]*(?:-[ \\t]+)?\\*\\*${label}:?\\*\\*:?[ \\t]*(.+)$`, 'm');
  return block.match(pattern)?.[1]?.trim() || null;
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHeadingSection(content: string, heading: string, level: number): string {
  const lines = content.split(/\r?\n/);
  const target = `${'#'.repeat(level)} ${heading}`.trim();
  const start = lines.findIndex((line) => line.trim() === target);

  if (start === -1) return '';

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(#{1,6})\s+/);
    if (headingMatch && headingMatch[1].length <= level) {
      end = index;
      break;
    }
  }

  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

function getListItems(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:-\s+|\d+\.\s+)(.*)$/)?.[1]?.trim() || '')
    .filter(Boolean)
    .map(stripMarkdownLinks);
}

function getFirstParagraph(section: string): string {
  return (
    section
      .split(/\r?\n\r?\n/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .find(Boolean) || ''
  );
}

function getProjectName(rootDir: string): string {
  const projectContent = readFileIfExists(join(rootDir, '.planning', 'PROJECT.md'));
  const headingMatch = projectContent.match(/^#\s+(.+)$/m);
  return headingMatch?.[1]?.trim() || 'Project';
}

function getCurrentMilestoneGoal(rootDir: string, milestone: string | null): string | null {
  if (!milestone) return null;

  const projectContent = readFileIfExists(join(rootDir, '.planning', 'PROJECT.md'));
  const milestoneBlock = projectContent.match(
    new RegExp(
      `^##\\s+Current Milestone:\\s+${escapeRegExp(milestone)}\\s+[^\n]+\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`,
      'm',
    ),
  );

  if (!milestoneBlock) return null;

  const goalMatch = milestoneBlock[1].match(/^\*\*Goal:\*\*\s*(.+)$/m);
  return goalMatch?.[1]?.trim() || null;
}

function parseCurrentMilestoneRequirements(rootDir: string, milestone: string | null): string[] {
  if (!milestone) return [];

  const content = readFileIfExists(join(rootDir, '.planning', 'REQUIREMENTS.md'));
  const section = getHeadingSection(content, `${milestone} Requirements`, 2);
  if (!section) return [];

  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^- \[[ xX]\] \*\*([A-Z0-9-]+)\*\*:/)?.[1] || '')
    .filter(Boolean);
}

function parseActiveRoadmapPhases(rootDir: string): ParsedRoadmapPhase[] {
  const content = readFileIfExists(join(rootDir, '.planning', 'ROADMAP.md'));
  const matches = content.matchAll(/^### Phase ([^:]+): ([^\n]+)\n([\s\S]*?)(?=^### Phase |\n## |(?![\s\S]))/gm);
  const phases: ParsedRoadmapPhase[] = [];

  for (const match of matches) {
    const requirementsLine = parseRoadmapLineValue(match[3], 'Requirements') || '';
    const plansValue = parseRoadmapLineValue(match[3], 'Plans') || '';
    const plansLine = plansValue.match(/^(\d+)\/(\d+)\s+(.+)$/);

    phases.push({
      number: match[1].trim(),
      slug: match[2].trim(),
      requirements: requirementsLine
        .split(',')
        .map((item) => item.replaceAll('`', '').trim())
        .filter(Boolean),
      plansCompleted: plansLine ? Number(plansLine[1]) : 0,
      plansTotal: plansLine ? Number(plansLine[2]) : 0,
    });
  }

  return phases;
}

function compareMilestoneVersions(left: string, right: string): number {
  const leftParts = left
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number(part));
  const rightParts = right
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta;
  }

  return 0;
}

function getMilestoneArtifactPaths(milestone: string): MilestoneArtifactPaths {
  return {
    bootstrapMarkdownPath: `.planning/milestones/${milestone}-BOOTSTRAP.md`,
    bootstrapJsonPath: `.planning/milestones/${milestone}-BOOTSTRAP.json`,
    closeoutMarkdownPath: `.planning/milestones/${milestone}-CLOSEOUT.md`,
    closeoutJsonPath: `.planning/milestones/${milestone}-CLOSEOUT.json`,
  };
}

function countArchivedRequirements(content: string): { satisfied: number; total: number } {
  const checkboxRows = content.match(/^- \[[xX ]\] \*\*[A-Z0-9-]+\*\*:/gm) || [];
  if (checkboxRows.length > 0) {
    return {
      total: checkboxRows.length,
      satisfied: (content.match(/^- \[[xX]\] \*\*[A-Z0-9-]+\*\*:/gm) || []).length,
    };
  }

  const tableRows = content.match(/^\|\s*`?[A-Z0-9-]+`?\s*\|/gm) || [];
  return {
    total: tableRows.length,
    satisfied: tableRows.length,
  };
}

function resolveAuditPath(rootDir: string, version: string): string | null {
  const archivedAuditPath = join(rootDir, '.planning', 'milestones', `${version}-MILESTONE-AUDIT.md`);
  if (existsSync(archivedAuditPath)) return `.planning/milestones/${version}-MILESTONE-AUDIT.md`;

  const rootAuditPath = join(rootDir, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (existsSync(rootAuditPath)) return `.planning/${version}-MILESTONE-AUDIT.md`;

  return null;
}

function readAuditStatus(rootDir: string, auditPath: string | null): 'passed' | 'pending' | 'n/a' {
  if (!auditPath) return 'n/a';
  const { attributes } = parseFrontmatter(readFileIfExists(join(rootDir, auditPath)));
  const status = typeof attributes.status === 'string' ? attributes.status : null;
  if (status === 'passed') return 'passed';
  return 'pending';
}

function parseArchivedMilestones(
  rootDir: string,
  options?: { excludeVersions?: string[] },
): PlanningMilestoneRegistryEntry[] {
  const milestonesDir = join(rootDir, '.planning', 'milestones');
  if (!existsSync(milestonesDir)) return [];
  const excludeVersions = new Set(options?.excludeVersions || []);

  const roadmapFiles = readdirSync(milestonesDir)
    .filter((name) => name.endsWith('-ROADMAP.md'))
    .filter((name) => !excludeVersions.has(name.replace(/-ROADMAP\.md$/, '')))
    .sort((left, right) =>
      compareMilestoneVersions(right.replace(/-ROADMAP\.md$/, ''), left.replace(/-ROADMAP\.md$/, '')),
    );

  return roadmapFiles.map((fileName) => {
    const version = fileName.replace(/-ROADMAP\.md$/, '');
    const roadmapPath = `.planning/milestones/${fileName}`;
    const requirementsPath = `.planning/milestones/${version}-REQUIREMENTS.md`;
    const roadmapContent = readFileIfExists(join(rootDir, roadmapPath));
    const requirementsContent = readFileIfExists(join(rootDir, requirementsPath));
    const headerMatch = roadmapContent.match(/^#\s+Milestone\s+([^\s:]+):\s+(.+)$/m);
    const statusMatch = roadmapContent.match(/^\*\*Status:\*\*\s*(.+)$/m);
    const phasesMatch = roadmapContent.match(/^\*\*Phases:\*\*\s*(.+)$/m);
    const totalPlansMatch = roadmapContent.match(/^\*\*Total Plans:\*\*\s*(\d+)$/m);
    const summary = getFirstParagraph(getHeadingSection(roadmapContent, 'Overview', 2));
    const accomplishments = getListItems(getHeadingSection(roadmapContent, 'Key Accomplishments', 3));
    const carryForward = getListItems(getHeadingSection(requirementsContent, 'Carry-Forward Candidates', 2));
    const requirementCounts = countArchivedRequirements(requirementsContent);

    return {
      version: headerMatch?.[1]?.trim() || version,
      name: headerMatch?.[2]?.trim() || version,
      status: 'shipped',
      statusLabel: statusMatch?.[1]?.trim() || 'SHIPPED',
      summary,
      phasesLabel: phasesMatch?.[1]?.trim() || 'n/a',
      totalPlans: totalPlansMatch ? Number(totalPlansMatch[1]) : null,
      requirementsSatisfied: requirementCounts.satisfied,
      requirementsTotal: requirementCounts.total,
      auditStatus: readAuditStatus(rootDir, resolveAuditPath(rootDir, version)),
      roadmapPath,
      requirementsPath,
      auditPath: resolveAuditPath(rootDir, version),
      bootstrapPath: null,
      closeoutPath: null,
      accomplishments,
      carryForward,
    };
  });
}

function buildActiveMilestoneEntry(rootDir: string): {
  entry: PlanningMilestoneRegistryEntry | null;
  bootstrap: PlanningMilestoneBootstrapReport | null;
  closeout: PlanningMilestoneCloseoutReport | null;
  paths: MilestoneArtifactPaths | null;
} {
  const stateContent = readFileIfExists(join(rootDir, '.planning', 'STATE.md'));
  const { attributes } = parseFrontmatter(stateContent);
  const milestone = typeof attributes.milestone === 'string' ? attributes.milestone : null;
  const milestoneName = typeof attributes.milestone_name === 'string' ? attributes.milestone_name : null;

  if (!milestone || !milestoneName) {
    return { entry: null, bootstrap: null, closeout: null, paths: null };
  }

  const traceability = buildPlanningTraceabilityReport({ rootDir });
  const phaseLifecycle = buildPlanningPhaseLifecycleReport({ rootDir });
  const phases = parseActiveRoadmapPhases(rootDir);
  const completedPhases = traceability.activePhases.filter(
    (phase) => phase.summaryMetadataReady && phase.verificationMetadataReady,
  ).length;
  const satisfiedRequirements = traceability.requirements.filter((item) => item.status === 'satisfied').length;
  const partialRequirements = traceability.requirements.filter((item) => item.status === 'partial').length;
  const pendingRequirements = traceability.requirements.filter((item) => item.status === 'pending').length;
  const totalPlans = phases.reduce((sum, phase) => sum + phase.plansTotal, 0);
  const goal = getCurrentMilestoneGoal(rootDir, milestone);
  const archivedMilestones = parseArchivedMilestones(rootDir, { excludeVersions: [milestone] });
  const previousMilestone = archivedMilestones[0] || null;
  const currentRequirementIds = parseCurrentMilestoneRequirements(rootDir, milestone);
  const paths = getMilestoneArtifactPaths(milestone);
  const activeAuditPath = resolveAuditPath(rootDir, milestone);

  const bootstrap: PlanningMilestoneBootstrapReport = {
    milestone,
    milestoneName,
    goal,
    sourceMilestone: previousMilestone?.version || null,
    sourceMilestoneName: previousMilestone?.name || null,
    sourceArtifacts: [
      previousMilestone?.roadmapPath,
      previousMilestone?.requirementsPath,
      previousMilestone?.auditPath,
    ].filter((value): value is string => Boolean(value)),
    carriedForward: previousMilestone?.carryForward || [],
    indexArtifacts: [
      '.planning/PROJECT.md',
      '.planning/ROADMAP.md',
      '.planning/REQUIREMENTS.md',
      '.planning/STATE.md',
      DEFAULT_MILESTONES_INDEX_PATH,
      '.planning/phase-lifecycle/latest-phase-lifecycle.md',
      '.planning/phase-lifecycle/latest-phase-lifecycle.json',
      '.planning/traceability/latest-milestone-traceability.md',
      '.planning/traceability/latest-milestone-traceability.json',
    ],
    phases: phases.map((phase) => ({
      number: phase.number,
      slug: phase.slug,
      requirements: phase.requirements,
    })),
    requirements: currentRequirementIds,
  };

  const closeoutBlockers: string[] = [];
  if (completedPhases !== traceability.activePhases.length) {
    closeoutBlockers.push(
      `Only ${completedPhases}/${traceability.activePhases.length} active phases have both summary and verification evidence.`,
    );
  }
  if (partialRequirements > 0 || pendingRequirements > 0) {
    closeoutBlockers.push(
      `Requirement coverage is not fully satisfied yet (satisfied=${satisfiedRequirements}, partial=${partialRequirements}, pending=${pendingRequirements}).`,
    );
  }
  if (traceability.hygiene.status !== 'clean') {
    closeoutBlockers.push(`Planning hygiene is ${traceability.hygiene.status}.`);
  }
  if (phaseLifecycle.status !== 'clean') {
    closeoutBlockers.push(
      `Phase lifecycle sync is ${phaseLifecycle.status} (archive=${phaseLifecycle.archiveActions.length}, restore=${phaseLifecycle.restoreActions.length}, create=${phaseLifecycle.createActions.length}).`,
    );
  }

  const closeout: PlanningMilestoneCloseoutReport = {
    milestone,
    milestoneName,
    status: closeoutBlockers.length === 0 ? 'ready' : 'in_progress',
    blockers: closeoutBlockers,
    phaseCounts: {
      total: traceability.activePhases.length,
      completed: completedPhases,
    },
    requirementCounts: {
      satisfied: satisfiedRequirements,
      partial: partialRequirements,
      pending: pendingRequirements,
      total: traceability.requirements.length,
    },
    hygieneStatus: traceability.hygiene.status,
    evidenceFiles: [
      '.planning/ROADMAP.md',
      '.planning/REQUIREMENTS.md',
      '.planning/STATE.md',
      '.planning/phase-lifecycle/latest-phase-lifecycle.md',
      '.planning/phase-lifecycle/latest-phase-lifecycle.json',
      '.planning/traceability/latest-milestone-traceability.md',
      '.planning/traceability/latest-milestone-traceability.json',
      ...traceability.activePhases.flatMap((phase) => [...phase.summaryFiles, ...phase.verificationFiles]),
    ],
    archiveTargets: [
      `.planning/milestones/${milestone}-phases`,
      `.planning/milestones/${milestone}-ROADMAP.md`,
      `.planning/milestones/${milestone}-REQUIREMENTS.md`,
      `.planning/milestones/${milestone}-MILESTONE-AUDIT.md`,
      paths.bootstrapMarkdownPath,
      paths.closeoutMarkdownPath,
    ],
  };

  const entry: PlanningMilestoneRegistryEntry = {
    version: milestone,
    name: milestoneName,
    status: 'active',
    statusLabel: closeout.status === 'ready' ? 'Closeout Ready' : 'Active',
    summary:
      goal ||
      'Active milestone scope is defined in the current planning files and should stay reproducible through generated support artifacts.',
    phasesLabel: `${completedPhases}/${traceability.activePhases.length} complete`,
    totalPlans,
    requirementsSatisfied: satisfiedRequirements,
    requirementsTotal: traceability.requirements.length,
    auditStatus: closeout.status === 'ready' ? readAuditStatus(rootDir, activeAuditPath) : 'n/a',
    roadmapPath: '.planning/ROADMAP.md',
    requirementsPath: '.planning/REQUIREMENTS.md',
    auditPath: activeAuditPath,
    bootstrapPath: paths.bootstrapMarkdownPath,
    closeoutPath: paths.closeoutMarkdownPath,
    accomplishments: [
      `Roadmap phases tracked: ${traceability.activePhases.length}`,
      `Requirement coverage: ${satisfiedRequirements}/${traceability.requirements.length} satisfied`,
      `Planning hygiene: ${traceability.hygiene.status}`,
    ],
    carryForward: bootstrap.carriedForward,
  };

  return { entry, bootstrap, closeout, paths };
}

export function buildPlanningMilestoneSupportReport(options?: {
  rootDir?: string;
  generatedAt?: string;
}): PlanningMilestoneSupportReport {
  const rootDir = resolve(options?.rootDir || process.cwd());
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const projectName = getProjectName(rootDir);
  const active = buildActiveMilestoneEntry(rootDir);
  const archivedMilestones = parseArchivedMilestones(rootDir, {
    excludeVersions: active.entry ? [active.entry.version] : [],
  });

  return {
    generatedAt,
    projectRoot: rootDir,
    projectName,
    activeMilestone: active.entry,
    archivedMilestones,
    bootstrap: active.bootstrap,
    closeout: active.closeout,
    paths: active.paths,
  };
}

function renderRegistryEntry(entry: PlanningMilestoneRegistryEntry): string {
  const stats = [
    entry.totalPlans === null ? null : `${entry.phasesLabel} phases, ${entry.totalPlans} plans`,
    entry.requirementsTotal > 0
      ? `${entry.requirementsSatisfied}/${entry.requirementsTotal} requirements satisfied`
      : null,
    entry.auditStatus === 'passed'
      ? 'milestone audit passed'
      : entry.auditStatus === 'pending'
        ? 'milestone audit pending'
        : null,
  ]
    .filter(Boolean)
    .join(', ');

  const archiveRefs = [
    entry.roadmapPath,
    entry.requirementsPath,
    entry.auditPath,
    entry.bootstrapPath,
    entry.closeoutPath,
  ]
    .filter((value): value is string => Boolean(value))
    .join(', ');

  const carryForwardLine = entry.carryForward.length > 0 ? entry.carryForward[0] : 'None recorded.';

  return [
    `### ${entry.version} ${entry.name} (${entry.status === 'active' ? entry.statusLabel : `Shipped: ${entry.statusLabel.replace(/^SHIPPED\s*/, '') || entry.statusLabel}`})`,
    '',
    `**Delivered:** ${entry.summary}`,
    '',
    `**Phases completed:** ${entry.phasesLabel}${entry.totalPlans === null ? '' : ` (${entry.totalPlans} plans total)`}`,
    '',
    '**Key accomplishments:**',
    ...(entry.accomplishments.length > 0 ? entry.accomplishments : ['No generated accomplishments recorded.']).map(
      (item) => `- ${item}`,
    ),
    '',
    '**Stats:**',
    `- ${stats || 'No generated stats available.'}`,
    `- Milestone artifacts: ${archiveRefs || 'none'}`,
    `- Carry-forward signal: ${carryForwardLine}`,
    '',
    `**What's next:** ${
      entry.status === 'active'
        ? entry.closeoutPath
          ? `Use ${entry.closeoutPath} to finish audit and archive preparation.`
          : 'Finish current milestone work and generate closeout support.'
        : entry.carryForward.length > 0
          ? entry.carryForward[0]
          : 'Define the next milestone scope from archived findings.'
    }`,
    '',
    '---',
    '',
  ].join('\n');
}

export function renderMilestonesIndex(report: PlanningMilestoneSupportReport): string {
  const activeBlock = report.activeMilestone ? renderRegistryEntry(report.activeMilestone) : '';
  const archivedBlocks = report.archivedMilestones.map((entry) => renderRegistryEntry(entry)).join('');

  return [
    `# Project Milestones: ${report.projectName}`,
    '',
    report.activeMilestone ? '## Active Milestone' : '',
    report.activeMilestone ? '' : '',
    activeBlock.trimEnd(),
    report.archivedMilestones.length > 0 ? '## Shipped Milestones' : '',
    report.archivedMilestones.length > 0 ? '' : '',
    archivedBlocks.trimEnd(),
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderMilestoneBootstrapReport(report: PlanningMilestoneSupportReport): string {
  if (!report.bootstrap) return '# Milestone Bootstrap Reference\n\nNo active milestone found.';

  return [
    `# Milestone ${report.bootstrap.milestone} Bootstrap Reference`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Milestone: ${report.bootstrap.milestone} (${report.bootstrap.milestoneName})`,
    `- Goal: ${report.bootstrap.goal || 'n/a'}`,
    `- Prior milestone: ${
      report.bootstrap.sourceMilestone
        ? `${report.bootstrap.sourceMilestone} (${report.bootstrap.sourceMilestoneName || 'n/a'})`
        : 'none'
    }`,
    '',
    '## Source Artifacts',
    '',
    ...(report.bootstrap.sourceArtifacts.length > 0
      ? report.bootstrap.sourceArtifacts.map((item) => `- ${item}`)
      : ['- none']),
    '',
    '## Carry-Forward Candidates',
    '',
    ...(report.bootstrap.carriedForward.length > 0
      ? report.bootstrap.carriedForward.map((item) => `- ${item}`)
      : ['- none']),
    '',
    '## Required Index Artifacts',
    '',
    ...report.bootstrap.indexArtifacts.map((item) => `- ${item}`),
    '',
    '## Active Milestone Contract',
    '',
    '| Phase | Slug | Requirements |',
    '|---|---|---|',
    ...report.bootstrap.phases.map(
      (phase) => `| ${phase.number} | ${phase.slug} | ${phase.requirements.join(', ') || 'n/a'} |`,
    ),
    '',
    '## Requirement IDs',
    '',
    ...(report.bootstrap.requirements.length > 0
      ? report.bootstrap.requirements.map((item) => `- ${item}`)
      : ['- none']),
  ].join('\n');
}

export function renderMilestoneCloseoutReport(report: PlanningMilestoneSupportReport): string {
  if (!report.closeout) return '# Milestone Closeout Support\n\nNo active milestone found.';

  return [
    `# Milestone ${report.closeout.milestone} Closeout Support`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Milestone: ${report.closeout.milestone} (${report.closeout.milestoneName})`,
    `- Status: ${report.closeout.status}`,
    `- Phase completion: ${report.closeout.phaseCounts.completed}/${report.closeout.phaseCounts.total}`,
    `- Requirement coverage: satisfied=${report.closeout.requirementCounts.satisfied}, partial=${report.closeout.requirementCounts.partial}, pending=${report.closeout.requirementCounts.pending}`,
    `- Planning hygiene: ${report.closeout.hygieneStatus}`,
    '',
    '## Blockers',
    '',
    ...(report.closeout.blockers.length > 0 ? report.closeout.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Evidence Files',
    '',
    ...report.closeout.evidenceFiles.map((item) => `- ${item}`),
    '',
    '## Archive Targets',
    '',
    ...report.closeout.archiveTargets.map((item) => `- ${item}`),
  ].join('\n');
}

export function writePlanningMilestoneSupportArtifacts(
  report: PlanningMilestoneSupportReport,
  options?: {
    milestonesIndexPath?: string;
    bootstrapMarkdownPath?: string;
    bootstrapJsonPath?: string;
    closeoutMarkdownPath?: string;
    closeoutJsonPath?: string;
  },
): void {
  const milestonesIndexPath = resolve(
    report.projectRoot,
    options?.milestonesIndexPath || DEFAULT_MILESTONES_INDEX_PATH,
  );

  mkdirSync(dirname(milestonesIndexPath), { recursive: true });
  writeFileSync(milestonesIndexPath, renderMilestonesIndex(report));

  if (!report.bootstrap || !report.closeout || !report.paths) {
    return;
  }

  const bootstrapMarkdownPath = resolve(
    report.projectRoot,
    options?.bootstrapMarkdownPath || report.paths.bootstrapMarkdownPath,
  );
  const bootstrapJsonPath = resolve(report.projectRoot, options?.bootstrapJsonPath || report.paths.bootstrapJsonPath);
  const closeoutMarkdownPath = resolve(
    report.projectRoot,
    options?.closeoutMarkdownPath || report.paths.closeoutMarkdownPath,
  );
  const closeoutJsonPath = resolve(report.projectRoot, options?.closeoutJsonPath || report.paths.closeoutJsonPath);

  for (const path of [bootstrapMarkdownPath, bootstrapJsonPath, closeoutMarkdownPath, closeoutJsonPath]) {
    mkdirSync(dirname(path), { recursive: true });
  }

  writeFileSync(bootstrapMarkdownPath, renderMilestoneBootstrapReport(report));
  writeFileSync(bootstrapJsonPath, JSON.stringify(report.bootstrap, null, 2));
  writeFileSync(closeoutMarkdownPath, renderMilestoneCloseoutReport(report));
  writeFileSync(closeoutJsonPath, JSON.stringify(report.closeout, null, 2));
}
