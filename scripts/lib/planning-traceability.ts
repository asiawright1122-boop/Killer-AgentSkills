import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export const DEFAULT_PLANNING_TRACEABILITY_MD_PATH = '.planning/traceability/latest-milestone-traceability.md';
export const DEFAULT_PLANNING_TRACEABILITY_JSON_PATH = '.planning/traceability/latest-milestone-traceability.json';

type FrontmatterValue = string | string[];

export type PlanningTraceabilityRequirement = {
  id: string;
  expectedPhase: string | null;
  summaryEvidence: boolean;
  verificationEvidence: boolean;
  status: 'satisfied' | 'partial' | 'pending';
};

export type PlanningTraceabilityPhase = {
  phaseNumber: string;
  slug: string;
  requirements: string[];
  phaseDirs: string[];
  summaryFiles: string[];
  verificationFiles: string[];
  summaryRequirementsCompleted: string[];
  verificationRequirementsCompleted: string[];
  summaryMetadataReady: boolean;
  verificationMetadataReady: boolean;
};

export type PlanningTraceabilityHygiene = {
  status: 'clean' | 'warning';
  legacyPhaseDirs: string[];
  orphanPhaseDirs: string[];
  duplicateActivePhaseDirs: Array<{ phaseNumber: string; dirs: string[] }>;
  missingActivePhaseDirs: string[];
};

export type PlanningTraceabilityReport = {
  generatedAt: string;
  projectRoot: string;
  milestone: string | null;
  milestoneName: string | null;
  activePhases: PlanningTraceabilityPhase[];
  requirements: PlanningTraceabilityRequirement[];
  hygiene: PlanningTraceabilityHygiene;
};

export type ArchivedPlanningTraceabilityArtifacts = {
  milestone: string;
  markdownPath: string | null;
  jsonPath: string | null;
};

type ParsedFrontmatter = {
  attributes: Record<string, FrontmatterValue>;
  body: string;
};

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { attributes: {}, body: content };
  }

  const attributes: Record<string, FrontmatterValue> = {};
  let currentListKey: string | null = null;

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim()) continue;

    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      if (!value.trim()) {
        attributes[key] = [];
        currentListKey = key;
      } else {
        attributes[key] = stripQuotes(value);
        currentListKey = null;
      }
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListKey) {
      const current = attributes[currentListKey];
      if (Array.isArray(current)) {
        current.push(stripQuotes(listMatch[1]));
      }
    }
  }

  return {
    attributes,
    body: match[2],
  };
}

function getFrontmatterString(attributes: Record<string, FrontmatterValue>, key: string): string | null {
  const value = attributes[key];
  return typeof value === 'string' ? value : null;
}

function getFrontmatterList(attributes: Record<string, FrontmatterValue>, key: string): string[] {
  const value = attributes[key];
  return Array.isArray(value) ? value : [];
}

function readFileIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function parseRoadmapLineValue(block: string, label: string): string | null {
  const pattern = new RegExp(`^\\*\\*${label}:?\\*\\*:?[ \\t]*(.+)$`, 'm');
  return block.match(pattern)?.[1]?.trim() || null;
}

function normalizeRelativePath(rootDir: string, path: string): string {
  return relative(rootDir, path).split('\\').join('/');
}

function parseArchivedTraceabilityMilestone(markdown: string, json: string): string | null {
  if (json.trim()) {
    try {
      const parsed = JSON.parse(json) as { milestone?: unknown };
      if (typeof parsed.milestone === 'string' && parsed.milestone.trim() && parsed.milestone !== 'n/a') {
        return parsed.milestone.trim();
      }
    } catch {
      // Fall back to markdown parsing when the existing JSON artifact is unavailable or malformed.
    }
  }

  const markdownMatch = markdown.match(/^- Milestone:\s+([^\s]+)(?:\s+\(|$)/m);
  if (!markdownMatch) return null;

  const milestone = markdownMatch[1].trim();
  return milestone && milestone !== 'n/a' ? milestone : null;
}

function getSectionBody(content: string, heading: string, level: number): string {
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

  return lines.slice(start + 1, end).join('\n');
}

function parseState(rootDir: string): { milestone: string | null; milestoneName: string | null } {
  const statePath = join(rootDir, '.planning', 'STATE.md');
  const { attributes } = parseFrontmatter(readFileIfExists(statePath));
  return {
    milestone: getFrontmatterString(attributes, 'milestone'),
    milestoneName: getFrontmatterString(attributes, 'milestone_name'),
  };
}

function parseCurrentMilestoneRequirements(rootDir: string, milestone: string | null): string[] {
  if (!milestone) return [];

  const content = readFileIfExists(join(rootDir, '.planning', 'REQUIREMENTS.md'));
  const sectionBody = getSectionBody(content, `${milestone} Requirements`, 2);
  if (!sectionBody) return [];

  const requirements: string[] = [];
  for (const line of sectionBody.split(/\r?\n/)) {
    const match = line.match(/^- \[[ xX]\] \*\*([A-Z0-9-]+)\*\*:/);
    if (match) requirements.push(match[1]);
  }
  return requirements;
}

function parseRoadmapPhases(rootDir: string): Array<{ phaseNumber: string; slug: string; requirements: string[] }> {
  const content = readFileIfExists(join(rootDir, '.planning', 'ROADMAP.md'));
  const matches = content.matchAll(/^### Phase ([^:]+): ([^\n]+)\n([\s\S]*?)(?=^### Phase |\n## |(?![\s\S]))/gm);
  const phases: Array<{ phaseNumber: string; slug: string; requirements: string[] }> = [];

  for (const match of matches) {
    const phaseNumber = match[1].trim();
    const slug = match[2].trim();
    const block = match[3];
    const requirementsLine = parseRoadmapLineValue(block, 'Requirements');
    phases.push({
      phaseNumber,
      slug,
      requirements: (requirementsLine || '')
        .split(',')
        .map((item) => item.replaceAll('`', '').trim())
        .filter(Boolean),
    });
  }

  return phases;
}

function listActivePhaseDirectories(rootDir: string): string[] {
  const phasesDir = join(rootDir, '.planning', 'phases');
  if (!existsSync(phasesDir)) return [];
  return readdirSync(phasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildPhaseCoverage(
  rootDir: string,
  activePhases: Array<{ phaseNumber: string; slug: string; requirements: string[] }>,
) {
  const allDirs = listActivePhaseDirectories(rootDir);
  const phaseLikePattern = /^\d+(?:\.\d+|[A-Z])?-/;
  const activeDirMap = new Map<string, string[]>();

  for (const phase of activePhases) {
    activeDirMap.set(
      phase.phaseNumber,
      allDirs.filter((dir) => dir.startsWith(`${phase.phaseNumber}-`)),
    );
  }

  const phaseCoverage: PlanningTraceabilityPhase[] = activePhases.map((phase) => {
    const phaseDirs = activeDirMap.get(phase.phaseNumber) || [];
    const phaseDir = phaseDirs[0];
    const summaryFiles =
      phaseDir && existsSync(join(rootDir, '.planning', 'phases', phaseDir))
        ? readdirSync(join(rootDir, '.planning', 'phases', phaseDir))
            .filter((name) => name.endsWith('SUMMARY.md'))
            .sort()
            .map((name) => join('.planning', 'phases', phaseDir, name))
        : [];
    const verificationFiles =
      phaseDir && existsSync(join(rootDir, '.planning', 'phases', phaseDir))
        ? readdirSync(join(rootDir, '.planning', 'phases', phaseDir))
            .filter((name) => name.endsWith('VERIFICATION.md'))
            .sort()
            .map((name) => join('.planning', 'phases', phaseDir, name))
        : [];

    const summaryAttributes = summaryFiles.map(
      (file) => parseFrontmatter(readFileIfExists(join(rootDir, file))).attributes,
    );
    const verificationAttributes = verificationFiles.map(
      (file) => parseFrontmatter(readFileIfExists(join(rootDir, file))).attributes,
    );

    return {
      phaseNumber: phase.phaseNumber,
      slug: phase.slug,
      requirements: phase.requirements,
      phaseDirs,
      summaryFiles,
      verificationFiles,
      summaryRequirementsCompleted: unique(
        summaryAttributes.flatMap((attributes) => getFrontmatterList(attributes, 'requirements_completed')),
      ),
      verificationRequirementsCompleted: unique(
        verificationAttributes.flatMap((attributes) => getFrontmatterList(attributes, 'requirements_completed')),
      ),
      summaryMetadataReady:
        summaryFiles.length > 0 &&
        summaryAttributes.every(
          (attributes) =>
            getFrontmatterString(attributes, 'phase') !== null &&
            getFrontmatterList(attributes, 'requirements_completed').length > 0,
        ),
      verificationMetadataReady:
        verificationFiles.length > 0 &&
        verificationAttributes.every(
          (attributes) =>
            getFrontmatterString(attributes, 'phase') !== null &&
            getFrontmatterList(attributes, 'requirements_completed').length > 0,
        ),
    };
  });

  const activeDirSet = new Set(phaseCoverage.flatMap((phase) => phase.phaseDirs));
  const hygiene: PlanningTraceabilityHygiene = {
    status: 'clean',
    legacyPhaseDirs: allDirs.filter((dir) => !activeDirSet.has(dir) && phaseLikePattern.test(dir)),
    orphanPhaseDirs: allDirs.filter((dir) => !activeDirSet.has(dir) && !phaseLikePattern.test(dir)),
    duplicateActivePhaseDirs: phaseCoverage
      .filter((phase) => phase.phaseDirs.length > 1)
      .map((phase) => ({ phaseNumber: phase.phaseNumber, dirs: phase.phaseDirs })),
    missingActivePhaseDirs: phaseCoverage
      .filter((phase) => phase.phaseDirs.length === 0)
      .map((phase) => phase.phaseNumber),
  };

  if (hygiene.orphanPhaseDirs.length > 0 || hygiene.duplicateActivePhaseDirs.length > 0) {
    hygiene.status = 'warning';
  }

  return {
    phaseCoverage,
    hygiene,
  };
}

export function buildPlanningTraceabilityReport(options?: {
  rootDir?: string;
  generatedAt?: string;
}): PlanningTraceabilityReport {
  const rootDir = resolve(options?.rootDir || process.cwd());
  const generatedAt = options?.generatedAt || new Date().toISOString();
  const state = parseState(rootDir);
  const milestoneRequirements = parseCurrentMilestoneRequirements(rootDir, state.milestone);
  const activePhases = parseRoadmapPhases(rootDir);
  const { phaseCoverage, hygiene } = buildPhaseCoverage(rootDir, activePhases);

  const requirementPhaseMap = new Map<string, string>();
  for (const phase of phaseCoverage) {
    for (const requirement of phase.requirements) {
      requirementPhaseMap.set(requirement, phase.phaseNumber);
    }
  }

  const requirements = milestoneRequirements.map<PlanningTraceabilityRequirement>((id) => {
    const summaryEvidence = phaseCoverage.some((phase) => phase.summaryRequirementsCompleted.includes(id));
    const verificationEvidence = phaseCoverage.some((phase) => phase.verificationRequirementsCompleted.includes(id));
    return {
      id,
      expectedPhase: requirementPhaseMap.get(id) || null,
      summaryEvidence,
      verificationEvidence,
      status:
        summaryEvidence && verificationEvidence
          ? 'satisfied'
          : summaryEvidence || verificationEvidence
            ? 'partial'
            : 'pending',
    };
  });

  return {
    generatedAt,
    projectRoot: rootDir,
    milestone: state.milestone,
    milestoneName: state.milestoneName,
    activePhases: phaseCoverage,
    requirements,
    hygiene,
  };
}

export function renderPlanningTraceabilityReport(report: PlanningTraceabilityReport): string {
  const satisfied = report.requirements.filter((item) => item.status === 'satisfied').length;
  const partial = report.requirements.filter((item) => item.status === 'partial').length;
  const pending = report.requirements.filter((item) => item.status === 'pending').length;

  const requirementSection = report.requirements.length
    ? [
        '## Requirement Coverage',
        '',
        '| Requirement | Expected Phase | Status | Summary Evidence | Verification Evidence |',
        '|---|---|---|---|---|',
        report.requirements
          .map(
            (item) =>
              `| ${item.id} | ${item.expectedPhase || 'n/a'} | ${item.status} | ${item.summaryEvidence ? 'yes' : 'no'} | ${item.verificationEvidence ? 'yes' : 'no'} |`,
          )
          .join('\n'),
      ]
    : ['## Requirement Coverage', '', 'No active milestone requirements are currently defined.'];

  const activePhaseSection = report.activePhases.length
    ? [
        '## Active Phase Contract',
        '',
        '| Phase | Directory | Summary Metadata | Verification Metadata | Summary Requirements | Verification Requirements |',
        '|---|---|---|---|---|---|',
        report.activePhases
          .map(
            (phase) =>
              `| ${phase.phaseNumber} | ${phase.phaseDirs.join(', ') || 'missing'} | ${phase.summaryMetadataReady ? 'ready' : phase.summaryFiles.length ? 'incomplete' : 'pending'} | ${phase.verificationMetadataReady ? 'ready' : phase.verificationFiles.length ? 'incomplete' : 'pending'} | ${phase.summaryRequirementsCompleted.join(', ') || 'n/a'} | ${phase.verificationRequirementsCompleted.join(', ') || 'n/a'} |`,
          )
          .join('\n'),
      ]
    : ['## Active Phase Contract', '', 'No active phases are currently mapped in `.planning/ROADMAP.md`.'];

  const hygieneLines = [
    `- Status: ${report.hygiene.status}`,
    `- Legacy phase dirs ignored for active discovery: ${report.hygiene.legacyPhaseDirs.join(', ') || 'none'}`,
    `- Orphan phase dirs: ${report.hygiene.orphanPhaseDirs.join(', ') || 'none'}`,
    `- Duplicate active phase dirs: ${
      report.hygiene.duplicateActivePhaseDirs.length
        ? report.hygiene.duplicateActivePhaseDirs
            .map((entry) => `${entry.phaseNumber} => ${entry.dirs.join(', ')}`)
            .join('; ')
        : 'none'
    }`,
    `- Missing active phase dirs: ${report.hygiene.missingActivePhaseDirs.join(', ') || 'none'}`,
  ];

  return [
    '# Planning Traceability Report',
    '',
    `- Milestone: ${report.milestone || 'n/a'}${report.milestoneName ? ` (${report.milestoneName})` : ''}`,
    `- Generated: ${report.generatedAt}`,
    `- Requirement coverage: satisfied=${satisfied}, partial=${partial}, pending=${pending}`,
    '',
    ...requirementSection,
    '',
    ...activePhaseSection,
    '',
    '## Planning Hygiene',
    '',
    ...hygieneLines,
  ].join('\n');
}

export function writePlanningTraceabilityArtifacts(
  report: PlanningTraceabilityReport,
  options?: { outputPath?: string; jsonOutputPath?: string },
): void {
  const outputPath = resolve(report.projectRoot, options?.outputPath || DEFAULT_PLANNING_TRACEABILITY_MD_PATH);
  const jsonOutputPath = resolve(
    report.projectRoot,
    options?.jsonOutputPath || DEFAULT_PLANNING_TRACEABILITY_JSON_PATH,
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  writeFileSync(outputPath, renderPlanningTraceabilityReport(report));
  writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
}

export function archivePlanningTraceabilityArtifacts(options?: {
  rootDir?: string;
  inputPath?: string;
  jsonInputPath?: string;
  outputPath?: string;
  jsonOutputPath?: string;
}): ArchivedPlanningTraceabilityArtifacts | null {
  const rootDir = resolve(options?.rootDir || process.cwd());
  const inputPath = resolve(rootDir, options?.inputPath || DEFAULT_PLANNING_TRACEABILITY_MD_PATH);
  const jsonInputPath = resolve(rootDir, options?.jsonInputPath || DEFAULT_PLANNING_TRACEABILITY_JSON_PATH);
  const markdown = readFileIfExists(inputPath);
  const json = readFileIfExists(jsonInputPath);
  const milestone = parseArchivedTraceabilityMilestone(markdown, json);

  if (!milestone) return null;

  const outputPath = resolve(rootDir, options?.outputPath || `.planning/milestones/${milestone}-TRACEABILITY.md`);
  const jsonOutputPath = resolve(
    rootDir,
    options?.jsonOutputPath || `.planning/milestones/${milestone}-TRACEABILITY.json`,
  );

  if (markdown) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, markdown);
  }

  if (json) {
    mkdirSync(dirname(jsonOutputPath), { recursive: true });
    writeFileSync(jsonOutputPath, json);
  }

  return {
    milestone,
    markdownPath: markdown ? normalizeRelativePath(rootDir, outputPath) : null,
    jsonPath: json ? normalizeRelativePath(rootDir, jsonOutputPath) : null,
  };
}
