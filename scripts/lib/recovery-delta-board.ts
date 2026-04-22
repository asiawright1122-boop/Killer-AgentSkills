import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH,
  DEFAULT_RECOVERY_PROOF_WINDOW_DIR,
  DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH,
  type RecoveryProofVerdict,
  type RecoveryProofWindowReport,
} from './recovery-proof-window';
import {
  DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH,
  type ControlBoardStatus,
  type RecoveryControlBoardReport,
  type RecoveryControlItem,
} from './recovery-control-board';

export const DEFAULT_RECOVERY_DELTA_BOARD_MD_PATH = 'reports/seo/latest-recovery-delta-board.md';
export const DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH = 'reports/seo/latest-recovery-delta-board.json';
export const DEFAULT_AUTHORITY_SURFACES_JSON_PATH = 'data/authority-surfaces.json';

export type RecoveryDeltaBoardState = 'improving' | 'flat' | 'noisy' | 'blocked';
export type RecoveryDeltaBoardConfidence = 'high' | 'medium' | 'low';
export type RecoveryDeltaBoardDisposition = 'deepen' | 'hold' | 'avoid';
export type RecoveryDeltaBoardCohortType =
  | 'authority-surface-group'
  | 'governed-corpus'
  | 'locale'
  | 'issue-cluster';
export type RecoveryDeltaBoardPresence = 'both' | 'current-only' | 'baseline-only';

export type RecoveryDeltaBoardMetrics = {
  baselineCount: number | null;
  currentCount: number | null;
  deltaCount: number | null;
  baselineScore: number | null;
  currentScore: number | null;
  deltaScore: number | null;
  baselineQueueCount: number | null;
  currentQueueCount: number | null;
  deltaQueueCount: number | null;
  baselinePrimaryCount: number | null;
  currentPrimaryCount: number | null;
  deltaPrimaryCount: number | null;
  coverageSourceAgeDays: number | null;
};

export type RecoveryDeltaBoardCohort = {
  id: string;
  cohortType: RecoveryDeltaBoardCohortType;
  label: string;
  state: RecoveryDeltaBoardState;
  confidence: RecoveryDeltaBoardConfidence;
  disposition: RecoveryDeltaBoardDisposition;
  comparisonPresence: RecoveryDeltaBoardPresence;
  rank: number;
  summary: string;
  evidence: string[];
  blockers: string[];
  nextActions: string[];
  relatedSurfaceIds: string[];
  metrics: RecoveryDeltaBoardMetrics;
};

export type RecoveryDeltaBoardPhase56SurfaceDecision = {
  surfaceId: string;
  label: string;
  surfaceClass: string;
  tier: string;
  priority: string | null;
  disposition: RecoveryDeltaBoardDisposition;
  reason: string;
  relatedCohortIds: string[];
};

export type RecoveryDeltaBoardReport = {
  generatedAt: string;
  headline: string;
  trustVerdict: RecoveryProofVerdict;
  baselineSeeded: boolean;
  comparisonWindow: {
    currentSnapshotDate: string;
    baselineSnapshotDate: string | null;
    baselineLabel: string;
    baselineDate: string | null;
    trafficPeriod: { start: string; end: string } | null;
    coverageFreshnessStatus: string | null;
    coverageSourceDate: string | null;
    coverageSourceAgeDays: number | null;
  };
  sourceSummary: RecoveryProofWindowReport['sourceSummary'];
  blockers: string[];
  nextActions: string[];
  statusSummary: {
    improving: number;
    flat: number;
    noisy: number;
    blocked: number;
    deepen: number;
    hold: number;
    avoid: number;
  };
  sections: {
    authoritySurfaceGroups: RecoveryDeltaBoardCohort[];
    governedCorpusCohorts: RecoveryDeltaBoardCohort[];
    localeCohorts: RecoveryDeltaBoardCohort[];
    issueClusterCohorts: RecoveryDeltaBoardCohort[];
  };
  phase56Handoff: {
    deepen: RecoveryDeltaBoardPhase56SurfaceDecision[];
    hold: RecoveryDeltaBoardPhase56SurfaceDecision[];
    avoid: RecoveryDeltaBoardPhase56SurfaceDecision[];
    notes: string[];
  };
};

type LocalizedText = Record<string, string>;

type AuthoritySurfaceRecord = {
  id: string;
  role: 'primary' | 'supporting';
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  href?: string;
  url?: string;
  title?: string | LocalizedText;
  description?: string | LocalizedText;
  rationale?: string | LocalizedText;
  placements?: string[];
};

type AuthorityQueueRecord = {
  id: string;
  surfaceId: string;
  priority: string;
  action?: string | LocalizedText;
  why?: string | LocalizedText;
};

type AuthoritySurfaceProgramJson = {
  generatedAt?: string;
  summary?: {
    totalSurfaces?: number | null;
    primarySurfaces?: number | null;
    supportingSurfaces?: number | null;
    editorialQueueItems?: number | null;
  } | null;
  surfaces?: AuthoritySurfaceRecord[] | null;
  editorialQueue?: AuthorityQueueRecord[] | null;
};

type AuthoritySurfacesJson = {
  surfaces?: AuthoritySurfaceRecord[] | null;
  editorialQueue?: AuthorityQueueRecord[] | null;
};

type RecoveryDeltaBoardFileOptions = {
  proofWindowJsonPath?: string;
  controlBoardJsonPath?: string;
  baselineControlBoardJsonPath?: string;
  authorityProgramJsonPath?: string;
  baselineAuthorityProgramJsonPath?: string;
  authoritySurfacesJsonPath?: string;
};

type RecoveryDeltaBoardWriteOptions = {
  markdownOutputPath?: string;
  jsonOutputPath?: string;
};

type AuthorityGroupStats = {
  surfaceClass: string;
  currentCount: number;
  baselineCount: number;
  currentPrimaryCount: number;
  baselinePrimaryCount: number;
  currentQueueCount: number;
  baselineQueueCount: number;
  currentSurfaceIds: string[];
  baselineSurfaceIds: string[];
  highestTier: string | null;
  hasPriorityNow: boolean;
};

const GROUP_LABELS: Record<string, string> = {
  hub: 'Authority hubs',
  collection: 'Curated collections',
  solution: 'Solution pages',
  guide: 'Editorial / install guides',
  comparison: 'Comparison pages',
  directory: 'Supporting directory',
};

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string | null | undefined): T | null {
  if (!path) return null;
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function writeJson(path: string, value: unknown): void {
  const absolutePath = toAbsolutePath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function snapshotDateFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeLocalizedText(value: string | LocalizedText | null | undefined): string {
  if (typeof value === 'string') return value;
  if (!value) return '';
  return value.en || value.zh || Object.values(value)[0] || '';
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  if (value === 0) return '0';
  return value > 0 ? `+${formatInteger(value)}` : `${formatInteger(value)}`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function controlStatusSeverity(status: ControlBoardStatus | string | null | undefined): number {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'blocked' || normalized === 'blocking') return 3;
  if (normalized === 'recoverable' || normalized === 'warning') return 2;
  if (normalized === 'recovered' || normalized === 'clear') return 1;
  return 0;
}

function stateRank(state: RecoveryDeltaBoardState): number {
  switch (state) {
    case 'blocked':
      return 4;
    case 'noisy':
      return 3;
    case 'flat':
      return 2;
    case 'improving':
      return 1;
  }
}

function dispositionRank(disposition: RecoveryDeltaBoardDisposition): number {
  switch (disposition) {
    case 'deepen':
      return 3;
    case 'hold':
      return 2;
    case 'avoid':
      return 1;
  }
}

function confidenceRank(confidence: RecoveryDeltaBoardConfidence): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
  }
}

function compareNumber(current: number | null | undefined, baseline: number | null | undefined): number | null {
  if (current === null || current === undefined || baseline === null || baseline === undefined) return null;
  return current - baseline;
}

function presenceOf(currentExists: boolean, baselineExists: boolean): RecoveryDeltaBoardPresence {
  if (currentExists && baselineExists) return 'both';
  if (currentExists) return 'current-only';
  return 'baseline-only';
}

function resolveSurfaceLabel(surface: AuthoritySurfaceRecord | null | undefined): string {
  if (!surface) return 'Unknown surface';
  return normalizeLocalizedText(surface.title) || surface.id;
}

function buildSurfaceMap(program: AuthoritySurfaceProgramJson | null, fallback: AuthoritySurfacesJson | null): Map<string, AuthoritySurfaceRecord> {
  const map = new Map<string, AuthoritySurfaceRecord>();
  const sources = [program?.surfaces || [], fallback?.surfaces || []];
  for (const source of sources) {
    for (const surface of source) {
      if (!surface?.id) continue;
      map.set(surface.id, surface);
    }
  }
  return map;
}

function buildQueueMap(program: AuthoritySurfaceProgramJson | null, fallback: AuthoritySurfacesJson | null): Map<string, AuthorityQueueRecord[]> {
  const map = new Map<string, AuthorityQueueRecord[]>();
  const sources = [program?.editorialQueue || [], fallback?.editorialQueue || []];
  for (const source of sources) {
    for (const item of source) {
      if (!item?.surfaceId) continue;
      const existing = map.get(item.surfaceId) || [];
      existing.push(item);
      map.set(item.surfaceId, existing);
    }
  }
  return map;
}

function tierPriority(tier: string | null | undefined): number {
  switch (tier) {
    case 'P0':
      return 4;
    case 'P1':
      return 3;
    case 'P2':
      return 2;
    case 'P3':
      return 1;
    default:
      return 0;
  }
}

function highestTierFor(surfaceIds: string[], surfaceMap: Map<string, AuthoritySurfaceRecord>): string | null {
  const tiers = surfaceIds
    .map((surfaceId) => surfaceMap.get(surfaceId)?.tier || null)
    .filter((tier): tier is string => Boolean(tier))
    .sort((a, b) => tierPriority(b) - tierPriority(a));
  return tiers[0] || null;
}

function groupAuthorityStats(
  currentProgram: AuthoritySurfaceProgramJson | null,
  baselineProgram: AuthoritySurfaceProgramJson | null,
  authorityData: AuthoritySurfacesJson | null,
): AuthorityGroupStats[] {
  const currentSurfaceMap = buildSurfaceMap(currentProgram, authorityData);
  const baselineSurfaceMap = buildSurfaceMap(baselineProgram, authorityData);
  const currentQueueMap = buildQueueMap(currentProgram, authorityData);
  const baselineQueueMap = buildQueueMap(baselineProgram, authorityData);

  const surfaceClasses = new Set<string>();
  for (const surface of currentSurfaceMap.values()) surfaceClasses.add(surface.surfaceClass);
  for (const surface of baselineSurfaceMap.values()) surfaceClasses.add(surface.surfaceClass);

  const stats: AuthorityGroupStats[] = [];

  for (const surfaceClass of surfaceClasses) {
    const currentSurfaces = Array.from(currentSurfaceMap.values()).filter((surface) => surface.surfaceClass === surfaceClass);
    const baselineSurfaces = Array.from(baselineSurfaceMap.values()).filter((surface) => surface.surfaceClass === surfaceClass);
    const currentSurfaceIds = currentSurfaces.map((surface) => surface.id);
    const baselineSurfaceIds = baselineSurfaces.map((surface) => surface.id);
    const currentQueueCount = currentSurfaceIds.reduce((sum, surfaceId) => sum + (currentQueueMap.get(surfaceId)?.length || 0), 0);
    const baselineQueueCount = baselineSurfaceIds.reduce((sum, surfaceId) => sum + (baselineQueueMap.get(surfaceId)?.length || 0), 0);
    const queueItems = currentSurfaceIds.flatMap((surfaceId) => currentQueueMap.get(surfaceId) || []);

    stats.push({
      surfaceClass,
      currentCount: currentSurfaces.length,
      baselineCount: baselineSurfaces.length,
      currentPrimaryCount: currentSurfaces.filter((surface) => surface.role === 'primary').length,
      baselinePrimaryCount: baselineSurfaces.filter((surface) => surface.role === 'primary').length,
      currentQueueCount,
      baselineQueueCount,
      currentSurfaceIds,
      baselineSurfaceIds,
      highestTier: highestTierFor(currentSurfaceIds, currentSurfaceMap),
      hasPriorityNow: queueItems.some((item) => String(item.priority || '').toLowerCase() === 'now'),
    });
  }

  return stats.sort((a, b) => (GROUP_LABELS[a.surfaceClass] || a.surfaceClass).localeCompare(GROUP_LABELS[b.surfaceClass] || b.surfaceClass));
}

function buildAuthoritySurfaceGroups(
  proofWindow: RecoveryProofWindowReport,
  currentProgram: AuthoritySurfaceProgramJson | null,
  baselineProgram: AuthoritySurfaceProgramJson | null,
  authorityData: AuthoritySurfacesJson | null,
): RecoveryDeltaBoardCohort[] {
  const comparableProofReady = proofWindow.trustVerdict === 'ready' && !proofWindow.baselineSeeded;
  const stats = groupAuthorityStats(currentProgram, baselineProgram, authorityData);

  return stats
    .map<RecoveryDeltaBoardCohort>((group) => {
      const supportingOnly = group.currentPrimaryCount === 0 && group.currentCount > 0;
      const stableInventory =
        group.currentCount === group.baselineCount &&
        group.currentPrimaryCount === group.baselinePrimaryCount &&
        group.currentQueueCount === group.baselineQueueCount;
      const disposition: RecoveryDeltaBoardDisposition = supportingOnly
        ? 'avoid'
        : comparableProofReady && (group.hasPriorityNow || tierPriority(group.highestTier) >= tierPriority('P0'))
          ? 'deepen'
          : 'hold';
      const state: RecoveryDeltaBoardState = supportingOnly ? 'blocked' : comparableProofReady ? 'flat' : 'noisy';
      const confidence: RecoveryDeltaBoardConfidence = comparableProofReady ? 'medium' : 'low';
      const evidence = dedupeStrings([
        `Baseline surfaces ${formatInteger(group.baselineCount)} -> current ${formatInteger(group.currentCount)} (${formatDelta(compareNumber(group.currentCount, group.baselineCount))}).`,
        `Primary surfaces ${formatInteger(group.baselinePrimaryCount)} -> ${formatInteger(group.currentPrimaryCount)}.`,
        `Editorial queue items ${formatInteger(group.baselineQueueCount)} -> ${formatInteger(group.currentQueueCount)}.`,
        group.highestTier ? `Highest tier in group: ${group.highestTier}.` : '',
      ]);
      const blockers = dedupeStrings([
        proofWindow.trustVerdict !== 'ready'
          ? `Comparable post-governance proof is still ${proofWindow.trustVerdict}, so this group cannot be promoted yet.`
          : '',
        supportingOnly ? 'This group is supporting-only and should not become the lead recovery bet.' : '',
      ]);
      const nextActions = dedupeStrings([
        disposition === 'deepen'
          ? 'Carry this group into the authority uplift scorecard and define promote / hold / stop thresholds.'
          : '',
        disposition === 'hold'
          ? 'Keep the group stable until another trustworthy proof window confirms lift.'
          : '',
        disposition === 'avoid'
          ? 'Keep this group supporting-only while curated authority surfaces carry recovery.'
          : '',
      ]);
      const label = GROUP_LABELS[group.surfaceClass] || group.surfaceClass;
      const summary = supportingOnly
        ? `${label} remains a supporting-only cohort and should stay out of expansion while recovery proof is incomplete.`
        : comparableProofReady
          ? `${label} is structurally stable against the baseline and is now eligible for Phase 56 uplift gating.`
          : `${label} is structurally stable, but recovery lift is still unproven because the current proof window is not trustworthy enough.`;

      return {
        id: `authority-group-${group.surfaceClass}`,
        cohortType: 'authority-surface-group',
        label,
        state,
        confidence,
        disposition,
        comparisonPresence: presenceOf(group.currentCount > 0, group.baselineCount > 0),
        rank:
          stateRank(state) * 1000 +
          dispositionRank(disposition) * 100 +
          confidenceRank(confidence) * 10 +
          Math.max(group.currentCount, group.baselineCount),
        summary,
        evidence,
        blockers,
        nextActions,
        relatedSurfaceIds: dedupeStrings([...group.currentSurfaceIds, ...group.baselineSurfaceIds]),
        metrics: {
          baselineCount: group.baselineCount,
          currentCount: group.currentCount,
          deltaCount: compareNumber(group.currentCount, group.baselineCount),
          baselineScore: null,
          currentScore: null,
          deltaScore: null,
          baselineQueueCount: group.baselineQueueCount,
          currentQueueCount: group.currentQueueCount,
          deltaQueueCount: compareNumber(group.currentQueueCount, group.baselineQueueCount),
          baselinePrimaryCount: group.baselinePrimaryCount,
          currentPrimaryCount: group.currentPrimaryCount,
          deltaPrimaryCount: compareNumber(group.currentPrimaryCount, group.baselinePrimaryCount),
          coverageSourceAgeDays: proofWindow.sourceSummary.coverageSourceAgeDays ?? null,
        },
      };
    })
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
}

function buildGovernedCorpusCohorts(
  proofWindow: RecoveryProofWindowReport,
  currentProgram: AuthoritySurfaceProgramJson | null,
  baselineProgram: AuthoritySurfaceProgramJson | null,
  authorityData: AuthoritySurfacesJson | null,
): RecoveryDeltaBoardCohort[] {
  const currentSurfaceMap = buildSurfaceMap(currentProgram, authorityData);
  const baselineSurfaceMap = buildSurfaceMap(baselineProgram, authorityData);
  const currentQueueMap = buildQueueMap(currentProgram, authorityData);
  const baselineQueueMap = buildQueueMap(baselineProgram, authorityData);
  const comparableProofReady = proofWindow.trustVerdict === 'ready' && !proofWindow.baselineSeeded;

  const currentPrimaryIds = Array.from(currentSurfaceMap.values())
    .filter((surface) => surface.role === 'primary')
    .map((surface) => surface.id);
  const baselinePrimaryIds = Array.from(baselineSurfaceMap.values())
    .filter((surface) => surface.role === 'primary')
    .map((surface) => surface.id);
  const currentSupportingIds = Array.from(currentSurfaceMap.values())
    .filter((surface) => surface.role === 'supporting')
    .map((surface) => surface.id);
  const baselineSupportingIds = Array.from(baselineSurfaceMap.values())
    .filter((surface) => surface.role === 'supporting')
    .map((surface) => surface.id);
  const currentQueueNowIds = Array.from(currentQueueMap.entries())
    .filter(([, items]) => items.some((item) => String(item.priority || '').toLowerCase() === 'now'))
    .map(([surfaceId]) => surfaceId);
  const baselineQueueNowIds = Array.from(baselineQueueMap.entries())
    .filter(([, items]) => items.some((item) => String(item.priority || '').toLowerCase() === 'now'))
    .map(([surfaceId]) => surfaceId);
  const currentQueueNextIds = Array.from(currentQueueMap.entries())
    .filter(([, items]) => items.some((item) => String(item.priority || '').toLowerCase() === 'next'))
    .map(([surfaceId]) => surfaceId);
  const baselineQueueNextIds = Array.from(baselineQueueMap.entries())
    .filter(([, items]) => items.some((item) => String(item.priority || '').toLowerCase() === 'next'))
    .map(([surfaceId]) => surfaceId);

  const definitions = [
    {
      id: 'governed-primary-authority-surfaces',
      label: 'Primary authority corpus',
      currentIds: currentPrimaryIds,
      baselineIds: baselinePrimaryIds,
      disposition: comparableProofReady ? 'deepen' : 'hold',
      state: 'flat' as RecoveryDeltaBoardState,
      confidence: 'medium' as RecoveryDeltaBoardConfidence,
      extraBlocker: comparableProofReady ? '' : 'Primary surfaces should not expand until a second trustworthy proof window exists.',
      nextAction: comparableProofReady
        ? 'Turn this cohort into explicit uplift gates in Phase 56.'
        : 'Keep the governed primary corpus stable and wait for one more trustworthy comparable window.',
    },
    {
      id: 'governed-supporting-directory-surface',
      label: 'Supporting directory cohort',
      currentIds: currentSupportingIds,
      baselineIds: baselineSupportingIds,
      disposition: 'avoid' as RecoveryDeltaBoardDisposition,
      state: 'blocked' as RecoveryDeltaBoardState,
      confidence: 'medium' as RecoveryDeltaBoardConfidence,
      extraBlocker: 'The full directory remains supporting-only and should not reopen broad corpus growth.',
      nextAction: 'Keep the supporting directory available for breadth, but do not elevate it into the lead recovery layer.',
    },
    {
      id: 'governed-editorial-queue-now',
      label: 'Editorial queue: now',
      currentIds: currentQueueNowIds,
      baselineIds: baselineQueueNowIds,
      disposition: comparableProofReady ? 'deepen' : 'hold',
      state: comparableProofReady ? ('flat' as RecoveryDeltaBoardState) : ('noisy' as RecoveryDeltaBoardState),
      confidence: comparableProofReady ? ('medium' as RecoveryDeltaBoardConfidence) : ('low' as RecoveryDeltaBoardConfidence),
      extraBlocker: comparableProofReady ? '' : 'Current proof is not ready enough to promote the "now" queue beyond a guarded hold state.',
      nextAction: comparableProofReady
        ? 'Use this queue as the first uplift wave in Phase 56.'
        : 'Keep the "now" queue focused, but do not treat it as proof of lift yet.',
    },
    {
      id: 'governed-editorial-queue-next',
      label: 'Editorial queue: next',
      currentIds: currentQueueNextIds,
      baselineIds: baselineQueueNextIds,
      disposition: 'hold' as RecoveryDeltaBoardDisposition,
      state: comparableProofReady ? ('flat' as RecoveryDeltaBoardState) : ('noisy' as RecoveryDeltaBoardState),
      confidence: comparableProofReady ? ('medium' as RecoveryDeltaBoardConfidence) : ('low' as RecoveryDeltaBoardConfidence),
      extraBlocker: 'The "next" queue is intentionally behind the first uplift wave.',
      nextAction: 'Keep these surfaces staged behind the highest-priority proof-backed uplift candidates.',
    },
  ];

  return definitions.map<RecoveryDeltaBoardCohort>((definition) => ({
    id: definition.id,
    cohortType: 'governed-corpus',
    label: definition.label,
    state: definition.state,
    confidence: definition.confidence,
    disposition: definition.disposition,
    comparisonPresence: presenceOf(definition.currentIds.length > 0, definition.baselineIds.length > 0),
    rank:
      stateRank(definition.state) * 1000 +
      dispositionRank(definition.disposition) * 100 +
      confidenceRank(definition.confidence) * 10 +
      Math.max(definition.currentIds.length, definition.baselineIds.length),
    summary:
      definition.disposition === 'avoid'
        ? `${definition.label} stays supporting-only and should not reopen volume-led recovery.`
        : `${definition.label} remains structurally stable and is waiting for Phase 56 gating rather than ad-hoc expansion.`,
    evidence: [
      `Baseline count ${formatInteger(definition.baselineIds.length)} -> current ${formatInteger(definition.currentIds.length)} (${formatDelta(compareNumber(definition.currentIds.length, definition.baselineIds.length))}).`,
      comparableProofReady
        ? 'A comparable proof window now exists, so this cohort can move into uplift gating.'
        : 'The current proof window is still seeded or not trustworthy enough for direct expansion.',
    ],
    blockers: dedupeStrings([definition.extraBlocker]),
    nextActions: [definition.nextAction],
    relatedSurfaceIds: dedupeStrings([...definition.currentIds, ...definition.baselineIds]),
    metrics: {
      baselineCount: definition.baselineIds.length,
      currentCount: definition.currentIds.length,
      deltaCount: compareNumber(definition.currentIds.length, definition.baselineIds.length),
      baselineScore: null,
      currentScore: null,
      deltaScore: null,
      baselineQueueCount: null,
      currentQueueCount: null,
      deltaQueueCount: null,
      baselinePrimaryCount: null,
      currentPrimaryCount: null,
      deltaPrimaryCount: null,
      coverageSourceAgeDays: proofWindow.sourceSummary.coverageSourceAgeDays ?? null,
    },
  }));
}

function controlComparisonSummary(
  lens: 'locale' | 'cluster',
  currentItem: RecoveryControlItem | null,
  baselineItem: RecoveryControlItem | null,
  state: RecoveryDeltaBoardState,
  proofWindow: RecoveryProofWindowReport,
): string {
  if (!currentItem && baselineItem) {
    return `${baselineItem.title} was present in the baseline board but no longer appears in the current board, so it is treated as resolved unless it returns.`;
  }

  if (!currentItem) {
    return `No current ${lens} cohort evidence is available.`;
  }

  if (state === 'improving' && baselineItem) {
    return `${currentItem.title} still exists, but its ranked risk score moved from ${formatInteger(baselineItem.score)} to ${formatInteger(currentItem.score)}.`;
  }

  if (lens === 'cluster' && proofWindow.sourceSummary.coverageFreshnessStatus === 'blocking') {
    return `${currentItem.title} remains blocked because the freshest Coverage Drilldown export is still ${proofWindow.sourceSummary.coverageSourceDate || 'unknown'} (age ${proofWindow.sourceSummary.coverageSourceAgeDays ?? 'n/a'} day(s)).`;
  }

  if (lens === 'locale') {
    return `${currentItem.title} still appears in the current decline board, so locale recovery is not yet proven.`;
  }

  return currentItem.summary;
}

function buildControlCohorts(
  lens: 'locale' | 'cluster',
  proofWindow: RecoveryProofWindowReport,
  currentBoard: RecoveryControlBoardReport | null,
  baselineBoard: RecoveryControlBoardReport | null,
): RecoveryDeltaBoardCohort[] {
  const currentItems = (currentBoard?.items || []).filter((item) => item.lens === lens);
  const baselineItems = (baselineBoard?.items || []).filter((item) => item.lens === lens);
  const currentMap = new Map(currentItems.map((item) => [item.id, item]));
  const baselineMap = new Map(baselineItems.map((item) => [item.id, item]));
  const ids = new Set<string>([...currentMap.keys(), ...baselineMap.keys()]);
  const measurementBlocked = lens === 'cluster' && proofWindow.sourceSummary.coverageFreshnessStatus === 'blocking';

  return Array.from(ids)
    .map<RecoveryDeltaBoardCohort>((id) => {
      const currentItem = currentMap.get(id) || null;
      const baselineItem = baselineMap.get(id) || null;
      const currentExists = Boolean(currentItem);
      const baselineExists = Boolean(baselineItem);
      const currentSeverity = controlStatusSeverity(currentItem?.status);
      const baselineSeverity = controlStatusSeverity(baselineItem?.status);
      const scoreDelta = compareNumber(currentItem?.score ?? null, baselineItem?.score ?? null);
      const severityImproved = currentExists && baselineExists ? currentSeverity < baselineSeverity : !currentExists && baselineExists;
      const scoreImproved = scoreDelta !== null ? scoreDelta < 0 : false;

      let state: RecoveryDeltaBoardState = 'flat';
      if (!currentExists && baselineExists) {
        state = measurementBlocked ? 'noisy' : 'improving';
      } else if (measurementBlocked) {
        state = severityImproved || scoreImproved ? 'noisy' : 'blocked';
      } else if (severityImproved || scoreImproved) {
        state = 'improving';
      } else if (currentExists) {
        state = 'blocked';
      }

      const confidence: RecoveryDeltaBoardConfidence = measurementBlocked
        ? 'low'
        : proofWindow.sourceSummary.trafficStatus === 'clear' || lens === 'cluster'
          ? 'medium'
          : 'low';
      const disposition: RecoveryDeltaBoardDisposition = state === 'improving' ? 'hold' : 'avoid';
      const label = currentItem?.title || baselineItem?.title || id;
      const blockers = dedupeStrings([
        measurementBlocked
          ? `Coverage freshness remains ${proofWindow.sourceSummary.coverageFreshnessStatus}, so ${lens}-level attribution is still partially blocked.`
          : '',
        state === 'blocked' && currentItem ? currentItem.summary : '',
      ]);
      const nextActions = dedupeStrings([
        ...(currentItem?.actions || baselineItem?.actions || []),
        measurementBlocked && lens === 'cluster'
          ? 'Import a fresher Coverage Drilldown export before treating cluster movement as real.'
          : '',
      ]);
      const evidence = dedupeStrings([
        baselineItem ? `Baseline score ${formatInteger(baselineItem.score)}.` : 'No baseline cohort entry existed.',
        currentItem ? `Current score ${formatInteger(currentItem.score)}.` : 'Current board no longer lists this cohort.',
        ...(currentItem?.evidence || []).slice(0, 3),
        ...(baselineItem?.evidence || []).slice(0, 2),
      ]);

      return {
        id,
        cohortType: lens === 'locale' ? 'locale' : 'issue-cluster',
        label,
        state,
        confidence,
        disposition,
        comparisonPresence: presenceOf(currentExists, baselineExists),
        rank:
          stateRank(state) * 1000 +
          confidenceRank(confidence) * 100 +
          dispositionRank(disposition) * 10 +
          Math.round(Math.max(currentItem?.score || 0, baselineItem?.score || 0)),
        summary: controlComparisonSummary(lens, currentItem, baselineItem, state, proofWindow),
        evidence,
        blockers,
        nextActions,
        relatedSurfaceIds: [],
        metrics: {
          baselineCount: baselineExists ? 1 : 0,
          currentCount: currentExists ? 1 : 0,
          deltaCount: compareNumber(currentExists ? 1 : 0, baselineExists ? 1 : 0),
          baselineScore: baselineItem?.score ?? null,
          currentScore: currentItem?.score ?? null,
          deltaScore: scoreDelta,
          baselineQueueCount: null,
          currentQueueCount: null,
          deltaQueueCount: null,
          baselinePrimaryCount: null,
          currentPrimaryCount: null,
          deltaPrimaryCount: null,
          coverageSourceAgeDays: proofWindow.sourceSummary.coverageSourceAgeDays ?? null,
        },
      };
    })
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
}

function sortSurfaceDecisions(decisions: RecoveryDeltaBoardPhase56SurfaceDecision[]): RecoveryDeltaBoardPhase56SurfaceDecision[] {
  return [...decisions].sort((a, b) => {
    const dispositionGap = dispositionRank(b.disposition) - dispositionRank(a.disposition);
    if (dispositionGap !== 0) return dispositionGap;
    const priorityGap = tierPriority(b.tier) - tierPriority(a.tier);
    if (priorityGap !== 0) return priorityGap;
    return a.label.localeCompare(b.label);
  });
}

function buildPhase56Handoff(
  proofWindow: RecoveryProofWindowReport,
  currentProgram: AuthoritySurfaceProgramJson | null,
  authorityData: AuthoritySurfacesJson | null,
): RecoveryDeltaBoardReport['phase56Handoff'] {
  const surfaceMap = buildSurfaceMap(currentProgram, authorityData);
  const queueMap = buildQueueMap(currentProgram, authorityData);
  const comparableProofReady = proofWindow.trustVerdict === 'ready' && !proofWindow.baselineSeeded;
  const focusSurfaces = Array.from(surfaceMap.values()).filter((surface) => {
    const queueItems = queueMap.get(surface.id) || [];
    return surface.role === 'supporting' || surface.tier === 'P0' || queueItems.length > 0;
  });

  const decisions = focusSurfaces.map<RecoveryDeltaBoardPhase56SurfaceDecision>((surface) => {
    const queueItems = queueMap.get(surface.id) || [];
    const highestPriority = queueItems
      .map((item) => String(item.priority || '').toLowerCase())
      .sort((a, b) => (a === 'now' ? -1 : b === 'now' ? 1 : a.localeCompare(b)))[0] || null;
    const disposition: RecoveryDeltaBoardDisposition =
      surface.role === 'supporting' || surface.surfaceClass === 'directory'
        ? 'avoid'
        : comparableProofReady && (surface.tier === 'P0' || highestPriority === 'now')
          ? 'deepen'
          : 'hold';

    const reason =
      disposition === 'deepen'
        ? 'Comparable proof is ready and this surface sits in the highest-priority authority layer, so Phase 56 can apply explicit uplift gates here first.'
        : disposition === 'avoid'
          ? 'This surface is supporting-only and should stay outside the lead recovery expansion path.'
          : 'Keep this surface in the guarded authority set, but wait for explicit Phase 56 uplift thresholds before promoting it harder.';

    return {
      surfaceId: surface.id,
      label: resolveSurfaceLabel(surface),
      surfaceClass: surface.surfaceClass,
      tier: surface.tier,
      priority: highestPriority,
      disposition,
      reason,
      relatedCohortIds: dedupeStrings([
        `authority-group-${surface.surfaceClass}`,
        surface.role === 'supporting' ? 'governed-supporting-directory-surface' : 'governed-primary-authority-surfaces',
        highestPriority === 'now' ? 'governed-editorial-queue-now' : '',
        highestPriority === 'next' ? 'governed-editorial-queue-next' : '',
      ]),
    };
  });

  const deepen = sortSurfaceDecisions(decisions.filter((item) => item.disposition === 'deepen'));
  const hold = sortSurfaceDecisions(decisions.filter((item) => item.disposition === 'hold'));
  const avoid = sortSurfaceDecisions(decisions.filter((item) => item.disposition === 'avoid'));

  return {
    deepen,
    hold,
    avoid,
    notes: dedupeStrings([
      comparableProofReady
        ? 'Phase 56 can start from the deepen list, but every candidate still needs explicit promote / hold / stop thresholds.'
        : 'No surface should be promoted yet because the current proof window is still seeded or blocked.',
      'Keep the supporting directory out of the lead recovery bet even if it remains indexable for breadth and retrieval.',
      proofWindow.sourceSummary.coverageFreshnessStatus === 'blocking'
        ? 'Cluster-level coverage freshness is still blocking, so authority uplift must avoid over-interpreting apparent improvement.'
        : '',
    ]),
  };
}

function summarizeStates(cohorts: RecoveryDeltaBoardCohort[]): RecoveryDeltaBoardReport['statusSummary'] {
  return cohorts.reduce<RecoveryDeltaBoardReport['statusSummary']>(
    (acc, cohort) => {
      acc[cohort.state] += 1;
      acc[cohort.disposition] += 1;
      return acc;
    },
    {
      improving: 0,
      flat: 0,
      noisy: 0,
      blocked: 0,
      deepen: 0,
      hold: 0,
      avoid: 0,
    },
  );
}

export function buildRecoveryDeltaBoardReport(options: {
  generatedAt?: string;
  proofWindowReport: RecoveryProofWindowReport;
  currentControlBoardReport?: RecoveryControlBoardReport | null;
  baselineControlBoardReport?: RecoveryControlBoardReport | null;
  currentAuthorityProgramReport?: AuthoritySurfaceProgramJson | null;
  baselineAuthorityProgramReport?: AuthoritySurfaceProgramJson | null;
  authoritySurfacesData?: AuthoritySurfacesJson | null;
}): RecoveryDeltaBoardReport {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const proofWindow = options.proofWindowReport;
  const currentControlBoard = options.currentControlBoardReport || null;
  const baselineControlBoard = options.baselineControlBoardReport || options.currentControlBoardReport || null;
  const currentAuthorityProgram = options.currentAuthorityProgramReport || null;
  const baselineAuthorityProgram = options.baselineAuthorityProgramReport || options.currentAuthorityProgramReport || null;
  const authorityData = options.authoritySurfacesData || null;

  const authoritySurfaceGroups = buildAuthoritySurfaceGroups(
    proofWindow,
    currentAuthorityProgram,
    baselineAuthorityProgram,
    authorityData,
  );
  const governedCorpusCohorts = buildGovernedCorpusCohorts(
    proofWindow,
    currentAuthorityProgram,
    baselineAuthorityProgram,
    authorityData,
  );
  const localeCohorts = buildControlCohorts('locale', proofWindow, currentControlBoard, baselineControlBoard);
  const issueClusterCohorts = buildControlCohorts('cluster', proofWindow, currentControlBoard, baselineControlBoard);
  const allCohorts = [...authoritySurfaceGroups, ...governedCorpusCohorts, ...localeCohorts, ...issueClusterCohorts];
  const phase56Handoff = buildPhase56Handoff(proofWindow, currentAuthorityProgram, authorityData);
  const statusSummary = summarizeStates(allCohorts);
  const blockers = dedupeStrings([
    ...(proofWindow.blockers || []),
    proofWindow.sourceSummary.coverageFreshnessStatus === 'blocking'
      ? 'Cluster attribution still depends on a stale Coverage Drilldown raw export.'
      : '',
    proofWindow.baselineSeeded ? 'Only the first seeded proof window exists so far; authority lift is not yet a proven trend.' : '',
    phase56Handoff.deepen.length === 0 ? 'No authority surface qualifies for promotion yet.' : '',
  ]);
  const nextActions = dedupeStrings([
    ...(proofWindow.nextActions || []),
    ...(currentControlBoard?.nextActions || []),
    phase56Handoff.deepen.length > 0
      ? 'Start Phase 56 from the current deepen candidates and encode explicit uplift thresholds.'
      : 'Hold authority surfaces steady and wait for a second trustworthy proof window before promoting them.',
    'Keep the supporting directory secondary while curated authority surfaces stay in front.',
  ]).slice(0, 8);
  const baselineSnapshotDate = snapshotDateFrom(proofWindow.baselineDate);
  const headline =
    phase56Handoff.deepen.length > 0
      ? `Recovery delta board found ${phase56Handoff.deepen.length} Phase 56 deepen candidate(s) with trustworthy proof, while ${statusSummary.blocked} cohort(s) still remain blocked.`
      : `Recovery delta board shows ${statusSummary.blocked} blocked cohort(s) and no authority surfaces ready for promotion yet; hold the curated set steady until another trustworthy window lands.`;

  return {
    generatedAt,
    headline,
    trustVerdict: proofWindow.trustVerdict,
    baselineSeeded: proofWindow.baselineSeeded,
    comparisonWindow: {
      currentSnapshotDate: proofWindow.snapshotDate,
      baselineSnapshotDate,
      baselineLabel: proofWindow.baselineLabel,
      baselineDate: proofWindow.baselineDate,
      trafficPeriod: proofWindow.sourceSummary.trafficPeriod,
      coverageFreshnessStatus: proofWindow.sourceSummary.coverageFreshnessStatus,
      coverageSourceDate: proofWindow.sourceSummary.coverageSourceDate,
      coverageSourceAgeDays: proofWindow.sourceSummary.coverageSourceAgeDays,
    },
    sourceSummary: proofWindow.sourceSummary,
    blockers,
    nextActions,
    statusSummary,
    sections: {
      authoritySurfaceGroups,
      governedCorpusCohorts,
      localeCohorts,
      issueClusterCohorts,
    },
    phase56Handoff,
  };
}

function inferBaselineArtifactPath(
  proofWindow: RecoveryProofWindowReport,
  fileName: string,
  explicitPath?: string,
): string | undefined {
  if (explicitPath) return explicitPath;
  const baselineSnapshotDate = snapshotDateFrom(proofWindow.baselineDate);
  if (!baselineSnapshotDate) return undefined;
  return `${DEFAULT_RECOVERY_PROOF_WINDOW_DIR}/${baselineSnapshotDate}/${fileName}`;
}

export function buildRecoveryDeltaBoardFromFiles(
  options: RecoveryDeltaBoardFileOptions = {},
): RecoveryDeltaBoardReport {
  const proofWindow = readJsonFile<RecoveryProofWindowReport>(options.proofWindowJsonPath || DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH);
  if (!proofWindow) {
    throw new Error(`Missing proof-window report at ${options.proofWindowJsonPath || DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH}`);
  }

  const currentControlBoard = readJsonFile<RecoveryControlBoardReport>(
    options.controlBoardJsonPath || DEFAULT_RECOVERY_CONTROL_BOARD_JSON_PATH,
  );
  const baselineControlBoard = readJsonFile<RecoveryControlBoardReport>(
    inferBaselineArtifactPath(proofWindow, 'latest-recovery-control-board.json', options.baselineControlBoardJsonPath),
  );
  const currentAuthorityProgram = readJsonFile<AuthoritySurfaceProgramJson>(
    options.authorityProgramJsonPath || DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH,
  );
  const baselineAuthorityProgram = readJsonFile<AuthoritySurfaceProgramJson>(
    inferBaselineArtifactPath(proofWindow, 'latest-authority-surface-program.json', options.baselineAuthorityProgramJsonPath),
  );
  const authoritySurfacesData = readJsonFile<AuthoritySurfacesJson>(
    options.authoritySurfacesJsonPath || DEFAULT_AUTHORITY_SURFACES_JSON_PATH,
  );

  return buildRecoveryDeltaBoardReport({
    proofWindowReport: proofWindow,
    currentControlBoardReport: currentControlBoard,
    baselineControlBoardReport: baselineControlBoard,
    currentAuthorityProgramReport: currentAuthorityProgram,
    baselineAuthorityProgramReport: baselineAuthorityProgram,
    authoritySurfacesData,
  });
}

function renderCohortTable(cohorts: RecoveryDeltaBoardCohort[]): string[] {
  return [
    '| Cohort | State | Confidence | Phase 56 | Baseline | Current | Summary |',
    '|---|---|---|---|---|---|---|',
    ...cohorts.map((cohort) => {
      const baseline = cohort.metrics.baselineScore ?? cohort.metrics.baselineCount;
      const current = cohort.metrics.currentScore ?? cohort.metrics.currentCount;
      return `| ${escapeCell(cohort.label)} | ${cohort.state} | ${cohort.confidence} | ${cohort.disposition} | ${baseline ?? 'n/a'} | ${current ?? 'n/a'} | ${escapeCell(cohort.summary)} |`;
    }),
  ];
}

export function renderRecoveryDeltaBoardReport(report: RecoveryDeltaBoardReport): string {
  const renderSurfaceDecisions = (items: RecoveryDeltaBoardPhase56SurfaceDecision[]): string[] =>
    items.length > 0
      ? items.map(
          (item) =>
            `- ${item.surfaceId} | ${item.label} | ${item.surfaceClass} | ${item.tier} | ${item.priority || 'none'} | ${item.reason}`,
        )
      : ['- none'];

  return [
    '# Recovery Delta Board',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Trust verdict: ${report.trustVerdict}`,
    `- Current snapshot: ${report.comparisonWindow.currentSnapshotDate}`,
    `- Baseline snapshot: ${report.comparisonWindow.baselineSnapshotDate || 'n/a'}`,
    `- Baseline seeded now: ${report.baselineSeeded ? 'yes' : 'no'}`,
    `- Traffic period: ${report.comparisonWindow.trafficPeriod ? `${report.comparisonWindow.trafficPeriod.start} -> ${report.comparisonWindow.trafficPeriod.end}` : 'n/a'}`,
    `- Coverage freshness: ${report.comparisonWindow.coverageFreshnessStatus || 'n/a'} (${report.comparisonWindow.coverageSourceDate || 'n/a'}, age=${report.comparisonWindow.coverageSourceAgeDays ?? 'n/a'})`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Status Summary',
    '',
    `- improving: ${report.statusSummary.improving}`,
    `- flat: ${report.statusSummary.flat}`,
    `- noisy: ${report.statusSummary.noisy}`,
    `- blocked: ${report.statusSummary.blocked}`,
    `- phase 56 deepen: ${report.statusSummary.deepen}`,
    `- phase 56 hold: ${report.statusSummary.hold}`,
    `- phase 56 avoid: ${report.statusSummary.avoid}`,
    '',
    '## Authority Surface Groups',
    '',
    ...renderCohortTable(report.sections.authoritySurfaceGroups),
    '',
    '## Governed Corpus Cohorts',
    '',
    ...renderCohortTable(report.sections.governedCorpusCohorts),
    '',
    '## Locale Cohorts',
    '',
    ...renderCohortTable(report.sections.localeCohorts),
    '',
    '## Issue Cluster Cohorts',
    '',
    ...renderCohortTable(report.sections.issueClusterCohorts),
    '',
    '## Phase 56 Handoff',
    '',
    '### Deepen',
    '',
    ...renderSurfaceDecisions(report.phase56Handoff.deepen),
    '',
    '### Hold',
    '',
    ...renderSurfaceDecisions(report.phase56Handoff.hold),
    '',
    '### Avoid',
    '',
    ...renderSurfaceDecisions(report.phase56Handoff.avoid),
    '',
    '### Notes',
    '',
    ...(report.phase56Handoff.notes.length > 0 ? report.phase56Handoff.notes.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0 ? report.nextActions.map((item) => `- ${item}`) : ['- none']),
    '',
  ].join('\n');
}

export function writeRecoveryDeltaBoardArtifacts(
  report: RecoveryDeltaBoardReport,
  options: RecoveryDeltaBoardWriteOptions = {},
): RecoveryDeltaBoardReport {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_RECOVERY_DELTA_BOARD_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH;
  writeJson(jsonOutputPath, report);

  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  writeFileSync(markdownAbsolutePath, `${renderRecoveryDeltaBoardReport(report)}\n`, 'utf8');
  return report;
}
