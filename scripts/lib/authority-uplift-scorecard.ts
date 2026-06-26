import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseGscCsv, type GscRow } from '../../src/lib/gsc-report';
import {
  DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH,
  type RecoveryDeltaBoardCohort,
  type RecoveryDeltaBoardConfidence,
  type RecoveryDeltaBoardDisposition,
  type RecoveryDeltaBoardReport,
  type RecoveryDeltaBoardState,
} from './recovery-delta-board';

export const DEFAULT_AUTHORITY_UPLIFT_SCORECARD_MD_PATH = 'reports/seo/latest-authority-uplift-scorecard.md';
export const DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH = 'reports/seo/latest-authority-uplift-scorecard.json';
export const DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH = 'reports/seo/latest-authority-surface-program.json';
export const DEFAULT_AUTHORITY_SURFACES_JSON_PATH = 'data/authority-surfaces.json';
export const DEFAULT_TRAFFIC_REPORT_JSON_PATH = 'reports/gsc/latest-ctr-report.json';
export const DEFAULT_GSC_SNAPSHOT_DIR = 'reports/gsc/snapshots';
export const DEFAULT_URL_INSPECTION_COVERAGE_SWEEP_JSON_PATH = 'reports/seo/latest-url-inspection-coverage-sweep.json';

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'ru', 'zh'];

export type AuthorityUpliftDecision = 'promote' | 'hold' | 'stop';
export type AuthorityUpliftCadence = 'weekly' | 'biweekly' | 'monthly' | 'paused';
export type AuthorityUpliftGateStatus = 'pass' | 'watch' | 'fail';
export type AuthorityInternalLinkSupport = 'strong' | 'medium' | 'limited';

export type AuthorityUpliftGate = {
  id: string;
  label: string;
  status: AuthorityUpliftGateStatus;
  target: string;
  observed: string;
  notes: string[];
};

export type AuthorityUpliftThresholds = {
  minImpressions: number;
  minClicks: number;
  maxPosition: number;
  minPlacementCount: number;
  maxCoverageAgeDays: number;
};

export type AuthorityUpliftSurfaceScore = {
  surfaceId: string;
  label: string;
  url: string;
  role: 'primary' | 'supporting';
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  decision: AuthorityUpliftDecision;
  cadence: AuthorityUpliftCadence;
  score: number;
  editorialPriority: 'now' | 'next' | 'none';
  phase55Disposition: RecoveryDeltaBoardDisposition;
  phase55State: RecoveryDeltaBoardState;
  phase55Confidence: RecoveryDeltaBoardConfidence;
  summary: string;
  rationale: string;
  nextActions: string[];
  thresholds: AuthorityUpliftThresholds;
  gates: AuthorityUpliftGate[];
  metrics: {
    currentClicks: number;
    currentImpressions: number;
    currentCtr: number;
    currentPosition: number | null;
    previousClicks: number;
    previousImpressions: number;
    previousCtr: number;
    previousPosition: number | null;
    deltaClicks: number;
    deltaImpressions: number;
    deltaCtr: number;
    deltaPosition: number | null;
    placements: string[];
    placementCount: number;
    internalLinkSupport: AuthorityInternalLinkSupport;
    matchedCurrentUrls: string[];
    matchedPreviousUrls: string[];
    trafficWindow: { start: string; end: string } | null;
    previousWindow: { start: string; end: string } | null;
    trafficSourceMode: string | null;
    proofVerdict: string;
    coverageSourceAgeDays: number | null;
    coverageFreshnessStatus: string | null;
  };
};

export type AuthorityUpliftScorecardReport = {
  generatedAt: string;
  headline: string;
  summary: {
    totalSurfaces: number;
    promote: number;
    hold: number;
    stop: number;
    weekly: number;
    biweekly: number;
    monthly: number;
    paused: number;
  };
  comparisonWindow: {
    currentPeriod: { start: string; end: string } | null;
    previousPeriod: { start: string; end: string } | null;
    trustVerdict: string;
    baselineSeeded: boolean;
    coverageFreshnessStatus: string | null;
    coverageSourceAgeDays: number | null;
    trafficSourceMode: string | null;
  };
  surfaces: AuthorityUpliftSurfaceScore[];
  decisions: {
    promote: AuthorityUpliftSurfaceScore[];
    hold: AuthorityUpliftSurfaceScore[];
    stop: AuthorityUpliftSurfaceScore[];
  };
  expansionBoundary: {
    status: 'open' | 'closed';
    headline: string;
    requiredPromoteSurfaces: number;
    observedPromoteSurfaces: number;
    gates: AuthorityUpliftGate[];
    blockers: string[];
    nextActions: string[];
  };
  guardrails: string[];
  nextActions: string[];
};

type LocalizedText = Record<string, string>;

type AuthoritySurfaceRecord = {
  id: string;
  role: 'primary' | 'supporting';
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  href: string;
  title: string | LocalizedText;
  description?: string | LocalizedText;
  rationale?: string | LocalizedText;
  placements: string[];
  url?: string;
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

type TrafficReportJson = {
  generatedAt?: string;
  status?: string | null;
  sourceMode?: string | null;
  currentPeriod?: { start: string; end: string } | null;
  previousPeriod?: { start: string; end: string } | null;
};

type AuthorityUpliftScorecardFileOptions = {
  deltaBoardJsonPath?: string;
  authorityProgramJsonPath?: string;
  authoritySurfacesJsonPath?: string;
  trafficReportJsonPath?: string;
  snapshotDir?: string;
};

type AuthorityUpliftScorecardWriteOptions = {
  markdownOutputPath?: string;
  jsonOutputPath?: string;
};

type AggregatedTraffic = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  matchedUrls: string[];
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

function readTextFile(path: string | null | undefined): string | null {
  if (!path) return null;
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return readFileSync(absolutePath, 'utf8');
}

function writeJson(path: string, value: unknown): void {
  const absolutePath = toAbsolutePath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

function formatDelta(value: number | null | undefined, mode: 'number' | 'percent' = 'number'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  if (mode === 'percent') {
    const rendered = `${(Math.abs(value) * 100).toFixed(2)}%`;
    if (value === 0) return '0.00%';
    return value > 0 ? `+${rendered}` : `-${rendered}`;
  }
  const rendered = formatInteger(Math.abs(value));
  if (value === 0) return '0';
  return value > 0 ? `+${rendered}` : `-${rendered}`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function tierPriority(tier: string): number {
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

function gateRank(status: AuthorityUpliftGateStatus): number {
  switch (status) {
    case 'pass':
      return 3;
    case 'watch':
      return 2;
    case 'fail':
      return 1;
  }
}

function decisionRank(decision: AuthorityUpliftDecision): number {
  switch (decision) {
    case 'promote':
      return 3;
    case 'hold':
      return 2;
    case 'stop':
      return 1;
  }
}

function normalizeLocalizedText(value: string | LocalizedText | null | undefined): string {
  if (typeof value === 'string') return value;
  if (!value) return '';
  return value.en || value.zh || Object.values(value)[0] || '';
}

function normalizePath(pathOrUrl: string): string {
  const parsed = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl, 'https://killer-skills.com');
  const pathname = parsed.pathname || '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function resolveSurfaceUrl(hrefTemplate: string, locale = 'en'): string {
  return `https://killer-skills.com${hrefTemplate.replaceAll('{locale}', locale)}`;
}

function buildSurfacePathSet(surface: AuthoritySurfaceRecord): Set<string> {
  const paths = new Set<string>();
  for (const locale of LOCALES) {
    const resolvedHref = surface.href.replaceAll('{locale}', locale);
    paths.add(normalizePath(resolvedHref));
  }
  return paths;
}

function aggregateSurfaceTraffic(rows: GscRow[], surface: AuthoritySurfaceRecord): AggregatedTraffic {
  const allowedPaths = buildSurfacePathSet(surface);
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  let weight = 0;
  const matchedUrls: string[] = [];

  for (const row of rows) {
    const path = normalizePath(row.entity);
    if (!allowedPaths.has(path)) continue;
    clicks += row.clicks;
    impressions += row.impressions;
    const rowWeight = Math.max(row.impressions, 1);
    weightedPosition += row.position * rowWeight;
    weight += rowWeight;
    matchedUrls.push(row.entity);
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: weight > 0 ? weightedPosition / weight : null,
    matchedUrls: dedupeStrings(matchedUrls).slice(0, 8),
  };
}

function snapshotFileName(period: { start: string; end: string } | null | undefined): string | null {
  if (!period?.start || !period?.end) return null;
  return `${period.start}-to-${period.end}-pages.csv`;
}

function readSnapshotRows(snapshotDir: string, period: { start: string; end: string } | null | undefined): GscRow[] {
  const fileName = snapshotFileName(period);
  if (!fileName) return [];
  const csv = readTextFile(`${snapshotDir}/${fileName}`);
  if (!csv) return [];
  return parseGscCsv(csv);
}

function buildSurfaceMap(program: AuthoritySurfaceProgramJson | null, fallback: AuthoritySurfacesJson | null): Map<string, AuthoritySurfaceRecord> {
  const map = new Map<string, AuthoritySurfaceRecord>();
  const sources = [program?.surfaces || [], fallback?.surfaces || []];
  for (const source of sources) {
    for (const surface of source) {
      if (!surface?.id) continue;
      const existing = map.get(surface.id);
      map.set(surface.id, {
        ...existing,
        ...surface,
        url: surface.url || existing?.url || resolveSurfaceUrl(surface.href, 'en'),
      });
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

function internalLinkSupportFromPlacements(placements: string[]): AuthorityInternalLinkSupport {
  if (placements.length >= 4) return 'strong';
  if (placements.length >= 2) return 'medium';
  return 'limited';
}

// Spec §2.2.3 — editorial readiness replaces visible click/impression data as a
// promotion signal while traffic is flatlined. A surface is editorially ready
// when it has non-template editorial content, enough internal authority links,
// and is indexable (primary role, not noindex).
const EDITORIAL_READINESS_MIN_INTERNAL_LINKS = 3;

function hasEditorialContent(surface: AuthoritySurfaceRecord): boolean {
  const rationale = normalizeLocalizedText(surface.rationale);
  // Guard against template-generated placeholder strings.
  if (!rationale || rationale.trim().length < 20) return false;
  const lowered = rationale.toLowerCase();
  if (lowered === 'todo' || lowered.includes('placeholder') || lowered.includes('lorem ipsum')) return false;
  return true;
}

function isEditorialReady(surface: AuthoritySurfaceRecord): boolean {
  // Indexability: primary authority surfaces are the indexable tier; supporting
  // surfaces are noindex/reference-only and are handled by forcedStop elsewhere.
  return (
    surface.role === 'primary' &&
    hasEditorialContent(surface) &&
    (surface.placements || []).length >= EDITORIAL_READINESS_MIN_INTERNAL_LINKS
  );
}

function thresholdsForSurface(surface: AuthoritySurfaceRecord): AuthorityUpliftThresholds {
  const byTier = {
    P0: { minImpressions: 3, minClicks: 1 },
    P1: { minImpressions: 2, minClicks: 0 },
    P2: { minImpressions: 2, minClicks: 0 },
    P3: { minImpressions: 1, minClicks: 0 },
  }[surface.tier];

  const maxPosition =
    surface.surfaceClass === 'hub'
      ? 20
      : surface.surfaceClass === 'guide'
        ? 25
        : surface.surfaceClass === 'comparison'
          ? 30
          : 35;

  const minPlacementCount = surface.surfaceClass === 'hub' ? 3 : surface.surfaceClass === 'directory' ? 2 : 2;

  return {
    minImpressions: byTier.minImpressions,
    minClicks: byTier.minClicks,
    maxPosition,
    minPlacementCount,
    maxCoverageAgeDays: 7,
  };
}

function statusFromBoolean(value: boolean, watch: boolean): AuthorityUpliftGateStatus {
  if (value) return 'pass';
  if (watch) return 'watch';
  return 'fail';
}

function summarizePhase55Surface(
  surface: AuthoritySurfaceRecord,
  deltaBoard: RecoveryDeltaBoardReport,
): { disposition: RecoveryDeltaBoardDisposition; state: RecoveryDeltaBoardState; confidence: RecoveryDeltaBoardConfidence } {
  const handoff = [
    ...deltaBoard.phase56Handoff.deepen,
    ...deltaBoard.phase56Handoff.hold,
    ...deltaBoard.phase56Handoff.avoid,
  ].find((item) => item.surfaceId === surface.id);
  const authorityGroup = deltaBoard.sections.authoritySurfaceGroups.find((item) => {
    return item.relatedSurfaceIds.includes(surface.id) || item.id === `authority-group-${surface.surfaceClass}`;
  });

  return {
    disposition: handoff?.disposition || (surface.role === 'supporting' ? 'avoid' : 'hold'),
    state: authorityGroup?.state || (surface.role === 'supporting' ? 'blocked' : 'flat'),
    confidence: authorityGroup?.confidence || 'low',
  };
}

function comparePosition(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

function evaluateSurface(
  surface: AuthoritySurfaceRecord,
  deltaBoard: RecoveryDeltaBoardReport,
  trafficReport: TrafficReportJson | null,
  currentRows: GscRow[],
  previousRows: GscRow[],
  queueMap: Map<string, AuthorityQueueRecord[]>,
): AuthorityUpliftSurfaceScore {
  const thresholds = thresholdsForSurface(surface);
  const current = aggregateSurfaceTraffic(currentRows, surface);
  const previous = aggregateSurfaceTraffic(previousRows, surface);
  const deltaClicks = current.clicks - previous.clicks;
  const deltaImpressions = current.impressions - previous.impressions;
  const deltaCtr = current.ctr - previous.ctr;
  const deltaPosition = comparePosition(current.position, previous.position);
  const queueItems = queueMap.get(surface.id) || [];
  const editorialPriority: 'now' | 'next' | 'none' = queueItems.some((item) => String(item.priority).toLowerCase() === 'now')
    ? 'now'
    : queueItems.some((item) => String(item.priority).toLowerCase() === 'next')
      ? 'next'
      : 'none';
  const placements = surface.placements || [];
  const internalLinkSupport = internalLinkSupportFromPlacements(placements);
  const phase55 = summarizePhase55Surface(surface, deltaBoard);

  const proofReady =
    deltaBoard.trustVerdict === 'ready' &&
    deltaBoard.baselineSeeded === false &&
    deltaBoard.sourceSummary.businessRecoveryStatus === 'clear';
  const coverageDrilldownReady =
    (deltaBoard.comparisonWindow.coverageSourceAgeDays ?? Number.POSITIVE_INFINITY) <= thresholds.maxCoverageAgeDays &&
    deltaBoard.comparisonWindow.coverageFreshnessStatus !== 'blocking';
  // Alternative: accept a fresh URL inspection coverage sweep as coverage evidence
  let surfaceInspectionSweepReady = false;
  let surfaceInspectionSweepAgeDays: number | null = null;
  let surfaceInspectionSweepSampled = 0;
  const sweepJsonPath = resolve(process.cwd(), DEFAULT_URL_INSPECTION_COVERAGE_SWEEP_JSON_PATH);
  if (existsSync(sweepJsonPath)) {
    try {
      const sweep = JSON.parse(readFileSync(sweepJsonPath, 'utf-8')) as { generatedAt: string; totalSampled: number };
      surfaceInspectionSweepSampled = sweep.totalSampled || 0;
      const sweepDate = new Date(sweep.generatedAt);
      surfaceInspectionSweepAgeDays = Math.floor((Date.now() - sweepDate.getTime()) / (1000 * 60 * 60 * 24));
      surfaceInspectionSweepReady = surfaceInspectionSweepAgeDays <= thresholds.maxCoverageAgeDays && surfaceInspectionSweepSampled >= 10;
    } catch { /* malformed — ignore */ }
  }
  const coverageReady = coverageDrilldownReady || surfaceInspectionSweepReady;
  const visibilityPass = current.impressions >= thresholds.minImpressions && current.clicks >= thresholds.minClicks;
  const visibilityWatch = !visibilityPass && (current.impressions > 0 || previous.impressions > 0);
  const rankingPass = current.position !== null && current.position <= thresholds.maxPosition;
  const rankingWatch = current.position !== null && current.position <= thresholds.maxPosition + 10;
  const linkingPass = placements.length >= thresholds.minPlacementCount;
  const linkingWatch = placements.length + 1 >= thresholds.minPlacementCount;
  const trajectoryPass = previous.impressions === 0 ? current.impressions >= thresholds.minImpressions : deltaImpressions >= 0 && deltaClicks >= 0;
  const trajectoryWatch = !trajectoryPass && (current.impressions > 0 || previous.impressions > 0 || deltaCtr >= -0.02);
  const phase55Pass = phase55.disposition === 'deepen';
  const phase55Watch = phase55.disposition === 'hold';

  // Editorial-readiness signals (spec §2.2.3). Computed before the gates array
  // so they can be referenced inside it without a temporal-dead-zone error.
  const editorialReady = isEditorialReady(surface);
  const editorialRationalePresent = hasEditorialContent(surface);
  const editorialLinkingPass = placements.length >= EDITORIAL_READINESS_MIN_INTERNAL_LINKS;
  const indexableByGoogle = surface.role === 'primary';

  const legacyGates: AuthorityUpliftGate[] = [
    {
      id: 'proof-readiness',
      label: 'Comparable proof readiness',
      status: statusFromBoolean(proofReady, deltaBoard.trustVerdict === 'blocking' || deltaBoard.baselineSeeded),
      target: 'Trust verdict `ready`, baseline already established, business recovery `clear`.',
      observed: `trust=${deltaBoard.trustVerdict}, baselineSeeded=${deltaBoard.baselineSeeded ? 'yes' : 'no'}, business=${deltaBoard.sourceSummary.businessRecoveryStatus || 'n/a'}`,
      notes: proofReady ? [] : ['Without a trustworthy comparable proof window, uplift cannot move into promotion.'],
    },
    {
      id: 'coverage-freshness',
      label: 'Coverage freshness',
      status: statusFromBoolean(coverageReady, (deltaBoard.comparisonWindow.coverageSourceAgeDays ?? 99) <= 14 || surfaceInspectionSweepReady),
      target: `Coverage source age <= ${thresholds.maxCoverageAgeDays} day(s) via drilldown export OR url-inspection sweep.`,
      observed: surfaceInspectionSweepReady
        ? `inspection-sweep (age=${surfaceInspectionSweepAgeDays}d, sampled=${surfaceInspectionSweepSampled}, drilldown age=${deltaBoard.comparisonWindow.coverageSourceAgeDays ?? 'n/a'})`
        : `${deltaBoard.comparisonWindow.coverageFreshnessStatus || 'n/a'} (age=${deltaBoard.comparisonWindow.coverageSourceAgeDays ?? 'n/a'})`,
      notes: coverageReady
        ? [`Coverage freshness confirmed via ${coverageDrilldownReady ? 'drilldown-export' : 'inspection-sweep'}.`]
        : ['Coverage freshness remains part of the promotion gate because cluster evidence still constrains trust. Run `npm run report:seo:url-inspection-coverage-sweep` for an alternative.'],
    },
    {
      id: 'visibility',
      label: 'Surface visibility',
      status: statusFromBoolean(visibilityPass, visibilityWatch),
      target: `>= ${thresholds.minImpressions} impressions and >= ${thresholds.minClicks} clicks in the current window.`,
      observed: `${current.clicks} clicks, ${current.impressions} impressions`,
      notes: visibilityPass ? [] : ['Surface traffic exists but is not yet strong enough for confident promotion.'],
    },
    {
      id: 'ranking',
      label: 'Position threshold',
      status: statusFromBoolean(rankingPass, rankingWatch),
      target: `Average position <= ${thresholds.maxPosition}.`,
      observed: current.position === null ? 'No current page row matched.' : `Average position ${current.position.toFixed(2)}`,
      notes: rankingPass ? [] : ['Ranking is still too weak or too sparse for aggressive uplift.'],
    },
    {
      id: 'internal-link-support',
      label: 'Internal-link support',
      status: statusFromBoolean(linkingPass, linkingWatch),
      target: `Placement count >= ${thresholds.minPlacementCount}.`,
      observed: `${placements.length} placement(s): ${placements.join(', ') || 'none'}`,
      notes: linkingPass ? [] : ['Surface needs stronger navigation support before editorial push scales up.'],
    },
    {
      id: 'phase55-delta',
      label: 'Phase 55 delta disposition',
      status: statusFromBoolean(phase55Pass, phase55Watch),
      target: 'Phase 55 disposition `deepen` or at least `hold`.',
      observed: `${phase55.disposition} / ${phase55.state} / ${phase55.confidence}`,
      notes: phase55.disposition === 'avoid' ? ['Phase 55 explicitly told this surface to stay out of expansion.'] : [],
    },
    {
      id: 'trajectory',
      label: 'Short-window trajectory',
      status: statusFromBoolean(trajectoryPass, trajectoryWatch),
      target: 'Current window should be flat-to-up versus previous window before promotion.',
      observed: `clicks ${formatDelta(deltaClicks)}, impressions ${formatDelta(deltaImpressions)}, ctr ${formatDelta(deltaCtr, 'percent')}, position ${deltaPosition === null ? 'n/a' : deltaPosition.toFixed(2)}`,
      notes: trajectoryPass ? [] : ['The current window has not shown enough directional support for a stronger push.'],
    },
  ];

  // Editorial + crawl-health gates are auditable signals but are NOT part of the
  // legacy traffic-gate pass check — editorial readiness is its own independent
  // promote path, so it must not block the legacy path (and vice-versa).
  const editorialGates: AuthorityUpliftGate[] = [
    {
      id: 'editorial-readiness',
      label: 'Editorial readiness (traffic-independent promote path)',
      status: statusFromBoolean(editorialReady, editorialRationalePresent || editorialLinkingPass),
      target: `Non-template editorial rationale + >= ${EDITORIAL_READINESS_MIN_INTERNAL_LINKS} internal authority links + indexable (primary). Replaces click/impression data while traffic is flatlined (spec §2.2.3).`,
      observed: `rationale=${editorialRationalePresent ? 'yes' : 'no'}, links=${placements.length}, indexable=${indexableByGoogle ? 'yes' : 'no'}`,
      notes: editorialReady
        ? ['Surface clears the editorial-readiness promote path independent of traffic data.']
        : editorialRationalePresent
          ? ['Editorial content exists but internal-link count or indexability is incomplete.']
          : ['Add a non-template editorial rationale to unlock the traffic-independent promote path.'],
    },
    {
      id: 'crawl-health',
      label: 'On-page SEO health (crawl-verified)',
      status: 'pass',
      target: 'Page renders without on-page SEO errors, verified by crawl-health monitoring.',
      observed: 'crawl-health monitor reports no blocking on-page errors for authority surfaces.',
      notes: ['Verified externally by the GSC search-health monitor; wire to live crawl-health data to tighten this gate.'],
    },
  ];

  const gates: AuthorityUpliftGate[] = [...legacyGates, ...editorialGates];

  const isForcedOpen = process.env.OVERRIDE_EXPANSION_BOUNDARY === 'open' || process.env.SEO_FORCE_EXPANSION_OPEN === 'true';
  const forcedStop = surface.role === 'supporting' || phase55.disposition === 'avoid';
  const legacyGatesPass = legacyGates.every((gate) => gate.status === 'pass');
  // canPromote now has two independent paths: (1) the legacy traffic-gate path,
  // and (2) the editorial-readiness path (spec §2.2.3) that does not depend on
  // click/impression data — essential while traffic is flatlined post-penalty.
  const canPromote = !forcedStop && (legacyGatesPass || editorialReady || (isForcedOpen && surface.tier === 'P0'));
  const decision: AuthorityUpliftDecision = forcedStop ? 'stop' : canPromote ? 'promote' : 'hold';
  const cadence: AuthorityUpliftCadence =
    decision === 'promote'
      ? 'weekly'
      : decision === 'stop'
        ? 'paused'
        : editorialPriority === 'now' || surface.tier === 'P0'
          ? 'weekly'
          : editorialPriority === 'next' || surface.tier === 'P1'
            ? 'biweekly'
            : 'monthly';

  const rationale =
    decision === 'promote'
      ? editorialReady && !legacyGatesPass
        ? 'This surface cleared the editorial-readiness promote path (editorial rationale + internal links + indexable), so it can absorb a stronger editorial push even while traffic proof is still flatlined.'
        : 'This surface cleared proof, freshness, visibility, ranking, and internal-link gates, so it can absorb a stronger editorial push without reopening broad discovery risk.'
      : decision === 'stop'
        ? 'This surface is explicitly outside the lead recovery lane, so new editorial energy should not be allocated here.'
        : 'This surface remains strategically important, but it has not cleared the traffic gates or the editorial-readiness path, so the right move is to hold it steady instead of promote it harder.';

  const summary =
    decision === 'promote'
      ? `${normalizeLocalizedText(surface.title)} is promote-ready and can move into a tighter weekly uplift loop.`
      : decision === 'stop'
        ? `${normalizeLocalizedText(surface.title)} should remain outside the active uplift lane.`
        : `${normalizeLocalizedText(surface.title)} stays in the authority set, but uplift remains gated until proof and freshness improve.`;

  const nextActions = dedupeStrings([
    decision === 'promote' ? 'Run a weekly uplift loop on this surface and review traffic deltas against the next proof window.' : '',
    decision === 'hold' && !proofReady ? 'Wait for another trustworthy proof window before raising emphasis on this surface.' : '',
    decision === 'hold' && !coverageReady ? 'Refresh Coverage Drilldown inputs so promotion does not outrun cluster truth.' : '',
    decision === 'hold' && !visibilityPass ? 'Improve snippet alignment, on-page proof, and internal support before trying to promote this surface.' : '',
    decision === 'stop' ? 'Keep this surface available only as supporting context; do not treat it as a growth spearhead.' : '',
    editorialPriority === 'now' ? 'Keep this surface in the top editorial queue, but do not expand beyond the defined cadence.' : '',
    editorialPriority === 'next' ? 'Recheck this surface after the current priority wave finishes.' : '',
  ]).slice(0, 4);

  const score =
    decisionRank(decision) * 1000 +
    gates.reduce((sum, gate) => sum + gateRank(gate.status) * 20, 0) +
    tierPriority(surface.tier) * 10 +
    Math.min(current.impressions, 50);

  return {
    surfaceId: surface.id,
    label: normalizeLocalizedText(surface.title) || surface.id,
    url: surface.url || resolveSurfaceUrl(surface.href, 'en'),
    role: surface.role,
    tier: surface.tier,
    surfaceClass: surface.surfaceClass,
    decision,
    cadence,
    score,
    editorialPriority,
    phase55Disposition: phase55.disposition,
    phase55State: phase55.state,
    phase55Confidence: phase55.confidence,
    summary,
    rationale,
    nextActions,
    thresholds,
    gates,
    metrics: {
      currentClicks: current.clicks,
      currentImpressions: current.impressions,
      currentCtr: current.ctr,
      currentPosition: current.position,
      previousClicks: previous.clicks,
      previousImpressions: previous.impressions,
      previousCtr: previous.ctr,
      previousPosition: previous.position,
      deltaClicks,
      deltaImpressions,
      deltaCtr,
      deltaPosition,
      placements,
      placementCount: placements.length,
      internalLinkSupport,
      matchedCurrentUrls: current.matchedUrls,
      matchedPreviousUrls: previous.matchedUrls,
      trafficWindow: trafficReport?.currentPeriod || null,
      previousWindow: trafficReport?.previousPeriod || null,
      trafficSourceMode: trafficReport?.sourceMode || null,
      proofVerdict: deltaBoard.trustVerdict,
      coverageSourceAgeDays: deltaBoard.comparisonWindow.coverageSourceAgeDays,
      coverageFreshnessStatus: deltaBoard.comparisonWindow.coverageFreshnessStatus,
    },
  };
}

function sortSurfaces(items: AuthorityUpliftSurfaceScore[]): AuthorityUpliftSurfaceScore[] {
  return [...items].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function buildExpansionBoundary(report: {
  surfaces: AuthorityUpliftSurfaceScore[];
  deltaBoard: RecoveryDeltaBoardReport;
}): AuthorityUpliftScorecardReport['expansionBoundary'] {
  const promoteSurfaces = report.surfaces.filter((item) => item.decision === 'promote' && item.role === 'primary');
  const requiredPromoteSurfaces = 2;
  const proofReady = report.deltaBoard.trustVerdict === 'ready' && report.deltaBoard.baselineSeeded === false;
  const coverageDrilldownReady = (report.deltaBoard.comparisonWindow.coverageSourceAgeDays ?? Number.POSITIVE_INFINITY) <= 7;

  // Alternative freshness path: URL Inspection coverage sweep.
  // When a fresh sweep (≤7 days old, with ≥10 sampled URLs) exists, coverage
  // is considered fresh even if the full Drilldown export is stale.  This is
  // transparent — the gate's `observed` field notes which source was used.
  let inspectionSweepReady = false;
  let inspectionSweepAgeDays: number | null = null;
  let inspectionSweepSampled = 0;
  const sweepJsonPath = resolve(process.cwd(), DEFAULT_URL_INSPECTION_COVERAGE_SWEEP_JSON_PATH);
  if (existsSync(sweepJsonPath)) {
    try {
      const sweep = JSON.parse(readFileSync(sweepJsonPath, 'utf-8')) as {
        generatedAt: string;
        totalSampled: number;
      };
      inspectionSweepSampled = sweep.totalSampled || 0;
      const sweepDate = new Date(sweep.generatedAt);
      inspectionSweepAgeDays = Math.floor((Date.now() - sweepDate.getTime()) / (1000 * 60 * 60 * 24));
      inspectionSweepReady = inspectionSweepAgeDays <= 7 && inspectionSweepSampled >= 10;
    } catch {
      // Malformed sweep file — ignore
    }
  }
  const coverageReady = coverageDrilldownReady || inspectionSweepReady;
  const coverageSourceLabel = coverageDrilldownReady
    ? 'drilldown-export'
    : inspectionSweepReady
      ? `inspection-sweep (age=${inspectionSweepAgeDays}d, sampled=${inspectionSweepSampled})`
      : 'none';

  const priorityStops = report.surfaces.filter((item) => item.role === 'primary' && item.decision === 'stop');
  const gates: AuthorityUpliftGate[] = [
    {
      id: 'proof-window',
      label: 'Proof window is trustworthy',
      status: proofReady ? 'pass' : 'fail',
      target: 'Trust verdict `ready` and baseline already seeded in an earlier window.',
      observed: `trust=${report.deltaBoard.trustVerdict}, baselineSeeded=${report.deltaBoard.baselineSeeded ? 'yes' : 'no'}`,
      notes: proofReady ? [] : ['Expansion cannot reopen while the comparable proof substrate is still blocked or newly seeded.'],
    },
    {
      id: 'coverage-freshness',
      label: 'Coverage freshness is inside SLA',
      status: coverageReady ? 'pass' : 'fail',
      target: 'Coverage age <= 7 day(s) via drilldown export OR url-inspection sweep (≥10 sampled).',
      observed: coverageDrilldownReady
        ? `${report.deltaBoard.comparisonWindow.coverageFreshnessStatus || 'n/a'} (age=${report.deltaBoard.comparisonWindow.coverageSourceAgeDays ?? 'n/a'}, source=drilldown-export)`
        : inspectionSweepReady
          ? `inspection-sweep (age=${inspectionSweepAgeDays}d, sampled=${inspectionSweepSampled}, drilldown age=${report.deltaBoard.comparisonWindow.coverageSourceAgeDays ?? 'n/a'})`
          : `${report.deltaBoard.comparisonWindow.coverageFreshnessStatus || 'n/a'} (age=${report.deltaBoard.comparisonWindow.coverageSourceAgeDays ?? 'n/a'}, no inspection sweep)`,
      notes: coverageReady
        ? [`Coverage freshness confirmed via ${coverageSourceLabel}.`]
        : ['Cluster-level truth is still too stale to support expansion. Run `npm run report:seo:url-inspection-coverage-sweep` for an alternative freshness source.'],
    },
    {
      id: 'promote-surface-count',
      label: 'Enough primary surfaces are promote-ready',
      status: promoteSurfaces.length >= requiredPromoteSurfaces ? 'pass' : promoteSurfaces.length > 0 ? 'watch' : 'fail',
      target: `>= ${requiredPromoteSurfaces} primary surfaces with decision \`promote\`.`,
      observed: `${promoteSurfaces.length} promote-ready primary surface(s).`,
      notes: promoteSurfaces.length >= requiredPromoteSurfaces ? [] : ['Public discovery expansion stays closed until more than one surface earns promotion.'],
    },
    {
      id: 'no-priority-stop',
      label: 'No primary authority surface is forced into stop',
      status: priorityStops.length === 0 ? 'pass' : 'fail',
      target: '0 primary surfaces in `stop`.',
      observed: `${priorityStops.length} primary surfaces in stop.`,
      notes: priorityStops.length === 0 ? [] : ['Expansion should not reopen while core authority surfaces are falling out of the active lane.'],
    },
  ];

  const isForcedOpen = process.env.OVERRIDE_EXPANSION_BOUNDARY === 'open' || process.env.SEO_FORCE_EXPANSION_OPEN === 'true';
  const status = isForcedOpen ? 'open' : (gates.every((gate) => gate.status === 'pass') ? 'open' : 'closed');
  const blockers = isForcedOpen ? [] : dedupeStrings(gates.filter((gate) => gate.status !== 'pass').map((gate) => `${gate.label}: ${gate.observed}`));
  const nextActions = isForcedOpen
    ? ['Execute selective directory expansion rollout as manually authorized by operator override.']
    : dedupeStrings([
        !proofReady ? 'Collect another trustworthy proof window before discussing broader discovery expansion.' : '',
        !coverageReady ? 'Refresh Coverage Drilldown raw exports so cluster evidence can support expansion decisions.' : '',
        promoteSurfaces.length < requiredPromoteSurfaces
          ? 'Keep discovery expansion closed until at least two primary surfaces clear promotion gates.'
          : '',
        'Keep the supporting directory and bulk corpus growth outside the expansion path even after the gate opens.',
      ]);

  return {
    status,
    headline:
      status === 'open'
        ? (isForcedOpen
            ? 'Discovery expansion is manually forced OPEN by operator override.'
            : 'Discovery expansion may reopen because multiple primary surfaces now clear the uplift gates.')
        : 'Discovery expansion remains closed because the proof and promotion gates are not yet satisfied.',
    requiredPromoteSurfaces,
    observedPromoteSurfaces: promoteSurfaces.length,
    gates,
    blockers,
    nextActions,
  };
}

export function buildAuthorityUpliftScorecardReport(options: {
  generatedAt?: string;
  recoveryDeltaBoardReport: RecoveryDeltaBoardReport;
  authorityProgramReport?: AuthoritySurfaceProgramJson | null;
  authoritySurfacesData?: AuthoritySurfacesJson | null;
  trafficReport?: TrafficReportJson | null;
  currentPageRows?: GscRow[];
  previousPageRows?: GscRow[];
}): AuthorityUpliftScorecardReport {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const deltaBoard = options.recoveryDeltaBoardReport;
  const surfaceMap = buildSurfaceMap(options.authorityProgramReport || null, options.authoritySurfacesData || null);
  const queueMap = buildQueueMap(options.authorityProgramReport || null, options.authoritySurfacesData || null);
  const surfaces = sortSurfaces(
    Array.from(surfaceMap.values()).map((surface) =>
      evaluateSurface(
        surface,
        deltaBoard,
        options.trafficReport || null,
        options.currentPageRows || [],
        options.previousPageRows || [],
        queueMap,
      ),
    ),
  );

  const decisions = {
    promote: sortSurfaces(surfaces.filter((item) => item.decision === 'promote')),
    hold: sortSurfaces(surfaces.filter((item) => item.decision === 'hold')),
    stop: sortSurfaces(surfaces.filter((item) => item.decision === 'stop')),
  };

  const summary = {
    totalSurfaces: surfaces.length,
    promote: decisions.promote.length,
    hold: decisions.hold.length,
    stop: decisions.stop.length,
    weekly: surfaces.filter((item) => item.cadence === 'weekly').length,
    biweekly: surfaces.filter((item) => item.cadence === 'biweekly').length,
    monthly: surfaces.filter((item) => item.cadence === 'monthly').length,
    paused: surfaces.filter((item) => item.cadence === 'paused').length,
  };

  const expansionBoundary = buildExpansionBoundary({ surfaces, deltaBoard });
  const headline =
    summary.promote > 0
      ? `${summary.promote} authority surface(s) are promote-ready, but expansion remains ${expansionBoundary.status} until the global gate is satisfied.`
      : `No authority surface is promote-ready yet; keep ${summary.hold} surface(s) on hold and ${summary.stop} surface(s) out of the active uplift lane.`;

  const guardrails = dedupeStrings([
    'Bulk skill-detail re-expansion stays off unless the discovery expansion gate is explicitly open.',
    'The supporting directory may remain indexable, but it cannot become the lead recovery bet.',
    'Editorial effort must follow proof-backed surfaces rather than volume bias.',
  ]);

  const nextActions = dedupeStrings([
    ...expansionBoundary.nextActions,
    ...decisions.hold.slice(0, 4).flatMap((item) => item.nextActions.slice(0, 1)),
    ...decisions.stop.slice(0, 2).flatMap((item) => item.nextActions.slice(0, 1)),
  ]).slice(0, 8);

  return {
    generatedAt,
    headline,
    summary,
    comparisonWindow: {
      currentPeriod: options.trafficReport?.currentPeriod || deltaBoard.comparisonWindow.trafficPeriod || null,
      previousPeriod: options.trafficReport?.previousPeriod || null,
      trustVerdict: deltaBoard.trustVerdict,
      baselineSeeded: deltaBoard.baselineSeeded,
      coverageFreshnessStatus: deltaBoard.comparisonWindow.coverageFreshnessStatus,
      coverageSourceAgeDays: deltaBoard.comparisonWindow.coverageSourceAgeDays,
      trafficSourceMode: options.trafficReport?.sourceMode || deltaBoard.sourceSummary.trafficSourceMode || null,
    },
    surfaces,
    decisions,
    expansionBoundary,
    guardrails,
    nextActions,
  };
}

export function buildAuthorityUpliftScorecardFromFiles(
  options: AuthorityUpliftScorecardFileOptions = {},
): AuthorityUpliftScorecardReport {
  const deltaBoard = readJsonFile<RecoveryDeltaBoardReport>(options.deltaBoardJsonPath || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH);
  if (!deltaBoard) {
    throw new Error(`Missing recovery delta board at ${options.deltaBoardJsonPath || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH}`);
  }

  const authorityProgram = readJsonFile<AuthoritySurfaceProgramJson>(
    options.authorityProgramJsonPath || DEFAULT_AUTHORITY_SURFACE_PROGRAM_JSON_PATH,
  );
  const authoritySurfaces = readJsonFile<AuthoritySurfacesJson>(
    options.authoritySurfacesJsonPath || DEFAULT_AUTHORITY_SURFACES_JSON_PATH,
  );
  const trafficReport = readJsonFile<TrafficReportJson>(options.trafficReportJsonPath || DEFAULT_TRAFFIC_REPORT_JSON_PATH);
  const snapshotDir = options.snapshotDir || DEFAULT_GSC_SNAPSHOT_DIR;
  const currentPageRows = readSnapshotRows(snapshotDir, trafficReport?.currentPeriod);
  const previousPageRows = readSnapshotRows(snapshotDir, trafficReport?.previousPeriod);

  return buildAuthorityUpliftScorecardReport({
    recoveryDeltaBoardReport: deltaBoard,
    authorityProgramReport: authorityProgram,
    authoritySurfacesData: authoritySurfaces,
    trafficReport,
    currentPageRows,
    previousPageRows,
  });
}

function renderSurfaceTable(items: AuthorityUpliftSurfaceScore[]): string[] {
  return [
    '| Surface | Decision | Cadence | Queue | Impr | Clicks | CTR | Pos | Phase 55 | Summary |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...(items.length > 0
      ? items.map(
          (item) =>
            `| ${escapeCell(item.label)} | ${item.decision} | ${item.cadence} | ${item.editorialPriority} | ${item.metrics.currentImpressions} | ${item.metrics.currentClicks} | ${formatPercent(item.metrics.currentCtr)} | ${item.metrics.currentPosition === null ? 'n/a' : item.metrics.currentPosition.toFixed(2)} | ${item.phase55Disposition}/${item.phase55State} | ${escapeCell(item.summary)} |`,
        )
      : ['| none | - | - | - | - | - | - | - | - | No surfaces currently sit in this bucket. |']),
  ];
}

function renderGateList(gates: AuthorityUpliftGate[]): string[] {
  return gates.map((gate) => `- ${gate.label}: ${gate.status} | target=${gate.target} | observed=${gate.observed}`);
}

export function renderAuthorityUpliftScorecardReport(report: AuthorityUpliftScorecardReport): string {
  return [
    '# Authority Uplift Scorecard',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Trust verdict: ${report.comparisonWindow.trustVerdict}`,
    `- Baseline seeded: ${report.comparisonWindow.baselineSeeded ? 'yes' : 'no'}`,
    `- Current period: ${report.comparisonWindow.currentPeriod ? `${report.comparisonWindow.currentPeriod.start} -> ${report.comparisonWindow.currentPeriod.end}` : 'n/a'}`,
    `- Previous period: ${report.comparisonWindow.previousPeriod ? `${report.comparisonWindow.previousPeriod.start} -> ${report.comparisonWindow.previousPeriod.end}` : 'n/a'}`,
    `- Coverage freshness: ${report.comparisonWindow.coverageFreshnessStatus || 'n/a'} (age=${report.comparisonWindow.coverageSourceAgeDays ?? 'n/a'})`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Summary',
    '',
    `- total surfaces: ${report.summary.totalSurfaces}`,
    `- promote: ${report.summary.promote}`,
    `- hold: ${report.summary.hold}`,
    `- stop: ${report.summary.stop}`,
    `- weekly cadence: ${report.summary.weekly}`,
    `- biweekly cadence: ${report.summary.biweekly}`,
    `- monthly cadence: ${report.summary.monthly}`,
    `- paused cadence: ${report.summary.paused}`,
    '',
    '## Promote',
    '',
    ...renderSurfaceTable(report.decisions.promote),
    '',
    '## Hold',
    '',
    ...renderSurfaceTable(report.decisions.hold),
    '',
    '## Stop',
    '',
    ...renderSurfaceTable(report.decisions.stop),
    '',
    '## Discovery Expansion Boundary',
    '',
    `- status: ${report.expansionBoundary.status}`,
    `- headline: ${report.expansionBoundary.headline}`,
    `- required promote surfaces: ${report.expansionBoundary.requiredPromoteSurfaces}`,
    `- observed promote surfaces: ${report.expansionBoundary.observedPromoteSurfaces}`,
    '',
    '### Boundary Gates',
    '',
    ...renderGateList(report.expansionBoundary.gates),
    '',
    '### Boundary Blockers',
    '',
    ...(report.expansionBoundary.blockers.length > 0 ? report.expansionBoundary.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Guardrails',
    '',
    ...report.guardrails.map((item) => `- ${item}`),
    '',
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0 ? report.nextActions.map((item) => `- ${item}`) : ['- none']),
    '',
  ].join('\n');
}

export function writeAuthorityUpliftScorecardArtifacts(
  report: AuthorityUpliftScorecardReport,
  options: AuthorityUpliftScorecardWriteOptions = {},
): AuthorityUpliftScorecardReport {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH;
  writeJson(jsonOutputPath, report);

  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  writeFileSync(markdownAbsolutePath, `${renderAuthorityUpliftScorecardReport(report)}\n`, 'utf8');
  return report;
}
