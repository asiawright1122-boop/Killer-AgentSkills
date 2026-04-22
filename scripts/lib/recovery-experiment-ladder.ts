import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH,
  type AuthorityUpliftDecision,
  type AuthorityUpliftScorecardReport,
  type AuthorityUpliftSurfaceScore,
} from './authority-uplift-scorecard';
import {
  DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
  type RecoveryExecutionQueueItem,
  type RecoveryExecutionQueueReport,
} from './recovery-execution-queue';
import { DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH, type RecoveryDeltaBoardReport } from './recovery-delta-board';

export const DEFAULT_RECOVERY_EXPERIMENT_LADDER_MD_PATH = 'reports/seo/latest-recovery-experiment-ladder.md';
export const DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH = 'reports/seo/latest-recovery-experiment-ladder.json';

export type RecoveryExperimentState =
  | 'queued'
  | 'manual-active'
  | 'review'
  | 'limited-rollout'
  | 'automation-candidate'
  | 'retired';
export type RecoveryAutomationReadiness = 'manual-only' | 'not-ready' | 'candidate';
export type RecoveryExperimentSourceType = 'execution-queue' | 'authority-surface';
export type RecoveryExperimentCategory =
  | 'measurement'
  | 'canonicalization'
  | 'internal-linking'
  | 'editorial-uplift'
  | 'monitoring'
  | 'triage';
export type RecoveryExperimentGateStatus = 'pass' | 'watch' | 'fail';

export type RecoveryExperimentGate = {
  id: string;
  label: string;
  status: RecoveryExperimentGateStatus;
  target: string;
  observed: string;
  notes: string[];
};

export type RecoveryExperimentStateContract = {
  state: RecoveryExperimentState;
  meaning: string;
  promotionCriteria: string[];
  rollbackTriggers: string[];
  retirementCriteria: string[];
};

export type RecoveryExperimentItem = {
  id: string;
  title: string;
  sourceType: RecoveryExperimentSourceType;
  sourceId: string;
  category: RecoveryExperimentCategory;
  state: RecoveryExperimentState;
  automationReadiness: RecoveryAutomationReadiness;
  priority: string;
  score: number;
  summary: string;
  rationale: string;
  nextEvidence: string;
  nextAction: string;
  decisionSignal: string;
  sourceLane: string | null;
  ownerSurfaceId: string | null;
  gates: RecoveryExperimentGate[];
  blockers: string[];
  evidence: string[];
  promotionCriteria: string[];
  rollbackTriggers: string[];
  retirementCriteria: string[];
};

export type RecoveryExperimentLadderReport = {
  generatedAt: string;
  headline: string;
  summary: {
    totalExperiments: number;
    queued: number;
    manualActive: number;
    review: number;
    limitedRollout: number;
    automationCandidate: number;
    retired: number;
    manualOnly: number;
    notReady: number;
    candidate: number;
  };
  context: {
    trustVerdict: string;
    baselineSeeded: boolean;
    expansionBoundary: string;
    blockedExecutionItems: number;
    readyExecutionItems: number;
    promoteSurfaces: number;
    holdSurfaces: number;
    stopSurfaces: number;
  };
  ladderDefinition: RecoveryExperimentStateContract[];
  experiments: RecoveryExperimentItem[];
  buckets: {
    queued: RecoveryExperimentItem[];
    manualActive: RecoveryExperimentItem[];
    review: RecoveryExperimentItem[];
    limitedRollout: RecoveryExperimentItem[];
    automationCandidate: RecoveryExperimentItem[];
    retired: RecoveryExperimentItem[];
  };
  automationPolicy: {
    status: 'locked' | 'eligible';
    headline: string;
    gates: RecoveryExperimentGate[];
    blockers: string[];
    nextActions: string[];
  };
  nextActions: string[];
};

type RecoveryExperimentLadderFileOptions = {
  authorityUpliftScorecardJsonPath?: string;
  executionQueueJsonPath?: string;
  deltaBoardJsonPath?: string;
};

type RecoveryExperimentLadderWriteOptions = {
  markdownOutputPath?: string;
  jsonOutputPath?: string;
};

const LADDER_DEFINITION: RecoveryExperimentStateContract[] = [
  {
    state: 'queued',
    meaning: 'The intervention is identified, but prerequisites or operator action still keep it from entering an active manual loop.',
    promotionCriteria: [
      'Clear the blocking prerequisite or ambiguity.',
      'Keep one explicit manual action and one success signal attached to the experiment.',
    ],
    rollbackTriggers: ['New evidence shows the candidate is invalid or misprioritized.'],
    retirementCriteria: ['The source surface becomes irrelevant or moves to a durable stop state.'],
  },
  {
    state: 'manual-active',
    meaning: 'The experiment is ready for human execution now and should gather an explicit outcome note.',
    promotionCriteria: [
      'Ship the manual intervention.',
      'Capture the next proof window against the stated success signal.',
    ],
    rollbackTriggers: ['Manual change introduces regressions or the success signal fails clearly.'],
    retirementCriteria: ['The intervention is no longer worth repeating or becomes superseded by a better path.'],
  },
  {
    state: 'review',
    meaning: 'Manual work or monitoring exists, but the next comparable evidence window must confirm whether it worked.',
    promotionCriteria: [
      'One comparable proof window validates the intended success signal.',
      'No rollback trigger fires during review.',
    ],
    rollbackTriggers: ['Fresh evidence becomes stale, noisy, or directionally negative.'],
    retirementCriteria: ['The experiment keeps failing review or loses strategic value.'],
  },
  {
    state: 'limited-rollout',
    meaning: 'The intervention has early proof and can expand inside a constrained, reversible rollout.',
    promotionCriteria: [
      'A second successful proof cycle confirms the win is repeatable.',
      'Rollback instructions remain explicit and practical.',
    ],
    rollbackTriggers: ['Another proof cycle shows regression, noise, or elevated risk.'],
    retirementCriteria: ['The rollout remains too noisy or too costly to justify further expansion.'],
  },
  {
    state: 'automation-candidate',
    meaning: 'The intervention has enough repeatable manual evidence that a later milestone may automate it safely.',
    promotionCriteria: ['Future automation work may consume this experiment only with explicit operator approval.'],
    rollbackTriggers: ['Any later proof cycle weakens the repeatability or safety assumptions.'],
    retirementCriteria: ['Cost, risk, or strategic priority makes automation no longer worthwhile.'],
  },
  {
    state: 'retired',
    meaning: 'The intervention should not receive new execution effort unless materially new evidence appears.',
    promotionCriteria: ['Only reopen if new evidence clearly changes the strategic case.'],
    rollbackTriggers: [],
    retirementCriteria: ['Retired is the terminal default until new evidence arrives.'],
  },
];

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

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  return new Intl.NumberFormat('en-US').format(value);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function gateRank(status: RecoveryExperimentGateStatus): number {
  switch (status) {
    case 'pass':
      return 3;
    case 'watch':
      return 2;
    case 'fail':
      return 1;
  }
}

function stateRank(state: RecoveryExperimentState): number {
  switch (state) {
    case 'automation-candidate':
      return 6;
    case 'limited-rollout':
      return 5;
    case 'review':
      return 4;
    case 'manual-active':
      return 3;
    case 'queued':
      return 2;
    case 'retired':
      return 1;
  }
}

function readinessRank(readiness: RecoveryAutomationReadiness): number {
  switch (readiness) {
    case 'candidate':
      return 3;
    case 'not-ready':
      return 2;
    case 'manual-only':
      return 1;
  }
}

function categorizeExecutionItem(item: RecoveryExecutionQueueItem): RecoveryExperimentCategory {
  if (item.lane === 'measurement') return 'measurement';
  if (item.lane === 'canonicalization') return 'canonicalization';
  if (item.lane === 'internal-linking') return 'internal-linking';
  if (item.lane === 'monitoring') return 'monitoring';
  return 'triage';
}

function buildAutomationPolicy(
  scorecard: AuthorityUpliftScorecardReport,
  executionQueue: RecoveryExecutionQueueReport,
  deltaBoard: RecoveryDeltaBoardReport,
): RecoveryExperimentLadderReport['automationPolicy'] {
  const blockedMeasurementItems = executionQueue.items.filter(
    (item) => item.lane === 'measurement' && item.queueStatus === 'blocked',
  );
  const proofReady = deltaBoard.trustVerdict === 'ready' && deltaBoard.baselineSeeded === false;
  const expansionOpen = scorecard.expansionBoundary.status === 'open';
  const promoteReadySurfaces = scorecard.summary.promote;

  const gates: RecoveryExperimentGate[] = [
    {
      id: 'proof-ready',
      label: 'Proof substrate is trustworthy',
      status: proofReady ? 'pass' : 'fail',
      target: 'Delta board trust `ready` and baseline no longer newly seeded.',
      observed: `trust=${deltaBoard.trustVerdict}, baselineSeeded=${deltaBoard.baselineSeeded ? 'yes' : 'no'}`,
      notes: proofReady ? [] : ['Automation remains locked while comparable proof is still missing or blocked.'],
    },
    {
      id: 'expansion-open',
      label: 'Authority uplift gate is open',
      status: expansionOpen ? 'pass' : 'fail',
      target: 'Discovery expansion boundary `open`.',
      observed: `boundary=${scorecard.expansionBoundary.status}, promote=${promoteReadySurfaces}`,
      notes: expansionOpen ? [] : ['Automation cannot outrun the authority uplift gate.'],
    },
    {
      id: 'measurement-clear',
      label: 'Measurement prerequisites are clear',
      status: blockedMeasurementItems.length === 0 ? 'pass' : 'fail',
      target: '0 blocked measurement prerequisites.',
      observed: `${blockedMeasurementItems.length} blocked measurement item(s).`,
      notes: blockedMeasurementItems.length === 0 ? [] : ['Blocked measurement work means automation would amplify uncertainty.'],
    },
  ];

  const status = gates.every((gate) => gate.status === 'pass') ? 'eligible' : 'locked';
  const blockers = dedupeStrings(gates.filter((gate) => gate.status !== 'pass').map((gate) => `${gate.label}: ${gate.observed}`));
  const nextActions = dedupeStrings([
    !proofReady ? 'Collect another trustworthy proof window before any experiment can be considered automation-ready.' : '',
    !expansionOpen ? 'Keep automation locked until the authority uplift boundary opens.' : '',
    blockedMeasurementItems.length > 0 ? 'Clear blocked measurement prerequisites before promoting any experiment into automation candidacy.' : '',
  ]);

  return {
    status,
    headline:
      status === 'eligible'
        ? 'Automation candidacy may be evaluated because proof, uplift, and measurement gates are all open.'
        : 'Automation remains locked because the proof, uplift, or measurement gates are still closed.',
    gates,
    blockers,
    nextActions,
  };
}

function experimentGateSummary(
  proofReady: boolean,
  expansionOpen: boolean,
  measurementBlockedCount: number,
  observed: string,
): RecoveryExperimentGate[] {
  return [
    {
      id: 'proof',
      label: 'Proof readiness',
      status: proofReady ? 'pass' : 'watch',
      target: 'Comparable proof window ready.',
      observed,
      notes: proofReady ? [] : ['This experiment must stay manual while proof is incomplete.'],
    },
    {
      id: 'expansion',
      label: 'Authority uplift boundary',
      status: expansionOpen ? 'pass' : 'watch',
      target: 'Expansion boundary open for promotable surfaces.',
      observed: expansionOpen ? 'open' : 'closed',
      notes: expansionOpen ? [] : ['Experiments cannot skip the authority uplift gate.'],
    },
    {
      id: 'measurement',
      label: 'Measurement prerequisites',
      status: measurementBlockedCount === 0 ? 'pass' : 'watch',
      target: '0 blocked measurement prerequisites.',
      observed: `${measurementBlockedCount} blocked measurement prerequisite(s).`,
      notes: measurementBlockedCount === 0 ? [] : ['Blocked measurement keeps the experiment below automation readiness.'],
    },
  ];
}

function classifyExecutionExperiment(
  item: RecoveryExecutionQueueItem,
  context: {
    automationPolicy: RecoveryExperimentLadderReport['automationPolicy'];
    proofReady: boolean;
    expansionOpen: boolean;
    measurementBlockedCount: number;
  },
): RecoveryExperimentItem {
  const category = categorizeExecutionItem(item);
  const candidateEligible =
    item.queueStatus === 'watch' &&
    category === 'monitoring' &&
    context.automationPolicy.status === 'eligible' &&
    item.blockedBy.length === 0;

  const state: RecoveryExperimentState =
    item.queueStatus === 'blocked'
      ? 'queued'
      : candidateEligible
        ? 'automation-candidate'
        : item.queueStatus === 'watch'
          ? 'review'
          : 'manual-active';

  const automationReadiness: RecoveryAutomationReadiness =
    candidateEligible ? 'candidate' : item.queueStatus === 'blocked' ? 'not-ready' : 'manual-only';

  const observed = `${item.queueStatus} / ${item.lane} / ${item.priority}`;
  const gates = [
    ...experimentGateSummary(context.proofReady, context.expansionOpen, context.measurementBlockedCount, observed),
    {
      id: 'queue-status',
      label: 'Execution queue status',
      status: item.queueStatus === 'ready' ? 'pass' : item.queueStatus === 'watch' ? 'watch' : 'fail',
      target: 'Queue status should be ready or watch before higher ladder states.',
      observed: item.queueStatus,
      notes: item.queueStatus === 'blocked' ? item.blockedBy : [],
    },
  ];

  const promotionCriteria = dedupeStrings([
    ...(LADDER_DEFINITION.find((entry) => entry.state === state)?.promotionCriteria || []),
    item.successSignal,
  ]);
  const rollbackTriggers = dedupeStrings([
    ...(LADDER_DEFINITION.find((entry) => entry.state === state)?.rollbackTriggers || []),
    'Fresh proof becomes stale, noisy, or directionally negative.',
    'Any new blocker makes the current action unsafe to continue.',
  ]);
  const retirementCriteria = dedupeStrings([
    ...(LADDER_DEFINITION.find((entry) => entry.state === state)?.retirementCriteria || []),
    'A stronger recovery path replaces this intervention.',
  ]);
  const summary =
    state === 'manual-active'
      ? `${item.title} is ready for manual execution and should stay human-driven until the next proof window validates the result.`
      : state === 'queued'
        ? `${item.title} remains queued because prerequisites or ambiguity still block execution.`
        : state === 'automation-candidate'
          ? `${item.title} has cleared the ladder far enough to be considered a future automation candidate.`
          : `${item.title} is under review and still needs another evidence cycle before it can advance.`;
  const rationale =
    state === 'manual-active'
      ? item.rationale
      : state === 'queued'
        ? 'The intervention exists, but the ladder should not let it bypass its blocking prerequisites.'
        : state === 'automation-candidate'
          ? 'This monitoring-style experiment is stable enough to become a future automation candidate once a later milestone chooses to automate it.'
          : 'The experiment has some active evidence, but it still needs another proof pass before the ladder should promote it further.';
  const nextAction = item.action;
  const nextEvidence = item.successSignal;
  const score =
    stateRank(state) * 1000 +
    readinessRank(automationReadiness) * 100 +
    gates.reduce((sum, gate) => sum + gateRank(gate.status) * 10, 0) +
    Math.min(Math.round(item.score), 999);

  return {
    id: `queue-${item.id}`,
    title: item.title,
    sourceType: 'execution-queue',
    sourceId: item.id,
    category,
    state,
    automationReadiness,
    priority: item.priority,
    score,
    summary,
    rationale,
    nextEvidence,
    nextAction,
    decisionSignal: `${item.queueStatus} / ${item.priority} / ${item.lane}`,
    sourceLane: item.lane,
    ownerSurfaceId: null,
    gates,
    blockers: dedupeStrings(item.blockedBy),
    evidence: dedupeStrings(item.evidence.slice(0, 4)),
    promotionCriteria,
    rollbackTriggers,
    retirementCriteria,
  };
}

function classifySurfaceExperiment(
  surface: AuthorityUpliftSurfaceScore,
  context: {
    automationPolicy: RecoveryExperimentLadderReport['automationPolicy'];
    proofReady: boolean;
    expansionOpen: boolean;
    measurementBlockedCount: number;
  },
): RecoveryExperimentItem {
  const failCount = surface.gates.filter((gate) => gate.status === 'fail').length;
  const candidateEligible =
    surface.decision === 'promote' &&
    context.automationPolicy.status === 'eligible' &&
    failCount === 0 &&
    surface.metrics.currentImpressions >= surface.thresholds.minImpressions * 2 &&
    surface.metrics.currentClicks >= Math.max(1, surface.thresholds.minClicks);

  const state: RecoveryExperimentState =
    surface.decision === 'stop'
      ? 'retired'
      : candidateEligible
        ? 'automation-candidate'
        : surface.decision === 'promote'
          ? 'limited-rollout'
          : surface.editorialPriority === 'now' || surface.cadence === 'weekly'
            ? 'manual-active'
            : surface.editorialPriority === 'next'
              ? 'review'
              : 'queued';

  const automationReadiness: RecoveryAutomationReadiness =
    candidateEligible ? 'candidate' : state === 'limited-rollout' ? 'not-ready' : 'manual-only';

  const gates = [
    ...experimentGateSummary(
      context.proofReady,
      context.expansionOpen,
      context.measurementBlockedCount,
      `${surface.decision} / ${surface.cadence} / ${surface.phase55Disposition}`,
    ),
    {
      id: 'surface-decision',
      label: 'Authority uplift decision',
      status: surface.decision === 'promote' ? 'pass' : surface.decision === 'hold' ? 'watch' : 'fail',
      target: 'Surface must clear uplift gates before rollout or automation candidacy.',
      observed: `${surface.decision} / ${surface.phase55Disposition} / ${surface.phase55State}`,
      notes: surface.decision === 'stop' ? ['Stop surfaces must not be promoted into automation work.'] : [],
    },
  ];

  const summary =
    state === 'manual-active'
      ? `${surface.label} is an active manual uplift loop and should keep gathering outcome evidence before broader rollout.`
      : state === 'limited-rollout'
        ? `${surface.label} can expand inside a constrained rollout, but automation still stays behind another proof cycle.`
        : state === 'automation-candidate'
          ? `${surface.label} has enough repeatable manual evidence to be considered a future automation candidate.`
          : state === 'retired'
            ? `${surface.label} is retired from the active uplift lane and should not receive new automation work.`
            : state === 'review'
              ? `${surface.label} needs another evidence review before it can advance.`
              : `${surface.label} remains queued behind stronger or better-proven surface experiments.`;

  const promotionCriteria = dedupeStrings([
    ...(LADDER_DEFINITION.find((entry) => entry.state === state)?.promotionCriteria || []),
    ...surface.nextActions.slice(0, 2),
  ]);
  const rollbackTriggers = dedupeStrings([
    ...(LADDER_DEFINITION.find((entry) => entry.state === state)?.rollbackTriggers || []),
    'Surface decision falls from promote to hold or stop.',
    'Traffic or proof freshness degrades below the uplift thresholds.',
  ]);
  const retirementCriteria = dedupeStrings([
    ...(LADDER_DEFINITION.find((entry) => entry.state === state)?.retirementCriteria || []),
    'The surface no longer deserves active editorial effort.',
  ]);
  const score =
    stateRank(state) * 1000 +
    readinessRank(automationReadiness) * 100 +
    gates.reduce((sum, gate) => sum + gateRank(gate.status) * 10, 0) +
    Math.min(Math.round(surface.score), 999);

  return {
    id: `surface-${surface.surfaceId}`,
    title: `Authority uplift: ${surface.label}`,
    sourceType: 'authority-surface',
    sourceId: surface.surfaceId,
    category: 'editorial-uplift',
    state,
    automationReadiness,
    priority: surface.tier,
    score,
    summary,
    rationale: surface.rationale,
    nextEvidence: surface.nextActions[0] || 'Collect the next proof window for this surface.',
    nextAction: surface.nextActions[0] || 'Hold the current cadence until another proof window arrives.',
    decisionSignal: `${surface.decision} / ${surface.cadence} / ${surface.editorialPriority}`,
    sourceLane: null,
    ownerSurfaceId: surface.surfaceId,
    gates,
    blockers: dedupeStrings(surface.gates.filter((gate) => gate.status === 'fail').map((gate) => `${gate.label}: ${gate.observed}`)),
    evidence: dedupeStrings([
      `Decision: ${surface.decision}`,
      `Cadence: ${surface.cadence}`,
      `Current impressions: ${surface.metrics.currentImpressions}`,
      `Current clicks: ${surface.metrics.currentClicks}`,
      ...surface.nextActions.slice(0, 2),
    ]),
    promotionCriteria,
    rollbackTriggers,
    retirementCriteria,
  };
}

function selectSurfaceExperiments(scorecard: AuthorityUpliftScorecardReport): AuthorityUpliftSurfaceScore[] {
  return scorecard.surfaces.filter(
    (surface) => surface.cadence === 'weekly' || surface.editorialPriority !== 'none' || surface.decision !== 'hold',
  );
}

function sortExperiments(items: RecoveryExperimentItem[]): RecoveryExperimentItem[] {
  return [...items].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function buildRecoveryExperimentLadderReport(options: {
  generatedAt?: string;
  authorityUpliftScorecardReport: AuthorityUpliftScorecardReport;
  recoveryExecutionQueueReport: RecoveryExecutionQueueReport;
  recoveryDeltaBoardReport: RecoveryDeltaBoardReport;
}): RecoveryExperimentLadderReport {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const scorecard = options.authorityUpliftScorecardReport;
  const executionQueue = options.recoveryExecutionQueueReport;
  const deltaBoard = options.recoveryDeltaBoardReport;
  const proofReady = deltaBoard.trustVerdict === 'ready' && deltaBoard.baselineSeeded === false;
  const expansionOpen = scorecard.expansionBoundary.status === 'open';
  const measurementBlockedCount = executionQueue.items.filter(
    (item) => item.lane === 'measurement' && item.queueStatus === 'blocked',
  ).length;
  const automationPolicy = buildAutomationPolicy(scorecard, executionQueue, deltaBoard);

  const queueExperiments = executionQueue.items.map((item) =>
    classifyExecutionExperiment(item, {
      automationPolicy,
      proofReady,
      expansionOpen,
      measurementBlockedCount,
    }),
  );
  const surfaceExperiments = selectSurfaceExperiments(scorecard).map((surface) =>
    classifySurfaceExperiment(surface, {
      automationPolicy,
      proofReady,
      expansionOpen,
      measurementBlockedCount,
    }),
  );

  const experiments = sortExperiments([...queueExperiments, ...surfaceExperiments]);
  const buckets = {
    queued: sortExperiments(experiments.filter((item) => item.state === 'queued')),
    manualActive: sortExperiments(experiments.filter((item) => item.state === 'manual-active')),
    review: sortExperiments(experiments.filter((item) => item.state === 'review')),
    limitedRollout: sortExperiments(experiments.filter((item) => item.state === 'limited-rollout')),
    automationCandidate: sortExperiments(experiments.filter((item) => item.state === 'automation-candidate')),
    retired: sortExperiments(experiments.filter((item) => item.state === 'retired')),
  };

  const summary = {
    totalExperiments: experiments.length,
    queued: buckets.queued.length,
    manualActive: buckets.manualActive.length,
    review: buckets.review.length,
    limitedRollout: buckets.limitedRollout.length,
    automationCandidate: buckets.automationCandidate.length,
    retired: buckets.retired.length,
    manualOnly: experiments.filter((item) => item.automationReadiness === 'manual-only').length,
    notReady: experiments.filter((item) => item.automationReadiness === 'not-ready').length,
    candidate: experiments.filter((item) => item.automationReadiness === 'candidate').length,
  };

  const headline =
    summary.automationCandidate > 0
      ? `${summary.automationCandidate} experiment(s) are automation candidates, while ${summary.manualActive} remain manual-active and ${summary.queued} still wait in queue.`
      : `No experiment is automation-ready yet; ${summary.manualActive} are manual-active, ${summary.review} are under review, and ${summary.queued} still wait behind blockers or proof gates.`;

  const nextActions = dedupeStrings([
    ...automationPolicy.nextActions,
    ...buckets.manualActive.slice(0, 4).map((item) => item.nextAction),
    ...buckets.queued.slice(0, 2).map((item) => item.nextAction),
    ...buckets.review.slice(0, 2).map((item) => item.nextEvidence),
  ]).slice(0, 8);

  return {
    generatedAt,
    headline,
    summary,
    context: {
      trustVerdict: deltaBoard.trustVerdict,
      baselineSeeded: deltaBoard.baselineSeeded,
      expansionBoundary: scorecard.expansionBoundary.status,
      blockedExecutionItems: executionQueue.blockedCount,
      readyExecutionItems: executionQueue.readyCount,
      promoteSurfaces: scorecard.summary.promote,
      holdSurfaces: scorecard.summary.hold,
      stopSurfaces: scorecard.summary.stop,
    },
    ladderDefinition: LADDER_DEFINITION,
    experiments,
    buckets,
    automationPolicy,
    nextActions,
  };
}

export function buildRecoveryExperimentLadderFromFiles(
  options: RecoveryExperimentLadderFileOptions = {},
): RecoveryExperimentLadderReport {
  const scorecard = readJsonFile<AuthorityUpliftScorecardReport>(
    options.authorityUpliftScorecardJsonPath || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH,
  );
  if (!scorecard) {
    throw new Error(
      `Missing authority uplift scorecard at ${options.authorityUpliftScorecardJsonPath || DEFAULT_AUTHORITY_UPLIFT_SCORECARD_JSON_PATH}`,
    );
  }

  const executionQueue = readJsonFile<RecoveryExecutionQueueReport>(
    options.executionQueueJsonPath || DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH,
  );
  if (!executionQueue) {
    throw new Error(
      `Missing recovery execution queue at ${options.executionQueueJsonPath || DEFAULT_RECOVERY_EXECUTION_QUEUE_JSON_PATH}`,
    );
  }

  const deltaBoard = readJsonFile<RecoveryDeltaBoardReport>(options.deltaBoardJsonPath || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH);
  if (!deltaBoard) {
    throw new Error(`Missing recovery delta board at ${options.deltaBoardJsonPath || DEFAULT_RECOVERY_DELTA_BOARD_JSON_PATH}`);
  }

  return buildRecoveryExperimentLadderReport({
    authorityUpliftScorecardReport: scorecard,
    recoveryExecutionQueueReport: executionQueue,
    recoveryDeltaBoardReport: deltaBoard,
  });
}

function renderExperimentTable(items: RecoveryExperimentItem[]): string[] {
  return [
    '| Experiment | Source | State | Automation | Priority | Signal | Summary |',
    '|---|---|---|---|---|---|---|',
    ...(items.length > 0
      ? items.map(
          (item) =>
            `| ${escapeCell(item.title)} | ${item.sourceType} | ${item.state} | ${item.automationReadiness} | ${item.priority} | ${escapeCell(item.decisionSignal)} | ${escapeCell(item.summary)} |`,
        )
      : ['| none | - | - | - | - | - | No experiments currently sit in this bucket. |']),
  ];
}

export function renderRecoveryExperimentLadderReport(report: RecoveryExperimentLadderReport): string {
  const renderGateList = (gates: RecoveryExperimentGate[]) =>
    gates.map((gate) => `- ${gate.label}: ${gate.status} | target=${gate.target} | observed=${gate.observed}`);

  return [
    '# Recovery Experiment Ladder',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Trust verdict: ${report.context.trustVerdict}`,
    `- Baseline seeded: ${report.context.baselineSeeded ? 'yes' : 'no'}`,
    `- Expansion boundary: ${report.context.expansionBoundary}`,
    '',
    '## Headline',
    '',
    report.headline,
    '',
    '## Summary',
    '',
    `- total experiments: ${report.summary.totalExperiments}`,
    `- queued: ${report.summary.queued}`,
    `- manual-active: ${report.summary.manualActive}`,
    `- review: ${report.summary.review}`,
    `- limited-rollout: ${report.summary.limitedRollout}`,
    `- automation-candidate: ${report.summary.automationCandidate}`,
    `- retired: ${report.summary.retired}`,
    `- automation manual-only: ${report.summary.manualOnly}`,
    `- automation not-ready: ${report.summary.notReady}`,
    `- automation candidate: ${report.summary.candidate}`,
    '',
    '## Ladder Definition',
    '',
    ...report.ladderDefinition.flatMap((entry) => [
      `### ${entry.state}`,
      '',
      entry.meaning,
      '',
      '- Promotion criteria:',
      ...entry.promotionCriteria.map((item) => `  - ${item}`),
      '- Rollback triggers:',
      ...entry.rollbackTriggers.map((item) => `  - ${item}`),
      '- Retirement criteria:',
      ...entry.retirementCriteria.map((item) => `  - ${item}`),
      '',
    ]),
    '## Queued',
    '',
    ...renderExperimentTable(report.buckets.queued),
    '',
    '## Manual Active',
    '',
    ...renderExperimentTable(report.buckets.manualActive),
    '',
    '## Review',
    '',
    ...renderExperimentTable(report.buckets.review),
    '',
    '## Limited Rollout',
    '',
    ...renderExperimentTable(report.buckets.limitedRollout),
    '',
    '## Automation Candidate',
    '',
    ...renderExperimentTable(report.buckets.automationCandidate),
    '',
    '## Retired',
    '',
    ...renderExperimentTable(report.buckets.retired),
    '',
    '## Automation Policy',
    '',
    `- status: ${report.automationPolicy.status}`,
    `- headline: ${report.automationPolicy.headline}`,
    '',
    '### Automation Gates',
    '',
    ...renderGateList(report.automationPolicy.gates),
    '',
    '### Automation Blockers',
    '',
    ...(report.automationPolicy.blockers.length > 0 ? report.automationPolicy.blockers.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Next Actions',
    '',
    ...(report.nextActions.length > 0 ? report.nextActions.map((item) => `- ${item}`) : ['- none']),
    '',
  ].join('\n');
}

export function writeRecoveryExperimentLadderArtifacts(
  report: RecoveryExperimentLadderReport,
  options: RecoveryExperimentLadderWriteOptions = {},
): RecoveryExperimentLadderReport {
  const markdownOutputPath = options.markdownOutputPath || DEFAULT_RECOVERY_EXPERIMENT_LADDER_MD_PATH;
  const jsonOutputPath = options.jsonOutputPath || DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH;
  writeJson(jsonOutputPath, report);

  const markdownAbsolutePath = toAbsolutePath(markdownOutputPath);
  mkdirSync(dirname(markdownAbsolutePath), { recursive: true });
  writeFileSync(markdownAbsolutePath, `${renderRecoveryExperimentLadderReport(report)}\n`, 'utf8');
  return report;
}
