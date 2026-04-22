#!/usr/bin/env npx tsx

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../src/i18n';
import { buildLocalizedSkillPath, normalizeSitemapSkillEntry } from '../src/lib/skill-route-paths';
import { compileSitemapBlocklist, isSitemapSkillBlocked } from '../src/lib/sitemap-blocklist';

type RemediationAction = {
  url?: string;
  action?: 'redirect_301' | 'gone_410' | 'manual_review' | 'observe';
  reason?: string;
  targetUrl?: string;
  coveredByMiddleware?: boolean;
};

type RemediationPlan = {
  generatedAt?: string;
  issueName?: string;
  actions?: RemediationAction[];
};

type MissingClusterAuditCandidateSignal = {
  canonicalUrl?: string | null;
  routeBucket?: string | null;
};

type MissingClusterAuditRow = {
  url?: string;
  decision?: 'restore' | 'redirect' | 'keep410' | 'manual_review';
  redirectCoveredByMiddleware?: boolean;
  canonicalUrl?: string | null;
  candidateSignals?: MissingClusterAuditCandidateSignal[];
};

type MissingClusterAuditReport = {
  rows?: MissingClusterAuditRow[];
};

type RedirectRule = {
  fromPath: string;
  toPath: string;
  reason: string;
};

type GoneRule = {
  path: string;
  reason: string;
};

type Seo404RulesFile = {
  generatedAt: string;
  sourceReport: string;
  sourceGeneratedAt: string | null;
  sourceIssueName: string | null;
  stats: {
    redirect301: number;
    gone410: number;
    ignored: number;
    redirect301CandidateTotal: number;
    redirect301CoveredByMiddleware: number;
    redirect301Materialized: number;
    gone410CandidateTotal: number;
    gone410CoveredByMiddleware: number;
    gone410Materialized: number;
    manualReviewCandidateTotal: number;
    observeCandidateTotal: number;
    skippedInvalidOrProtected: number;
  };
  rules: {
    redirect301: RedirectRule[];
    gone410: GoneRule[];
  };
};

const CANONICAL_HOST = 'killer-skills.com';
const REPORT_RELATIVE_PATH = 'reports/seo/latest-404-remediation-plan.json';
const MISSING_CLUSTER_AUDIT_RELATIVE_PATH = 'reports/seo/latest-404-missing-cluster-audit.json';
const SITEMAP_SKILLS_RELATIVE_PATH = 'data/sitemap-skills.json';
const SITEMAP_BLOCKLIST_RELATIVE_PATH = 'data/seo-sitemap-blocklist.json';
const OUTPUT_RELATIVE_PATH = 'data/seo-404-rules.json';
const reportPath = resolve(process.cwd(), REPORT_RELATIVE_PATH);
const missingClusterAuditPath = resolve(process.cwd(), MISSING_CLUSTER_AUDIT_RELATIVE_PATH);
const sitemapSkillsPath = resolve(process.cwd(), SITEMAP_SKILLS_RELATIVE_PATH);
const sitemapBlocklistPath = resolve(process.cwd(), SITEMAP_BLOCKLIST_RELATIVE_PATH);
const outputPath = resolve(process.cwd(), OUTPUT_RELATIVE_PATH);

function toCanonicalPath(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== CANONICAL_HOST) return null;
    if (parsed.search || parsed.hash) return null;
    return parsed.pathname || null;
  } catch {
    return null;
  }
}

function buildSitemapPathSet(): Set<string> {
  if (!existsSync(sitemapSkillsPath)) return new Set<string>();
  const raw = JSON.parse(readFileSync(sitemapSkillsPath, 'utf8')) as unknown;
  const records = Array.isArray(raw) ? raw : ((raw as { skills?: unknown[] })?.skills ?? []);
  const blocklistRaw = existsSync(sitemapBlocklistPath) ? JSON.parse(readFileSync(sitemapBlocklistPath, 'utf8')) : null;
  const blocklist = compileSitemapBlocklist(blocklistRaw);
  const paths = new Set<string>();

  for (const record of records) {
    const normalized = normalizeSitemapSkillEntry(record as Record<string, unknown>);
    if (!normalized) continue;
    if (isSitemapSkillBlocked(normalized.owner, normalized.routePath, blocklist)) continue;
    for (const locale of SUPPORTED_LOCALES) {
      paths.add(buildLocalizedSkillPath(locale, normalized.owner, normalized.routePath));
    }
  }

  return paths;
}

function pickMissingClusterRedirectTarget(row: MissingClusterAuditRow): string | null {
  const direct = typeof row.canonicalUrl === 'string' ? row.canonicalUrl : '';
  if (direct.trim()) return direct.trim();

  const candidate = (row.candidateSignals || []).find(
    (signal) => signal?.routeBucket === 'keep' && typeof signal?.canonicalUrl === 'string' && signal.canonicalUrl.trim(),
  );
  return typeof candidate?.canonicalUrl === 'string' ? candidate.canonicalUrl.trim() : null;
}

function main() {
  if (!existsSync(reportPath)) {
    console.error(`Missing report: ${reportPath}`);
    process.exit(1);
  }

  const plan = JSON.parse(readFileSync(reportPath, 'utf8')) as RemediationPlan;
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const sitemapPaths = buildSitemapPathSet();
  const missingClusterAudit = existsSync(missingClusterAuditPath)
    ? (JSON.parse(readFileSync(missingClusterAuditPath, 'utf8')) as MissingClusterAuditReport)
    : null;
  const missingClusterRows = Array.isArray(missingClusterAudit?.rows) ? missingClusterAudit.rows : [];
  const missingClusterOverrideMap = new Map<string, MissingClusterAuditRow>();

  for (const row of missingClusterRows) {
    const sourceUrl = typeof row.url === 'string' ? row.url : '';
    const sourcePath = toCanonicalPath(sourceUrl);
    if (!sourcePath) continue;
    missingClusterOverrideMap.set(sourcePath, row);
  }

  const redirectMap = new Map<string, RedirectRule>();
  const goneMap = new Map<string, GoneRule>();
  let redirect301CandidateTotal = 0;
  let redirect301CoveredByMiddleware = 0;
  let gone410CandidateTotal = 0;
  let gone410CoveredByMiddleware = 0;
  let manualReviewCandidateTotal = 0;
  let observeCandidateTotal = 0;
  let skippedInvalidOrProtected = 0;

  for (const action of actions) {
    const sourceUrl = typeof action.url === 'string' ? action.url : '';
    if (!sourceUrl) {
      skippedInvalidOrProtected++;
      continue;
    }

    const sourcePath = toCanonicalPath(sourceUrl);
    const missingClusterOverride = sourcePath ? missingClusterOverrideMap.get(sourcePath) : null;

    if (action.action === 'redirect_301') {
      redirect301CandidateTotal++;
      if (action.coveredByMiddleware !== false) {
        redirect301CoveredByMiddleware++;
        continue;
      }

      const targetUrl = typeof action.targetUrl === 'string' ? action.targetUrl : '';
      const fromPath = toCanonicalPath(sourceUrl);
      const toPath = toCanonicalPath(targetUrl);

      if (!fromPath || !toPath || fromPath === toPath) {
        skippedInvalidOrProtected++;
        continue;
      }
      if (sitemapPaths.has(fromPath)) {
        skippedInvalidOrProtected++;
        continue;
      }

      redirectMap.set(fromPath, {
        fromPath,
        toPath,
        reason: action.reason || 'report_uncovered_redirect',
      });
      continue;
    }

    if (action.action === 'gone_410') {
      gone410CandidateTotal++;
      if (missingClusterOverride?.decision === 'redirect' || missingClusterOverride?.decision === 'restore') {
        continue;
      }
      if (action.coveredByMiddleware !== false) {
        gone410CoveredByMiddleware++;
        continue;
      }

      const path = sourcePath;
      if (!path || sitemapPaths.has(path)) {
        skippedInvalidOrProtected++;
        continue;
      }

      goneMap.set(path, {
        path,
        reason: action.reason || 'report_uncovered_trap',
      });
      continue;
    }

    if (action.action === 'manual_review') {
      manualReviewCandidateTotal++;
      continue;
    }

    if (action.action === 'observe') {
      observeCandidateTotal++;
      continue;
    }

    skippedInvalidOrProtected++;
  }

  for (const row of missingClusterRows) {
    if (row.decision !== 'redirect') continue;

    const fromPath = toCanonicalPath(typeof row.url === 'string' ? row.url : '');
    if (!fromPath || sitemapPaths.has(fromPath)) continue;

    redirect301CandidateTotal++;

    if (row.redirectCoveredByMiddleware) {
      redirect301CoveredByMiddleware++;
      goneMap.delete(fromPath);
      continue;
    }

    const toPath = toCanonicalPath(pickMissingClusterRedirectTarget(row) || '');
    if (!toPath || fromPath === toPath) {
      skippedInvalidOrProtected++;
      continue;
    }

    goneMap.delete(fromPath);
    redirectMap.set(fromPath, {
      fromPath,
      toPath,
      reason: 'missing_cluster_redirect_override',
    });
  }

  const output: Seo404RulesFile = {
    generatedAt: new Date().toISOString(),
    sourceReport: REPORT_RELATIVE_PATH,
    sourceGeneratedAt: plan.generatedAt || null,
    sourceIssueName: plan.issueName || null,
    stats: {
      redirect301: redirectMap.size,
      gone410: goneMap.size,
      ignored: manualReviewCandidateTotal + observeCandidateTotal + skippedInvalidOrProtected,
      redirect301CandidateTotal,
      redirect301CoveredByMiddleware,
      redirect301Materialized: redirectMap.size,
      gone410CandidateTotal,
      gone410CoveredByMiddleware,
      gone410Materialized: goneMap.size,
      manualReviewCandidateTotal,
      observeCandidateTotal,
      skippedInvalidOrProtected,
    },
    rules: {
      redirect301: Array.from(redirectMap.values()).sort((a, b) => a.fromPath.localeCompare(b.fromPath)),
      gone410: Array.from(goneMap.values()).sort((a, b) => a.path.localeCompare(b.path)),
    },
  };

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Wrote SEO 404 rules: ${outputPath}`);
  console.log(
    [
      `rules => redirect_301(materialized): ${output.stats.redirect301Materialized}`,
      `redirect_301(middleware): ${output.stats.redirect301CoveredByMiddleware}`,
      `gone_410(materialized): ${output.stats.gone410Materialized}`,
      `gone_410(middleware): ${output.stats.gone410CoveredByMiddleware}`,
      `manual_review: ${output.stats.manualReviewCandidateTotal}`,
      `observe: ${output.stats.observeCandidateTotal}`,
      `skipped: ${output.stats.skippedInvalidOrProtected}`,
    ].join(', '),
  );
}

main();
