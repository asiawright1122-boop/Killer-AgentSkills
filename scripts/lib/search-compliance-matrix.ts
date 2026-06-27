import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const DEFAULT_SEARCH_COMPLIANCE_MATRIX_MD_PATH = 'reports/seo/latest-search-compliance-matrix.md';
export const DEFAULT_SEARCH_COMPLIANCE_MATRIX_JSON_PATH = 'reports/seo/latest-search-compliance-matrix.json';
export const DEFAULT_CRAWL_HEALTH_JSON_PATH = 'reports/seo/latest-crawl-health.json';
export const DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH = 'reports/seo/latest-coverage-drilldown.json';
export const DEFAULT_TRAFFIC_JSON_PATH = 'reports/gsc/latest-ctr-report.json';
export const DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH = 'reports/seo/latest-recovery-proof-window.json';
export const DEFAULT_AUTHORITY_UPLIFT_JSON_PATH = 'reports/seo/latest-authority-uplift-scorecard.json';
export const DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH = 'reports/seo/latest-recovery-experiment-ladder.json';
export const DEFAULT_URL_INSPECTION_SWEEP_JSON_PATH = 'reports/seo/latest-url-inspection-coverage-sweep.json';
export const DEFAULT_GUIDELINES_RESEARCH_PATH = '.planning/research/v1.9-search-guidelines.md';

export type SearchComplianceVerdict = 'pass' | 'watch' | 'block' | 'unavailable';

export type SearchComplianceEvidence = {
  path: string;
  exists: boolean;
  summary: string;
};

export type SearchComplianceItem = {
  id: string;
  category: string;
  requirement: string;
  primarySources: string[];
  projectEvidence: SearchComplianceEvidence[];
  verdict: SearchComplianceVerdict;
  rationale: string;
  nextAction: string;
};

export type SearchComplianceMatrixReport = {
  generatedAt: string;
  overallVerdict: SearchComplianceVerdict;
  headline: string;
  counts: Record<SearchComplianceVerdict, number>;
  sourceSet: Array<{ label: string; url: string }>;
  items: SearchComplianceItem[];
  blockers: string[];
  nextActions: string[];
};

type CrawlHealthJson = {
  generatedAt?: string;
  totals?: {
    sitemapFilesDiscovered?: number;
    pageUrlsDiscovered?: number;
    pageUrlsChecked?: number;
  };
  statusSummary?: {
    status2xx?: number;
    status3xx?: number;
    status4xx?: number;
    status5xx?: number;
    statusOther?: number;
  };
  sitemapErrors?: unknown[];
  onPageSeoErrors?: unknown[];
  duplicates?: unknown[];
};

type CoverageDrilldownJson = {
  generatedAt?: string;
  issueCount?: number;
  totalAffectedPages?: number;
  sourceFreshnessStatus?: string;
  sourceFreshnessDate?: string | null;
  sourceFreshnessDays?: number | null;
  sourceMaxWindowDays?: number | null;
  clusterPriorities?: Array<{ cluster?: string; estimatedAffected?: number; weightedImpact?: number }>;
};

type TrafficJson = {
  generatedAt?: string;
  status?: string;
  sourceMode?: string;
  currentPeriod?: { start?: string; end?: string };
  queryRows?: number;
  pageRows?: number;
  priorityQueryOpportunities?: number;
  priorityPageOpportunities?: number;
  queryPrecisionRisks?: number;
};

type RecoveryProofJson = {
  generatedAt?: string;
  snapshotDate?: string;
  trustVerdict?: string;
  sourceSummary?: {
    technicalRecoveryStatus?: string | null;
    businessRecoveryStatus?: string | null;
    coverageFreshnessStatus?: string | null;
    coverageSourceDate?: string | null;
    coverageSourceAgeDays?: number | null;
  };
  blockers?: string[];
  nextActions?: string[];
};

type AuthorityUpliftJson = {
  generatedAt?: string;
  expansionBoundary?: string | { status?: string };
  counts?: {
    promote?: number;
    hold?: number;
    stop?: number;
  };
  summary?: {
    promote?: number;
    hold?: number;
    stop?: number;
  };
};

type ExperimentLadderJson = {
  generatedAt?: string;
  automationPolicy?: string | { status?: string };
  summary?: {
    limitedRollout?: number;
    automationCandidate?: number;
  };
};

type UrlInspectionSweepJson = {
  generatedAt?: string;
  sourceMode?: string;
  totalSampled?: number;
  overallPassRate?: number;
  clustersInspected?: number;
  clusters?: Array<{ cluster: string; sampleSize: number; passCount: number }>;
};

type SearchComplianceInputs = {
  generatedAt?: string;
  crawlHealth?: CrawlHealthJson | null;
  coverage?: CoverageDrilldownJson | null;
  traffic?: TrafficJson | null;
  proofWindow?: RecoveryProofJson | null;
  authority?: AuthorityUpliftJson | null;
  experimentLadder?: ExperimentLadderJson | null;
  urlInspectionSweep?: UrlInspectionSweepJson | null;
  guidelineResearchExists?: boolean;
};

type SearchComplianceFileOptions = {
  crawlHealthJsonPath?: string;
  coverageJsonPath?: string;
  trafficJsonPath?: string;
  proofWindowJsonPath?: string;
  authorityJsonPath?: string;
  experimentLadderJsonPath?: string;
  urlInspectionSweepJsonPath?: string;
  guidelineResearchPath?: string;
};

type SearchComplianceWriteOptions = {
  markdownOutputPath?: string;
  jsonOutputPath?: string;
};

const SOURCE_SET = [
  { label: 'Google Search Essentials', url: 'https://developers.google.com/search/docs/essentials' },
  {
    label: 'Google helpful, reliable, people-first content',
    url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
  },
  {
    label: 'Google SEO Starter Guide',
    url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide',
  },
  {
    label: 'Google canonicalization',
    url: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  },
  { label: 'Google redirects', url: 'https://developers.google.com/search/docs/crawling-indexing/301-redirects' },
  { label: 'Bing Webmaster Guidelines', url: 'https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a' },
  { label: 'IndexNow', url: 'https://www.indexnow.org/index.html' },
  { label: 'Yandex IndexNow', url: 'https://yandex.com/support/webmaster/en/indexing-options/index-now' },
];

function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function readJsonFile<T>(path: string): T | null {
  const absolutePath = toAbsolutePath(path);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function evidence(path: string, exists: boolean, summary: string): SearchComplianceEvidence {
  return { path, exists, summary };
}

function countVerdicts(items: SearchComplianceItem[]): Record<SearchComplianceVerdict, number> {
  return items.reduce<Record<SearchComplianceVerdict, number>>(
    (counts, item) => {
      counts[item.verdict] += 1;
      return counts;
    },
    { pass: 0, watch: 0, block: 0, unavailable: 0 },
  );
}

function overallFromCounts(counts: Record<SearchComplianceVerdict, number>): SearchComplianceVerdict {
  if (counts.block > 0) return 'block';
  if (counts.unavailable > 0) return 'unavailable';
  if (counts.watch > 0) return 'watch';
  return 'pass';
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'unknown';
}

function topCoverageCluster(coverage: CoverageDrilldownJson | null | undefined): string {
  const top = coverage?.clusterPriorities?.[0];
  if (!top?.cluster) return 'unknown';
  return `${top.cluster} (${formatNumber(top.estimatedAffected)} estimated affected)`;
}

function statusFromStringOrObject(value: string | { status?: string } | null | undefined): string {
  if (!value) return 'missing';
  if (typeof value === 'string') return value;
  return value.status || 'missing';
}

function authorityCount(
  authority: AuthorityUpliftJson | null | undefined,
  key: 'promote' | 'hold' | 'stop',
): number | undefined {
  return authority?.counts?.[key] ?? authority?.summary?.[key];
}

/** Compute freshness of URL Inspection sweep. Returns {fresh, ageDays, sampled} */
function computeSweepFreshness(sweep: UrlInspectionSweepJson | null | undefined): {
  fresh: boolean;
  ageDays: number | null;
  sampled: number;
} {
  if (!sweep?.generatedAt) return { fresh: false, ageDays: null, sampled: 0 };
  const sampled = sweep.totalSampled ?? 0;
  if (sampled < 10) return { fresh: false, ageDays: null, sampled };
  const generatedAt = new Date(sweep.generatedAt);
  const ageMs = Date.now() - generatedAt.getTime();
  if (!Number.isFinite(ageMs)) return { fresh: false, ageDays: null, sampled };
  const ageDays = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
  return { fresh: ageDays <= 7, ageDays, sampled };
}

function buildItems(input: SearchComplianceInputs): SearchComplianceItem[] {
  const crawl = input.crawlHealth;
  const coverage = input.coverage;
  const traffic = input.traffic;
  const proof = input.proofWindow;
  const authority = input.authority;
  const experiment = input.experimentLadder;
  const sweep = input.urlInspectionSweep;

  const sitemapFetchErrors = crawl?.sitemapErrors?.length ?? null;
  const checkedUrls = crawl?.totals?.pageUrlsChecked ?? null;
  const status2xx = crawl?.statusSummary?.status2xx ?? null;
  const status4xx = crawl?.statusSummary?.status4xx ?? null;
  const status5xx = crawl?.statusSummary?.status5xx ?? null;
  const crawlClear =
    checkedUrls !== null &&
    checkedUrls > 0 &&
    status2xx === checkedUrls &&
    (status4xx ?? 0) === 0 &&
    (status5xx ?? 0) === 0 &&
    sitemapFetchErrors === 0;

  const coverageFreshness = coverage?.sourceFreshnessStatus || 'missing';
  const coverageDrilldownFresh = coverageFreshness === 'fresh' || coverageFreshness === 'warning';
  const sweepFreshness = computeSweepFreshness(sweep);
  const coverageFresh = coverageDrilldownFresh || sweepFreshness.fresh;
  const coverageFreshSource = coverageDrilldownFresh ? 'drilldown-export' : sweepFreshness.fresh ? 'inspection-sweep' : 'none';
  const proofTrust = proof?.trustVerdict || 'missing';
  const trafficClear = traffic?.status === 'clear' && traffic?.sourceMode === 'live-api';
  const expansionBoundaryStatus = statusFromStringOrObject(authority?.expansionBoundary);
  const automationPolicyStatus = statusFromStringOrObject(experiment?.automationPolicy);
  const promoteCount = authorityCount(authority, 'promote') ?? 0;
  const holdCount = authorityCount(authority, 'hold');
  const stopCount = authorityCount(authority, 'stop');
  const promotionOpen = promoteCount > 0 && expansionBoundaryStatus !== 'closed';
  const automationOpen =
    (experiment?.summary?.limitedRollout ?? 0) > 0 ||
    (experiment?.summary?.automationCandidate ?? 0) > 0 ||
    automationPolicyStatus !== 'locked';

  return [
    {
      id: 'crawl-index-eligibility',
      category: 'Crawl and Index Eligibility',
      requirement:
        'Sitemaps, crawlable links, live responses, and on-page index signals should expose canonical pages without fetch or status-code noise.',
      primarySources: ['Google Search Essentials', 'Google SEO Starter Guide', 'Bing Webmaster Guidelines'],
      projectEvidence: [
        evidence(
          DEFAULT_CRAWL_HEALTH_JSON_PATH,
          Boolean(crawl),
          crawl
            ? `${formatNumber(crawl.totals?.sitemapFilesDiscovered)} sitemap files, ${formatNumber(crawl.totals?.pageUrlsDiscovered)} discovered URLs, ${formatNumber(checkedUrls)} checked, ${formatNumber(status2xx)} 2xx, ${formatNumber(status4xx)} 4xx, ${formatNumber(status5xx)} 5xx, ${formatNumber(sitemapFetchErrors)} sitemap fetch errors`
            : 'latest crawl-health report missing',
        ),
      ],
      verdict: crawlClear ? 'pass' : 'block',
      rationale: crawlClear
        ? 'The sampled production crawl lane is technically clean.'
        : 'Crawl/index eligibility cannot be considered clean without a complete 2xx sampled crawl and zero sitemap fetch errors.',
      nextAction: crawlClear
        ? 'Keep production crawl health in the daily verification lane.'
        : 'Regenerate crawl health and fix sitemap or response-status regressions before claiming recovery.',
    },
    {
      id: 'coverage-freshness-before-claims',
      category: 'Measurement Freshness',
      requirement:
        'Coverage Drilldown or URL Inspection sweep evidence must be fresh enough before cluster-level attribution, promotion, or rollout claims depend on it.',
      primarySources: ['Google Search Essentials', 'Bing Webmaster Guidelines'],
      projectEvidence: [
        evidence(
          DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
          Boolean(coverage),
          coverage
            ? `freshness=${coverageFreshness}, sourceDate=${coverage.sourceFreshnessDate || 'missing'}, age=${formatNumber(coverage.sourceFreshnessDays)} day(s), hardSla=${formatNumber(coverage.sourceMaxWindowDays)} day(s), topCluster=${topCoverageCluster(coverage)}`
            : 'latest Coverage Drilldown report missing',
        ),
        evidence(
          DEFAULT_URL_INSPECTION_SWEEP_JSON_PATH,
          Boolean(sweep),
          sweep
            ? `mode=${sweep.sourceMode || 'unknown'}, sampled=${sweepFreshness.sampled}, age=${formatNumber(sweepFreshness.ageDays)} day(s), fresh=${sweepFreshness.fresh}, passRate=${sweep.overallPassRate != null ? (sweep.overallPassRate * 100).toFixed(1) + '%' : 'n/a'}`
            : 'URL Inspection sweep report missing',
        ),
      ],
      verdict: coverageFresh ? 'pass' : 'block',
      rationale: coverageFresh
        ? `Coverage freshness confirmed via ${coverageFreshSource}.`
        : 'Coverage evidence is stale or missing from both drilldown export and URL Inspection sweep, so cluster-level recovery attribution remains blocked.',
      nextAction: coverageFresh
        ? 'Continue daily sweep runs to maintain freshness; the automated pipeline closes REC-24.'
        : 'Run `npm run report:seo:coverage-sweep:p0` to generate a fresh URL Inspection sweep, or import a fresh Coverage Drilldown export and rerun `npm run report:seo:coverage-drilldown`.',
    },
    {
      id: 'canonical-redirect-signal-consistency',
      category: 'Canonicalization and Redirects',
      requirement:
        'Redirects, canonical URLs, sitemap URLs, middleware behavior, and sampled live responses should point to the same preferred URL.',
      primarySources: ['Google canonicalization', 'Google redirects', 'Bing Webmaster Guidelines'],
      projectEvidence: [
        evidence(
          DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH,
          Boolean(coverage),
          coverage
            ? `issueCount=${formatNumber(coverage.issueCount)}, affectedPages=${formatNumber(coverage.totalAffectedPages)}, topCluster=${topCoverageCluster(coverage)}`
            : 'Coverage clusters unavailable',
        ),
        evidence(
          DEFAULT_CRAWL_HEALTH_JSON_PATH,
          Boolean(crawl),
          crawl
            ? `crawl redirects=${formatNumber((crawl as { redirects?: unknown[] }).redirects?.length)}`
            : 'crawl redirects unavailable',
        ),
      ],
      verdict: coverageFreshness === 'blocking' ? 'block' : 'watch',
      rationale:
        coverageFreshness === 'blocking'
          ? 'Canonical and redirect proof cannot be closed while the newest Coverage export is outside the hard freshness SLA.'
          : 'Canonical and redirect proof can proceed, but Phase 65 must verify the P0 URL classes before this becomes pass.',
      nextAction:
        'Execute Phase 65 P0 URL recovery batches and verify trailing-slash, query-parameter, repeated-segment, source-file, and deep-skill-path classes against fresh Coverage.',
    },
    {
      id: 'people-first-public-copy',
      category: 'Content Quality and Trust',
      requirement:
        'Public surfaces should remain helpful and user-facing, with no internal planning language, unverifiable recovery claims, or search-engine-first copy.',
      primarySources: ['Google helpful, reliable, people-first content', 'Bing Webmaster Guidelines'],
      projectEvidence: [
        evidence(
          DEFAULT_CRAWL_HEALTH_JSON_PATH,
          Boolean(crawl),
          crawl
            ? `${formatNumber(crawl.onPageSeoErrors?.length)} sampled on-page SEO/copy errors, ${formatNumber(crawl.duplicates?.length)} duplicate sampled URLs`
            : 'crawl on-page evidence missing',
        ),
        evidence(
          DEFAULT_GUIDELINES_RESEARCH_PATH,
          Boolean(input.guidelineResearchExists),
          'v1.9 official-guidance research notes',
        ),
      ],
      verdict: crawl?.onPageSeoErrors?.length === 0 ? 'pass' : 'block',
      rationale:
        crawl?.onPageSeoErrors?.length === 0
          ? 'The latest sampled crawl did not find the known internal-copy leak families or on-page SEO errors.'
          : 'Public page copy and on-page SEO signals still need cleanup before trust can be treated as closed.',
      nextAction:
        'Keep the public copy-boundary guardrail active and review Phase 66 title/snippet changes for usefulness rather than ranking language.',
    },
    {
      id: 'ctr-search-appearance',
      category: 'CTR and Search Appearance',
      requirement:
        'Title, description, heading, internal-link, and structured-data changes should target real page/query opportunities and remain accurate to visible content.',
      primarySources: [
        'Google SEO Starter Guide',
        'Google helpful, reliable, people-first content',
        'Bing Webmaster Guidelines',
      ],
      projectEvidence: [
        evidence(
          DEFAULT_TRAFFIC_JSON_PATH,
          Boolean(traffic),
          traffic
            ? `traffic=${traffic.status || 'missing'}, source=${traffic.sourceMode || 'missing'}, period=${traffic.currentPeriod?.start || '?'} -> ${traffic.currentPeriod?.end || '?'}, queryRows=${formatNumber(traffic.queryRows)}, pageRows=${formatNumber(traffic.pageRows)}, priorityQueries=${formatNumber(traffic.priorityQueryOpportunities)}, priorityPages=${formatNumber(traffic.priorityPageOpportunities)}, queryPrecisionRisks=${formatNumber(traffic.queryPrecisionRisks)}`
            : 'GSC CTR report missing',
        ),
      ],
      verdict: trafficClear ? 'watch' : 'block',
      rationale: trafficClear
        ? 'Live GSC data is available, but the opportunity counts do not yet justify broad metadata rewrites.'
        : 'CTR work cannot be evidence-led without live GSC page and query data.',
      nextAction:
        'Use Phase 66 to select only priority surfaces from GSC and authority evidence; avoid broad title churn or recovery-claim copy.',
    },
    {
      id: 'structured-data-validity',
      category: 'Structured Data',
      requirement:
        'Structured data should be valid, visible-content-aligned, and present only where it describes the page truthfully.',
      primarySources: ['Google Search Essentials', 'Google SEO Starter Guide', 'Bing Webmaster Guidelines'],
      projectEvidence: [
        evidence(
          DEFAULT_CRAWL_HEALTH_JSON_PATH,
          Boolean(crawl),
          crawl
            ? `${formatNumber(crawl.onPageSeoErrors?.length)} sampled on-page SEO errors`
            : 'structured-data crawl sample missing',
        ),
      ],
      verdict: crawl?.onPageSeoErrors?.length === 0 ? 'watch' : 'block',
      rationale:
        crawl?.onPageSeoErrors?.length === 0
          ? 'The sampled crawl did not flag structured-data/on-page SEO errors, but Phase 66 should validate priority surfaces before edits.'
          : 'Structured-data or on-page SEO errors exist in the sampled crawl.',
      nextAction: 'Validate structured data on the Phase 66 priority surfaces before adding or changing schema markup.',
    },
    {
      id: 'ai-search-and-indexnow-evidence',
      category: 'AI Search and URL Submission',
      requirement:
        'AI-search visibility and URL submission evidence should be captured when available, but unavailable data must stay explicit and must not become synthetic proof.',
      primarySources: ['Bing Webmaster Guidelines', 'IndexNow', 'Yandex IndexNow'],
      projectEvidence: [
        evidence(
          DEFAULT_AUTHORITY_UPLIFT_JSON_PATH,
          Boolean(authority),
          authority
            ? `expansion=${expansionBoundaryStatus}, promote=${formatNumber(promoteCount)}, hold=${formatNumber(holdCount)}, stop=${formatNumber(stopCount)}`
            : 'authority uplift scorecard missing',
        ),
        evidence(
          DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH,
          Boolean(experiment),
          experiment
            ? `automation=${automationPolicyStatus}, limitedRollout=${formatNumber(experiment.summary?.limitedRollout)}, automationCandidate=${formatNumber(experiment.summary?.automationCandidate)}`
            : 'experiment ladder missing',
        ),
      ],
      verdict: promotionOpen || automationOpen ? 'watch' : 'unavailable',
      rationale:
        promotionOpen || automationOpen
          ? 'Some promotion or rollout surface is open enough to inspect AI-search visibility evidence.'
          : 'No authority surface is promote-ready and no automation candidate exists; Bing AI Performance or IndexNow evidence may still be unavailable.',
      nextAction:
        'In Phase 66, capture Bing AI Performance / IndexNow evidence if verified access exists; otherwise record an unavailable-data state.',
    },
    {
      id: 'proof-before-expansion',
      category: 'Promotion and Automation Gates',
      requirement:
        'Recovery, discovery expansion, and automation decisions must wait for trustworthy proof across crawl, Coverage, GSC demand, authority, and experiment gates.',
      primarySources: ['Google Search Essentials', 'Bing Webmaster Guidelines'],
      projectEvidence: [
        evidence(
          DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH,
          Boolean(proof),
          proof
            ? `trust=${proofTrust}, technical=${proof.sourceSummary?.technicalRecoveryStatus || 'missing'}, business=${proof.sourceSummary?.businessRecoveryStatus || 'missing'}, coverage=${proof.sourceSummary?.coverageFreshnessStatus || 'missing'}, blockers=${formatNumber(proof.blockers?.length)}`
            : 'proof-window report missing',
        ),
      ],
      verdict: proofTrust === 'ready' ? 'pass' : 'block',
      rationale:
        proofTrust === 'ready'
          ? 'The proof window reports ready status.'
          : 'The latest proof window is not trustworthy enough to reopen expansion or automation.',
      nextAction:
        proof?.nextActions?.[0] ||
        'Generate a post-intervention proof window only after fresh Coverage and P0 manual recovery work have landed.',
    },
  ];
}

export function buildSearchComplianceMatrixReport(input: SearchComplianceInputs = {}): SearchComplianceMatrixReport {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const items = buildItems(input);
  const counts = countVerdicts(items);
  const overallVerdict = overallFromCounts(counts);
  const blockers = items.filter((item) => item.verdict === 'block').map((item) => `${item.id}: ${item.rationale}`);
  const nextActions = Array.from(
    new Set(items.filter((item) => item.verdict !== 'pass').map((item) => item.nextAction)),
  );

  return {
    generatedAt,
    overallVerdict,
    headline:
      overallVerdict === 'pass'
        ? 'Search compliance matrix is clear; recovery work can move to proof-gated expansion review.'
        : `Search compliance matrix is ${overallVerdict}; ${counts.block} blocking lane(s), ${counts.watch} watch lane(s), and ${counts.unavailable} unavailable lane(s) remain.`,
    counts,
    sourceSet: SOURCE_SET,
    items,
    blockers,
    nextActions,
  };
}

export function buildSearchComplianceMatrixReportFromFiles(
  options: SearchComplianceFileOptions = {},
): SearchComplianceMatrixReport {
  const guidelineResearchPath = options.guidelineResearchPath || DEFAULT_GUIDELINES_RESEARCH_PATH;
  return buildSearchComplianceMatrixReport({
    crawlHealth: readJsonFile<CrawlHealthJson>(options.crawlHealthJsonPath || DEFAULT_CRAWL_HEALTH_JSON_PATH),
    coverage: readJsonFile<CoverageDrilldownJson>(options.coverageJsonPath || DEFAULT_COVERAGE_DRILLDOWN_JSON_PATH),
    traffic: readJsonFile<TrafficJson>(options.trafficJsonPath || DEFAULT_TRAFFIC_JSON_PATH),
    proofWindow: readJsonFile<RecoveryProofJson>(
      options.proofWindowJsonPath || DEFAULT_RECOVERY_PROOF_WINDOW_JSON_PATH,
    ),
    authority: readJsonFile<AuthorityUpliftJson>(options.authorityJsonPath || DEFAULT_AUTHORITY_UPLIFT_JSON_PATH),
    experimentLadder: readJsonFile<ExperimentLadderJson>(
      options.experimentLadderJsonPath || DEFAULT_RECOVERY_EXPERIMENT_LADDER_JSON_PATH,
    ),
    urlInspectionSweep: readJsonFile<UrlInspectionSweepJson>(
      options.urlInspectionSweepJsonPath || DEFAULT_URL_INSPECTION_SWEEP_JSON_PATH,
    ),
    guidelineResearchExists: existsSync(toAbsolutePath(guidelineResearchPath)),
  });
}

export function renderSearchComplianceMatrixReport(report: SearchComplianceMatrixReport): string {
  const lines: string[] = [];
  lines.push('# Search Compliance Matrix');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Overall verdict: ${report.overallVerdict}`);
  lines.push(`- Headline: ${report.headline}`);
  lines.push(
    `- Counts: pass=${report.counts.pass}, watch=${report.counts.watch}, block=${report.counts.block}, unavailable=${report.counts.unavailable}`,
  );
  lines.push('');
  lines.push('## Official Source Set');
  lines.push('');
  for (const source of report.sourceSet) {
    lines.push(`- [${source.label}](${source.url})`);
  }
  lines.push('');
  lines.push('## Matrix');
  lines.push('');
  lines.push('| ID | Category | Verdict | Requirement | Evidence | Next Action |');
  lines.push('|---|---|---|---|---|---|');
  for (const item of report.items) {
    const evidenceSummary = item.projectEvidence
      .map((entry) => `${entry.exists ? 'yes' : 'no'} ${entry.path}: ${entry.summary}`)
      .join('<br>');
    lines.push(
      `| ${item.id} | ${item.category} | ${item.verdict} | ${item.requirement} | ${evidenceSummary} | ${item.nextAction} |`,
    );
  }
  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  if (report.blockers.length === 0) {
    lines.push('- none');
  } else {
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`);
    }
  }
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  if (report.nextActions.length === 0) {
    lines.push('- none');
  } else {
    for (const action of report.nextActions) {
      lines.push(`- ${action}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function writeSearchComplianceMatrixArtifacts(
  report: SearchComplianceMatrixReport,
  options: SearchComplianceWriteOptions = {},
): SearchComplianceMatrixReport {
  const markdownPath = options.markdownOutputPath || DEFAULT_SEARCH_COMPLIANCE_MATRIX_MD_PATH;
  const jsonPath = options.jsonOutputPath || DEFAULT_SEARCH_COMPLIANCE_MATRIX_JSON_PATH;

  mkdirSync(dirname(toAbsolutePath(markdownPath)), { recursive: true });
  writeFileSync(toAbsolutePath(markdownPath), renderSearchComplianceMatrixReport(report), 'utf8');
  writeFileSync(toAbsolutePath(jsonPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report;
}
