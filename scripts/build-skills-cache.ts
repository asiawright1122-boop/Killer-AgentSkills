/**
 * Skills 缓存构建脚本
 * 运行: npx tsx scripts/build-skills-cache.ts
 *
 * 重构后：所有共享逻辑已提取到 scripts/lib/ 模块
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'node:child_process';
import 'dotenv/config';
import * as dotenv from 'dotenv';

// ===== Shared Lib Imports =====
import * as crypto from 'crypto';
import { AIService } from './lib/ai';
import type { AIProviderTelemetrySnapshot } from './lib/ai';
import {
  getSiblingAiTelemetrySummaryPath,
  renderAiTelemetryReport,
  type TelemetryCheckpoint,
} from './lib/ai-telemetry-report';
import {
  OFFICIAL_REPOS,
  CATEGORY_RULES,
  SUSPICIOUS_NAMES,
  SKILL_HEADERS,
  FUNCTIONAL_KEYWORDS,
  GITHUB_API,
  KV_NAMESPACE_ID,
} from './lib/constants';
import { pLimit } from './lib/utils'; // Removed 'sleep' as it's unused
import {
  fetchWithRetry,
  fetchRepoInfo,
  fetchSkillMd,
  parseSkillMd,
  searchGitHubSkills,
  discoverNewSkillsFromGitHub,
} from './lib/github';
import type { SeoData, SkillCache, CacheData, TranslateContext } from './lib/types';
import { getNonTargetSkillReason, POSITIVE_THEME_KEYWORDS, isOfficialRepo } from '../src/lib/shared/validation';
import { sanitizePublicAIOutputValue } from '../src/lib/public-ai-output';
import { assessSkillTrust } from '../src/lib/skill-trust';
import { isSkillFullyOptimized, collectOptimizationIssues, DEFAULT_REGEN_BATCH_SIZE } from './lib/skill-quality';
import { writeRegenerationBaselineReport } from './lib/regeneration-report';
import { getSkillRoutePath, type SitemapSkillEntry } from '../src/lib/skill-route-paths';
import { buildSkillLocaleGovernanceIndex } from './lib/skill-locale-governance';
import { resolveSkillScoringPath } from './lib/skill-source';
import { injectOriginalityBlock } from './lib/originality-filter';

// Try loading .env.local if available
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

// ===== Service Instances =====
const aiService = new AIService();
const AI_RUNTIME_REPORT_DIR = path.resolve(process.cwd(), 'reports/seo');
const AI_RUNTIME_SUMMARY_PATH = path.join(AI_RUNTIME_REPORT_DIR, 'latest-ai-runtime-summary.md');
const AI_RUNTIME_JSON_PATH = path.join(AI_RUNTIME_REPORT_DIR, 'latest-ai-runtime-summary.json');

type AiRuntimeSummaryContext = {
  startedAt: string;
  selectedBatchNumber: number;
  batchPlanPath: string;
  selectedBatchIds: Set<string> | null;
  completedBatchIds: Set<string>;
  skippedBatchIds: Set<string>;
  failedBatchEntries: Array<{ id: string; error: string }>;
};

type BatchCheckpoint = {
  batch?: number;
  batchPlanPath?: string;
  selectedIds?: string[];
  completedIds?: string[];
  skippedIds?: string[];
  failedIds?: Array<{ id: string; error: string }>;
  pendingIds?: string[];
  firstId?: string;
  lastId?: string;
  topReasons?: Array<[string, number]>;
  startedAt?: string;
  status?: string;
  aiTelemetry?: AIProviderTelemetrySnapshot;
};

let globalAiRuntimeSummaryContext: AiRuntimeSummaryContext | null = null;
let globalPauseBatchProgress: (() => void) | null = null;

function persistAiRuntimeSummary(status: string): void {
  if (!globalAiRuntimeSummaryContext) return;

  const {
    startedAt,
    selectedBatchNumber,
    batchPlanPath,
    selectedBatchIds,
    completedBatchIds,
    skippedBatchIds,
    failedBatchEntries,
  } = globalAiRuntimeSummaryContext;

  const runtimeCheckpoint: TelemetryCheckpoint = {
    status,
    batch: selectedBatchNumber > 0 ? selectedBatchNumber : undefined,
    batchPlanPath: selectedBatchNumber > 0 ? path.relative(process.cwd(), batchPlanPath) : undefined,
    startedAt,
    lastUpdated: new Date().toISOString(),
    selectedCount: selectedBatchIds?.size,
    completedIds: selectedBatchIds ? Array.from(completedBatchIds).sort() : undefined,
    skippedIds: selectedBatchIds ? Array.from(skippedBatchIds).sort() : undefined,
    failedIds: selectedBatchIds ? failedBatchEntries.slice() : undefined,
    pendingIds: selectedBatchIds
      ? Array.from(selectedBatchIds).filter(
          (id) =>
            !completedBatchIds.has(id) &&
            !skippedBatchIds.has(id) &&
            !failedBatchEntries.some((entry) => entry.id === id),
        )
      : undefined,
    aiTelemetry: aiService.getTelemetrySnapshot(),
  };

  fs.mkdirSync(AI_RUNTIME_REPORT_DIR, { recursive: true });
  fs.writeFileSync(AI_RUNTIME_JSON_PATH, JSON.stringify(runtimeCheckpoint, null, 2));
  fs.writeFileSync(
    AI_RUNTIME_SUMMARY_PATH,
    renderAiTelemetryReport(runtimeCheckpoint, AI_RUNTIME_JSON_PATH, runtimeCheckpoint.lastUpdated),
  );
}

function toPublicSkillCache(skill: SkillCache): SkillCache {
  return sanitizePublicAIOutputValue(skill) as SkillCache;
}

function getThemeExclusionReason(skill: {
  name?: string;
  owner?: string;
  repo?: string;
  body?: string;
  description?: string | Record<string, string>;
  topics?: string[];
  category?: string;
  filePath?: string;
}): string {
  const owner = skill.owner || '';
  const repo = skill.repo || '';
  const isOfficial = isOfficialRepo(owner, repo);
  const description = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';

  // Negative theme filter (interview, resume, product-management, etc.)
  const negativeReason = getNonTargetSkillReason({
    name: skill.name || '',
    owner,
    repo,
    body: skill.body || '',
    description: skill.description,
    topics: skill.topics || [],
    category: skill.category,
    filePath: skill.filePath,
  });
  if (negativeReason) return negativeReason;

  // Positive theme gate: non-official skills must reference AI agent ecosystem.
  if (!isOfficial) {
    const fullText = [skill.body || '', description, ...(skill.topics || [])].join(' ').toLowerCase();
    const hasPositiveTheme = POSITIVE_THEME_KEYWORDS.some((kw) => fullText.includes(kw));
    if (!hasPositiveTheme) {
      return 'no-ai-agent-context';
    }
  }

  return '';
}

// ===== Build-Specific Scoring Logic =====
function sharedCalculateQualityScore(skill: any): number {
  // ══════════════════════════════════════════════════════════════════
  // 按 Agent Skills 官方规范验证 SKILL.md 结构:
  //
  //   必须有:
  //     1. YAML frontmatter（---...---）
  //
  //   score = 0  → 结构无效，不收录
  //   score > 0  → 结构有效，收录到全部技能
  //   score 越高 → 精选排序越靠前
  // ══════════════════════════════════════════════════════════════════

  const isOfficial = isOfficialRepo(skill.owner, skill.repo);

  // ── 结构有效性验证（不通过 = score 0 = 不收录）──────────

  // 必须有 name（来自 frontmatter 的 name 字段）
  if (!skill.name || skill.name.trim().length === 0) return 0;

  // 过滤可疑名称（test, example, demo 等）
  const nameLower = skill.name.toLowerCase();
  if (!isOfficial && SUSPICIOUS_NAMES.some((k) => nameLower === k || nameLower.includes(k + '-'))) {
    return 0;
  }

  // 必须有 description（来自 frontmatter 的 description 字段）
  const desc = skill.description || '';
  const descText = typeof desc === 'string' ? desc : desc.en || '';
  if (!isOfficial && descText.trim().length < 10) return 0;

  // 必须有 body 内容（Markdown 指令）
  const body = skill.body || '';
  if (!isOfficial && body.length < 100) return 0;
  if (
    !isOfficial &&
    getThemeExclusionReason({
      name: skill.name,
      owner: skill.owner,
      repo: skill.repo,
      body,
      description: desc,
      topics: skill.topics,
      category: skill.category,
      filePath: skill.filePath,
    })
  )
    return 0;

  // ── 通过结构验证 → 计算精选排序分（越高越精选）──────────
  let score = 10; // 结构有效基础分

  const bodyLower = body.toLowerCase();

  // 指令质量：有标准 header 说明结构清晰
  for (const h of SKILL_HEADERS) {
    if (bodyLower.includes(h)) {
      score += 15;
      break;
    }
  }

  // 功能关键词密度：越多说明内容越实操
  let foundKeywords = 0;
  for (const k of FUNCTIONAL_KEYWORDS) {
    if (bodyLower.includes(k)) foundKeywords++;
  }
  score += Math.min(15, foundKeywords * 3);

  // 有代码示例：实操性强
  if (body.includes('```')) score += 10;

  // 标准路径：.claude/, .agent/, skills/ → 规范性高
  const standardPaths = ['.codex/', '.claude/', '.agent/', 'skills/'];
  if (skill.repoPath && standardPaths.some((p) => skill.repoPath!.includes(p))) {
    score += 10;
  }

  // 元数据完整度
  if (skill.version) score += 5;
  if (skill.tags && skill.tags.length > 0) score += 5;
  if (descText.length > 80) score += 5; // 详细 description

  // 官方仓库额外加分
  if (isOfficial) {
    score += 30;
  } else if (skill.updatedAt) {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate < 180) score += 5;
  }

  // Stars 仅用于精选排序加分，不影响是否收录
  if (skill.stars && skill.stars > 100) score += 10;
  else if (skill.stars && skill.stars > 20) score += 5;

  return Math.min(100, score);
}

function attachTrustProfile<T extends SkillCache>(skill: T): T {
  return Object.assign(skill, assessSkillTrust(skill));
}

// ===== Category Determination =====
function determineCategory(skill: SkillCache): string {
  const text = `${skill.name} ${JSON.stringify(skill.description)} ${(skill.topics || []).join(' ')}`.toLowerCase();
  const topics = new Set((skill.topics || []).map((t) => t.toLowerCase()));

  let bestCategory = 'developer'; // Fallback to developer instead of development
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    let score = 0;
    for (const keyword of keywords) {
      if (topics.has(keyword)) score += 10;
      if (skill.name.toLowerCase().includes(keyword)) score += 5;
      if (text.includes(keyword)) score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  if (maxScore === 0) {
    if (text.includes('agent')) return 'ai';
    if (text.includes('code')) return 'developer';
  }

  return bestCategory;
}

/**
 * Calculate quality score using shared validation module
 * This is a wrapper to adapt SkillCache to SkillScoringInput
 */
function calculateQualityScore(skill: SkillCache): number {
  if (!skill.skillMd) return 0;

  const bodyRaw = (skill.skillMd as any).body || skill.skillMd.bodyPreview || '';
  const desc = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';

  return sharedCalculateQualityScore({
    name: skill.skillMd.name || skill.name,
    owner: skill.owner,
    repo: skill.repo,
    body: bodyRaw,
    repoPath: resolveSkillScoringPath(skill.filePath, skill.repoPath),
    description: desc,
    stars: skill.stars,
    updatedAt: skill.updatedAt,
    version: skill.skillMd.version,
    tags: skill.skillMd.tags,
  });
}

const MIN_INDEXABLE_SKILL_CONTENT_BYTES = 200;
const MIN_ENRICHED_FALLBACK_README_BYTES = 250;
const skillTextEncoder = new TextEncoder();

function pickPreferredLocalizedText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const preferred = [record.en, record.zh, ...Object.values(record)];
  for (const candidate of preferred) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return '';
}

function pickPreferredLocalizedArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const preferred = [record.en, record.zh, ...Object.values(record)];
  for (const candidate of preferred) {
    if (!Array.isArray(candidate)) continue;
    const cleaned = candidate.map((item) => String(item || '').trim()).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  return [];
}

function getSkillFallbackDescription(skill: SkillCache): string {
  return (
    pickPreferredLocalizedText(skill.description) ||
    pickPreferredLocalizedText(skill.seo?.definition) ||
    pickPreferredLocalizedText(skill.seo?.description) ||
    ''
  );
}

function getSkillAgentFallbackDescription(skill: SkillCache): string {
  return (
    pickPreferredLocalizedText(skill.agentAnalysis?.recommendation) ||
    pickPreferredLocalizedText(skill.agentAnalysis?.suitability) ||
    ''
  );
}

function buildSkillFallbackReadme(skill: SkillCache): string {
  const fallbackDescription = getSkillFallbackDescription(skill);
  const agentFallbackDescription = getSkillAgentFallbackDescription(skill);
  const useCases = pickPreferredLocalizedArray(skill.agentAnalysis?.useCases).slice(0, 4);
  const limitations = pickPreferredLocalizedArray(skill.agentAnalysis?.limitations).slice(0, 3);
  const topics = (skill.topics || [])
    .map((topic) => String(topic || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const genericSummary =
    fallbackDescription ||
    agentFallbackDescription ||
    `${skill.name || skill.repo || 'This skill'} helps AI agents handle repository-specific developer workflows. ` +
      `It is especially relevant for ${topics.slice(0, 4).join(', ') || 'Claude Code and MCP-driven automation'} ` +
      `setups where teams need clearer execution guidance, stronger defaults, and reusable implementation patterns.`;
  const summary = genericSummary.trim();

  if (!summary && useCases.length === 0 && limitations.length === 0 && topics.length === 0) return '';

  const sections = [`# ${skill.name || skill.repo || 'Skill'}`];
  if (summary) sections.push(summary);
  if (useCases.length > 0) {
    sections.push(`## Use Cases\n${useCases.map((item) => `- ${item}`).join('\n')}`);
  }
  if (limitations.length > 0) {
    sections.push(`## Limitations\n${limitations.map((item) => `- ${item}`).join('\n')}`);
  }
  if (topics.length > 0) {
    sections.push(`## Topics\n${topics.map((item) => `- ${item}`).join('\n')}`);
  }
  return sections.join('\n\n').trim();
}

function stripFallbackHeading(markdown: string): string {
  return markdown.replace(/^# .+\n\n?/, '').trim();
}

function ensureSkillMdContent(skill: SkillCache): SkillCache {
  const body = skill.skillMd?.body || '';
  const bodyPreview = skill.skillMd?.bodyPreview || '';
  const fallbackReadme = buildSkillFallbackReadme(skill);
  const fallbackWithoutHeading = stripFallbackHeading(fallbackReadme);

  if (body.trim().length > 0) {
    const bodyBytes = skillTextEncoder.encode(body).length;
    if (bodyBytes >= MIN_ENRICHED_FALLBACK_README_BYTES || !fallbackWithoutHeading) {
      return skill;
    }

    const enrichedBody = [body.trim(), fallbackWithoutHeading].filter(Boolean).join('\n\n').trim();
    if (skillTextEncoder.encode(enrichedBody).length <= bodyBytes) {
      return skill;
    }

    return {
      ...skill,
      skillMd: {
        name: skill.skillMd?.name || skill.name || skill.repo,
        description:
          skill.skillMd?.description || getSkillFallbackDescription(skill) || getSkillAgentFallbackDescription(skill),
        version: skill.skillMd?.version,
        tags: skill.skillMd?.tags,
        body: enrichedBody,
        bodyPreview: enrichedBody.slice(0, 5000).trim(),
      },
    };
  }

  if (!fallbackReadme) return skill;

  if (bodyPreview.trim().length > 0) {
    const currentBytes = skillTextEncoder.encode(bodyPreview).length;
    if (currentBytes >= MIN_ENRICHED_FALLBACK_README_BYTES) {
      return skill;
    }

    if (skillTextEncoder.encode(fallbackReadme).length <= currentBytes) {
      return skill;
    }

    return {
      ...skill,
      skillMd: {
        name: skill.skillMd?.name || skill.name || skill.repo,
        description:
          skill.skillMd?.description || getSkillFallbackDescription(skill) || getSkillAgentFallbackDescription(skill),
        version: skill.skillMd?.version,
        tags: skill.skillMd?.tags,
        bodyPreview: fallbackReadme.slice(0, 5000).trim(),
      },
    };
  }

  return {
    ...skill,
    skillMd: {
      name: skill.skillMd?.name || skill.name || skill.repo,
      description:
        skill.skillMd?.description || getSkillFallbackDescription(skill) || getSkillAgentFallbackDescription(skill),
      version: skill.skillMd?.version,
      tags: skill.skillMd?.tags,
      bodyPreview: fallbackReadme.slice(0, 5000).trim(),
      ...(skill.skillMd?.body ? { body: skill.skillMd.body } : {}),
    },
  };
}

function getSkillIndexableContentBytes(skill: SkillCache): number {
  const normalized = ensureSkillMdContent(skill);
  const content = normalized.skillMd?.body || normalized.skillMd?.bodyPreview || '';
  if (!content) return 0;
  return skillTextEncoder.encode(content).length;
}

function isSkillIndexableForSitemap(skill: SkillCache): boolean {
  return getSkillIndexableContentBytes(skill) >= MIN_INDEXABLE_SKILL_CONTENT_BYTES;
}

function isPublicSkillForSitemap(skill: SkillCache): boolean {
  return !getNonTargetSkillReason({
    name: skill.name || skill.repo || '',
    owner: skill.owner || '',
    repo: skill.repo || '',
    body: skill.skillMd?.body || skill.skillMd?.bodyPreview || '',
    description: skill.description,
    topics: Array.isArray(skill.topics) ? skill.topics : [],
    category: skill.category,
    filePath: skill.filePath,
  });
}

function parseDateMs(value?: string): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function buildSitemapSkillsData(skills: SkillCache[]): SitemapSkillEntry[] {
  const deduped = new Map<string, SitemapSkillEntry>();

  for (const skill of skills) {
    if (!skill.owner || !skill.repo || !isSkillIndexableForSitemap(skill)) continue;
    if (!isPublicSkillForSitemap(skill)) continue;
    const owner = String(skill.owner).trim();
    const repo = String(skill.repo).trim();
    if (!owner || !repo) continue;
    const routePath = getSkillRoutePath({
      id: skill.id,
      owner,
      repo,
    });
    if (!routePath) continue;

    const updatedAt = skill.updatedAt || undefined;
    const key = `${owner.toLowerCase()}/${routePath.toLowerCase()}`;
    const current = deduped.get(key);

    if (!current || parseDateMs(updatedAt) > parseDateMs(current.updatedAt)) {
      deduped.set(key, { owner, repo, routePath, ...(updatedAt ? { updatedAt } : {}) });
    }
  }

  return Array.from(deduped.values()).sort((a, b) => parseDateMs(b.updatedAt) - parseDateMs(a.updatedAt));
}

function refreshGovernedSkillCorpus(): void {
  execSync('npx tsx scripts/seo-corpus-governance.ts', {
    stdio: 'inherit',
  });
}

function refreshSkillIndexabilityReport(): void {
  execSync('npx tsx scripts/seo-skill-indexability-report.ts', {
    stdio: 'inherit',
  });
}

async function buildCache(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2);
  const reportRegeneration = args.includes('--report-regeneration');
  const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));
  const reportBatchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : DEFAULT_REGEN_BATCH_SIZE;
  const batchArg = args.find((arg) => arg.startsWith('--batch='));
  const selectedBatchNumber = batchArg ? parseInt(batchArg.split('=')[1], 10) : 0;
  const batchPlanArg = args.find((arg) => arg.startsWith('--batch-plan='));
  const checkpointArg = args.find((arg) => arg.startsWith('--checkpoint-file='));
  const resumeBatch = args.includes('--resume') || args.includes('--resume-batch');
  const dryRunBatch = args.includes('--dry-run-batch');
  const maxItemsArg = args.find((arg) => arg.startsWith('--max-items='));
  const maxItems = maxItemsArg ? parseInt(maxItemsArg.split('=')[1], 10) : 0;
  const batchPlanPath = path.resolve(
    process.cwd(),
    batchPlanArg ? batchPlanArg.split('=')[1] : 'reports/seo/phase-02-regeneration-baseline.json',
  );
  const checkpointPath = path.resolve(
    process.cwd(),
    checkpointArg ? checkpointArg.split('=')[1] : 'reports/seo/phase-02-batch-progress.json',
  );
  const modeArg = args.find((arg) => arg.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'update'; // default to update (full)
  const force = args.includes('--force'); // Force re-generation of AI content
  const filterArg = args.find((arg) => arg.startsWith('--filter='));
  const filters = filterArg ? filterArg.split('=')[1].toLowerCase().split(',') : [];
  const existingOnly = args.includes('--existing-only') || selectedBatchNumber > 0;

  // Max duration parameter for CI/CD timeout prevention
  const durationArg = args.find((arg) => arg.startsWith('--max-duration='));
  const maxDurationMinutes = durationArg ? parseInt(durationArg.split('=')[1], 10) : 0;
  const startTimeMs = Date.now();
  let timeLimitReached = false;

  console.log(
    `🚀 Starting cache build in [${mode.toUpperCase()}] mode... (Force: ${force}, Filter: ${filters.join(',') || 'None'}, Max Duration: ${maxDurationMinutes ? maxDurationMinutes + 'm' : 'Unlimited'})\n`,
  );

  function isTimeUp(): boolean {
    if (timeLimitReached) return true;
    if (!maxDurationMinutes) return false;
    if (Date.now() - startTimeMs > maxDurationMinutes * 60 * 1000) {
      console.log(
        `\n⏳ Time limit of ${maxDurationMinutes} minutes reached. Gracefully shutting down to save progress...`,
      );
      timeLimitReached = true;
      return true;
    }
    return false;
  }

  if (!['discover', 'update', 'full-discovery'].includes(mode)) {
    console.error(`❌ Invalid mode: ${mode}. Use --mode=discover, --mode=update, or --mode=full-discovery`);
    process.exit(1);
  }

  // Load existing cache
  const existingMap = new Map<string, SkillCache>();
  let lastCacheUpdate: string | undefined;
  const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
  if (fs.existsSync(cachePath)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheData;
      oldData.skills.forEach((s) => existingMap.set(s.id, s));
      lastCacheUpdate = oldData.lastUpdated;
      console.log(`📚 Loaded ${existingMap.size} skills from cache (last updated: ${lastCacheUpdate || 'unknown'})`);
    } catch (e) {
      console.error(`⚠️ Failed to load existing cache (corrupted or LFS pointer?):`, e);
    }
  }
  // Snapshot the full initial cache so saveStateOnly never loses startup-loaded data
  globalExistingMap = new Map(existingMap);

  if (reportRegeneration) {
    if (existingMap.size === 0) {
      throw new Error('Cannot build a regeneration baseline without an existing data/skills-cache.json snapshot.');
    }

    const report = writeRegenerationBaselineReport(Array.from(existingMap.values()), {
      batchSize: reportBatchSize,
    });

    console.log(
      `📊 Regeneration baseline ready: ${report.queuedCount} skills queued across ${report.batchCount} batch(es).`,
    );
    console.log(`   Markdown: ${path.relative(process.cwd(), report.markdownPath)}`);
    console.log(`   JSON: ${path.relative(process.cwd(), report.jsonPath)}`);
    return;
  }

  let selectedBatchIds: Set<string> | null = null;
  const completedBatchIds = new Set<string>();
  const skippedBatchIds = new Set<string>();
  let failedBatchEntries: Array<{ id: string; error: string }> = [];
  let batchProgress: Record<string, unknown> | null = null;
  const buildStartedAt = new Date().toISOString();
  globalAiRuntimeSummaryContext = {
    startedAt: buildStartedAt,
    selectedBatchNumber,
    batchPlanPath,
    selectedBatchIds,
    completedBatchIds,
    skippedBatchIds,
    failedBatchEntries,
  };
  const syncAiRuntimeSummaryContext = () => {
    if (!globalAiRuntimeSummaryContext) return;
    globalAiRuntimeSummaryContext.selectedBatchIds = selectedBatchIds;
    globalAiRuntimeSummaryContext.failedBatchEntries = failedBatchEntries;
  };

  const persistBatchProgress = () => {
    if (!batchProgress || !selectedBatchIds) return;
    const selectedIds = Array.from(selectedBatchIds);
    const failedIds = new Set(failedBatchEntries.map((entry) => entry.id));
    batchProgress = {
      ...batchProgress,
      lastUpdated: new Date().toISOString(),
      aiTelemetry: aiService.getTelemetrySnapshot(),
      completedIds: Array.from(completedBatchIds).sort(),
      skippedIds: Array.from(skippedBatchIds).sort(),
      failedIds: failedBatchEntries,
      pendingIds: selectedIds.filter(
        (id) => !completedBatchIds.has(id) && !skippedBatchIds.has(id) && !failedIds.has(id),
      ),
    };
    fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
    fs.writeFileSync(checkpointPath, JSON.stringify(batchProgress, null, 2));
    const telemetrySummaryPath = getSiblingAiTelemetrySummaryPath(checkpointPath);
    fs.writeFileSync(
      telemetrySummaryPath,
      renderAiTelemetryReport(batchProgress as BatchCheckpoint, checkpointPath, new Date().toISOString()),
    );
    persistAiRuntimeSummary(String((batchProgress as BatchCheckpoint).status || 'running'));
  };

  globalPauseBatchProgress = () => {
    if (!batchProgress || !selectedBatchIds) return;
    batchProgress = {
      ...batchProgress,
      status: 'paused',
      completedAt: null,
    };
    persistBatchProgress();
  };

  const recordBatchCompletion = (id: string, status: 'completed' | 'skipped', error?: string) => {
    if (!selectedBatchIds || !selectedBatchIds.has(id)) return;
    if (status === 'completed') completedBatchIds.add(id);
    if (status === 'skipped') skippedBatchIds.add(id);
    if (error) {
      failedBatchEntries = failedBatchEntries.filter((entry) => entry.id !== id);
      failedBatchEntries.push({ id, error });
    } else {
      failedBatchEntries = failedBatchEntries.filter((entry) => entry.id !== id);
    }
    syncAiRuntimeSummaryContext();
    persistBatchProgress();
  };

  const recordBatchFailure = (id: string, error: unknown) => {
    if (!selectedBatchIds || !selectedBatchIds.has(id)) return;
    failedBatchEntries = failedBatchEntries.filter((entry) => entry.id !== id);
    failedBatchEntries.push({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    syncAiRuntimeSummaryContext();
    persistBatchProgress();
  };

  const batchHasPendingSelectedIds = (): boolean =>
    Boolean(
      selectedBatchIds &&
      Array.from(selectedBatchIds).some(
        (id) =>
          !completedBatchIds.has(id) &&
          !skippedBatchIds.has(id) &&
          !failedBatchEntries.some((entry) => entry.id === id),
      ),
    );

  if (selectedBatchNumber > 0) {
    const relativeBatchPlanPath = path.relative(process.cwd(), batchPlanPath);
    type BatchPlanEntry = {
      batch: number;
      ids: string[];
      firstId?: string;
      lastId?: string;
      topReasons?: Array<[string, number]>;
    };
    let batchEntry: BatchPlanEntry | undefined;
    let checkpointSnapshotIds: string[] = [];
    let checkpointStartedAt: string | undefined;
    let checkpointFirstId: string | undefined;
    let checkpointLastId: string | undefined;
    let checkpointTopReasons: Array<[string, number]> | undefined;
    let checkpointAiTelemetry: AIProviderTelemetrySnapshot | undefined;

    if (resumeBatch && fs.existsSync(checkpointPath)) {
      try {
        const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8')) as BatchCheckpoint;
        if (checkpoint.batch === selectedBatchNumber && checkpoint.batchPlanPath === relativeBatchPlanPath) {
          for (const id of checkpoint.completedIds || []) completedBatchIds.add(id);
          for (const id of checkpoint.skippedIds || []) skippedBatchIds.add(id);
          failedBatchEntries = Array.isArray(checkpoint.failedIds) ? checkpoint.failedIds.slice() : [];

          const reconstructedIds =
            Array.isArray(checkpoint.selectedIds) && checkpoint.selectedIds.length > 0
              ? checkpoint.selectedIds
              : Array.from(
                  new Set([
                    ...(checkpoint.completedIds || []),
                    ...(checkpoint.skippedIds || []),
                    ...(checkpoint.failedIds || []).map((entry) => entry.id),
                    ...(checkpoint.pendingIds || []),
                  ]),
                );
          checkpointSnapshotIds = reconstructedIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
          checkpointStartedAt = checkpoint.startedAt;
          checkpointFirstId = checkpoint.firstId;
          checkpointLastId = checkpoint.lastId;
          checkpointTopReasons = checkpoint.topReasons;
          checkpointAiTelemetry = checkpoint.aiTelemetry;
          syncAiRuntimeSummaryContext();
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load batch checkpoint ${checkpointPath}:`, error);
      }
    }

    if (checkpointAiTelemetry) {
      aiService.restoreTelemetrySnapshot(checkpointAiTelemetry);
    }

    if (fs.existsSync(batchPlanPath)) {
      const baseline = JSON.parse(fs.readFileSync(batchPlanPath, 'utf-8')) as {
        batches?: BatchPlanEntry[];
      };
      batchEntry = baseline.batches?.find((entry) => entry.batch === selectedBatchNumber);
    } else if (!checkpointSnapshotIds.length) {
      throw new Error(`Batch plan not found: ${batchPlanPath}`);
    }

    let scopedIds: string[];
    if (checkpointSnapshotIds.length > 0) {
      scopedIds = maxItems > 0 ? checkpointSnapshotIds.slice(0, maxItems) : checkpointSnapshotIds.slice();
      if (batchEntry) {
        const batchEntryIds = maxItems > 0 ? batchEntry.ids.slice(0, maxItems) : batchEntry.ids.slice();
        const sameSelection =
          batchEntryIds.length === scopedIds.length && batchEntryIds.every((id, index) => id === scopedIds[index]);
        if (!sameSelection) {
          console.warn(
            `⚠️ Resume checkpoint selection diverged from current batch plan. Continuing with checkpoint snapshot from ${checkpointPath} to avoid cross-batch drift.`,
          );
        }
      }
    } else {
      if (!batchEntry) {
        throw new Error(`Batch ${selectedBatchNumber} not found in ${batchPlanPath}`);
      }
      scopedIds = maxItems > 0 ? batchEntry.ids.slice(0, maxItems) : batchEntry.ids.slice();
    }

    selectedBatchIds = new Set(scopedIds);
    syncAiRuntimeSummaryContext();

    console.log(
      `📦 Batch mode active: batch ${selectedBatchNumber} with ${scopedIds.length} selected skill(s) (${existingOnly ? 'existing-only' : 'full'})`,
    );

    batchProgress = {
      version: 1,
      batch: selectedBatchNumber,
      batchPlanPath: relativeBatchPlanPath,
      dryRun: dryRunBatch,
      existingOnly,
      selectedCount: scopedIds.length,
      selectedIds: scopedIds,
      firstId: checkpointFirstId || batchEntry?.firstId || scopedIds[0] || '',
      lastId: checkpointLastId || batchEntry?.lastId || scopedIds[scopedIds.length - 1] || '',
      topReasons: checkpointTopReasons || batchEntry?.topReasons || [],
      startedAt: checkpointStartedAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    persistBatchProgress();
  }

  const skills: SkillCache[] = [];
  globalSkillsRef = skills; // Global ref for SIGINT handler
  const processedRepos = new Set<string>();

  // Helper: 检查 skill 是否有更新 (updatedAt > lastSynced)
  function hasSkillUpdated(skill: SkillCache, freshUpdatedAt?: string): boolean {
    if (!skill.lastSynced) return true; // 从未同步过
    if (freshUpdatedAt) {
      return new Date(freshUpdatedAt) > new Date(skill.lastSynced);
    }
    if (skill.updatedAt) {
      return new Date(skill.updatedAt) > new Date(skill.lastSynced);
    }
    return false;
  }

  // Helper: 计算 SHA-256 哈希
  function computeHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content || '')
      .digest('hex');
  }

  async function processMetadata(
    id: string,
    text: string,
    context?: TranslateContext,
    freshUpdatedAt?: string,
  ): Promise<{ description: string | Record<string, string>; seo?: SeoData }> {
    const existing = existingMap.get(id);

    // 内部降级守门员: 如果最外层的 Hash 校对网漏掉了因数据残缺跳避的旧技能，
    // 我们再次依据 updatedAt 进行保底判定，避免触发无谓的大模型调用。
    if (!force && existing && isSkillFullyOptimized(existing) && !hasSkillUpdated(existing, freshUpdatedAt)) {
      process.stdout.write('s'); // s = skip (已完成)
      return { description: existing.description, seo: existing.seo };
    }

    process.stdout.write('T'); // T for Translating/Generating
    return await aiService.translateMetadata(text, context);
  }

  // 1. 处理官方仓库 (仅在 update 模式下，或者 discover 模式下检查是否存在)
  if (mode === 'update' && !existingOnly) {
    console.log('📦 Processing official repos...');
    for (const repo of OFFICIAL_REPOS) {
      if (isTimeUp()) break;
      const repoPath = `${repo.owner}/${repo.repo}`;
      console.log(`   → ${repoPath}`);

      let repoInfo = null;
      let currentRepoEtag: string | undefined = undefined;

      try {
        // Find ANY existing skill from this repo to grab its ETag
        const anyExistingSkill = Array.from(existingMap.values()).find(
          (s) => s.owner === repo.owner && s.repo === repo.repo,
        );

        const repoInfoObj = await fetchRepoInfo(repo.owner, repo.repo, anyExistingSkill?.repoEtag);

        if (repoInfoObj?.notModified) {
          currentRepoEtag = anyExistingSkill?.repoEtag;
          console.log(`   ⏩ API Skipping entire repo (ETag Match): ${repoPath}`);
          const repoSkills = Array.from(existingMap.values()).filter(
            (s) => s.owner === repo.owner && s.repo === repo.repo,
          );
          for (const existing of repoSkills) {
            if (!processedRepos.has(existing.id)) {
              processedRepos.add(existing.id);

              // Important: must also update global ref just in case
              if (!skills.find((s) => s.id === existing.id)) {
                skills.push({
                  ...existing,
                  lastSynced: new Date().toISOString(),
                });
              }
            }
          }
          continue; // Skip the entire repository parsing!!!
        }

        if (repoInfoObj) {
          repoInfo = repoInfoObj.data;
          currentRepoEtag = repoInfoObj.etag;
        }
      } catch (e) {
        console.log(`   ⚠️ Failed to fetch repo info (Error: ${e})`);
      }

      if (!repoInfo) {
        // FALLBACK: Try to find existing data from cache if available
        const existingSkill = Array.from(existingMap.values()).find(
          (s) => s.owner === repo.owner && s.repo === repo.repo,
        );
        if (existingSkill) {
          console.log(`   ⚠️ Rate limit/Error fetching repo info. Using cached data from ${existingSkill.id}`);
          repoInfo = {
            name: existingSkill.repo,
            description:
              typeof existingSkill.description === 'string' ? existingSkill.description : existingSkill.description.en,
            stargazers_count: existingSkill.stars,
            forks_count: existingSkill.forks,
            updated_at: existingSkill.updatedAt,
            topics: existingSkill.topics,
            default_branch: 'main',
          } as any;
          currentRepoEtag = existingSkill.repoEtag;
        }
      }

      if (!repoInfo) {
        console.log(`   ⚠️ Failed to fetch repo info`);
        continue;
      }

      if (repo.skillsPath) {
        try {
          const contentsUrl = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${repo.skillsPath}`;
          const contentsRes = await fetchWithRetry(contentsUrl);
          if (contentsRes.ok) {
            const contents = (await contentsRes.json()) as any;

            let skillDirs: any[] = [];
            if (Array.isArray(contents)) {
              skillDirs = contents.filter((item: any) => item.type === 'dir' && !item.name.startsWith('.'));
            } else if (contents.type === 'file') {
              // If skillsPath points to a file (like README.md), use the filename (e.g. README.md) as the skill name
              // This ensures the skillId becomes 'owner/repo/README.md'
              skillDirs = [
                { name: repo.skillsPath, type: 'file', path: contents.path, download_url: contents.download_url },
              ];
            }

            console.log(`      Found ${skillDirs.length} skills in ${repo.skillsPath}`);

            for (const skillDir of skillDirs) {
              const skillId = `${repoPath}/${skillDir.name}`;
              if (processedRepos.has(skillId)) continue;

              console.log(`      Found candidate: ${skillDir.name}`);

              // Check filter for individual skills within the repo
              if (filters.length > 0) {
                const match = filters.some(
                  (f) =>
                    skillDir.name.toLowerCase().includes(f) ||
                    repo.owner.toLowerCase().includes(f) ||
                    repo.repo.toLowerCase().includes(f),
                );
                if (!match) continue;
              }

              processedRepos.add(skillId);

              // INCREMENTAL CHECK: If we already have this skill deeply translated and optimized, skip fetching to save time and API limits
              const existing = existingMap.get(skillId);
              if (existing && isSkillFullyOptimized(existing) && !force) {
                // Check if it needs update based on repo updated_at
                if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                  console.log(`      ⏩ Skipping fetch (Cached & Optimized): ${skillDir.name}`);
                  skills.push(existing);
                  process.stdout.write('s');
                  continue;
                }
              }

              const isSingleFile = skillDir.type === 'file';
              const skillFilePath = isSingleFile ? repo.skillsPath : `${repo.skillsPath}/${skillDir.name}`;
              let skillMdContent = '';

              try {
                skillMdContent = (await fetchSkillMd(repo.owner, repo.repo, skillFilePath)) || '';
              } catch (e) {
                console.log(`      ⚠️ Failed to fetch file content: ${e}`);
              }

              const parsed = skillMdContent ? parseSkillMd(skillMdContent) : undefined;

              // Fallback for README.md or non-standard skills
              const skillMd =
                parsed ||
                (isSingleFile
                  ? {
                      name: (repo as any).displayName || repoInfo.name, // Use displayName from config if available
                      description: repoInfo.description,
                      bodyPreview: skillMdContent.slice(0, 5000), // Use content as body for AI to analyze
                      tags: repoInfo.topics,
                    }
                  : undefined);

              const rawDesc = skillMd?.description || '';

              const currentContentHash = computeHash(skillMdContent || rawDesc || '');

              // INCREMENTAL CHECK: Hash MATCH bypass AI calls completely!
              let existingHash =
                existing?.contentHash || (existing?.skillMd?.body ? computeHash(existing.skillMd.body) : undefined);

              // If we STILL don't have an existing hash (because old caches stripped .body),
              // we can fetch the old content using the old commit hash/branch IF we had it,
              // but actually, we don't have the old commit hash.
              // However, we CAN just assume the contentHash is the currentContentHash IF
              // `existing.description` is a fully translated object and force is false.
              // But wait, what if the repo DID change? We don't know if SKILL.md changed.
              // So we MUST generate a new translation if we can't be sure it didn't change!
              // Wait, no - we CAN do a quick similarity check on the `bodyPreview`!
              // `existing.skillMd.bodyPreview` is 500 chars.
              // If the new `skillMd` starts with the exact same 500 chars, it's highly likely unchanged!
              if (!existingHash && existing?.skillMd?.bodyPreview && skillMd?.bodyPreview) {
                if (existing.skillMd.bodyPreview === skillMd.bodyPreview) {
                  existingHash = currentContentHash; // Force match!
                }
              }

              let metadataDescription = existing?.description || '';
              let metadataSeo = existing?.seo;
              let agentAnalysis = existing?.agentAnalysis;

              if (!force && existing && isSkillFullyOptimized(existing) && existingHash === currentContentHash) {
                process.stdout.write('H'); // H = Hash Match Faster Skip
                metadataDescription = existing.description;
                metadataSeo = existing.seo;
                agentAnalysis = existing.agentAnalysis;
              } else {
                const metadata = await processMetadata(skillId, rawDesc, {
                  name: skillMd?.name || skillDir.name,
                  topics: repoInfo.topics || [],
                  bodyPreview: skillMd?.bodyPreview,
                  category: 'official',
                });
                metadataDescription = metadata.description;
                metadataSeo = metadata.seo;

                // Generate Agent Analysis + translate
                const rawAgentAnalysis = await aiService.generateAgentAnalysis(
                  skillMd?.name || skillDir.name,
                  rawDesc,
                  skillMd?.bodyPreview || '',
                );
                if (rawAgentAnalysis) {
                  agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
                }
              }

              const skillMdAny = skillMd as any;
              if (skillMdAny && skillMdAny.body) {
                skillMdAny.body = injectOriginalityBlock(skillMdAny.body, {
                  owner: repo.owner,
                  repo: repo.repo,
                  filePath: isSingleFile ? repo.skillsPath : `${repo.skillsPath}/${skillDir.name}/SKILL.md`,
                });
              }

              const skill: SkillCache = {
                id: skillId,
                name: skillMd?.name || skillDir.name,
                description: metadataDescription,
                owner: repo.owner,
                repo: repo.repo,
                repoPath,
                filePath: isSingleFile ? repo.skillsPath : `${repo.skillsPath}/${skillDir.name}/SKILL.md`,
                stars: repoInfo.stargazers_count,
                forks: repoInfo.forks_count,
                updatedAt: repoInfo.updated_at,
                topics: repoInfo.topics || [],
                skillMd,
                category: 'official',
                lastSynced: new Date().toISOString(),
                seo: metadataSeo,
                agentAnalysis: agentAnalysis,
                contentHash: currentContentHash,
                repoEtag: currentRepoEtag,
              };

              console.log(`      ✅ Added skill: ${skill.name} (${skill.id})`);
              skill.qualityScore = calculateQualityScore(skill);
              attachTrustProfile(skill);
              skills.push(skill);
              globalSkillsRef = skills; // Update reference

              // NEW: Auto-save checkpoint
              if (skills.length % 5 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} official processed)...`);
                await saveStateOnly(skills);
              }
              process.stdout.write('.');
            }
          }
        } catch (e) {
          console.log(`      ⚠️ Failed to list skills directory: ${e}`);

          // FALLBACK: Use cached skills for this repo
          const repoSkills = Array.from(existingMap.values()).filter(
            (s) => s.owner === repo.owner && s.repo === repo.repo,
          );
          if (repoSkills.length > 0) {
            console.log(`      ⚠️ Using ${repoSkills.length} cached skills for ${repoPath} due to error`);
            for (const existing of repoSkills) {
              const skillId = existing.id;
              if (processedRepos.has(skillId)) continue;
              processedRepos.add(skillId);

              // Check filter
              if (filters.length > 0) {
                const match = filters.some(
                  (f) =>
                    skillId.toLowerCase().includes(f) ||
                    repo.owner.toLowerCase().includes(f) ||
                    repo.repo.toLowerCase().includes(f),
                );
                if (!match) continue;
              }

              console.log(`      Found candidate (cached): ${existing.name}`);

              // Use existing metadata/content
              const skillMd = existing.skillMd;
              const rawDesc =
                skillMd?.description ||
                (typeof existing.description === 'string' ? existing.description : existing.description.en);
              const bodyPreview = skillMd?.bodyPreview || ''; // Use bodyPreview if available

              const skill: SkillCache = {
                ...existing,
                lastSynced: new Date().toISOString(), // Update sync time
              };

              // RE-GENERATE AI text
              process.stdout.write('T');
              const rawAgentAnalysis = await aiService.generateAgentAnalysis(skill.name, rawDesc, bodyPreview);
              if (rawAgentAnalysis) {
                skill.agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
              }

              skill.qualityScore = calculateQualityScore(skill);
              attachTrustProfile(skill);
              skills.push(skill);
              globalSkillsRef = skills; // Update reference

              // NEW: Auto-save checkpoint
              if (skills.length % 5 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} official processed)...`);
                await saveStateOnly(skills);
              }
              process.stdout.write('.');
            }
          }
        }
      } else {
        const skillId = repoPath;

        if (!processedRepos.has(skillId)) {
          processedRepos.add(skillId);

          // INCREMENTAL CHECK: Single-file repo
          const existing = existingMap.get(skillId);
          if (existing && isSkillFullyOptimized(existing) && !force) {
            if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
              console.log(`      ⏩ Skipping fetch (Cached & Fresh): ${repo.repo}`);
              skills.push(existing);
              process.stdout.write('s');
              continue;
            }
          }

          const skillMdContent = await fetchSkillMd(repo.owner, repo.repo, '');
          const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : undefined;
          const rawDesc = skillMd?.description || repoInfo.description || '';

          const currentContentHash = computeHash(skillMdContent || rawDesc || '');

          let metadataDescription: SkillCache['description'];
          let metadataSeo: SkillCache['seo'];
          let agentAnalysis = existing?.agentAnalysis;
          let existingHash =
            existing?.contentHash || (existing?.skillMd?.body ? computeHash(existing.skillMd.body) : undefined);

          if (!existingHash && existing?.skillMd?.bodyPreview && skillMd?.bodyPreview) {
            if (existing.skillMd.bodyPreview === skillMd.bodyPreview) {
              existingHash = currentContentHash; // Force match!
            }
          }

          if (!force && existing && isSkillFullyOptimized(existing) && existingHash === currentContentHash) {
            process.stdout.write('H');
            metadataDescription = existing.description;
            metadataSeo = existing.seo;
            agentAnalysis = existing.agentAnalysis;
          } else {
            const metadata = await processMetadata(skillId, rawDesc, {
              name: skillMd?.name || repoInfo.name,
              topics: repoInfo.topics || [],
              bodyPreview: skillMd?.bodyPreview,
              category: 'official',
            });
            metadataDescription = metadata.description;
            metadataSeo = metadata.seo;

            const rawAgentAnalysis = await aiService.generateAgentAnalysis(
              skillMd?.name || repoInfo.name,
              rawDesc,
              skillMd?.bodyPreview || '',
            );
            if (rawAgentAnalysis) {
              agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
            }
          }

          const skillMdAny = skillMd as any;
          if (skillMdAny && skillMdAny.body) {
            skillMdAny.body = injectOriginalityBlock(skillMdAny.body, {
              owner: repo.owner,
              repo: repo.repo,
              filePath: repo.skillsPath || 'SKILL.md',
            });
          }

          const skill: SkillCache = {
            id: skillId,
            name: skillMd?.name || repoInfo.name,
            description: metadataDescription,
            seo: metadataSeo,
            owner: repo.owner,
            repo: repo.repo,
            repoPath,
            filePath: repo.skillsPath || 'SKILL.md',
            stars: repoInfo.stargazers_count,
            forks: repoInfo.forks_count,
            updatedAt: repoInfo.updated_at,
            topics: repoInfo.topics || [],
            skillMd,
            category: 'official',
            lastSynced: new Date().toISOString(),
            agentAnalysis: agentAnalysis,
            contentHash: currentContentHash,
            repoEtag: currentRepoEtag,
          };

          skill.qualityScore = calculateQualityScore(skill);
          attachTrustProfile(skill);
          skills.push(skill);
          globalSkillsRef = skills; // Update reference

          // NEW: Auto-save checkpoint
          if (skills.length % 5 === 0) {
            console.log(`\n\n💾 Auto-saving progress (${skills.length} official processed)...`);
            await saveStateOnly(skills);
          }
          process.stdout.write('.');
        }
      }
    }
  } else {
    console.log(
      existingOnly
        ? '📦 Skipping official repos check (--existing-only)'
        : '📦 Skipping official repos check (Discover Mode)',
    );
    // In discover mode, we still need to keep existing official skills in the list
    // We'll load them from existingMap later in step 3
  }

  if (!existingOnly) {
    // 2. 搜索更多 Skills
    console.log('\n🔍 Searching for more skills...');
    const searchResults = await searchGitHubSkills();
    const skillsToProcess: any[] = [];

    for (const item of searchResults) {
      // Handle both GitHub API format and local backup format
      let repoName = '';
      let ownerLogin = '';
      let stars: number;
      let forks: number;
      let updatedAt: string;
      let topics: string[];
      let rawDesc: string;
      let content = '';
      let filePath: string;

      if (item.repository) {
        // GitHub API format
        const repo = item.repository;
        repoName = repo.name;
        ownerLogin = typeof repo.owner === 'object' ? repo.owner.login : repo.owner;
        stars = repo.stargazers_count;
        forks = repo.forks_count;
        updatedAt = repo.updated_at;
        topics = repo.topics || [];
        rawDesc = repo.description || '';
        filePath = item.path || '';
      } else {
        // Local backup format (flat structure)
        repoName = item.repo;
        ownerLogin = item.owner;
        stars = item.stars || 0;
        forks = item.forks || 0;
        updatedAt = item.fetchedAt || item.updatedAt || new Date().toISOString();
        topics = item.topics || [];
        rawDesc = item.description || '';
        content = item.content || '';
        filePath = item.filePath || '';
      }

      // Bug Fix: 使用 repoPath + skillName 作为去重键
      // Note: we can't be 100% sure of skillId until we parse skillMd
      // But we can check if any skill from this repo/path is already in processed-repos
      const repoPath = `${ownerLogin}/${repoName}`;
      const dedupeKey = filePath ? `${repoPath}/${filePath}` : repoPath;
      if (processedRepos.has(dedupeKey)) continue;

      // NEW: Check if this repo/path is already in existingMap and complete
      // We look for any skill that matches this owner/repo/path
      const existingSkill = Array.from(existingMap.values()).find(
        (s) => s.owner === ownerLogin && s.repo === repoName && (s.repoPath === repoPath || s.id.startsWith(repoPath)),
      );

      // Optimization: If existing skill is fully optimized and NOT updated, use it directly
      // Note: we use item.updatedAt (from search result) to check for updates
      if (existingSkill && isSkillFullyOptimized(existingSkill) && !hasSkillUpdated(existingSkill, updatedAt)) {
        skills.push(existingSkill);
        // We need a unique ID for processedRepos, use the one from cache
        processedRepos.add(existingSkill.id);
        process.stdout.write('s');
        continue;
      }

      // Content fetching moved to parallel step
      // if (!content) continue; // Allow empty content to proceed to parallel step

      skillsToProcess.push({
        owner: ownerLogin,
        repo: repoName,
        stars: stars,
        forks: forks,
        updatedAt: updatedAt,
        topics: topics,
        description: rawDesc,
        content: content,
        filePath: filePath,
      });
    }

    // P0 FIX: Pre-filter dedup by repo name — keep only highest-stars entry per name
    // This eliminates 90%+ of junk items BEFORE expensive fetch/translate
    const nameStarsMap = new Map<string, { idx: number; stars: number }>();
    for (let i = 0; i < skillsToProcess.length; i++) {
      const item = skillsToProcess[i];
      // Use repo name as rough skill name proxy (exact name requires parsing)
      const nameKey = item.repo.toLowerCase();
      const existing = nameStarsMap.get(nameKey);
      if (!existing || item.stars > existing.stars) {
        nameStarsMap.set(nameKey, { idx: i, stars: item.stars });
      }
    }
    const dedupedIndices = new Set(Array.from(nameStarsMap.values()).map((v) => v.idx));
    const beforeDedup = skillsToProcess.length;
    const dedupedSkillsToProcess = skillsToProcess.filter((_: any, i: number) => dedupedIndices.has(i));
    if (beforeDedup !== dedupedSkillsToProcess.length) {
      console.log(
        `\n🧹 Pre-filter: ${beforeDedup} → ${dedupedSkillsToProcess.length} items (removed ${beforeDedup - dedupedSkillsToProcess.length} repo-name duplicates)`,
      );
    }

    // Track processed skill names to avoid translating same-named skills from different repos
    const processedNames = new Set<string>();

    const limit = pLimit(8); // Concurrency 8
    await Promise.all(
      dedupedSkillsToProcess.map((item: any) =>
        limit(async () => {
          if (isTimeUp()) return;
          try {
            // 0. Fetch content if missing (Parallelized)
            if (!item.content && item.filePath) {
              try {
                const filePath = item.filePath;

                // Bug Fix: 严格验证文件名
                const fileName = filePath.split('/').pop() || '';
                const isValidFile =
                  fileName === 'SKILL.md' ||
                  fileName === 'SKILL.MD' ||
                  (filePath.includes('/skills/') && fileName.toLowerCase() === 'skill.md');

                if (isValidFile) {
                  item.content = (await fetchSkillMd(item.owner, item.repo, filePath)) || '';
                }
                // Jitter delay (100-500ms)
                await new Promise((r) => setTimeout(r, 100 + Math.random() * 400));
              } catch (e) {
                console.error(`Fetch failed for ${item.repo}:`, e);
              }
            }

            // Fallback fetch
            if (!item.content) {
              try {
                const fetched = await fetchSkillMd(
                  item.owner,
                  item.repo,
                  item.filePath ? item.filePath.replace('/SKILL.md', '').replace('SKILL.md', '') : '',
                );
                if (fetched) item.content = fetched;
              } catch {}
            }

            if (!item.content) return;

            // 1. Validation & Parsing checks
            const skillMd = parseSkillMd(item.content);
            if (!skillMd || !skillMd.name) {
              // Invalid structure - not a proper SKILL.md
              return;
            }
            if (
              getThemeExclusionReason({
                name: skillMd.name,
                owner: item.owner,
                repo: item.repo,
                body: skillMd.body || skillMd.bodyPreview || '',
                description: skillMd.description || item.description || '',
                topics: item.topics || [],
                category: item.category,
                filePath: item.filePath,
              })
            ) {
              process.stdout.write('X');
              return;
            }

            // 2. Generate Unique ID
            // Use repoPath + skillName to allow multiple skills per repo
            const repoPath = `${item.owner}/${item.repo}`;
            const skillId = `${repoPath}/${skillMd.name}`;

            if (processedRepos.has(skillId)) return;

            // P0 FIX: Name-level dedup — if another repo already claimed this skill name, skip
            const skillNameKey = skillMd.name.toLowerCase();
            if (processedNames.has(skillNameKey)) {
              process.stdout.write('D'); // D = Duplicate name skipped
              return;
            }

            // Check if existing in cache
            const existing = existingMap.get(skillId);
            if (!force && existing && isSkillFullyOptimized(existing) && !hasSkillUpdated(existing, item.updatedAt)) {
              skills.push(existing);
              processedRepos.add(skillId);
              globalSkillsRef = skills; // Keep reference updated

              // NEW: Auto-save checkpoint for official skills
              if (skills.length % 10 === 0) {
                console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
                await saveStateOnly(skills);
              }
              process.stdout.write('s');
              return;
            }

            processedRepos.add(skillId);

            // console.log(`   → ${skillId}`);
            process.stdout.write('.');

            const currentContentHash = computeHash(item.content || item.description || '');

            const itemContent = item.content || '';
            const parsedSkillMd = itemContent ? parseSkillMd(itemContent) : undefined;

            let existingHash =
              existing?.contentHash || (existing?.skillMd?.body ? computeHash(existing.skillMd.body) : undefined);

            // Assume same definition hash if the preview is identical
            if (!existingHash && existing?.skillMd?.bodyPreview && parsedSkillMd?.bodyPreview) {
              if (existing.skillMd.bodyPreview === parsedSkillMd.bodyPreview) {
                existingHash = currentContentHash; // Force match!
              }
            }

            let metadataDescription = existing?.description || '';
            let metadataSeo = existing?.seo;
            let agentAnalysis = existing?.agentAnalysis;

            if (!force && existing && isSkillFullyOptimized(existing) && existingHash === currentContentHash) {
              process.stdout.write('H'); // Hash Match Skip
              metadataDescription = existing.description;
              metadataSeo = existing.seo;
              agentAnalysis = existing.agentAnalysis;
            } else {
              const metadata = await processMetadata(skillId, item.description || '', {
                name: skillMd.name,
                topics: item.topics || [],
                bodyPreview: skillMd.bodyPreview,
                category: item.category || 'community',
              });
              metadataDescription = metadata.description;
              metadataSeo = metadata.seo;

              const rawAgentAnalysis = await aiService.generateAgentAnalysis(
                skillMd.name,
                typeof metadataDescription === 'string' ? metadataDescription : metadataDescription.en,
                skillMd.bodyPreview || '',
              );
              if (rawAgentAnalysis) {
                agentAnalysis = await aiService.translateAgentAnalysis(rawAgentAnalysis);
              }
            }

            const skillMdAny = skillMd as any;
            if (skillMdAny && skillMdAny.body) {
              skillMdAny.body = injectOriginalityBlock(skillMdAny.body, {
                owner: item.owner,
                repo: item.repo,
                filePath: item.filePath,
              });
            }

            const skill: SkillCache = {
              id: skillId,
              name: skillMd.name,
              description: metadataDescription,
              seo: metadataSeo,
              owner: item.owner,
              repo: item.repo,
              repoPath,
              filePath: item.filePath,
              stars: item.stars || 0,
              forks: item.forks || 0,
              updatedAt: item.updatedAt || new Date().toISOString(),
              topics: item.topics || [],
              category: 'community',
              skillMd: skillMd,
              lastSynced: new Date().toISOString(),
              agentAnalysis: agentAnalysis,
              contentHash: currentContentHash,
            };

            skill.qualityScore = calculateQualityScore(skill);
            attachTrustProfile(skill);

            // 收录门槛：score > 0 即为结构有效的 SKILL.md（score=0 = 无名字/可疑/空内容）
            if ((skill.qualityScore || 0) <= 0) {
              process.stdout.write('Q'); // Q = 无效结构
              return;
            }

            processedNames.add(skillNameKey); // Claim this name after quality check passes
            skills.push(skill);

            // Auto-save every 10 newly processed skills
            if (skills.length % 10 === 0) {
              console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
              await saveStateOnly(skills);
            }
          } catch (e) {
            console.error(`\n❌ Error processing ${item.owner}/${item.repo}:`, e);
          }
        }),
      ),
    );

    // 2.5 自动发现 GitHub 上新发布的 Skills
    console.log('\n🔎 Auto-discovering new Skills from GitHub...');
    const discoveredSkills = await discoverNewSkillsFromGitHub(
      processedRepos,
      lastCacheUpdate,
      mode === 'full-discovery',
    );

    const limit2 = pLimit(8);
    await Promise.all(
      discoveredSkills.map((item) =>
        limit2(async () => {
          if (isTimeUp()) return;
          try {
            const skillMd = parseSkillMd(item.content);
            if (!skillMd || !skillMd.name) return;
            if (
              getThemeExclusionReason({
                name: skillMd.name,
                owner: item.owner,
                repo: item.repo,
                body: skillMd.body || skillMd.bodyPreview || '',
                description: skillMd.description || item.description || '',
                topics: item.topics || [],
                category: item.category,
                filePath: item.filePath,
              })
            ) {
              return;
            }

            const repoPath = `${item.owner}/${item.repo}`;
            const skillId = `${repoPath}/${skillMd.name}`;

            if (processedRepos.has(skillId)) return;

            // Apply Filter for discovered skills
            if (filters.length > 0) {
              const match = filters.some(
                (f) =>
                  skillMd.name.toLowerCase().includes(f) ||
                  item.repo.toLowerCase().includes(f) ||
                  item.owner.toLowerCase().includes(f),
              );
              if (!match) return;
            }

            // 快速预验证：如果质量分太低，直接跳过不处理元数据
            // 构造一个临时对象进行评分
            const tempSkill: any = {
              id: skillId,
              name: skillMd.name,
              description: skillMd.description || item.description || '',
              owner: item.owner,
              repo: item.repo,
              repoPath: `${item.owner}/${item.repo}`,
              filePath: item.filePath,
              stars: item.stars || 0,
              updatedAt: item.updatedAt || new Date().toISOString(),
              skillMd: skillMd,
            };

            const strictScore = calculateQualityScore(tempSkill);

            // 严格模式：新发现的技能如果分数低于 20 (was 30)，直接丢弃
            if (strictScore < 20) {
              // console.log(`Skipping low quality skill: ${skillId} (Score: ${strictScore})`);
              return;
            }

            processedRepos.add(skillId);

            const rawDesc = skillMd.description || item.description || '';

            const currentContentHash = computeHash(item.content || rawDesc || '');

            const metadata = await processMetadata(skillId, rawDesc, {
              name: skillMd.name,
              topics: item.topics || [],
              bodyPreview: skillMd.bodyPreview,
              category: item.category || 'community',
            });

            const skill: SkillCache = {
              id: skillId,
              name: skillMd.name,
              description: metadata.description,
              seo: metadata.seo,
              agentAnalysis: undefined, // Will be populated in update step
              owner: item.owner,
              repo: item.repo,
              repoPath: `${item.owner}/${item.repo}`,
              filePath: item.filePath,
              stars: item.stars || 0,
              forks: item.forks || 0,
              updatedAt: item.fetchedAt || item.updatedAt || new Date().toISOString(),
              topics: item.topics || [],
              category: 'community',
              skillMd: skillMd,
              lastSynced: new Date().toISOString(),
              contentHash: currentContentHash,
            };

            skill.category = determineCategory(skill);
            globalSkillsRef = skills; // Keep reference updated

            // Auto-save every 10 newly discovered skills
            if (skills.length % 10 === 0) {
              console.log(`\n\n💾 Auto-saving progress (${skills.length} processed)...`);
              await saveStateOnly(skills);
            }
          } catch (e) {
            console.error(`\n❌ Error processing discovered skill:`, e);
          }
        }),
      ),
    );

    if (discoveredSkills.length > 0) {
      console.log(`\n   → Added ${discoveredSkills.length} newly discovered Skills`);
    }
  } else {
    console.log('\n⏭️ Skipping GitHub search and auto-discovery (--existing-only)');
  }

  // 3. 保留并重新优化现有缓存项 (Preserve & Smart Update)
  console.log(`\n📦 Auditing & Optimizing existing cache items (Concurrency: 5)...`);

  // 准备任务列表
  const tasks: SkillCache[] = [];
  let processedCount = 0;

  if (mode === 'update') {
    for (const [id, skill] of existingMap.entries()) {
      if (!processedRepos.has(id)) {
        if (selectedBatchIds && !selectedBatchIds.has(id)) {
          skills.push(skill);
          continue;
        }
        if (selectedBatchIds && (completedBatchIds.has(id) || skippedBatchIds.has(id))) {
          skills.push(skill);
          continue;
        }
        // Apply Filter for existing items
        if (filters.length > 0) {
          const match = filters.some(
            (f) =>
              skill.name.toLowerCase().includes(f) ||
              skill.repo.toLowerCase().includes(f) ||
              skill.owner.toLowerCase().includes(f),
          );
          if (!match) {
            skills.push(skill); // Preserve without processing
            continue; // Skip adding to tasks
          }
        }
        tasks.push(skill);
      }
    }
  } else {
    // In DISCOVER mode, we keep existing skills but apply quality filter
    // to prevent low-quality skills from persisting indefinitely
    console.log(`\n⏭️  Preserving existing skills with quality check (Discover Mode)`);
    let preservedCount = 0;
    let droppedCount = 0;
    for (const [id, skill] of Array.from(existingMap.entries())) {
      if (!processedRepos.has(id)) {
        const isOfficial =
          OFFICIAL_REPOS.some((or) => or.owner === skill.owner && or.repo === skill.repo) ||
          skill.category === 'official';
        // 收录门槛：只丢弃结构无效的（score=0）
        if (!isOfficial && (skill.qualityScore || 0) <= 0) {
          droppedCount++;
          continue;
        }
        skills.push(skill);
        preservedCount++;
      }
    }
    if (droppedCount > 0) {
      console.log(`   🗑️ Dropped ${droppedCount} invalid cached skills (score = 0)`);
    }
    console.log(`   ✅ Preserved ${preservedCount} existing skills`);
  }

  if (mode === 'update') {
    // Use the robust pLimit from utils (handles errors correctly)
    const pLimit = (concurrency: number) => {
      const queue: (() => Promise<void>)[] = [];
      let activeCount = 0;

      const next = () => {
        activeCount--;
        if (queue.length > 0) {
          queue.shift()!();
        }
      };

      const run = (fn: () => Promise<void>) =>
        new Promise<void>((resolve, reject) => {
          const trigger = async () => {
            activeCount++;
            try {
              await fn();
              resolve();
            } catch (e) {
              reject(e);
            } finally {
              next();
            }
          };

          if (activeCount < concurrency) {
            trigger();
          } else {
            queue.push(trigger);
          }
        });

      return run;
    };

    const configuredConcurrency = Number(
      process.env.BATCH_SKILL_CONCURRENCY || process.env.AI_CONCURRENCY_LIMIT || '4',
    );
    const CONCURRENCY = Number.isFinite(configuredConcurrency) ? Math.max(1, configuredConcurrency) : 4;
    const limit = pLimit(CONCURRENCY);

    console.log(`\n🚀 Processing ${tasks.length} skills with Concurrency=${CONCURRENCY}...`);

    if (selectedBatchIds && tasks.length === 0) {
      const hasPendingSelectedIds = batchHasPendingSelectedIds();
      if (batchProgress) {
        batchProgress = {
          ...batchProgress,
          status: hasPendingSelectedIds ? 'paused' : failedBatchEntries.length > 0 ? 'partial' : 'completed',
          completedAt: hasPendingSelectedIds ? null : new Date().toISOString(),
        };
        persistBatchProgress();
      }
      console.log(
        hasPendingSelectedIds
          ? '\n⚠️ Batch mode has no runnable tasks but still has pending selected IDs. Keeping checkpoint and skipping cache rewrite.'
          : '\n✅ Batch mode already fully processed for selected IDs. Skipping cache rewrite.',
      );
      return;
    }

    if (dryRunBatch && selectedBatchIds) {
      persistBatchProgress();
      console.log(`\n🧪 Dry-run batch ready. Pending ids: ${tasks.length}`);
      return;
    }

    const promises = tasks.map((skill, _index) =>
      limit(async () => {
        try {
          if (isTimeUp()) {
            skills.push(skill); // CRITICAL: Preserve the un-updated skill so it isn't deleted from the cache
            return;
          }

          const originalSkill = JSON.parse(JSON.stringify(skill)) as SkillCache;
          const currentDesc = typeof skill.description === 'string' ? skill.description : skill.description.en || '';

          // 增量翻译: 翻译完整 + SEO 完整 + 无更新 → 跳过
          if (isSkillFullyOptimized(skill) && !hasSkillUpdated(skill)) {
            skills.push(skill);
            recordBatchCompletion(skill.id, 'skipped');
            process.stdout.write('S'); // Skip (Optimized)
          } else {
            const rawDesc = skill.skillMd?.description || currentDesc || '';
            const context = {
              name: skill.name,
              topics: skill.topics,
              bodyPreview: skill.skillMd?.bodyPreview,
              category: skill.category,
            };
            const repairedMetadata = aiService.repairMetadataDeterministically(rawDesc, context, {
              description: skill.description,
              seo: skill.seo,
            });
            const repairedDescriptionText =
              typeof repairedMetadata.description === 'string'
                ? repairedMetadata.description
                : repairedMetadata.description.en || '';
            const repairedAgentAnalysis = aiService.repairAgentAnalysisDeterministically(
              skill.name,
              repairedDescriptionText,
              context.bodyPreview || '',
              skill.agentAnalysis,
            );
            const locallyRepairedSkill: SkillCache = {
              ...skill,
              description: repairedMetadata.description,
              seo: repairedMetadata.seo,
              agentAnalysis: repairedAgentAnalysis,
              lastSynced: new Date().toISOString(),
            };

            if (isSkillFullyOptimized(locallyRepairedSkill)) {
              skills.push(locallyRepairedSkill);
              processedCount++;
              recordBatchCompletion(skill.id, 'completed');
              process.stdout.write('R'); // deterministic local repair
              return;
            }

            // Add random delay to prevent initial burst
            await new Promise((r) => setTimeout(r, Math.random() * 2000));

            const metadata = await processMetadata(skill.id, rawDesc, context);
            const normalizedMetadata = aiService.repairMetadataDeterministically(rawDesc, context, {
              description: metadata.description,
              seo: metadata.seo,
            });
            skill.description = normalizedMetadata.description;
            skill.seo = normalizedMetadata.seo;

            // Generate Agent Analysis + translate (same NVIDIA key)
            const rawAgentAnalysis = await aiService.generateAgentAnalysis(
              skill.name,
              typeof skill.description === 'string' ? skill.description : skill.description.en || currentDesc,
              context.bodyPreview || '',
            );
            const translatedAgentAnalysis = rawAgentAnalysis
              ? await aiService.translateAgentAnalysis(rawAgentAnalysis)
              : locallyRepairedSkill.agentAnalysis;
            skill.agentAnalysis = aiService.repairAgentAnalysisDeterministically(
              skill.name,
              typeof skill.description === 'string' ? skill.description : skill.description.en || currentDesc,
              context.bodyPreview || '',
              translatedAgentAnalysis,
            );

            skill.lastSynced = new Date().toISOString();

            if (!isSkillFullyOptimized(skill)) {
              const issueCodes = collectOptimizationIssues(skill).map((issue) => issue.code);
              if (process.env.AI_DEBUG_METADATA === '1') {
                console.warn(`[SEO Gate] ${skill.id} failed with issues: ${issueCodes.join(', ') || 'unknown'}`);
                console.warn(
                  `[SEO Gate] title=${JSON.stringify(skill.seo?.title?.en || '')} keywords=${JSON.stringify(skill.seo?.keywords?.en || [])}`,
                );
              }
              skills.push(originalSkill);
              recordBatchFailure(
                skill.id,
                new Error(
                  `Regenerated output did not satisfy the optimization gate${issueCodes.length ? `: ${issueCodes.join(', ')}` : ''}`,
                ),
              );
              process.stdout.write('F');
              return;
            }

            skills.push(skill);
            processedCount++;
            recordBatchCompletion(skill.id, 'completed');
            process.stdout.write('U'); // update (需要翻译)

            // Periodic Save every 50 updates
            if (processedCount % 50 === 0) {
              console.log(`\n💾 Auto-saving checkpoint (${processedCount} updates)...`);
              await saveStateOnly(skills);
            }
          }
        } catch (error) {
          skills.push(skill);
          recordBatchFailure(skill.id, error);
          console.error(`\n❌ Error processing ${skill.id}:`, error);
        }
      }),
    );

    await Promise.all(promises);
  } // End of if (mode === 'update')

  console.log(`\n   → Processed ${tasks.length} existing skills (Optimized: ${processedCount})`);

  if (isTimeUp()) {
    console.log(`\n⏳ Time limit reached! Saving progress via merge to prevent wiping unprocessed skills...`);
    await saveStateOnly(skills, 'paused');
  } else {
    await finalizeAndSave(skills);
  }

  if (batchProgress) {
    const hasPendingSelectedIds = batchHasPendingSelectedIds();
    batchProgress = {
      ...batchProgress,
      status: hasPendingSelectedIds ? 'paused' : failedBatchEntries.length > 0 ? 'partial' : 'completed',
      completedAt: hasPendingSelectedIds ? null : new Date().toISOString(),
    };
    persistBatchProgress();
  }

  globalPauseBatchProgress = null;
}

/**
 * Finalize, clean up, and save the cache to file and KV
 */
async function finalizeAndSave(skills: SkillCache[]): Promise<void> {
  console.log(`\n🧹 Running final cleanup & saving...`);
  const beforeCount = skills.length;

  // helper to get desc text
  const getDescText = (s: SkillCache) => (typeof s.description === 'string' ? s.description : s.description.en || '');

  // Dedup by ID — each skill page is unique. Only apply quality filters.
  const idMap = new Map<string, SkillCache>();

  for (const skill of skills) {
    const normalizedSkill = ensureSkillMdContent(skill);
    const desc = getDescText(normalizedSkill);
    // Explicitly check if it is an official repo
    const isOfficial =
      OFFICIAL_REPOS.some((or) => or.owner === normalizedSkill.owner && or.repo === normalizedSkill.repo) ||
      normalizedSkill.category === 'official';

    // 收录门槛：score > 0 = 结构有效的 SKILL.md
    // qualityScore 仍用于前端「精选」排序，但不阻止收录
    if (!isOfficial && (normalizedSkill.qualityScore || 0) <= 0) {
      continue;
    }

    // Rule 1: Minimum Description Length (10 chars) — pages without content hurt SEO
    if (!isOfficial && desc.length < 10) {
      continue;
    }

    // Rule 2: Stars gate REMOVED — AI agent skills are often personal config repos

    // Dedup: if same ID appears twice, keep the latest
    idMap.set(normalizedSkill.id, normalizedSkill);
  }

  const cleanedSkills = Array.from(idMap.values()).sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  const normalizedSkills = cleanedSkills.map((skill) =>
    toPublicSkillCache(attachTrustProfile(ensureSkillMdContent(skill))),
  );
  console.log(`   → Removed ${beforeCount - cleanedSkills.length} low-quality/duplicate skills`);
  console.log(`   → Final count: ${normalizedSkills.length}`);

  // 4. 保存缓存
  const cacheData: CacheData = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    totalCount: normalizedSkills.length,
    skills: normalizedSkills,
  };

  const outputDir = path.join(process.cwd(), 'data');
  const outputFile = path.join(outputDir, 'skills-cache.json');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));
  persistAiRuntimeSummary('completed');

  console.log(`\n✅ Cache saved successfully!`);
  console.log(`   📊 Total skills: ${cleanedSkills.length}`);
  console.log(`   📁 Output: ${outputFile}`);

  // ========== Generate Sitemap Data ==========
  const sitemapData = buildSitemapSkillsData(normalizedSkills);
  const sitemapFile = path.join(outputDir, 'sitemap-skills.json');
  fs.writeFileSync(sitemapFile, JSON.stringify(sitemapData, null, 2));
  console.log(`   🗺️  Sitemap data generated: ${sitemapFile} (${sitemapData.length} items)`);

  const skillLocaleGovernance = buildSkillLocaleGovernanceIndex(normalizedSkills);
  const skillLocaleGovernanceFile = path.join(outputDir, 'seo-skill-locale-governance.json');
  fs.writeFileSync(skillLocaleGovernanceFile, JSON.stringify(skillLocaleGovernance, null, 2));
  console.log(
    `   🌐 Skill locale governance generated: ${skillLocaleGovernanceFile} (${skillLocaleGovernance.summary.eligibleVariants} eligible variants)`,
  );

  refreshSkillIndexabilityReport();
  console.log(`   📉 Skill indexability report refreshed: reports/seo/latest-skill-indexability.json`);

  refreshGovernedSkillCorpus();
  console.log(`   🧭 Governed skill corpus refreshed: ${sitemapFile}`);

  // ========== 清除本地 miniflare KV 缓存 ==========
  // 确保 dev server 使用最新的 skills-cache.json 而非过期的 miniflare KV 数据
  const miniflareKvDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'kv', KV_NAMESPACE_ID);
  if (fs.existsSync(miniflareKvDir)) {
    try {
      fs.rmSync(miniflareKvDir, { recursive: true, force: true });
      console.log(`   🧹 Cleared local miniflare KV cache`);
    } catch (error) {
      console.warn(`   ⚠️ Failed to clear miniflare KV cache:`, error);
    }
  }

  // ========== 提示同步 KV ==========
  console.log(`\n📋 To deploy to Cloudflare KV, run: npm run sync:kv`);
}
/**
 * Quick save state (Raw JSON only, no KV sync)
 */
/**
 * Push a single skill to Cloudflare KV for real-time frontend updates.
 * Uses the same API as sync-to-kv.ts but writes only `skill:{id}` key.
 * Non-blocking: failures are logged but don't interrupt the build.
 * Reuses KV_NAMESPACE_ID from line ~237 and env vars from dotenv.
 */

async function saveStateOnly(skills: SkillCache[], runtimeStatus: 'running' | 'paused' = 'running'): Promise<void> {
  const outputDir = path.join(process.cwd(), 'data');
  const outputFile = path.join(outputDir, 'skills-cache.json');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // IMPORTANT: 3-layer merge to guarantee zero data loss:
  //   Layer 1: globalExistingMap (snapshot of the FULL initial cache from startup)
  //   Layer 2: on-disk file (in case other processes updated it)
  //   Layer 3: current session skills (newest, highest priority)
  const allSkillsMap = new Map<string, SkillCache>();

  // 1. Start with the FULL initial cache snapshot (never lose startup-loaded data)
  globalExistingMap.forEach((s, id) => allSkillsMap.set(id, s));

  // 2. Merge from file on disk (in case other processes or manual edits happened)
  if (fs.existsSync(outputFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8')) as CacheData;
      if (data.skills) data.skills.forEach((s) => allSkillsMap.set(s.id, s));
    } catch {
      /* ignore */
    }
  }

  // 3. Overwrite with current session skills (freshest data wins)
  skills.forEach((s) => allSkillsMap.set(s.id, s));

  // allSkillsMap is already deduped by ID — no secondary dedup needed.
  // Each skill has a unique ID; name collisions across repos are intentional (different pages).
  const uniqueSkills = Array.from(allSkillsMap.values()).map((skill) =>
    toPublicSkillCache(attachTrustProfile(ensureSkillMdContent(skill))),
  );

  const cacheData: CacheData = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    totalCount: uniqueSkills.length,
    skills: uniqueSkills,
  };
  fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));
  persistAiRuntimeSummary(runtimeStatus);

  const sitemapData = buildSitemapSkillsData(uniqueSkills);
  const sitemapFile = path.join(outputDir, 'sitemap-skills.json');
  fs.writeFileSync(sitemapFile, JSON.stringify(sitemapData, null, 2));

  const skillLocaleGovernance = buildSkillLocaleGovernanceIndex(uniqueSkills);
  const skillLocaleGovernanceFile = path.join(outputDir, 'seo-skill-locale-governance.json');
  fs.writeFileSync(skillLocaleGovernanceFile, JSON.stringify(skillLocaleGovernance, null, 2));
}

// Quality assessment and report generation extracted to:
// - ./lib/skill-quality.ts    (isSkillFullyOptimized, collectOptimizationIssues, etc.)
// - ./lib/regeneration-report.ts (writeRegenerationBaselineReport)

// Global reference for SIGINT handler
let globalSkillsRef: SkillCache[] = [];
// Global reference for existingMap — ensures saveStateOnly never loses startup-loaded data
let globalExistingMap: Map<string, SkillCache> = new Map();

// 运行
(async () => {
  globalSkillsRef = []; // Initialize
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Received SIGINT (Ctrl+C). Saving current progress...');
    if (globalPauseBatchProgress) {
      globalPauseBatchProgress();
    }
    await saveStateOnly(globalSkillsRef, 'paused');
    console.log('✅ Progress saved. Exiting.');
    process.exit(0);
  });

  await buildCache();
})().catch(console.error);
