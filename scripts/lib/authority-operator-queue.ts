import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const DEFAULT_AUTHORITY_OPERATOR_QUEUE_MD_PATH = 'reports/seo/latest-authority-operator-queue.md';
export const DEFAULT_AUTHORITY_OPERATOR_QUEUE_JSON_PATH = 'reports/seo/latest-authority-operator-queue.json';
export const DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH = 'reports/seo/latest-authority-uplift-scorecard.json';
export const DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH = 'reports/seo/latest-recovery-delta-board.json';
export const DEFAULT_AUTHORITY_SURFACES_JSON_PATH = 'data/authority-surfaces.json';

const FOCUS_SURFACE_IDS = [
  'home-root',
  'collections-hub',
  'collection-official-trusted-tools',
  'collection-agent-workflows',
  'docs-installation',
] as const;

const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3'] as const;
const QUEUE_PRIORITY_ORDER = ['now', 'next', 'none'] as const;

type FocusSurfaceId = (typeof FOCUS_SURFACE_IDS)[number];
type QueuePriority = (typeof QUEUE_PRIORITY_ORDER)[number];

type AuthorityGate = {
  id: string;
  label: string;
  status: 'pass' | 'watch' | 'fail';
  target: string;
  observed: string;
  notes?: string[];
};

type AuthoritySurfaceScore = {
  surfaceId: string;
  label: string;
  url: string;
  role: 'primary' | 'supporting';
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  decision: 'promote' | 'hold' | 'stop';
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'paused';
  editorialPriority: QueuePriority;
  summary: string;
  nextActions: string[];
  thresholds: {
    minImpressions: number;
    minClicks: number;
    maxPosition: number;
    minPlacementCount: number;
  };
  gates: AuthorityGate[];
  metrics: {
    currentClicks: number;
    currentImpressions: number;
    currentPosition: number | null;
    placementCount: number;
    placements: string[];
    proofVerdict: string;
    coverageFreshnessStatus: string | null;
    trafficWindow: { start: string; end: string } | null;
  };
};

type AuthorityUpliftScorecardReport = {
  generatedAt: string;
  headline: string;
  summary: {
    promote: number;
    hold: number;
    stop: number;
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
  expansionBoundary: {
    status: 'open' | 'closed';
    headline: string;
    blockers: string[];
    nextActions: string[];
  };
  surfaces: AuthoritySurfaceScore[];
};

type RecoveryDeltaBoardCohort = {
  id: string;
  label: string;
  state: string;
  disposition: string;
  rank: number;
  summary: string;
  blockers: string[];
  nextActions: string[];
  metrics?: {
    currentScore?: number | null;
  } | null;
};

type RecoveryDeltaBoardReport = {
  generatedAt: string;
  blockers: string[];
  sections: {
    issueClusterCohorts: RecoveryDeltaBoardCohort[];
  };
};

type AuthoritySurfaceQueueItem = {
  id: string;
  surfaceId: string;
  priority: QueuePriority;
  action: string | Record<string, string>;
  why: string | Record<string, string>;
};

type AuthoritySurfacesData = {
  editorialQueue: AuthoritySurfaceQueueItem[];
};

type ManualSurfaceNote = {
  headline: string;
  productGap: string[];
  operatorActions: string[];
};

type SitewideBlocker = {
  label: string;
  type: 'proof-window' | 'issue-cluster';
  summary: string;
  actions: string[];
};

export type AuthorityOperatorQueueEntry = {
  surfaceId: FocusSurfaceId;
  label: string;
  url: string;
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  decision: 'promote' | 'hold' | 'stop';
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'paused';
  queuePriority: QueuePriority;
  queueItems: Array<{
    id: string;
    priority: QueuePriority;
    action: string;
    why: string;
  }>;
  keyHeadline: string;
  gateBlockers: string[];
  gateWatchList: string[];
  productGaps: string[];
  actions: string[];
  measurement: string[];
  metrics: {
    currentClicks: number;
    currentImpressions: number;
    currentPosition: number | null;
    placementCount: number;
    placements: string[];
    proofVerdict: string;
  };
};

export type AuthorityOperatorQueueReport = {
  generatedAt: string;
  status: 'blocked' | 'active';
  scorecardGeneratedAt: string;
  deltaBoardGeneratedAt: string;
  headline: string;
  summary: {
    focusSurfaces: number;
    now: number;
    next: number;
    none: number;
    blockedByProofWindow: number;
    blockedByVisibility: number;
    blockedByRanking: number;
    blockedByInternalLinks: number;
  };
  sitewideBlockers: SitewideBlocker[];
  globalEditorialRisks: string[];
  entries: AuthorityOperatorQueueEntry[];
  nextActions: string[];
};

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(toAbsolutePath(path), 'utf8')) as T;
}

function writeJson(path: string, value: unknown): void {
  const absolutePath = toAbsolutePath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMarkdown(path: string, value: string): void {
  const absolutePath = toAbsolutePath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${value.trimEnd()}\n`, 'utf8');
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeText(value: string | Record<string, string>): string {
  if (typeof value === 'string') return value;
  return value.en || value.zh || Object.values(value)[0] || '';
}

function queueRank(priority: QueuePriority): number {
  return QUEUE_PRIORITY_ORDER.indexOf(priority);
}

function tierRank(tier: string): number {
  const index = PRIORITY_ORDER.indexOf(tier as (typeof PRIORITY_ORDER)[number]);
  return index === -1 ? PRIORITY_ORDER.length : index;
}

const MANUAL_NOTES: Record<FocusSurfaceId, ManualSurfaceNote> = {
  'home-root': {
    headline: 'Homepage still reads too much like an internal SEO recovery board instead of a public authority hub.',
    productGap: [
      'Remove recovery-heavy/operator-heavy wording from the first authority section so users see selection help, not internal growth language.',
      'Reduce directory-biased calls to action on the homepage and keep curated collections and trusted guides ahead of raw /skills browsing.',
      'Keep the homepage positioned as the place that explains how Killer-Skills evaluates tools, not just how many repos exist.',
    ],
    operatorActions: [
      'Rewrite the homepage authority block in user-facing language.',
      'Keep directory entry points explicitly secondary to curated collections and trusted docs.',
      'Track homepage support placements in the authority data so scorecards reflect the real navigation posture.',
    ],
  },
  'collections-hub': {
    headline: 'Collections hub needs stronger explanation of why curated paths are different from bulk directory browsing.',
    productGap: [
      'Make the hub explain how collections are reviewed and why users should start here before the full directory.',
      'Keep reference-directory messaging secondary and clearly labeled as supporting context.',
      'Use collections as a decision product, not just a themed browse index.',
    ],
    operatorActions: [
      'Add clearer review criteria and curated-path framing on the collections hub.',
      'Keep all generic directory prompts secondary to trusted or workflow-first collections.',
    ],
  },
  'collection-official-trusted-tools': {
    headline: 'Trusted collection must prove first-party judgment more clearly than a generic official-owner roundup.',
    productGap: [
      'Keep selection notes, trust reasons, and maintenance timestamps visible above the imported repository layer.',
      'Replace repeated template phrasing with more specific editorial reasoning where possible.',
    ],
    operatorActions: [
      'Audit the trusted collection for stronger first-party proof above the fold.',
      'Keep trusted next steps pointed into installation docs and workflow decisions instead of generic browse loops.',
    ],
  },
  'collection-agent-workflows': {
    headline: 'Workflow collection needs clearer execution proof so it feels like a workflow guide, not just a themed list.',
    productGap: [
      'Execution examples, grouping logic, and install handoff must stay concrete and not collapse into repeated template copy.',
      'This page should help users choose a workflow lane quickly, then validate it.',
    ],
    operatorActions: [
      'Keep workflow examples concrete and tied to operator checkpoints.',
      'Keep next steps focused on install, validation, and scenario continuation.',
    ],
  },
  'docs-installation': {
    headline: 'Installation docs still need to feel like a verified operating bridge instead of a documentation wrapper.',
    productGap: [
      'Single-page review proof is still weak because the page behaves like a docs shell more than a maintained operator center.',
      'Users and crawlers need clearer evidence that the page was reviewed for actual setup, validation, and next-step flow.',
    ],
    operatorActions: [
      'Strengthen the install page as the primary trust bridge from discovery into CLI action and validation.',
      'Introduce page-level review and validation cues, not only global docs freshness.',
    ],
  },
};

const GLOBAL_EDITORIAL_RISKS = [
  'Skill detail pages still depend heavily on upstream repository material, so the first-party review layer must stay decisively stronger than the imported README layer.',
  'Homepage and browse hubs should avoid exposing recovery or control-board language to users; they need user-facing selection logic instead.',
  'The full skills directory can remain indexable for support, but it should not act like the primary growth path while authority proof is still weak.',
];

function formatPosition(value: number | null): string {
  return value === null || Number.isNaN(value) ? 'n/a' : value.toFixed(2);
}

function buildMeasurement(surface: AuthoritySurfaceScore): string[] {
  return [
    `Current proof target: >= ${surface.thresholds.minImpressions} impressions, >= ${surface.thresholds.minClicks} clicks, average position <= ${surface.thresholds.maxPosition}.`,
    `Current observation: ${surface.metrics.currentClicks} click(s), ${surface.metrics.currentImpressions} impression(s), position ${formatPosition(surface.metrics.currentPosition)}.`,
    `Internal support target: at least ${surface.thresholds.minPlacementCount} tracked placement(s); current=${surface.metrics.placementCount} (${surface.metrics.placements.join(', ') || 'none'}).`,
  ];
}

function buildSitewideBlockers(
  scorecard: AuthorityUpliftScorecardReport,
  deltaBoard: RecoveryDeltaBoardReport,
): SitewideBlocker[] {
  const blockers: SitewideBlocker[] = [];

  if (scorecard.expansionBoundary.blockers.length > 0) {
    blockers.push({
      label: 'Discovery expansion proof gate',
      type: 'proof-window',
      summary: scorecard.expansionBoundary.blockers.join(' | '),
      actions: dedupeStrings(scorecard.expansionBoundary.nextActions),
    });
  }

  const topClusters = [...(deltaBoard.sections.issueClusterCohorts || [])]
    .sort(
      (left, right) =>
        Number(right.metrics?.currentScore || right.rank || 0) - Number(left.metrics?.currentScore || left.rank || 0),
    )
    .slice(0, 3);

  for (const cluster of topClusters) {
    blockers.push({
      label: cluster.label,
      type: 'issue-cluster',
      summary: cluster.summary,
      actions: dedupeStrings([...cluster.blockers, ...cluster.nextActions]),
    });
  }

  return blockers;
}

function buildEntry(
  surface: AuthoritySurfaceScore,
  queueItems: AuthoritySurfaceQueueItem[],
): AuthorityOperatorQueueEntry {
  const manualNote = MANUAL_NOTES[surface.surfaceId as FocusSurfaceId];
  const gateBlockers = surface.gates
    .filter((gate) => gate.status === 'fail')
    .map((gate) => `${gate.label}: ${gate.observed}`);
  const gateWatchList = surface.gates
    .filter((gate) => gate.status === 'watch')
    .map((gate) => `${gate.label}: ${gate.observed}`);
  const normalizedQueueItems = queueItems.map((item) => ({
    id: item.id,
    priority: item.priority,
    action: normalizeText(item.action),
    why: normalizeText(item.why),
  }));
  const actionSet = dedupeStrings([
    ...normalizedQueueItems.map((item) => item.action),
    ...surface.nextActions,
    ...manualNote.operatorActions,
  ]);

  return {
    surfaceId: surface.surfaceId as FocusSurfaceId,
    label: surface.label,
    url: surface.url,
    tier: surface.tier,
    surfaceClass: surface.surfaceClass,
    decision: surface.decision,
    cadence: surface.cadence,
    queuePriority: normalizedQueueItems[0]?.priority || surface.editorialPriority || 'none',
    queueItems: normalizedQueueItems,
    keyHeadline: manualNote.headline,
    gateBlockers,
    gateWatchList,
    productGaps: manualNote.productGap,
    actions: actionSet,
    measurement: buildMeasurement(surface),
    metrics: {
      currentClicks: surface.metrics.currentClicks,
      currentImpressions: surface.metrics.currentImpressions,
      currentPosition: surface.metrics.currentPosition,
      placementCount: surface.metrics.placementCount,
      placements: surface.metrics.placements,
      proofVerdict: surface.metrics.proofVerdict,
    },
  };
}

export function buildAuthorityOperatorQueueReport(options: {
  scorecard: AuthorityUpliftScorecardReport;
  deltaBoard: RecoveryDeltaBoardReport;
  authoritySurfaces: AuthoritySurfacesData;
}): AuthorityOperatorQueueReport {
  const { scorecard, deltaBoard, authoritySurfaces } = options;
  const focusSurfaces = scorecard.surfaces
    .filter((surface) => FOCUS_SURFACE_IDS.includes(surface.surfaceId as FocusSurfaceId))
    .sort((left, right) => {
      const queueDelta = queueRank(left.editorialPriority) - queueRank(right.editorialPriority);
      if (queueDelta !== 0) return queueDelta;
      const tierDelta = tierRank(left.tier) - tierRank(right.tier);
      if (tierDelta !== 0) return tierDelta;
      return left.label.localeCompare(right.label);
    });

  const entries = focusSurfaces.map((surface) => {
    const queueItems = authoritySurfaces.editorialQueue.filter((item) => item.surfaceId === surface.surfaceId);
    return buildEntry(surface, queueItems);
  });

  const summary = {
    focusSurfaces: entries.length,
    now: entries.filter((entry) => entry.queuePriority === 'now').length,
    next: entries.filter((entry) => entry.queuePriority === 'next').length,
    none: entries.filter((entry) => entry.queuePriority === 'none').length,
    blockedByProofWindow: entries.filter((entry) =>
      entry.gateBlockers.some((blocker) => blocker.startsWith('Comparable proof readiness:')),
    ).length,
    blockedByVisibility: entries.filter((entry) =>
      entry.gateBlockers.some((blocker) => blocker.startsWith('Surface visibility:')),
    ).length,
    blockedByRanking: entries.filter((entry) =>
      entry.gateBlockers.some((blocker) => blocker.startsWith('Position threshold:')),
    ).length,
    blockedByInternalLinks: entries.filter((entry) =>
      entry.gateBlockers.some((blocker) => blocker.startsWith('Internal-link support:')),
    ).length,
  };

  const sitewideBlockers = buildSitewideBlockers(scorecard, deltaBoard);
  const nextActions = dedupeStrings([
    ...sitewideBlockers.flatMap((blocker) => blocker.actions),
    ...entries.flatMap((entry) => entry.actions.slice(0, 2)),
  ]).slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    status: scorecard.expansionBoundary.status === 'closed' ? 'blocked' : 'active',
    scorecardGeneratedAt: scorecard.generatedAt,
    deltaBoardGeneratedAt: deltaBoard.generatedAt,
    headline:
      scorecard.expansionBoundary.status === 'closed'
        ? 'Authority queue stays blocked by proof-window and cluster noise; focus on the five core surfaces without reopening bulk discovery.'
        : 'Authority queue is active; keep moving the core surfaces with proof-backed editorial work.',
    summary,
    sitewideBlockers,
    globalEditorialRisks: GLOBAL_EDITORIAL_RISKS,
    entries,
    nextActions,
  };
}

function renderSitewideBlocker(blocker: SitewideBlocker): string[] {
  return [
    `### ${blocker.label}`,
    `- Type: ${blocker.type}`,
    `- Summary: ${blocker.summary}`,
    ...blocker.actions.map((action) => `- Action: ${action}`),
    '',
  ];
}

function renderEntry(entry: AuthorityOperatorQueueEntry): string[] {
  return [
    `## ${entry.label}`,
    `- Surface: ${entry.surfaceId} | ${entry.surfaceClass} | ${entry.tier}`,
    `- URL: ${entry.url}`,
    `- Queue: ${entry.queuePriority} | decision=${entry.decision} | cadence=${entry.cadence}`,
    `- Headline: ${entry.keyHeadline}`,
    `- Metrics: clicks=${entry.metrics.currentClicks}, impressions=${entry.metrics.currentImpressions}, position=${formatPosition(entry.metrics.currentPosition)}, placements=${entry.metrics.placements.join(', ') || 'none'}`,
    '',
    '### Gate Blockers',
    ...(entry.gateBlockers.length > 0 ? entry.gateBlockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '### Watch List',
    ...(entry.gateWatchList.length > 0 ? entry.gateWatchList.map((item) => `- ${item}`) : ['- none']),
    '',
    '### Product Gaps',
    ...entry.productGaps.map((item) => `- ${item}`),
    '',
    '### Queue Tasks',
    ...(entry.queueItems.length > 0
      ? entry.queueItems.flatMap((item) => [`- ${item.priority.toUpperCase()} | ${item.action}`, `- Why: ${item.why}`])
      : ['- none']),
    '',
    '### Operator Actions',
    ...entry.actions.map((item) => `- ${item}`),
    '',
    '### Measurement',
    ...entry.measurement.map((item) => `- ${item}`),
    '',
  ];
}

export function renderAuthorityOperatorQueueReport(report: AuthorityOperatorQueueReport): string {
  return [
    '# Authority Operator Queue',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Scorecard source: ${report.scorecardGeneratedAt}`,
    `- Delta-board source: ${report.deltaBoardGeneratedAt}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Summary',
    `- focus surfaces: ${report.summary.focusSurfaces}`,
    `- queue now: ${report.summary.now}`,
    `- queue next: ${report.summary.next}`,
    `- queue none: ${report.summary.none}`,
    `- blocked by proof window: ${report.summary.blockedByProofWindow}`,
    `- blocked by visibility: ${report.summary.blockedByVisibility}`,
    `- blocked by ranking: ${report.summary.blockedByRanking}`,
    `- blocked by internal links: ${report.summary.blockedByInternalLinks}`,
    '',
    '## Sitewide Blockers',
    '',
    ...report.sitewideBlockers.flatMap(renderSitewideBlocker),
    '## Global Editorial Risks',
    ...report.globalEditorialRisks.map((item) => `- ${item}`),
    '',
    ...report.entries.flatMap(renderEntry),
    '## Next Actions',
    ...report.nextActions.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

export function writeAuthorityOperatorQueueArtifacts(
  report: AuthorityOperatorQueueReport,
  options: {
    markdownOutputPath?: string;
    jsonOutputPath?: string;
  } = {},
): AuthorityOperatorQueueReport {
  writeJson(options.jsonOutputPath || DEFAULT_AUTHORITY_OPERATOR_QUEUE_JSON_PATH, report);
  writeMarkdown(options.markdownOutputPath || DEFAULT_AUTHORITY_OPERATOR_QUEUE_MD_PATH, renderAuthorityOperatorQueueReport(report));
  return report;
}

export function buildAuthorityOperatorQueueFromFiles(options: {
  scorecardJsonPath?: string;
  deltaBoardJsonPath?: string;
  authoritySurfacesJsonPath?: string;
} = {}): AuthorityOperatorQueueReport {
  const scorecard = readJsonFile<AuthorityUpliftScorecardReport>(
    options.scorecardJsonPath || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH,
  );
  const deltaBoard = readJsonFile<RecoveryDeltaBoardReport>(
    options.deltaBoardJsonPath || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH,
  );
  const authoritySurfaces = readJsonFile<AuthoritySurfacesData>(
    options.authoritySurfacesJsonPath || DEFAULT_AUTHORITY_SURFACES_JSON_PATH,
  );

  return buildAuthorityOperatorQueueReport({ scorecard, deltaBoard, authoritySurfaces });
}
