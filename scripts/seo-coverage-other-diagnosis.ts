#!/usr/bin/env npx tsx

/**
 * Diagnostic script: cross-references `other` and `known_skill_404` cluster
 * sample URLs from the Coverage Drilldown report against the published
 * sitemap-skills.json to quantify how many are expected 404s.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DRILLDOWN_JSON_PATH = resolve(process.cwd(), 'reports/seo/latest-coverage-drilldown.json');
const SITEMAP_SKILLS_PATH = resolve(process.cwd(), 'data/sitemap-skills.json');
const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-other-diagnosis.md');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-coverage-other-diagnosis.json');

type ClusterEntry = {
  cluster: string;
  sampleCount: number;
  estimatedAffected: number;
  topSamples: string[];
};

type DrilldownReport = {
  generatedAt: string;
  clusterPriorities: ClusterEntry[];
  issueSummaries: Array<{
    issueName: string;
    topClusters: Array<{ cluster: string; sampleCount: number; estimatedAffected: number }>;
  }>;
};

type SitemapEntry = {
  owner: string;
  repo: string;
  routePath?: string;
  updatedAt?: string;
};

type DiagnosisReport = {
  generatedAt: string;
  drilldownGeneratedAt: string;
  targetClusters: string[];
  totalSamples: number;
  inSitemap: number;
  notInSitemap: number;
  inSitemapPercent: number;
  notInSitemapPercent: number;
  localeBreakdown: Record<string, { total: number; inSitemap: number; notInSitemap: number }>;
  topAbsentOwnerRepos: Array<{ ownerRepo: string; count: number }>;
  sampleUrlStatus: Array<{ url: string; cluster: string; inSitemap: boolean; locale: string; ownerRepo: string }>;
};

function parseSkillRoute(url: string): { locale: string; ownerRepo: string } | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/([a-z]{2})\/skills\/([^/]+\/[^/]+)/i);
    if (!match) return null;
    return { locale: match[1].toLowerCase(), ownerRepo: match[2] };
  } catch {
    return null;
  }
}

function buildSitemapLookup(sitemapData: SitemapEntry[]): Set<string> {
  const lookup = new Set<string>();
  for (const entry of sitemapData) {
    if (entry.owner && entry.repo) {
      lookup.add(`${entry.owner.toLowerCase()}/${entry.repo.toLowerCase()}`);
    }
  }
  return lookup;
}

function main() {
  if (!existsSync(DRILLDOWN_JSON_PATH)) {
    console.error(`Coverage drilldown report not found at ${DRILLDOWN_JSON_PATH}`);
    process.exit(1);
  }

  const drilldown: DrilldownReport = JSON.parse(readFileSync(DRILLDOWN_JSON_PATH, 'utf8'));

  // Load sitemap skills
  let sitemapLookup: Set<string>;
  if (existsSync(SITEMAP_SKILLS_PATH)) {
    const sitemapData = JSON.parse(readFileSync(SITEMAP_SKILLS_PATH, 'utf8'));
    const entries: SitemapEntry[] = Array.isArray(sitemapData)
      ? sitemapData
      : (sitemapData.skills || sitemapData.entries || []);
    sitemapLookup = buildSitemapLookup(entries);
    console.log(`Loaded ${sitemapLookup.size} sitemap skill slugs.`);
  } else {
    console.warn(`Sitemap skills not found at ${SITEMAP_SKILLS_PATH}; all URLs will be marked as not-in-sitemap.`);
    sitemapLookup = new Set<string>();
  }

  // Collect sample URLs from target clusters
  const targetClusters = ['known_skill_404', 'other'];
  const sampleUrls: Array<{ url: string; cluster: string }> = [];

  for (const cluster of drilldown.clusterPriorities) {
    if (targetClusters.includes(cluster.cluster)) {
      for (const url of cluster.topSamples || []) {
        sampleUrls.push({ url, cluster: cluster.cluster });
      }
    }
  }

  // Cross-reference
  const localeBreakdown: Record<string, { total: number; inSitemap: number; notInSitemap: number }> = {};
  const absentOwnerRepos = new Map<string, number>();
  const sampleUrlStatus: DiagnosisReport['sampleUrlStatus'] = [];
  let inSitemap = 0;
  let notInSitemap = 0;

  for (const { url, cluster } of sampleUrls) {
    const parsed = parseSkillRoute(url);
    const locale = parsed?.locale || 'unknown';
    const ownerRepo = parsed?.ownerRepo || 'unknown';
    const isInSitemap = parsed ? sitemapLookup.has(ownerRepo.toLowerCase()) : false;

    if (isInSitemap) {
      inSitemap++;
    } else {
      notInSitemap++;
      absentOwnerRepos.set(ownerRepo, (absentOwnerRepos.get(ownerRepo) || 0) + 1);
    }

    if (!localeBreakdown[locale]) {
      localeBreakdown[locale] = { total: 0, inSitemap: 0, notInSitemap: 0 };
    }
    localeBreakdown[locale].total++;
    if (isInSitemap) {
      localeBreakdown[locale].inSitemap++;
    } else {
      localeBreakdown[locale].notInSitemap++;
    }

    sampleUrlStatus.push({ url, cluster, inSitemap: isInSitemap, locale, ownerRepo });
  }

  const totalSamples = sampleUrls.length;
  const topAbsentOwnerRepos = Array.from(absentOwnerRepos.entries())
    .map(([ownerRepo, count]) => ({ ownerRepo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const report: DiagnosisReport = {
    generatedAt: new Date().toISOString(),
    drilldownGeneratedAt: drilldown.generatedAt,
    targetClusters,
    totalSamples,
    inSitemap,
    notInSitemap,
    inSitemapPercent: totalSamples > 0 ? Number(((inSitemap / totalSamples) * 100).toFixed(1)) : 0,
    notInSitemapPercent: totalSamples > 0 ? Number(((notInSitemap / totalSamples) * 100).toFixed(1)) : 0,
    localeBreakdown,
    topAbsentOwnerRepos,
    sampleUrlStatus,
  };

  // Render markdown
  const lines: string[] = [];
  lines.push('# Coverage Other/Known-Skill-404 Cluster Diagnosis');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Drilldown source: ${report.drilldownGeneratedAt}`);
  lines.push(`- Target clusters: ${report.targetClusters.join(', ')}`);
  lines.push(`- Total sample URLs analyzed: ${report.totalSamples}`);
  lines.push('');
  lines.push('## Sitemap Cross-Reference');
  lines.push('');
  lines.push(`- In sitemap: ${report.inSitemap} (${report.inSitemapPercent}%)`);
  lines.push(`- Not in sitemap: ${report.notInSitemap} (${report.notInSitemapPercent}%)`);
  lines.push('');
  lines.push('## Locale Breakdown');
  lines.push('');
  lines.push('| Locale | Total | In Sitemap | Not In Sitemap |');
  lines.push('|--------|-------|-----------|----------------|');
  for (const [locale, stats] of Object.entries(report.localeBreakdown).sort((a, b) => b[1].total - a[1].total)) {
    lines.push(`| ${locale} | ${stats.total} | ${stats.inSitemap} | ${stats.notInSitemap} |`);
  }
  lines.push('');
  lines.push('## Top Absent Owner/Repos');
  lines.push('');
  for (const item of report.topAbsentOwnerRepos) {
    lines.push(`- ${item.ownerRepo} (${item.count} samples)`);
  }
  lines.push('');
  lines.push('## Conclusion');
  lines.push('');
  if (report.notInSitemapPercent > 80) {
    lines.push(
      `The vast majority (${report.notInSitemapPercent}%) of URLs in the target clusters are absent from the sitemap. These are expected 404s from deleted or renamed repositories, confirming that the \`known_skill_404\` cluster is a natural consequence of the evolving GitHub skill corpus.`
    );
  } else {
    lines.push(
      `${report.notInSitemapPercent}% of URLs in the target clusters are absent from the sitemap. Further investigation may be needed for URLs that are present in the sitemap but returning 404/5xx.`
    );
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(MD_OUTPUT, `${lines.join('\n')}\n`, 'utf8');
  writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Wrote diagnosis report to ${MD_OUTPUT}`);
  console.log(`Wrote diagnosis JSON to ${JSON_OUTPUT}`);
  console.log(`Samples: ${totalSamples} | In sitemap: ${inSitemap} (${report.inSitemapPercent}%) | Not in sitemap: ${notInSitemap} (${report.notInSitemapPercent}%)`);
}

main();
