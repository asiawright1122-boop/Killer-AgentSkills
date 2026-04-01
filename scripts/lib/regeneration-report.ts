/**
 * Regeneration Baseline Report Generator
 *
 * Extracted from build-skills-cache.ts — generates markdown + JSON reports
 * detailing which skills need SEO regeneration and in what order.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillCache } from './types';
import {
  type RegenerationTier,
  type OptimizationIssue,
  DEFAULT_REGEN_BATCH_SIZE,
  REGENERATION_TIER_ORDER,
  collectOptimizationIssues,
  collectContentRisks,
  getPrimaryOptimizationIssue,
  getRegenerationTier,
  getOptimizationIssuePriority,
  getTierLabel,
} from './skill-quality';

function getSkillReportKey(skill: SkillCache): string {
  if (skill.id) return skill.id;
  const ownerRepo = [skill.owner, skill.repo].filter(Boolean).join('/');
  return ownerRepo || skill.name;
}

function summarizeCountMap(entries: Array<[string, number]>, limit = 8): string {
  const preview = entries.slice(0, limit).map(([key, count]) => `${key} (${count})`);
  if (entries.length > limit) {
    preview.push(`... (+${entries.length - limit} more)`);
  }
  return preview.length > 0 ? preview.join(', ') : 'none';
}

export function writeRegenerationBaselineReport(skills: SkillCache[], options?: { batchSize?: number; outputDir?: string }): {
  markdownPath: string;
  jsonPath: string;
  queuedCount: number;
  batchCount: number;
} {
  const batchSize = Math.max(1, options?.batchSize || DEFAULT_REGEN_BATCH_SIZE);
  const outputDir = options?.outputDir || path.join(process.cwd(), 'reports', 'seo');
  fs.mkdirSync(outputDir, { recursive: true });

  const markdownPath = path.join(outputDir, 'phase-02-regeneration-baseline.md');
  const jsonPath = path.join(outputDir, 'phase-02-regeneration-baseline.json');
  const generatedAt = new Date().toISOString();

  const candidates = skills
    .map((skill) => {
      const issues = collectOptimizationIssues(skill);
      if (issues.length === 0) return null;

      const { risks: contentRisks, rawBytes } = collectContentRisks(skill);
      const primaryIssue = getPrimaryOptimizationIssue(issues);
      const tier = getRegenerationTier(issues, contentRisks);

      return {
        id: getSkillReportKey(skill),
        name: skill.name,
        owner: skill.owner,
        repo: skill.repo,
        repoPath: skill.repoPath || '',
        updatedAt: skill.updatedAt || '',
        tier,
        tierLabel: getTierLabel(tier),
        primaryIssueCode: primaryIssue.code,
        primaryIssueSummary: primaryIssue.summary,
        primaryIssueDetail: primaryIssue.detail || '',
        issueCodes: issues.map((issue) => issue.code),
        issues: issues.map((issue) => ({
          code: issue.code,
          category: issue.category,
          summary: issue.summary,
          detail: issue.detail || '',
        })),
        contentRisks: contentRisks.map((risk) => ({
          code: risk.code,
          summary: risk.summary,
          detail: risk.detail || '',
        })),
        rawBytes,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  const fullyOptimizedCount = skills.length - candidates.length;
  const issueCounts = new Map<string, number>();
  const primaryIssueCounts = new Map<string, number>();
  const contentRiskCounts = new Map<string, number>();
  const tierCounts = new Map<RegenerationTier, number>();

  for (const tier of REGENERATION_TIER_ORDER) tierCounts.set(tier, 0);

  for (const candidate of candidates) {
    primaryIssueCounts.set(candidate.primaryIssueCode, (primaryIssueCounts.get(candidate.primaryIssueCode) || 0) + 1);
    tierCounts.set(candidate.tier, (tierCounts.get(candidate.tier) || 0) + 1);
    for (const issue of candidate.issues) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) || 0) + 1);
    }
    for (const risk of candidate.contentRisks) {
      contentRiskCounts.set(risk.code, (contentRiskCounts.get(risk.code) || 0) + 1);
    }
  }

  const sortedCandidates = candidates.slice().sort((left, right) => {
    const tierDiff =
      REGENERATION_TIER_ORDER.indexOf(left.tier) - REGENERATION_TIER_ORDER.indexOf(right.tier);
    if (tierDiff !== 0) return tierDiff;

    const issueDiff =
      getOptimizationIssuePriority(left.primaryIssueCode) - getOptimizationIssuePriority(right.primaryIssueCode);
    if (issueDiff !== 0) return issueDiff;

    const ownerRepoDiff = `${left.owner}/${left.repo}`.localeCompare(`${right.owner}/${right.repo}`);
    if (ownerRepoDiff !== 0) return ownerRepoDiff;

    const repoPathDiff = left.repoPath.localeCompare(right.repoPath);
    if (repoPathDiff !== 0) return repoPathDiff;

    return left.id.localeCompare(right.id);
  });

  const batches = [];
  for (let index = 0; index < sortedCandidates.length; index += batchSize) {
    const batchItems = sortedCandidates.slice(index, index + batchSize);
    const perTier = Object.fromEntries(REGENERATION_TIER_ORDER.map((tier) => [tier, 0])) as Record<RegenerationTier, number>;
    const batchReasons = new Map<string, number>();

    for (const item of batchItems) {
      perTier[item.tier] += 1;
      batchReasons.set(item.primaryIssueCode, (batchReasons.get(item.primaryIssueCode) || 0) + 1);
    }

    batches.push({
      batch: Math.floor(index / batchSize) + 1,
      size: batchItems.length,
      firstId: batchItems[0]?.id || '',
      lastId: batchItems[batchItems.length - 1]?.id || '',
      tierCounts: perTier,
      topReasons: Array.from(batchReasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      ids: batchItems.map((item) => item.id),
    });
  }

  let driftSummary: { onlyInSitemap: number; onlyInIndexableCache: number } | null = null;
  const driftPath = path.join(outputDir, 'index-drift.json');
  if (fs.existsSync(driftPath)) {
    try {
      const drift = JSON.parse(fs.readFileSync(driftPath, 'utf-8')) as {
        counts?: { onlyInSitemap?: number; onlyInIndexableCache?: number };
      };
      driftSummary = {
        onlyInSitemap: drift.counts?.onlyInSitemap || 0,
        onlyInIndexableCache: drift.counts?.onlyInIndexableCache || 0,
      };
    } catch {
      driftSummary = null;
    }
  }

  const reportPayload = {
    generatedAt,
    batchSize,
    totals: {
      totalSkills: skills.length,
      fullyOptimized: fullyOptimizedCount,
      queuedForRegeneration: candidates.length,
    },
    driftSummary,
    primaryIssueCounts: Array.from(primaryIssueCounts.entries()).sort((a, b) => b[1] - a[1]),
    allIssueCounts: Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1]),
    contentRiskCounts: Array.from(contentRiskCounts.entries()).sort((a, b) => b[1] - a[1]),
    tierCounts: REGENERATION_TIER_ORDER.map((tier) => ({
      tier,
      label: getTierLabel(tier),
      count: tierCounts.get(tier) || 0,
    })),
    ordering: {
      sort: 'tier asc, primary issue priority asc, owner/repo asc, repoPath asc, id asc',
      publishSafeCriteria: [
        'Batch checkpoint and skipped/failure IDs recorded before any publish step',
        'Local audit:seo:index-quality re-run does not introduce worse drift, missing-body, or thin-content totals',
        'Representative title/keyword/locale samples from the batch are spot-checked before D1 publish',
      ],
    },
    batches,
    samples: {
      queued: sortedCandidates.slice(0, 15).map((item) => ({
        id: item.id,
        tier: item.tier,
        primaryIssue: item.primaryIssueCode,
      })),
      contentRisk: sortedCandidates
        .filter((item) => item.contentRisks.length > 0)
        .slice(0, 15)
        .map((item) => ({
          id: item.id,
          contentRisks: item.contentRisks.map((risk) => risk.code),
        })),
    },
    candidates: sortedCandidates,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(reportPayload, null, 2));

  const markdownLines = [
    '# Phase 02 Regeneration Baseline',
    '',
    `- Generated: ${generatedAt}`,
    `- Total skills in cache: ${skills.length}`,
    `- Fully optimized already: ${fullyOptimizedCount}`,
    `- Queued for regeneration: ${candidates.length}`,
    `- Default batch size: ${batchSize}`,
    driftSummary
      ? `- Current drift snapshot: sitemap-only ${driftSummary.onlyInSitemap}, indexable-cache-only ${driftSummary.onlyInIndexableCache}`
      : '- Current drift snapshot: unavailable (run `npm run audit:seo:index-quality` first to refresh)',
    '',
    '## Primary Regeneration Reasons',
    '',
    '| Reason | Count |',
    '|-------|------:|',
    ...Array.from(primaryIssueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `| ${code} | ${count} |`),
    '',
    '## Content Risks',
    '',
    '| Risk | Count |',
    '|------|------:|',
    ...Array.from(contentRiskCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `| ${code} | ${count} |`),
    ...(contentRiskCounts.size === 0 ? ['| none | 0 |'] : []),
    '',
    '## Execution Tiers',
    '',
    '| Tier | Count | Notes |',
    '|------|------:|-------|',
    ...REGENERATION_TIER_ORDER.map(
      (tier) => `| ${getTierLabel(tier)} | ${tierCounts.get(tier) || 0} | ${tier === 'tier_3_content_risk' ? 'Manual review or low-confidence content last' : 'Safe to batch automatically after spot checks'} |`,
    ),
    '',
    '## Batch Plan',
    '',
    '- Ordering rule: tier asc, primary issue priority asc, owner/repo asc, repoPath asc, id asc',
    '- Publish-safe batch criteria:',
    '  - checkpoint artifact updated with completed and skipped IDs',
    '  - `npm run audit:seo:index-quality` rerun after local cache update',
    '  - representative title/keyword/locale spot checks passed before D1 publish',
    '',
    '| Batch | Size | First ID | Last ID | Top reasons |',
    '|------:|-----:|----------|---------|-------------|',
    ...batches.map(
      (batch) =>
        `| ${batch.batch} | ${batch.size} | ${batch.firstId} | ${batch.lastId} | ${summarizeCountMap(batch.topReasons)} |`,
    ),
    '',
    '## Representative Samples',
    '',
    ...sortedCandidates.slice(0, 12).map((item) => `- ${item.id} — ${item.tierLabel} — ${item.primaryIssueCode}`),
    '',
    '## Output Artifacts',
    '',
    `- Markdown report: \`${path.relative(process.cwd(), markdownPath)}\``,
    `- JSON inventory and batches: \`${path.relative(process.cwd(), jsonPath)}\``,
  ];

  fs.writeFileSync(markdownPath, `${markdownLines.join('\n')}\n`);

  return {
    markdownPath,
    jsonPath,
    queuedCount: candidates.length,
    batchCount: batches.length,
  };
}
