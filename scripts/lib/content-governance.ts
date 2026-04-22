import type { SeoCollectionDriftReport } from './seo-collection-drift';
import type { SeoCollectionLocaleGapReport } from './seo-collection-locale-gaps';

export const DEFAULT_CONTENT_GOVERNANCE_MD_PATH = 'reports/seo/latest-content-governance.md';
export const DEFAULT_CONTENT_GOVERNANCE_JSON_PATH = 'reports/seo/latest-content-governance.json';

export type ContentGovernanceSeverity = 'clear' | 'warning' | 'blocking';
export type ContentGovernanceThreshold = ContentGovernanceSeverity | 'none';

export type ContentGovernanceRouteContracts = {
  command: string;
  passed: boolean;
  exitCode: number;
  summary: string;
  details?: string | null;
};

export type ContentGovernanceCheck = {
  code: 'collection_locale_gaps' | 'collection_drift' | 'public_route_contracts';
  title: string;
  severity: ContentGovernanceSeverity;
  blocking: boolean;
  summary: string;
  stats: Record<string, number | string | boolean | null>;
};

export type ContentGovernanceReport = {
  generatedAt: string;
  severity: ContentGovernanceSeverity;
  gate: {
    failOnSeverity: ContentGovernanceThreshold;
    blocking: boolean;
    triggeredChecks: string[];
  };
  localeGaps: SeoCollectionLocaleGapReport;
  collectionDrift: SeoCollectionDriftReport;
  routeContracts: ContentGovernanceRouteContracts;
  checks: ContentGovernanceCheck[];
};

function severityRank(severity: ContentGovernanceSeverity | 'none'): number {
  switch (severity) {
    case 'blocking':
      return 3;
    case 'warning':
      return 2;
    case 'clear':
      return 1;
    default:
      return 0;
  }
}

function maxSeverity(values: ContentGovernanceSeverity[]): ContentGovernanceSeverity {
  return values.reduce<ContentGovernanceSeverity>((current, candidate) => {
    return severityRank(candidate) > severityRank(current) ? candidate : current;
  }, 'clear');
}

export function parseContentGovernanceThreshold(raw: string | undefined | null): ContentGovernanceThreshold {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized || normalized === 'none' || normalized === 'off') return 'none';
  if (normalized === 'warning' || normalized === 'blocking') return normalized;
  throw new Error(`Invalid content governance threshold "${raw}". Use warning, blocking, or none.`);
}

export function buildContentGovernanceReport(options: {
  generatedAt?: string;
  failOnSeverity?: ContentGovernanceThreshold;
  localeGaps: SeoCollectionLocaleGapReport;
  collectionDrift: SeoCollectionDriftReport;
  routeContracts: ContentGovernanceRouteContracts;
}): ContentGovernanceReport {
  const generatedAt = options.generatedAt || new Date().toISOString();

  const checks: ContentGovernanceCheck[] = [
    {
      code: 'collection_locale_gaps',
      title: 'Collection locale coverage',
      severity: options.localeGaps.collectionsWithGaps > 0 ? 'warning' : 'clear',
      blocking: false,
      summary:
        options.localeGaps.collectionsWithGaps > 0
          ? `${options.localeGaps.collectionsWithGaps} collection(s) are missing one or more supported locales`
          : 'All collections have full supported-locale coverage',
      stats: {
        totalCollections: options.localeGaps.totalCollections,
        collectionsWithGaps: options.localeGaps.collectionsWithGaps,
        fullCoverageCollections: options.localeGaps.fullCoverageCollections,
      },
    },
    {
      code: 'collection_drift',
      title: 'Collection metadata / canonical drift',
      severity: options.collectionDrift.totalIssues > 0 ? 'warning' : 'clear',
      blocking: false,
      summary:
        options.collectionDrift.totalIssues > 0
          ? `${options.collectionDrift.totalIssues} collection drift issue(s) detected`
          : 'No collection drift issues detected',
      stats: {
        totalCollections: options.collectionDrift.totalCollections,
        totalIssues: options.collectionDrift.totalIssues,
      },
    },
    {
      code: 'public_route_contracts',
      title: 'Representative localized public-route contracts',
      severity: options.routeContracts.passed ? 'clear' : 'blocking',
      blocking: true,
      summary: options.routeContracts.summary,
      stats: {
        passed: options.routeContracts.passed,
        exitCode: options.routeContracts.exitCode,
      },
    },
  ];

  const severity = maxSeverity(checks.map((check) => check.severity));
  const failOnSeverity = options.failOnSeverity || 'none';
  const triggeredChecks =
    failOnSeverity === 'none'
      ? []
      : checks.filter((check) => severityRank(check.severity) >= severityRank(failOnSeverity)).map((check) => check.code);

  return {
    generatedAt,
    severity,
    gate: {
      failOnSeverity,
      blocking: triggeredChecks.length > 0,
      triggeredChecks,
    },
    localeGaps: options.localeGaps,
    collectionDrift: options.collectionDrift,
    routeContracts: options.routeContracts,
    checks,
  };
}

export function renderContentGovernanceReport(report: ContentGovernanceReport): string {
  const lines = [
    '# Content Governance Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Current severity: ${report.severity}`,
    `- Blocking at threshold: ${report.gate.blocking ? 'yes' : 'no'} (${report.gate.failOnSeverity})`,
    '',
    '## Checks',
    '',
  ];

  for (const check of report.checks) {
    lines.push(`### ${check.title}`);
    lines.push(`- Code: ${check.code}`);
    lines.push(`- Severity: ${check.severity}`);
    lines.push(`- Summary: ${check.summary}`);
    for (const [key, value] of Object.entries(check.stats)) {
      lines.push(`- ${key}: ${value}`);
    }
    lines.push('');
  }

  if (report.routeContracts.details) {
    lines.push('## Route Contract Details');
    lines.push('');
    lines.push('```text');
    lines.push(report.routeContracts.details.trim());
    lines.push('```');
  }

  return lines.join('\n');
}
