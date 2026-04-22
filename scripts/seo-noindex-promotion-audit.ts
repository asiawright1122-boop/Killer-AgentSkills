#!/usr/bin/env npx tsx

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FUNCTIONAL_KEYWORDS, SKILL_HEADERS, SUSPICIOUS_NAMES } from './lib/constants';
import { fetchSkillMd, parseSkillMd } from './lib/github';
import { resolveSkillScoringPath } from './lib/skill-source';
import { getNonTargetSkillReason, isOfficialRepo, POSITIVE_THEME_KEYWORDS } from '../src/lib/shared/validation';

type MissingClusterAuditRow = {
  url?: string;
  owner?: string;
  repo?: string;
  routePath?: string;
  manualWorkstream?: string | null;
  candidateSignals?: Array<{
    routePath?: string;
    routeBucket?: string | null;
    canonicalLocale?: string | null;
    canonicalUrl?: string | null;
    indexabilityMode?: string | null;
    qualityScore?: number | null;
    blockers?: string[];
  }>;
};

type MissingClusterAuditReport = {
  rows?: MissingClusterAuditRow[];
};

type ExpandedGithubSkill = {
  owner?: string;
  repo?: string;
  filePath?: string;
  description?: string | null;
  topics?: string[];
  stars?: number;
  updatedAt?: string;
};

type CachedSkill = {
  id?: string;
  description?: string | Record<string, string>;
  topics?: string[];
  stars?: number;
  updatedAt?: string;
};

type SkillCacheData = {
  skills?: CachedSkill[];
};

export type NoindexPromotionOutcome =
  | 'promote_after_build_fix'
  | 'keep_reference_only_non_ai'
  | 'keep_reference_only_quality_gap'
  | 'needs_manual_source_lookup';

export function classifyNoindexPromotionOutcome(input: {
  predictedQualityScore: number;
  exclusionReason: string | null;
  filePath: string | null;
}): NoindexPromotionOutcome {
  if (!input.filePath) return 'needs_manual_source_lookup';
  if (input.exclusionReason === 'no-ai-agent-context') return 'keep_reference_only_non_ai';
  if (input.exclusionReason) return 'keep_reference_only_quality_gap';
  if (input.predictedQualityScore >= 50) return 'promote_after_build_fix';
  return 'keep_reference_only_quality_gap';
}

function describeOutcome(outcome: NoindexPromotionOutcome): string {
  switch (outcome) {
    case 'promote_after_build_fix':
      return '当前更像是构建/评分链误伤，重建缓存后应重新评估提升到公开可索引页。';
    case 'keep_reference_only_non_ai':
      return '技能主题仍不够 AI-agent 定向，继续保持 reference_only 更安全。';
    case 'keep_reference_only_quality_gap':
      return '即使修复上游链路，当前内容/质量信号仍不够，先别提升。';
    case 'needs_manual_source_lookup':
      return '缺少稳定源文件路径，先补齐原始技能来源。';
  }
}

function buildThemeExclusionReason(skill: {
  name: string;
  owner: string;
  repo: string;
  body: string;
  description: string;
  topics: string[];
  filePath: string | null;
}): string {
  const negativeReason = getNonTargetSkillReason({
    name: skill.name,
    owner: skill.owner,
    repo: skill.repo,
    body: skill.body,
    description: skill.description,
    topics: skill.topics,
    filePath: skill.filePath || undefined,
  });
  if (negativeReason) return negativeReason;

  if (!isOfficialRepo(skill.owner, skill.repo)) {
    const fullText = [skill.body, skill.description, ...skill.topics].join(' ').toLowerCase();
    const hasPositiveTheme = POSITIVE_THEME_KEYWORDS.some((keyword) => fullText.includes(keyword));
    if (!hasPositiveTheme) return 'no-ai-agent-context';
  }

  return '';
}

function computeBuildQualityScore(skill: {
  name: string;
  owner: string;
  repo: string;
  body: string;
  description: string;
  repoPath: string;
  filePath: string | null;
  stars: number;
  updatedAt: string | null;
  version?: string;
  tags?: string[];
  topics: string[];
}): { score: number; exclusionReason: string | null } {
  const isOfficial = isOfficialRepo(skill.owner, skill.repo);
  if (!skill.name || skill.name.trim().length === 0) return { score: 0, exclusionReason: 'missing_name' };

  const nameLower = skill.name.toLowerCase();
  if (!isOfficial && SUSPICIOUS_NAMES.some((keyword) => nameLower === keyword || nameLower.includes(`${keyword}-`))) {
    return { score: 0, exclusionReason: 'suspicious_name' };
  }

  if (!isOfficial && skill.description.trim().length < 10) return { score: 0, exclusionReason: 'thin_description' };
  if (!isOfficial && skill.body.length < 100) return { score: 0, exclusionReason: 'thin_body' };

  const exclusionReason = !isOfficial
    ? buildThemeExclusionReason({
        name: skill.name,
        owner: skill.owner,
        repo: skill.repo,
        body: skill.body,
        description: skill.description,
        topics: skill.topics,
        filePath: skill.filePath,
      })
    : '';
  if (exclusionReason) return { score: 0, exclusionReason };

  let score = 10;
  const bodyLower = skill.body.toLowerCase();

  for (const header of SKILL_HEADERS) {
    if (bodyLower.includes(header)) {
      score += 15;
      break;
    }
  }

  let foundKeywords = 0;
  for (const keyword of FUNCTIONAL_KEYWORDS) {
    if (bodyLower.includes(keyword)) foundKeywords++;
  }
  score += Math.min(15, foundKeywords * 3);

  if (skill.body.includes('```')) score += 10;

  const standardPaths = ['.codex/', '.claude/', '.agent/', 'skills/'];
  if (skill.repoPath && standardPaths.some((prefix) => skill.repoPath.includes(prefix))) {
    score += 10;
  }

  if (skill.version) score += 5;
  if (skill.tags && skill.tags.length > 0) score += 5;
  if (skill.description.length > 80) score += 5;

  if (isOfficial) {
    score += 30;
  } else if (skill.updatedAt) {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate < 180) score += 5;
  }

  if (skill.stars > 100) score += 10;
  else if (skill.stars > 20) score += 5;

  return { score: Math.min(100, score), exclusionReason: null };
}

function extractRawSkillSlug(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/?SKILL\.md$/i, '').replace(/\/?README\.md$/i, '');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function findCandidateSource(
  expandedSkills: ExpandedGithubSkill[],
  owner: string,
  repo: string,
  routePath: string,
): ExpandedGithubSkill | null {
  const slug = routePath.split('/').slice(1).join('/');
  for (const item of expandedSkills) {
    if (item.owner !== owner || item.repo !== repo) continue;
    const filePath = typeof item.filePath === 'string' ? item.filePath.trim() : '';
    if (!filePath) continue;
    if (extractRawSkillSlug(filePath) === slug) return item;
  }
  return null;
}

type PromotionAuditCandidate = {
  url: string;
  owner: string;
  repo: string;
  candidateRoutePath: string;
  currentQualityScore: number | null;
  predictedQualityScore: number;
  qualityDelta: number | null;
  currentIndexabilityMode: string | null;
  currentRouteBucket: string | null;
  canonicalLocale: string | null;
  canonicalUrl: string | null;
  filePath: string | null;
  exclusionReason: string | null;
  outcome: NoindexPromotionOutcome;
  recommendedAction: string;
};

type PromotionAuditReport = {
  generatedAt: string;
  sourceReport: string;
  summary: Record<NoindexPromotionOutcome, number>;
  candidates: PromotionAuditCandidate[];
};

const REPORT_DIR = resolve(process.cwd(), 'reports/seo');
const INPUT_PATH = resolve(REPORT_DIR, 'latest-404-missing-cluster-audit.json');
const EXPANDED_SKILLS_PATH = resolve(process.cwd(), 'data/expanded-github-skills.json');
const SKILLS_CACHE_PATH = resolve(process.cwd(), 'data/skills-cache.json');
const JSON_OUTPUT = resolve(REPORT_DIR, 'latest-noindex-promotion-audit.json');
const MD_OUTPUT = resolve(REPORT_DIR, 'latest-noindex-promotion-audit.md');

function renderMarkdown(report: PromotionAuditReport): string {
  const lines: string[] = [];
  lines.push('# Noindex Promotion Audit');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source report: ${report.sourceReport}`);
  lines.push(`- Promote after build fix: ${report.summary.promote_after_build_fix}`);
  lines.push(`- Keep reference-only (non-AI): ${report.summary.keep_reference_only_non_ai}`);
  lines.push(`- Keep reference-only (quality gap): ${report.summary.keep_reference_only_quality_gap}`);
  lines.push(`- Needs manual source lookup: ${report.summary.needs_manual_source_lookup}`);
  lines.push('');
  lines.push('## Candidates');
  lines.push('');

  for (const item of report.candidates) {
    lines.push(
      `- ${item.url} | outcome=${item.outcome} | current=${item.currentQualityScore ?? 'n/a'} -> predicted=${item.predictedQualityScore} | mode=${item.currentIndexabilityMode || 'unknown'} | bucket=${item.currentRouteBucket || 'unknown'} | source=${item.filePath || 'missing'} | action=${item.recommendedAction}${item.exclusionReason ? ` | exclusion=${item.exclusionReason}` : ''}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

export async function main() {
  if (!existsSync(INPUT_PATH)) throw new Error(`Missing audit input: ${INPUT_PATH}`);
  if (!existsSync(EXPANDED_SKILLS_PATH)) throw new Error(`Missing expanded skills data: ${EXPANDED_SKILLS_PATH}`);

  const audit = JSON.parse(readFileSync(INPUT_PATH, 'utf8')) as MissingClusterAuditReport;
  const expandedSkills = JSON.parse(readFileSync(EXPANDED_SKILLS_PATH, 'utf8')) as ExpandedGithubSkill[];
  const cachedSkills = existsSync(SKILLS_CACHE_PATH)
    ? ((JSON.parse(readFileSync(SKILLS_CACHE_PATH, 'utf8')) as SkillCacheData).skills || [])
    : [];
  const cacheById = new Map<string, CachedSkill>();
  for (const skill of cachedSkills) {
    const id = typeof skill.id === 'string' ? skill.id : '';
    if (id) cacheById.set(id, skill);
  }
  const targetRows = (audit.rows || []).filter((row) => row.manualWorkstream === 'promote_noindex_target');

  const candidates: PromotionAuditCandidate[] = [];
  for (const row of targetRows) {
    const url = typeof row.url === 'string' ? row.url : '';
    const owner = typeof row.owner === 'string' ? row.owner : '';
    const repo = typeof row.repo === 'string' ? row.repo : '';
    const signal = row.candidateSignals?.[0];
    const candidateRoutePath = typeof signal?.routePath === 'string' ? signal.routePath : '';
    if (!url || !owner || !repo || !candidateRoutePath) continue;

    const source = findCandidateSource(expandedSkills, owner, repo, candidateRoutePath);
    const cachedSkill = cacheById.get(`${owner}/${candidateRoutePath}`) || null;
    const filePath = typeof source?.filePath === 'string' ? source.filePath : null;
    const description =
      (typeof source?.description === 'string' && source.description.trim()) ||
      (typeof cachedSkill?.description === 'string' && cachedSkill.description.trim()) ||
      (typeof cachedSkill?.description === 'object' && cachedSkill.description && 'en' in cachedSkill.description
        ? String((cachedSkill.description as Record<string, string>).en || '').trim()
        : '') ||
      '';
    const topics =
      (Array.isArray(source?.topics) && source!.topics!.filter((item): item is string => typeof item === 'string')) ||
      (Array.isArray(cachedSkill?.topics) ? cachedSkill!.topics!.filter((item): item is string => typeof item === 'string') : []);

    let predictedQualityScore = 0;
    let exclusionReason: string | null = filePath ? null : 'missing_source_file';

    if (filePath) {
      const rawContent = (await fetchSkillMd(owner, repo, filePath)) || '';
      const parsed = parseSkillMd(rawContent || '');
      const predicted = computeBuildQualityScore({
        name: parsed?.name || candidateRoutePath.split('/').pop() || candidateRoutePath,
        owner,
        repo,
        body: parsed?.body || parsed?.bodyPreview || rawContent,
        description,
        repoPath: resolveSkillScoringPath(filePath, `${owner}/${repo}`),
        filePath,
        stars: Number(source?.stars || cachedSkill?.stars || 0),
        updatedAt:
          (typeof source?.updatedAt === 'string' && source.updatedAt) ||
          (typeof cachedSkill?.updatedAt === 'string' ? cachedSkill.updatedAt : null),
        version: parsed?.version,
        tags: parsed?.tags,
        topics,
      });
      predictedQualityScore = predicted.score;
      exclusionReason = predicted.exclusionReason;
    }

    const currentQualityScore = typeof signal?.qualityScore === 'number' ? signal.qualityScore : null;
    const outcome = classifyNoindexPromotionOutcome({
      predictedQualityScore,
      exclusionReason,
      filePath,
    });

    candidates.push({
      url,
      owner,
      repo,
      candidateRoutePath,
      currentQualityScore,
      predictedQualityScore,
      qualityDelta: currentQualityScore === null ? null : predictedQualityScore - currentQualityScore,
      currentIndexabilityMode: typeof signal?.indexabilityMode === 'string' ? signal.indexabilityMode : null,
      currentRouteBucket: typeof signal?.routeBucket === 'string' ? signal.routeBucket : null,
      canonicalLocale: typeof signal?.canonicalLocale === 'string' ? signal.canonicalLocale : null,
      canonicalUrl: typeof signal?.canonicalUrl === 'string' ? signal.canonicalUrl : null,
      filePath,
      exclusionReason,
      outcome,
      recommendedAction: describeOutcome(outcome),
    });
  }

  const summary: Record<NoindexPromotionOutcome, number> = {
    promote_after_build_fix: 0,
    keep_reference_only_non_ai: 0,
    keep_reference_only_quality_gap: 0,
    needs_manual_source_lookup: 0,
  };

  for (const candidate of candidates) {
    summary[candidate.outcome]++;
  }

  const report: PromotionAuditReport = {
    generatedAt: new Date().toISOString(),
    sourceReport: 'reports/seo/latest-404-missing-cluster-audit.json',
    summary,
    candidates,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUTPUT, renderMarkdown(report), 'utf8');

  console.log(`Wrote noindex promotion audit JSON to ${JSON_OUTPUT}`);
  console.log(`Wrote noindex promotion audit markdown to ${MD_OUTPUT}`);
  console.log(
    `summary => promote_after_build_fix: ${summary.promote_after_build_fix}, keep_reference_only_non_ai: ${summary.keep_reference_only_non_ai}, keep_reference_only_quality_gap: ${summary.keep_reference_only_quality_gap}, needs_manual_source_lookup: ${summary.needs_manual_source_lookup}`,
  );
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
