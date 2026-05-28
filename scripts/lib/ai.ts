/**
 * Unified AI Service
 *
 * Consolidates all AI provider interactions used across:
 * - build-skills-cache.ts (translation, analysis, agent analysis)
 * - translate-blog.ts (blog translation)
 * - build-docs-cache.ts (docs translation)
 * - translate-locales.ts (UI translation)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  inspectAIBackupProviderPostures,
  resolveBackupPosturePriorityOffset,
  type AIBackupProviderPostureConfig,
} from '../../src/lib/ai-backup-posture';
import {
  parseAIFallbackPolicy as parseFallbackPolicy,
  type AIFallbackRoutingPolicy,
} from '../../src/lib/ai-fallback-policy';
import { buildAIOnlineProviderPool, splitAIProviderKeys } from '../../src/lib/ai-online-provider-pool';
import {
  buildProviderRoutingPlan,
  parseAIProviderWorkloadProfile,
  type AIProviderRoutingDecision,
  type AIProviderRoutingPressureEntry,
  type AIProviderRoutingState,
  type AIProviderWorkloadProfileName,
} from '../../src/lib/ai-provider-routing';
import { resolveAIProviderModel } from '../../src/lib/ai-provider-models';
import {
  ALLOWED_WORKERS_AI_FREE_MODELS,
  DEFAULT_WORKERS_AI_FREE_MODEL,
  DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS,
  DEFAULT_WORKERS_AI_FREE_MAX_CALLS,
  DEFAULT_WORKERS_AI_FREE_MAX_TOKENS,
} from './ai-config-guard';

// Load default .env first so runtime guards pick up repo-local policy.
dotenv.config();

// Then explicitly override with .env.local if present.
const localEnv = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

// Seed keywords — loaded once at startup from data/seed-keywords.json
// Edit that file to adjust SEO targeting without touching code.
interface SeedKeywords {
  navigational: string[];
  informational: string[];
  transactional: string[];
  long_tail: string[];
  theme_anchors: string[];
}
const SEED_KEYWORDS: SeedKeywords = (() => {
  try {
    const seedPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/seed-keywords.json');
    return JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as SeedKeywords;
  } catch {
    return { navigational: [], informational: [], transactional: [], long_tail: [], theme_anchors: [] };
  }
})();

// Rate limiting configuration
const MAX_CONCURRENT_REQUESTS = Number(process.env.AI_CONCURRENCY_LIMIT || '5');
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff: 1s, 2s, 4s, 8s, 16s
let activeRequests = 0;
const requestQueue: (() => void)[] = [];
const readPositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
type ProviderName = 'nvidia' | 'siliconflow' | 'openrouter' | 'cloudflare';
type BackupProviderName = Exclude<ProviderName, 'nvidia'>;
type AIWorkersMode = 'free-only' | 'disabled';
export type AIWorkersBudgetStatus = 'available' | 'disabled' | 'run_cap_reached' | 'daily_cap_reached';
export function parseWorkersAiMode(raw: string | undefined | null): AIWorkersMode {
  const normalized = String(raw || 'free-only')
    .trim()
    .toLowerCase();
  if (normalized === 'disabled') return 'disabled';
  if (normalized === 'free-only' || normalized === '') return 'free-only';

  console.warn(
    `[AIService] Unsupported WORKERS_AI_MODE "${normalized || 'empty'}". Workers AI is restricted to free-only or disabled; forcing free-only.`,
  );
  return 'free-only';
}
export function parseWorkersAiFreeModel(raw: string | undefined | null): string {
  const normalized = String(raw || '').trim();
  if (!normalized) return DEFAULT_WORKERS_AI_FREE_MODEL;
  if (ALLOWED_WORKERS_AI_FREE_MODELS.has(normalized)) return normalized;

  console.warn(
    `[AIService] Unsupported WORKERS_AI_FREE_MODEL "${normalized}". Workers AI free-only mode is limited to: ${Array.from(
      ALLOWED_WORKERS_AI_FREE_MODELS,
    ).join(', ')}. Falling back to ${DEFAULT_WORKERS_AI_FREE_MODEL}.`,
  );
  return DEFAULT_WORKERS_AI_FREE_MODEL;
}
export function parseWorkersAiFreeCap(raw: string | undefined | null, cap: number, envKey: string): number {
  const resolved = readPositiveInt(raw || undefined, cap);
  if (resolved > cap) {
    console.warn(`[AIService] ${envKey}=${resolved} exceeds free-only ceiling ${cap}. Clamping to ${cap}.`);
    return cap;
  }
  return resolved;
}
const WORKERS_AI_MODE = parseWorkersAiMode(process.env.WORKERS_AI_MODE); // free-only | disabled
const getBackupProviderPostures = () =>
  inspectAIBackupProviderPostures(process.env as Record<string, string | undefined>, WORKERS_AI_MODE);
const WORKERS_AI_FREE_MODEL = parseWorkersAiFreeModel(process.env.WORKERS_AI_FREE_MODEL);
const WORKERS_AI_FREE_MAX_CALLS = parseWorkersAiFreeCap(
  process.env.WORKERS_AI_FREE_MAX_CALLS,
  DEFAULT_WORKERS_AI_FREE_MAX_CALLS,
  'WORKERS_AI_FREE_MAX_CALLS',
);
const WORKERS_AI_FREE_DAILY_MAX_CALLS = parseWorkersAiFreeCap(
  process.env.WORKERS_AI_FREE_DAILY_MAX_CALLS,
  DEFAULT_WORKERS_AI_FREE_DAILY_MAX_CALLS,
  'WORKERS_AI_FREE_DAILY_MAX_CALLS',
);
const WORKERS_AI_FREE_MAX_TOKENS = readPositiveInt(
  process.env.WORKERS_AI_FREE_MAX_TOKENS,
  DEFAULT_WORKERS_AI_FREE_MAX_TOKENS,
);
const WORKERS_AI_FREE_RETRYABLE_FAILURE_LIMIT = readPositiveInt(process.env.WORKERS_AI_FREE_RETRYABLE_FAILURE_LIMIT, 3);
const WORKERS_AI_USAGE_FILE =
  process.env.WORKERS_AI_USAGE_FILE || path.join(process.cwd(), '.tmp/workers-ai-usage.json');
const AI_LOCALE_BATCH_SIZE = readPositiveInt(process.env.AI_LOCALE_BATCH_SIZE, 4);
const PROVIDER_COOLDOWN_429_MS = readPositiveInt(process.env.AI_PROVIDER_COOLDOWN_429_MS, 20_000);
const PROVIDER_COOLDOWN_5XX_MS = readPositiveInt(process.env.AI_PROVIDER_COOLDOWN_5XX_MS, 8_000);
const NVIDIA_KEY_QUARANTINE_CONSECUTIVE_FAILURES = readPositiveInt(
  process.env.NVIDIA_KEY_QUARANTINE_CONSECUTIVE_FAILURES,
  3,
);
const NVIDIA_KEY_QUARANTINE_ON_429 = process.env.NVIDIA_KEY_QUARANTINE_ON_429 !== '0';
const HARD_DISABLE_STATUSES = new Set([401, 402, 403]);
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
type ProviderEntry = { provider: ProviderName; key: string; label: string };
const getOnlineProviderModel = (provider: Exclude<ProviderName, 'cloudflare'>): string =>
  resolveAIProviderModel(provider, {
    scope: 'script',
  }).model;
type WorkersAiBudgetState = {
  model: string;
  dailyDate: string;
  dailyCalls: number;
  dailyRemaining: number | null;
  runRemaining: number | null;
  maxCallsPerRun: number | null;
  maxCallsPerDay: number | null;
  maxTokens: number | null;
  canUse: boolean;
  status: AIWorkersBudgetStatus;
  blockedReason: string | null;
};
type ProviderPoolInspection = {
  primaryProviders: ProviderEntry[];
  backupProviders: ProviderEntry[];
  providers: ProviderEntry[];
  fallbackRouting: AIFallbackRoutingSnapshot;
};
const AI_FALLBACK_POLICY = parseFallbackPolicy(process.env.AI_FALLBACK_POLICY);
const AI_FALLBACK_ALWAYS_REASON =
  String(process.env.AI_FALLBACK_ALWAYS_REASON || 'policy_always').trim() || 'policy_always';

const acquireSlot = async (): Promise<() => void> => {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return () => {
      activeRequests--;
      const next = requestQueue.shift();
      if (next) next();
    };
  }
  return new Promise((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve(() => {
        activeRequests--;
        const next = requestQueue.shift();
        if (next) next();
      });
    });
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
import { SUPPORTED_LOCALES } from './constants';
import type { SeoData, AgentAnalysis, TranslateContext } from './types';
import { robustParseJSON, extractJSONCandidates, cleanAndTruncate, cleanAndClamp } from './utils';

export interface AIConfig {
  nvidiaKeys: string[];
  siliconFlowKey: string;
  openRouterKeys: string[];
  cfAccountId: string;
  cfApiToken: string;
  workloadProfile?: AIProviderWorkloadProfileName;
}

export interface AIStats {
  nvidia: number;
  siliconflow: number;
  openrouter: number;
  cloudflare: number;
  nvidiaFail: number;
}

export interface AIProviderEvent {
  timestamp: string;
  type:
    | 'provider_success'
    | 'provider_failure'
    | 'fallback_activated'
    | 'provider_hard_disabled'
    | 'provider_label_quarantined'
    | 'provider_cooldown'
    | 'retry_scheduled'
    | 'workers_budget_exhausted'
    | 'providers_unavailable';
  provider?: ProviderName;
  label?: string;
  status?: number;
  attempt?: number;
  delayMs?: number;
  detail: string;
}

export interface AIProviderLabelTelemetry {
  label: string;
  provider: ProviderName;
  selectionRank: number | null;
  successCount: number;
  failureCount: number;
  consecutiveRetryableFailures: number;
  consecutive429s: number;
  recentRetryableFailureCount: number;
  recent429Count: number;
  recentCooldownCount: number;
  lastPressureAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  lastEventAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  currentlyAvailable: boolean;
  coolingDown: boolean;
  cooldownUntil: string | null;
  cooldownReason: string | null;
  quarantined: boolean;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  hardDisabled: boolean;
  hardDisableReason: string | null;
}

export interface AIFallbackActivation {
  timestamp: string;
  provider: BackupProviderName;
  label: string;
  reason: string;
  policy: AIFallbackRoutingPolicy;
  attempt: number | null;
}

export interface AIFallbackRoutingSnapshot {
  policy: AIFallbackRoutingPolicy;
  workloadProfile?: AIProviderWorkloadProfileName;
  backupPriorityOrder?: BackupProviderName[];
  backupsAllowed: boolean;
  activationReason: string | null;
  decision: AIProviderRoutingDecision;
  decisionReason: string;
  nvidiaConfigured: boolean;
  nvidiaAvailable: boolean;
  configuredBackupProviders: BackupProviderName[];
  eligibleBackupProviders: Array<{ label: string; provider: BackupProviderName }>;
  pressureLabels: AIProviderRoutingPressureEntry[];
  recentActivations: AIFallbackActivation[];
}

export interface AIProviderTelemetrySnapshot {
  timestamp: string;
  mode: {
    workersAi: string;
    fallbackPolicy: AIFallbackRoutingPolicy;
    concurrencyLimit: number;
    localeBatchSize: number;
  };
  stats: AIStats;
  recentEvents: AIProviderEvent[];
  labelStats: AIProviderLabelTelemetry[];
  availableProviders: Array<{ label: string; provider: ProviderName }>;
  quarantinedLabels: Array<{ label: string; provider: ProviderName; reason: string; quarantinedAt: string | null }>;
  hardDisabledProviders: Array<{ provider: ProviderName; reason: string }>;
  coolingDownProviders: Array<{ label: string; until: string; msRemaining: number; reason: string }>;
  fallbackRouting: AIFallbackRoutingSnapshot;
  workersAi: {
    usageFile: string;
    model: string;
    callsThisRun: number;
    dailyDate: string;
    dailyCalls: number;
    dailyRemaining: number | null;
    runRemaining: number | null;
    maxCallsPerRun: number | null;
    maxCallsPerDay: number | null;
    maxTokens: number | null;
    canUse: boolean;
    status: AIWorkersBudgetStatus;
    blockedReason: string | null;
  };
}

const LOW_INTENT_KEYWORD_PATTERNS = [
  /(^|\b)(how to|what is|why|guide|tutorial|vs|versus|alternative|alternatives|best|top\s*\d*|comparison|compare|free|download)\b/i,
  /(是什么|怎么用|如何|教程|指南|对比|替代|最佳|免费)/,
  /(とは|使い方|チュートリアル|ガイド|比較|代替|おすすめ|無料)/,
  /(무엇|사용법|튜토리얼|가이드|비교|대안|추천|무료)/,
];

// Generic filler keywords that appear across ALL skills and carry no unique signal.
// These are filtered post-generation to enforce capability-specific precision.
const GENERIC_FILLER_KEYWORDS = new Set([
  'agentic workflow',
  'agentic workflow automation',
  'ai coding workflow',
  'ai coding agent workflow',
  'cursor workflow automation',
  'workflow automation',
  'workflow optimization',
  'automation skill',
  'ai agent skills for developers',
  'claude code skills',
  'windsurf skills',
  'cursor skills',
  'ai automation',
  'agent skill workflow',
]);
const LONG_CONTEXT_TRIGGER_CHARS = 6000;
const INVALID_SEO_KEYWORD_PATTERNS = [/\.\.\./, /\[[^\]]+\]/, /[?？]/];
const AI_DEBUG_METADATA = process.env.AI_DEBUG_METADATA === '1';
const AI_PROVIDER_EVENT_LIMIT = readPositiveInt(process.env.AI_PROVIDER_EVENT_LIMIT, 60);
const LOCALIZED_FALLBACK_LABELS: Record<
  string,
  {
    summary: string;
    suitability: string;
    recommendation: string;
    useCase: string;
    limitation: string;
  }
> = {
  zh: {
    summary: '本地化技能摘要：',
    suitability: '适用场景：',
    recommendation: '推荐说明：',
    useCase: '适用任务：',
    limitation: '限制说明：',
  },
  ja: {
    summary: 'ローカライズされた概要:',
    suitability: '適した場面:',
    recommendation: '推奨ポイント:',
    useCase: 'ユースケース:',
    limitation: '制約事項:',
  },
  ko: {
    summary: '현지화된 요약:',
    suitability: '적합한 상황:',
    recommendation: '추천 설명:',
    useCase: '사용 사례:',
    limitation: '제한 사항:',
  },
  es: {
    summary: 'Resumen localizado:',
    suitability: 'Escenario recomendado:',
    recommendation: 'Recomendacion:',
    useCase: 'Caso de uso:',
    limitation: 'Limitacion:',
  },
  fr: {
    summary: 'Resume localise :',
    suitability: 'Scenario recommande :',
    recommendation: 'Recommandation :',
    useCase: "Cas d'usage :",
    limitation: 'Limitation :',
  },
  de: {
    summary: 'Lokalisierte Zusammenfassung:',
    suitability: 'Geeigneter Einsatz:',
    recommendation: 'Empfehlung:',
    useCase: 'Anwendungsfall:',
    limitation: 'Einschraenkung:',
  },
  pt: {
    summary: 'Resumo localizado:',
    suitability: 'Cenario recomendado:',
    recommendation: 'Recomendacao:',
    useCase: 'Caso de uso:',
    limitation: 'Limitacao:',
  },
  ru: {
    summary: 'Локализованное описание:',
    suitability: 'Подходящий сценарий:',
    recommendation: 'Рекомендация:',
    useCase: 'Сценарий использования:',
    limitation: 'Ограничение:',
  },
  ar: {
    summary: 'ملخص محلي:',
    suitability: 'سيناريو مناسب:',
    recommendation: 'توصية:',
    useCase: 'حالة استخدام:',
    limitation: 'قيد:',
  },
};

type ProviderLabelState = {
  provider: ProviderName;
  successCount: number;
  failureCount: number;
  consecutiveRetryableFailures: number;
  consecutive429s: number;
  recentRetryableFailureCount: number;
  recent429Count: number;
  recentCooldownCount: number;
  lastPressureAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  lastEventAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  quarantinedAt: string | null;
  quarantineReason: string | null;
};

const sanitizeKeywordToken = (raw: string): string =>
  String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:|/\\\-\s]+|[,.;:|/\\\-\s]+$/g, '')
    .trim();
const normalizeKeywordToken = (raw: string): string => sanitizeKeywordToken(raw).toLowerCase();
const isAsciiKeyword = (text: string): boolean => [...text].every((char) => char.charCodeAt(0) <= 0x7f);

export class AIService {
  private config: AIConfig;
  private fallbackPolicy: AIFallbackRoutingPolicy;
  private fallbackAlwaysReason: string;
  private defaultWorkloadProfile: AIProviderWorkloadProfileName;
  public stats: AIStats = {
    nvidia: 0,
    siliconflow: 0,
    openrouter: 0,
    cloudflare: 0,
    nvidiaFail: 0,
  };

  private currentOpenrouterKeyIndex = 0;
  private currentNvidiaKeyIndex = 0;
  private providerHardDisabled = new Set<ProviderName>();
  private providerHardDisableReason = new Map<ProviderName, string>();
  private providerCooldownUntil = new Map<string, number>(); // key label (N0/O1/S/C) -> timestamp
  private providerCooldownReason = new Map<string, string>();
  private providerEvents: AIProviderEvent[] = [];
  private providerLabelStats = new Map<string, ProviderLabelState>();
  private fallbackActivations: AIFallbackActivation[] = [];
  private workersAiCallsThisRun = 0;
  private workersAiDailyDate = '';
  private workersAiDailyCalls = 0;
  private workersAiUsageLoaded = false;

  private logMetadataDebug(scope: 'en' | 'batch', skillName: string, detail: string, response?: string): void {
    if (!AI_DEBUG_METADATA) return;
    const snippet = response ? `\n[AIService][${scope}] raw: ${response.slice(0, 1200)}` : '';
    console.warn(`[AIService][${scope}] ${skillName}: ${detail}${snippet}`);
  }

  private clampSeoText(value: string, limit: number): string {
    return cleanAndClamp({ value }, limit).value || '';
  }

  private fitEnglishTitleWithSuffix(base: string, suffix: string, limit: number = 60): string {
    const normalizedBase = String(base || '')
      .replace(/(\.\.\.|…)+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalizedBase) {
      return suffix.trim().slice(0, limit);
    }
    if (normalizedBase.length + suffix.length <= limit) {
      return `${normalizedBase}${suffix}`;
    }
    const available = Math.max(limit - suffix.length, 0);
    const clampedBase = this.clampSeoText(normalizedBase, available);
    return `${clampedBase}${suffix}`.trim();
  }

  private sanitizeEnglishSeoTitle(skillName: string, title: string): string {
    const fallbackBase = String(skillName || 'AI Skill')
      .replace(/\s+/g, ' ')
      .trim();
    const normalized = String(title || '')
      .replace(/(\.\.\.|…)+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const source = normalized || fallbackBase;
    const suffixRules = [
      { pattern: /\s*\|\s*AI Agent Skills?$/i, suffix: ' | AI Agent Skills' },
      { pattern: /\s*\|\s*Killer-Skills$/i, suffix: ' | Killer-Skills' },
      { pattern: /\s+for Claude Code$/i, suffix: ' for Claude Code' },
      { pattern: /\s+for Cursor$/i, suffix: ' for Cursor' },
      { pattern: /\s+for Windsurf$/i, suffix: ' for Windsurf' },
    ];

    for (const rule of suffixRules) {
      if (rule.pattern.test(source)) {
        const base =
          source
            .replace(rule.pattern, '')
            .replace(/[|:;,\-–\s]+$/g, '')
            .trim() || fallbackBase;
        return this.fitEnglishTitleWithSuffix(base, rule.suffix, 60);
      }
    }

    if (/(agent skill|ai agent|claude code|cursor|windsurf|mcp|killer-skills|agentic|skill guide)/i.test(source)) {
      return this.clampSeoText(source, 60);
    }

    const base =
      source
        .replace(/\s*\|\s*.*$/, '')
        .replace(/[|:;,\-–\s]+$/g, '')
        .trim() || fallbackBase;
    return this.fitEnglishTitleWithSuffix(base, ' | AI Agent Skills', 60);
  }

  private sanitizeEnglishSeoDescription(description: string, fallback: string): string {
    const normalized = String(description || '')
      .replace(/(\.\.\.|…)+/g, ' ')
      .replace(/\b(Get started|Learn now|Read more)\b[\s:,-]*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const source =
      normalized ||
      String(fallback || '')
        .replace(/\s+/g, ' ')
        .trim();
    return this.clampSeoText(source, 160);
  }

  private sanitizeSeoDescriptionMap(
    descriptions: Record<string, string>,
    fallbackDescriptions: Record<string, string>,
  ): Record<string, string> {
    const mergedLocales = new Set<string>([
      ...Object.keys(descriptions || {}),
      ...Object.keys(fallbackDescriptions || {}),
    ]);
    const cleaned: Record<string, string> = {};

    for (const locale of mergedLocales) {
      const value = descriptions?.[locale] || fallbackDescriptions?.[locale] || '';
      if (!value) continue;
      cleaned[locale] =
        locale === 'en'
          ? this.sanitizeEnglishSeoDescription(value, fallbackDescriptions?.[locale] || fallbackDescriptions?.en || '')
          : this.clampSeoText(String(value), 160);
    }

    if (!cleaned.en) {
      cleaned.en = this.sanitizeEnglishSeoDescription(
        descriptions?.en || fallbackDescriptions?.en || '',
        fallbackDescriptions?.en || '',
      );
    }

    return cleaned;
  }

  private sanitizeSeoTitleMap(skillName: string, titles: Record<string, string>): Record<string, string> {
    const cleaned: Record<string, string> = {};
    for (const [locale, value] of Object.entries(titles || {})) {
      const normalized = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!normalized) continue;
      cleaned[locale] =
        locale === 'en' ? this.sanitizeEnglishSeoTitle(skillName, normalized) : this.clampSeoText(normalized, 60);
    }
    if (!cleaned.en) {
      cleaned.en = this.sanitizeEnglishSeoTitle(skillName, titles?.en || skillName || 'AI Skill');
    }
    return cleaned;
  }

  private stripMarkdownForFallback(value: string): string {
    return String(value || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/[>*_~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      const normalized = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(normalized);
    }
    return output;
  }

  private buildLocalizedFallbackText(
    locale: string,
    kind: 'summary' | 'suitability' | 'recommendation' | 'useCase' | 'limitation',
    english: string,
    limit: number,
  ): string {
    if (locale === 'en') return this.clampSeoText(english, limit);
    const labels = LOCALIZED_FALLBACK_LABELS[locale];
    const prefix = labels?.[kind] || `${kind}:`;
    return this.clampSeoText(`${prefix} ${english}`, limit);
  }

  private buildLocalizedFallbackArray(
    locale: string,
    kind: 'useCase' | 'limitation',
    englishItems: string[],
  ): string[] {
    if (locale === 'en') return englishItems.slice();
    return englishItems.map((item) => this.buildLocalizedFallbackText(locale, kind, item, 140)).filter(Boolean);
  }

  private extractFallbackFeatureCandidates(text: string, bodyPreview: string): string[] {
    const rawLines = `${bodyPreview}\n${text}`.split(/\r?\n/);
    const lineCandidates = rawLines
      .map((line) =>
        this.stripMarkdownForFallback(
          line
            .replace(/^#{1,6}\s+/, '')
            .replace(/^\s*[-*+]\s+/, '')
            .replace(/^\s*\d+\.\s+/, ''),
        ),
      )
      .filter((line) => line.length >= 18 && line.length <= 120)
      .filter((line) => !/^(usage|input|output|guidelines|examples|reference|troubleshooting)$/i.test(line));

    const sentenceCandidates = this.stripMarkdownForFallback(`${text} ${bodyPreview}`)
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/[.!?]+$/g, '').trim())
      .filter((sentence) => sentence.length >= 18 && sentence.length <= 120);

    return this.uniqueNonEmpty([...lineCandidates, ...sentenceCandidates]);
  }

  private buildDeterministicFeatures(
    skillName: string,
    text: string,
    bodyPreview: string,
    topics: string[] = [],
  ): string[] {
    const candidateFeatures = this.extractFallbackFeatureCandidates(text, bodyPreview)
      .slice(0, 5)
      .map((feature) => this.clampSeoText(feature, 100));

    const topicFeatures = topics
      .filter((topic) => String(topic || '').trim().length > 0)
      .slice(0, 3)
      .map((topic) => this.clampSeoText(`Supports ${topic} workflows for ${skillName}`, 100));

    const genericFeatures = [
      `Guides ${skillName} usage for AI agent workflows`,
      'Preserves repository-specific implementation patterns',
      'Highlights technical steps from the skill documentation',
      'Supports repeatable developer automation tasks',
    ].map((feature) => this.clampSeoText(feature, 100));

    return this.uniqueNonEmpty([...candidateFeatures, ...topicFeatures, ...genericFeatures]).slice(0, 5);
  }

  private buildDeterministicKeywords(
    skillName: string,
    bodyPreview: string,
    topics: string[] = [],
    category?: string,
  ): string[] {
    const inlineCodeTerms = Array.from(bodyPreview.matchAll(/`([^`]{2,40})`/g)).map((match) => match[1]);
    const tokenMatches =
      bodyPreview
        .match(/\b[A-Za-z][A-Za-z0-9.+:_/-]{3,40}\b/g)
        ?.filter(
          (token) => !/^(this|that|with|from|into|when|only|guide|usage|input|output|step|template)$/i.test(token),
        ) || [];
    const candidateKeywords = this.uniqueNonEmpty([
      'AI agent skill',
      'for Claude Code',
      ...topics,
      ...inlineCodeTerms,
      ...tokenMatches,
      `${skillName} integration`,
      `${skillName} patterns`,
      `${skillName} automation`,
    ]);
    return this.sanitizeSeoKeywordList(skillName, candidateKeywords, category);
  }

  private buildDeterministicEnglishSummary(
    skillName: string,
    text: string,
    bodyPreview: string,
    topics: string[] = [],
  ): string {
    const cleaned = this.stripMarkdownForFallback(`${text} ${bodyPreview}`);
    const sentenceCandidates = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 40 && sentence.length <= 220);
    let summary =
      sentenceCandidates[0] ||
      `${skillName} helps AI agents handle repository-specific developer workflows with documented implementation details.`;
    if (topics.length > 0) {
      const topicList = topics.filter(Boolean).slice(0, 3).join(', ');
      if (topicList && !summary.toLowerCase().includes(topicList.toLowerCase())) {
        summary = `${summary} It covers ${topicList} workflows.`;
      }
    }
    if (!/ai agent|claude code|cursor|windsurf/i.test(summary)) {
      summary = `${summary} This AI agent skill supports Claude Code, Cursor, and Windsurf workflows.`;
    }
    return this.clampSeoText(summary, 300);
  }

  private buildDeterministicMetadataFallback(
    text: string,
    context?: TranslateContext,
  ): {
    description: Record<string, string>;
    seo: SeoData;
  } {
    const skillName = context?.name || 'AI Skill';
    const topics = Array.isArray(context?.topics) ? context!.topics.filter(Boolean) : [];
    const bodyPreview = context?.bodyPreview || '';
    const englishSummary = this.buildDeterministicEnglishSummary(skillName, text, bodyPreview, topics);
    const englishFeatures = this.buildDeterministicFeatures(skillName, text, bodyPreview, topics);
    const englishKeywords = this.buildDeterministicKeywords(skillName, bodyPreview, topics, context?.category);
    const descriptionMap: Record<string, string> = { en: englishSummary };

    for (const locale of SUPPORTED_LOCALES) {
      descriptionMap[locale] = this.buildLocalizedFallbackText(locale, 'summary', englishSummary, 300);
    }

    return {
      description: cleanAndTruncate(descriptionMap, 300),
      seo: {
        title: {
          en: this.sanitizeEnglishSeoTitle(skillName, `${skillName} | AI Agent Skills`),
        },
        description: {
          en: this.sanitizeEnglishSeoDescription(
            `${englishSummary} ${englishFeatures[0] || 'AI agent skill guidance.'}`,
            englishSummary,
          ),
        },
        definition: {
          en: this.clampSeoText(
            `${skillName} is an AI agent skill for ${(englishFeatures[0] || 'repository-specific developer workflows')
              .replace(/[.!?]+$/g, '')
              .toLowerCase()}.`,
            200,
          ),
        },
        features: {
          en: englishFeatures,
        },
        keywords: {
          en: englishKeywords,
        },
      },
    };
  }

  private buildDeterministicAgentAnalysisFallback(
    skillName: string,
    description: string,
    bodyPreview: string,
  ): { suitability: string; recommendation: string; useCases: string[]; limitations: string[]; version: number } {
    const englishSummary = this.buildDeterministicEnglishSummary(skillName, description, bodyPreview);
    const features = this.buildDeterministicFeatures(skillName, description, bodyPreview);
    const primaryFeature = (features[0] || 'repository-specific developer workflows')
      .replace(/[.!?]+$/g, '')
      .toLowerCase();
    const limitationLines = this.extractFallbackFeatureCandidates('', bodyPreview).filter((line) =>
      /\b(requires?|must|only|limited|depends|avoid|do not|don't|needs?)\b/i.test(line),
    );
    const fallbackLimitations = this.uniqueNonEmpty([
      ...limitationLines,
      'Requires repository-specific context from the skill documentation',
      'Works best when the underlying tools and dependencies are already configured',
    ]).slice(0, 3);

    return {
      suitability: this.clampSeoText(`Ideal for AI agents that need ${primaryFeature}.`, 160),
      recommendation: this.clampSeoText(`${skillName} helps agents ${primaryFeature}. ${englishSummary}`, 300),
      useCases: this.uniqueNonEmpty(
        features.slice(0, 3).map((feature) => `Applying ${feature.replace(/[.!?]+$/g, '')}`),
      ).slice(0, 3),
      limitations: fallbackLimitations,
      version: 4,
    };
  }

  private normalizeLocalizedTextMap(
    value: string | Record<string, string> | null | undefined,
    fallbackEnglish: string,
  ): Record<string, string> {
    const normalized: Record<string, string> = {};
    if (typeof value === 'string') {
      const cleaned = this.clampSeoText(value, 300);
      if (cleaned) normalized.en = cleaned;
    } else if (value && typeof value === 'object') {
      for (const [locale, raw] of Object.entries(value)) {
        if (typeof raw !== 'string') continue;
        const cleaned = this.clampSeoText(raw, 300);
        if (cleaned) normalized[locale] = cleaned;
      }
    }
    if (!normalized.en && fallbackEnglish) {
      normalized.en = this.clampSeoText(fallbackEnglish, 300);
    }
    return normalized;
  }

  private normalizeLocalizedArrayMap(
    value: string[] | Record<string, string[]> | null | undefined,
  ): Record<string, string[]> {
    const normalized: Record<string, string[]> = {};
    if (Array.isArray(value)) {
      const cleaned = this.uniqueNonEmpty(value.map((item) => this.clampSeoText(String(item || ''), 140)));
      if (cleaned.length > 0) normalized.en = cleaned;
      return normalized;
    }
    if (!value || typeof value !== 'object') return normalized;
    for (const [locale, raw] of Object.entries(value)) {
      if (!Array.isArray(raw)) continue;
      const cleaned = this.uniqueNonEmpty(raw.map((item) => this.clampSeoText(String(item || ''), 140)));
      if (cleaned.length > 0) normalized[locale] = cleaned;
    }
    return normalized;
  }

  private repairLocalizedSummaryMap(
    localized: Record<string, string>,
    fallbackEnglish: string,
  ): Record<string, string> {
    const english = this.clampSeoText(localized.en || fallbackEnglish, 300);
    const repaired: Record<string, string> = { en: english };
    for (const locale of SUPPORTED_LOCALES) {
      const candidate = localized[locale];
      if (candidate && candidate !== english) {
        repaired[locale] = this.clampSeoText(candidate, 300);
      } else {
        repaired[locale] = this.buildLocalizedFallbackText(locale, 'summary', english, 300);
      }
    }
    return repaired;
  }

  public repairMetadataDeterministically(
    text: string,
    context?: TranslateContext,
    existing?: {
      description?: string | Record<string, string>;
      seo?: SeoData;
    },
  ): {
    description: Record<string, string>;
    seo: SeoData;
  } {
    const fallback = this.buildDeterministicMetadataFallback(text, context);
    const skillName = context?.name || 'AI Skill';
    const existingDescription = this.normalizeLocalizedTextMap(existing?.description, fallback.description.en);
    const repairedDescription = this.repairLocalizedSummaryMap(
      { ...fallback.description, ...existingDescription },
      fallback.description.en,
    );

    const titleCandidates =
      existing?.seo?.title && typeof existing.seo.title === 'object'
        ? { ...existing.seo.title }
        : { ...fallback.seo.title };
    const repairedTitles = this.sanitizeSeoTitleMap(skillName, {
      ...titleCandidates,
      en: titleCandidates.en || fallback.seo.title.en,
    });

    const existingSeoDescription =
      existing?.seo?.description && typeof existing.seo.description === 'object' ? existing.seo.description : {};
    const repairedSeoDescription = this.sanitizeSeoDescriptionMap(
      { ...repairedDescription, ...existingSeoDescription },
      repairedDescription,
    );

    const existingDefinition =
      existing?.seo?.definition && typeof existing.seo.definition === 'object' ? existing.seo.definition : {};
    const repairedDefinition: Record<string, string> = {
      ...fallback.seo.definition,
      ...Object.fromEntries(
        Object.entries(existingDefinition).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
      ),
    };
    if (!repairedDefinition.en) repairedDefinition.en = fallback.seo.definition.en;

    const existingFeatures = this.normalizeLocalizedArrayMap(existing?.seo?.features);
    const repairedFeatures: Record<string, string[]> =
      Object.keys(existingFeatures).length > 0 ? { ...existingFeatures } : { ...fallback.seo.features };
    if (!Array.isArray(repairedFeatures.en) || repairedFeatures.en.length === 0) {
      repairedFeatures.en = fallback.seo.features.en;
    }

    const existingKeywords = this.normalizeLocalizedArrayMap(existing?.seo?.keywords);
    const repairedKeywords: Record<string, string[]> = { ...existingKeywords };
    const repairedEnglishKeywords = this.sanitizeSeoKeywordList(
      skillName,
      repairedKeywords.en || fallback.seo.keywords.en,
      context?.category,
    );
    repairedKeywords.en = repairedEnglishKeywords.length > 0 ? repairedEnglishKeywords : fallback.seo.keywords.en;

    return {
      description: repairedDescription,
      seo: {
        title: repairedTitles,
        description: repairedSeoDescription,
        definition: repairedDefinition,
        features: repairedFeatures,
        keywords: repairedKeywords,
      },
    };
  }

  public repairAgentAnalysisDeterministically(
    skillName: string,
    description: string,
    bodyPreview: string,
    existing?: AgentAnalysis,
  ): AgentAnalysis {
    const fallback = this.buildDeterministicAgentAnalysisFallback(skillName, description, bodyPreview);

    const existingSuitabilityMap =
      existing && typeof existing.suitability === 'object' && !Array.isArray(existing.suitability)
        ? this.normalizeLocalizedTextMap(existing.suitability as Record<string, string>, fallback.suitability)
        : {};
    const existingRecommendationMap =
      existing && typeof existing.recommendation === 'object' && !Array.isArray(existing.recommendation)
        ? this.normalizeLocalizedTextMap(existing.recommendation as Record<string, string>, fallback.recommendation)
        : {};
    const existingUseCasesMap =
      existing && typeof existing.useCases === 'object' && !Array.isArray(existing.useCases)
        ? this.normalizeLocalizedArrayMap(existing.useCases as Record<string, string[]>)
        : {};
    const existingLimitationsMap =
      existing && typeof existing.limitations === 'object' && !Array.isArray(existing.limitations)
        ? this.normalizeLocalizedArrayMap(existing.limitations as Record<string, string[]>)
        : {};

    const englishSuitability =
      typeof existing?.suitability === 'string'
        ? this.clampSeoText(existing.suitability, 220)
        : existingSuitabilityMap.en || fallback.suitability;
    const englishRecommendation =
      typeof existing?.recommendation === 'string'
        ? this.clampSeoText(existing.recommendation, 300)
        : existingRecommendationMap.en || fallback.recommendation;
    const englishUseCases =
      Array.isArray(existing?.useCases) && existing.useCases.length > 0
        ? this.uniqueNonEmpty(existing.useCases.map((item) => this.clampSeoText(String(item || ''), 140)))
        : existingUseCasesMap.en || fallback.useCases;
    const englishLimitations =
      Array.isArray(existing?.limitations) && existing.limitations.length > 0
        ? this.uniqueNonEmpty(existing.limitations.map((item) => this.clampSeoText(String(item || ''), 140)))
        : existingLimitationsMap.en || fallback.limitations;

    const repairLocalizedText = (
      locale: string,
      value: string | undefined,
      english: string,
      kind: 'suitability' | 'recommendation',
      limit: number,
    ): string => {
      if (locale === 'en') return this.clampSeoText(english, limit);
      const cleaned = this.clampSeoText(value || '', limit);
      if (!cleaned || cleaned === english) {
        return this.buildLocalizedFallbackText(locale, kind, english, limit);
      }
      return cleaned;
    };

    const repairLocalizedArray = (
      locale: string,
      value: string[] | undefined,
      english: string[],
      kind: 'useCase' | 'limitation',
    ): string[] => {
      if (locale === 'en') return english.slice();
      if (!Array.isArray(value) || value.length === 0) {
        return this.buildLocalizedFallbackArray(locale, kind, english);
      }
      const cleaned = this.uniqueNonEmpty(value.map((item) => this.clampSeoText(String(item || ''), 140)));
      const looksEnglishOnly =
        cleaned.length === english.length && cleaned.every((item, index) => item === english[index]);
      return looksEnglishOnly ? this.buildLocalizedFallbackArray(locale, kind, english) : cleaned;
    };

    const suitability: Record<string, string> = { en: englishSuitability };
    const recommendation: Record<string, string> = { en: englishRecommendation };
    const useCases: Record<string, string[]> = { en: englishUseCases };
    const limitations: Record<string, string[]> = { en: englishLimitations };

    for (const locale of SUPPORTED_LOCALES) {
      suitability[locale] = repairLocalizedText(
        locale,
        existingSuitabilityMap[locale],
        englishSuitability,
        'suitability',
        220,
      );
      recommendation[locale] = repairLocalizedText(
        locale,
        existingRecommendationMap[locale],
        englishRecommendation,
        'recommendation',
        300,
      );
      useCases[locale] = repairLocalizedArray(locale, existingUseCasesMap[locale], englishUseCases, 'useCase');
      limitations[locale] = repairLocalizedArray(
        locale,
        existingLimitationsMap[locale],
        englishLimitations,
        'limitation',
      );
    }

    return {
      suitability,
      recommendation,
      useCases,
      limitations,
      version: 4,
    };
  }

  private extractStatusCode(message: string): number | undefined {
    const match = message.match(/\b([1-5]\d{2})\b/);
    if (!match) return undefined;
    return Number.parseInt(match[1], 10);
  }

  private trimEventDetail(detail: string): string {
    return String(detail || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  private inferProviderFromLabel(label: string | undefined): ProviderName | undefined {
    if (!label) return undefined;
    if (label.startsWith('N')) return 'nvidia';
    if (label.startsWith('O')) return 'openrouter';
    if (label === 'S') return 'siliconflow';
    if (label === 'C') return 'cloudflare';
    return undefined;
  }

  private inferLabelFromReason(reason: string): string | undefined {
    const match = String(reason || '').match(/^([A-Z]\d*):/);
    if (!match) return undefined;
    return match[1];
  }

  private extractProviderLabelIndex(label: string | undefined, prefix: 'N' | 'O'): number | null {
    if (!label || !label.startsWith(prefix)) return null;
    const raw = label.slice(prefix.length);
    if (!/^\d+$/.test(raw)) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private compareNvidiaEntries(
    a: ProviderEntry & { index: number },
    b: ProviderEntry & { index: number },
    rotationStart: number,
    poolSize: number,
  ): number {
    const stateA = this.ensureProviderLabelState(a.label, a.provider);
    const stateB = this.ensureProviderLabelState(b.label, b.provider);
    const consecutive429Diff = (stateA?.consecutive429s || 0) - (stateB?.consecutive429s || 0);
    if (consecutive429Diff !== 0) return consecutive429Diff;
    const retryableFailureDiff =
      (stateA?.consecutiveRetryableFailures || 0) - (stateB?.consecutiveRetryableFailures || 0);
    if (retryableFailureDiff !== 0) return retryableFailureDiff;
    const failureCountDiff = (stateA?.failureCount || 0) - (stateB?.failureCount || 0);
    if (failureCountDiff !== 0) return failureCountDiff;
    const successCountDiff = (stateB?.successCount || 0) - (stateA?.successCount || 0);
    if (successCountDiff !== 0) return successCountDiff;
    const aRotation = (a.index - rotationStart + poolSize) % poolSize;
    const bRotation = (b.index - rotationStart + poolSize) % poolSize;
    if (aRotation !== bRotation) return aRotation - bRotation;
    return a.index - b.index;
  }

  private ensureProviderLabelState(
    label: string | undefined,
    provider: ProviderName | undefined,
  ): ProviderLabelState | null {
    if (!label || !provider) return null;
    const existing = this.providerLabelStats.get(label);
    if (existing) {
      if (existing.provider !== provider) existing.provider = provider;
      return existing;
    }
    const created: ProviderLabelState = {
      provider,
      successCount: 0,
      failureCount: 0,
      consecutiveRetryableFailures: 0,
      consecutive429s: 0,
      recentRetryableFailureCount: 0,
      recent429Count: 0,
      recentCooldownCount: 0,
      lastPressureAt: null,
      lastStatus: null,
      lastError: null,
      lastEventAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      quarantinedAt: null,
      quarantineReason: null,
    };
    this.providerLabelStats.set(label, created);
    return created;
  }

  private isProviderLabelQuarantined(label: string): boolean {
    return (this.providerLabelStats.get(label)?.quarantineReason || '').length > 0;
  }

  private markProviderLabelQuarantined(label: string, provider: ProviderName, reason: string): void {
    const state = this.ensureProviderLabelState(label, provider);
    if (!state || state.quarantineReason) return;
    state.quarantinedAt = new Date().toISOString();
    state.quarantineReason = reason;
    this.recordProviderEvent({
      type: 'provider_label_quarantined',
      provider,
      label,
      status: this.extractStatusCode(reason),
      detail: reason,
    });
    console.warn(`[AIService] Quarantining provider label "${label}" for this run: ${reason}`);
  }

  private recordProviderEvent(event: Omit<AIProviderEvent, 'timestamp' | 'detail'> & { detail: string }): void {
    const next: AIProviderEvent = {
      ...event,
      detail: this.trimEventDetail(event.detail),
      timestamp: new Date().toISOString(),
    };
    const labelState = this.ensureProviderLabelState(next.label, next.provider);
    if (labelState) {
      labelState.lastEventAt = next.timestamp;
      if (next.type === 'provider_success') {
        labelState.successCount += 1;
        labelState.consecutiveRetryableFailures = 0;
        labelState.consecutive429s = 0;
        labelState.recentRetryableFailureCount = Math.max(labelState.recentRetryableFailureCount - 1, 0);
        labelState.recent429Count = Math.max(labelState.recent429Count - 1, 0);
        labelState.recentCooldownCount = Math.max(labelState.recentCooldownCount - 1, 0);
        labelState.lastSuccessAt = next.timestamp;
        labelState.lastError = null;
        labelState.lastStatus = next.status ?? null;
      } else if (next.type === 'provider_failure') {
        labelState.failureCount += 1;
        const retryable = this.isRetryableFailure(next.provider || labelState.provider, next.status, next.detail);
        if (retryable) {
          labelState.consecutiveRetryableFailures += 1;
          labelState.recentRetryableFailureCount += 1;
          labelState.lastPressureAt = next.timestamp;
        } else {
          labelState.consecutiveRetryableFailures = 0;
        }
        if (next.status === 429) {
          labelState.consecutive429s += 1;
          labelState.recent429Count += 1;
          labelState.lastPressureAt = next.timestamp;
        } else if (next.status != null) {
          labelState.consecutive429s = 0;
        }
        labelState.lastFailureAt = next.timestamp;
        labelState.lastError = next.detail;
        labelState.lastStatus = next.status ?? null;
      } else if (next.type === 'provider_cooldown') {
        labelState.recentCooldownCount += 1;
        labelState.lastPressureAt = next.timestamp;
      } else if (next.status != null) {
        labelState.lastStatus = next.status;
      }
    }
    const previous = this.providerEvents[this.providerEvents.length - 1];
    if (
      previous &&
      previous.type === next.type &&
      previous.provider === next.provider &&
      previous.label === next.label &&
      previous.status === next.status &&
      previous.attempt === next.attempt &&
      previous.delayMs === next.delayMs &&
      previous.detail === next.detail
    ) {
      return;
    }
    this.providerEvents.push(next);
    if (this.providerEvents.length > AI_PROVIDER_EVENT_LIMIT) {
      this.providerEvents.splice(0, this.providerEvents.length - AI_PROVIDER_EVENT_LIMIT);
    }
  }

  private rebuildRecentPressureMemoryFromEvents(): void {
    for (const state of this.providerLabelStats.values()) {
      state.recentRetryableFailureCount = 0;
      state.recent429Count = 0;
      state.recentCooldownCount = 0;
      state.lastPressureAt = null;
    }

    for (const event of this.providerEvents) {
      const labelState = this.ensureProviderLabelState(event.label, event.provider);
      if (!labelState) continue;

      if (event.type === 'provider_success') {
        labelState.recentRetryableFailureCount = Math.max(labelState.recentRetryableFailureCount - 1, 0);
        labelState.recent429Count = Math.max(labelState.recent429Count - 1, 0);
        labelState.recentCooldownCount = Math.max(labelState.recentCooldownCount - 1, 0);
        continue;
      }

      if (event.type === 'provider_failure') {
        const retryable = this.isRetryableFailure(event.provider || labelState.provider, event.status, event.detail);
        if (retryable) {
          labelState.recentRetryableFailureCount += 1;
          labelState.lastPressureAt = event.timestamp;
        }
        if (event.status === 429) {
          labelState.recent429Count += 1;
          labelState.lastPressureAt = event.timestamp;
        }
        continue;
      }

      if (event.type === 'provider_cooldown') {
        labelState.recentCooldownCount += 1;
        labelState.lastPressureAt = event.timestamp;
      }
    }
  }

  private isEntryCoolingDown(label: string): boolean {
    const until = this.providerCooldownUntil.get(label);
    return typeof until === 'number' && until > Date.now();
  }

  private getSoonestCooldownRemainingMs(now: number = Date.now()): number | null {
    const remaining = Array.from(this.providerCooldownUntil.values())
      .map((until) => until - now)
      .filter((ms) => ms > 0);
    if (remaining.length === 0) return null;
    return Math.min(...remaining);
  }

  private markEntryCooldown(label: string, durationMs: number): void {
    this.providerCooldownUntil.set(label, Date.now() + Math.max(durationMs, 1000));
  }

  private markEntryCooldownWithReason(label: string, durationMs: number, reason: string): void {
    this.providerCooldownReason.set(label, reason);
    this.markEntryCooldown(label, durationMs);
    this.recordProviderEvent({
      type: 'provider_cooldown',
      provider: this.inferProviderFromLabel(label),
      label,
      status: this.extractStatusCode(reason),
      delayMs: Math.max(durationMs, 1000),
      detail: reason,
    });
  }

  private markProviderHardDisabled(provider: ProviderName, reason: string): void {
    if (this.providerHardDisabled.has(provider)) return;
    this.providerHardDisabled.add(provider);
    this.providerHardDisableReason.set(provider, reason);
    this.recordProviderEvent({
      type: 'provider_hard_disabled',
      provider,
      label: this.inferLabelFromReason(reason),
      status: this.extractStatusCode(reason),
      detail: reason,
    });
    console.warn(`[AIService] Hard-disabling provider "${provider}" for this run: ${reason}`);
  }

  private getWorkersAiBudgetState(): WorkersAiBudgetState {
    const model = WORKERS_AI_FREE_MODEL;
    if (WORKERS_AI_MODE === 'disabled') {
      return {
        model,
        dailyDate: this.workersAiDailyDate,
        dailyCalls: 0,
        dailyRemaining: null,
        runRemaining: null,
        maxCallsPerRun: null,
        maxCallsPerDay: null,
        maxTokens: null,
        canUse: false,
        status: 'disabled',
        blockedReason: 'workers_ai_disabled',
      };
    }

    this.loadWorkersAiUsage();
    const today = this.getTodayUtcDate();
    const dailyCalls = this.workersAiDailyDate === today ? this.workersAiDailyCalls : 0;
    const runRemaining = Math.max(WORKERS_AI_FREE_MAX_CALLS - this.workersAiCallsThisRun, 0);
    const dailyRemaining = Math.max(WORKERS_AI_FREE_DAILY_MAX_CALLS - dailyCalls, 0);
    const runCapReached = runRemaining <= 0;
    const dailyCapReached = dailyRemaining <= 0;

    let status: AIWorkersBudgetStatus = 'available';
    let blockedReason: string | null = null;
    if (runCapReached) {
      status = 'run_cap_reached';
      blockedReason = 'run_cap_reached';
    } else if (dailyCapReached) {
      status = 'daily_cap_reached';
      blockedReason = 'daily_cap_reached';
    }

    return {
      model,
      dailyDate: this.workersAiDailyDate,
      dailyCalls,
      dailyRemaining,
      runRemaining,
      maxCallsPerRun: WORKERS_AI_FREE_MAX_CALLS,
      maxCallsPerDay: WORKERS_AI_FREE_DAILY_MAX_CALLS,
      maxTokens: WORKERS_AI_FREE_MAX_TOKENS,
      canUse: !runCapReached && !dailyCapReached,
      status,
      blockedReason,
    };
  }

  private canUseWorkersAi(): boolean {
    return this.getWorkersAiBudgetState().canUse;
  }

  private reserveWorkersAiCall(): boolean {
    const budgetState = this.getWorkersAiBudgetState();
    if (!budgetState.canUse) return false;
    this.workersAiCallsThisRun += 1;
    if (WORKERS_AI_MODE === 'free-only') {
      const today = this.getTodayUtcDate();
      if (this.workersAiDailyDate !== today) {
        this.workersAiDailyDate = today;
        this.workersAiDailyCalls = 0;
      }
      this.workersAiDailyCalls += 1;
      this.persistWorkersAiUsage();
    }
    return true;
  }

  private getTodayUtcDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private loadWorkersAiUsage(): void {
    if (this.workersAiUsageLoaded) return;
    this.workersAiUsageLoaded = true;
    try {
      if (!fs.existsSync(WORKERS_AI_USAGE_FILE)) return;
      const raw = fs.readFileSync(WORKERS_AI_USAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as { date?: string; calls?: number };
      const date = typeof parsed.date === 'string' ? parsed.date : '';
      const calls =
        typeof parsed.calls === 'number' && Number.isFinite(parsed.calls) ? Math.max(0, Math.floor(parsed.calls)) : 0;
      this.workersAiDailyDate = date;
      this.workersAiDailyCalls = calls;
    } catch (error) {
      console.warn('[AIService] Failed to read Workers AI usage file, continuing with in-memory counters.', error);
    }
  }

  private persistWorkersAiUsage(): void {
    try {
      fs.mkdirSync(path.dirname(WORKERS_AI_USAGE_FILE), { recursive: true });
      fs.writeFileSync(
        WORKERS_AI_USAGE_FILE,
        JSON.stringify({ date: this.workersAiDailyDate, calls: this.workersAiDailyCalls }, null, 2),
      );
    } catch (error) {
      console.warn('[AIService] Failed to persist Workers AI usage counters.', error);
    }
  }

  private restoreWorkersAiState(snapshot: AIProviderTelemetrySnapshot['workersAi'] | null | undefined): void {
    this.loadWorkersAiUsage();
    if (!snapshot) return;

    const sanitizeCount = (value: number | null | undefined): number =>
      typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const snapshotRunCalls = sanitizeCount(snapshot.callsThisRun);
    const snapshotDailyCalls = sanitizeCount(snapshot.dailyCalls);
    const snapshotDailyDate = typeof snapshot.dailyDate === 'string' ? snapshot.dailyDate.trim() : '';

    this.workersAiCallsThisRun = Math.max(this.workersAiCallsThisRun, snapshotRunCalls);

    if (snapshotDailyDate) {
      if (!this.workersAiDailyDate || this.workersAiDailyDate < snapshotDailyDate) {
        this.workersAiDailyDate = snapshotDailyDate;
        this.workersAiDailyCalls = snapshotDailyCalls;
      } else if (this.workersAiDailyDate === snapshotDailyDate) {
        this.workersAiDailyCalls = Math.max(this.workersAiDailyCalls, snapshotDailyCalls);
      }
    }

    this.persistWorkersAiUsage();
  }

  private listConfiguredBackupProviders(): BackupProviderName[] {
    const providers: BackupProviderName[] = [];
    if (this.config.siliconFlowKey) providers.push('siliconflow');
    if (this.config.openRouterKeys.length > 0) providers.push('openrouter');
    if (this.config.cfAccountId && this.config.cfApiToken) providers.push('cloudflare');
    return providers;
  }

  private buildRoutingStateByLabel(now: number = Date.now()): Map<string, AIProviderRoutingState> {
    const stateByLabel = new Map<string, AIProviderRoutingState>();
    const labels = new Set<string>([
      ...this.providerLabelStats.keys(),
      ...this.providerCooldownUntil.keys(),
      ...this.providerCooldownReason.keys(),
    ]);

    for (const label of labels) {
      const state = this.providerLabelStats.get(label);
      const provider = state?.provider || this.inferProviderFromLabel(label);
      const cooldownUntil = this.providerCooldownUntil.get(label);
      const coolingDown = typeof cooldownUntil === 'number' && cooldownUntil > now;
      const cooldownReason = this.providerCooldownReason.get(label) || null;
      const providerHardDisabledReason = provider ? this.providerHardDisableReason.get(provider) || null : null;
      const providerHardDisabledLabel = this.inferLabelFromReason(providerHardDisabledReason || '');
      const hardDisableReason =
        providerHardDisabledReason &&
        providerHardDisabledLabel &&
        providerHardDisabledLabel !== label &&
        state?.lastStatus != null
          ? `${label}:${state.lastStatus}`
          : providerHardDisabledReason;

      stateByLabel.set(label, {
        provider: provider || undefined,
        successCount: state?.successCount ?? 0,
        failureCount: state?.failureCount ?? 0,
        consecutiveRetryableFailures: state?.consecutiveRetryableFailures ?? 0,
        consecutive429s: state?.consecutive429s ?? 0,
        recentRetryableFailureCount: state?.recentRetryableFailureCount ?? 0,
        recent429Count: state?.recent429Count ?? 0,
        recentCooldownCount: state?.recentCooldownCount ?? 0,
        lastPressureAt: state?.lastPressureAt ?? null,
        lastStatus: state?.lastStatus ?? null,
        lastError: state?.lastError ?? null,
        coolingDown,
        cooldownReason,
        quarantined: !!state?.quarantineReason,
        quarantineReason: state?.quarantineReason ?? null,
        hardDisabled: provider ? this.providerHardDisabled.has(provider) : false,
        hardDisableReason,
      });
    }

    return stateByLabel;
  }

  private recordFallbackActivation(entry: ProviderEntry, reason: string, attempt: number): void {
    if (entry.provider === 'nvidia') return;
    const activation: AIFallbackActivation = {
      timestamp: new Date().toISOString(),
      provider: entry.provider,
      label: entry.label,
      reason,
      policy: this.fallbackPolicy,
      attempt,
    };
    const previous = this.fallbackActivations[this.fallbackActivations.length - 1];
    if (
      previous &&
      previous.provider === activation.provider &&
      previous.label === activation.label &&
      previous.reason === activation.reason &&
      previous.policy === activation.policy &&
      previous.attempt === activation.attempt
    ) {
      return;
    }

    this.fallbackActivations.push(activation);
    if (this.fallbackActivations.length > AI_PROVIDER_EVENT_LIMIT) {
      this.fallbackActivations.splice(0, this.fallbackActivations.length - AI_PROVIDER_EVENT_LIMIT);
    }

    this.recordProviderEvent({
      type: 'fallback_activated',
      provider: entry.provider,
      label: entry.label,
      attempt,
      detail: reason,
    });
  }

  private isRetryableFailure(provider: ProviderName, status: number | undefined, message: string): boolean {
    if (status != null) {
      if (!RETRYABLE_STATUSES.has(status)) return false;
      // In free-only mode, Cloudflare 429 is treated as budget/cap pressure, not a retry trigger.
      if (provider === 'cloudflare' && status === 429 && WORKERS_AI_MODE === 'free-only') return false;
      if (HARD_DISABLE_STATUSES.has(status)) return false;
      return true;
    }
    return /abort|timeout|network|fetch failed|socket|econnreset|etimedout|enotfound/i.test(message);
  }

  private shouldHardDisableCloudflareAfterRetryableFailure(
    entry: ProviderEntry,
    status: number | undefined,
    message: string,
  ): boolean {
    if (entry.provider !== 'cloudflare' || WORKERS_AI_MODE !== 'free-only') return false;
    if (!this.isRetryableFailure(entry.provider, status, message)) return false;
    const state = this.ensureProviderLabelState(entry.label, entry.provider);
    if (!state) return false;
    return state.consecutiveRetryableFailures >= WORKERS_AI_FREE_RETRYABLE_FAILURE_LIMIT;
  }

  private shouldRestoreRunScopedQuarantine(provider: ProviderName, reason: string | null): boolean {
    void provider;
    void reason;
    // Quarantine is intentionally run-scoped. Across checkpoint resumes we keep health counters for
    // ranking, but let labels re-enter rotation so a fresh time slice can probe them again.
    return false;
  }

  private shouldRestoreProviderHardDisable(provider: ProviderName, reason: string | null): boolean {
    if (!reason) return true;
    if (provider === 'cloudflare' && /retryable-failures/i.test(reason)) return false;
    return true;
  }

  private applyFailurePolicy(entry: ProviderEntry, status: number | undefined, message: string): void {
    if (status == null) {
      if (entry.provider === 'cloudflare' && /invalid json|empty response/i.test(message)) {
        this.markProviderHardDisabled('cloudflare', `${entry.label}:schema`);
        return;
      }
      if (this.shouldHardDisableCloudflareAfterRetryableFailure(entry, status, message)) {
        const state = this.ensureProviderLabelState(entry.label, entry.provider);
        this.markProviderHardDisabled(
          'cloudflare',
          `${entry.label}:retryable-failures:${state?.consecutiveRetryableFailures || WORKERS_AI_FREE_RETRYABLE_FAILURE_LIMIT}`,
        );
        return;
      }
      if (/abort|timeout|fetch failed|network/i.test(message)) {
        this.markEntryCooldownWithReason(entry.label, PROVIDER_COOLDOWN_5XX_MS, `${entry.label}:network`);
      }
      return;
    }

    if (HARD_DISABLE_STATUSES.has(status)) {
      this.markProviderHardDisabled(entry.provider, `${entry.label}:${status}`);
      return;
    }

    if (status === 429) {
      if (entry.provider === 'cloudflare') {
        // Workers AI: once free path starts throttling, stop using it for this run.
        this.markProviderHardDisabled('cloudflare', `${entry.label}:429`);
      } else {
        this.markEntryCooldownWithReason(entry.label, PROVIDER_COOLDOWN_429_MS, `${entry.label}:429`);
      }
      return;
    }

    if (this.shouldHardDisableCloudflareAfterRetryableFailure(entry, status, message)) {
      const state = this.ensureProviderLabelState(entry.label, entry.provider);
      this.markProviderHardDisabled(
        'cloudflare',
        `${entry.label}:retryable-failures:${state?.consecutiveRetryableFailures || WORKERS_AI_FREE_RETRYABLE_FAILURE_LIMIT}`,
      );
      return;
    }

    if (status >= 500) {
      this.markEntryCooldownWithReason(entry.label, PROVIDER_COOLDOWN_5XX_MS, `${entry.label}:${status}`);
    }
  }

  private maybeQuarantineProviderLabel(entry: ProviderEntry, status: number | undefined, message: string): boolean {
    if (entry.provider !== 'nvidia') return false;
    const state = this.ensureProviderLabelState(entry.label, entry.provider);
    if (!state || state.quarantineReason) return false;

    if (status === 429 && NVIDIA_KEY_QUARANTINE_ON_429) {
      this.markProviderLabelQuarantined(entry.label, entry.provider, `${entry.label}:429-quarantine`);
      return true;
    }

    if (
      this.isRetryableFailure(entry.provider, status, message) &&
      state.consecutiveRetryableFailures >= NVIDIA_KEY_QUARANTINE_CONSECUTIVE_FAILURES
    ) {
      this.markProviderLabelQuarantined(
        entry.label,
        entry.provider,
        `${entry.label}:retryable-failures:${state.consecutiveRetryableFailures}`,
      );
      return true;
    }

    return false;
  }

  public getTelemetrySnapshot(): AIProviderTelemetrySnapshot {
    this.loadWorkersAiUsage();
    const now = Date.now();
    const workersBudgetState = this.getWorkersAiBudgetState();
    const inspection = this.inspectAvailableProviders(false, false);
    const availableProviders = inspection.providers.map((entry) => ({
      label: entry.label,
      provider: entry.provider,
    }));
    const selectionRankByLabel = new Map(availableProviders.map((entry, index) => [entry.label, index + 1]));

    return {
      timestamp: new Date(now).toISOString(),
      mode: {
        workersAi: WORKERS_AI_MODE,
        fallbackPolicy: inspection.fallbackRouting.policy,
        concurrencyLimit: MAX_CONCURRENT_REQUESTS,
        localeBatchSize: AI_LOCALE_BATCH_SIZE,
      },
      stats: { ...this.stats },
      recentEvents: this.providerEvents.slice(),
      labelStats: Array.from(this.providerLabelStats.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, state]) => {
          const cooldownUntil = this.providerCooldownUntil.get(label);
          const cooldownReason = this.providerCooldownReason.get(label) || null;
          const coolingDown = typeof cooldownUntil === 'number' && cooldownUntil > now;
          const providerHardDisabledReason = this.providerHardDisableReason.get(state.provider) || null;
          const providerHardDisabledLabel = this.inferLabelFromReason(providerHardDisabledReason || '');
          const hardDisabledReason =
            providerHardDisabledReason &&
            providerHardDisabledLabel &&
            providerHardDisabledLabel !== label &&
            state.lastStatus != null
              ? `${label}:${state.lastStatus}`
              : providerHardDisabledReason;
          const currentlyAvailable = availableProviders.some((entry) => entry.label === label);
          return {
            label,
            provider: state.provider,
            selectionRank: selectionRankByLabel.get(label) || null,
            successCount: state.successCount,
            failureCount: state.failureCount,
            consecutiveRetryableFailures: state.consecutiveRetryableFailures,
            consecutive429s: state.consecutive429s,
            recentRetryableFailureCount: state.recentRetryableFailureCount,
            recent429Count: state.recent429Count,
            recentCooldownCount: state.recentCooldownCount,
            lastPressureAt: state.lastPressureAt,
            lastStatus: state.lastStatus,
            lastError: state.lastError,
            lastEventAt: state.lastEventAt,
            lastSuccessAt: state.lastSuccessAt,
            lastFailureAt: state.lastFailureAt,
            currentlyAvailable,
            coolingDown,
            cooldownUntil: coolingDown ? new Date(cooldownUntil!).toISOString() : null,
            cooldownReason,
            quarantined: !!state.quarantineReason,
            quarantinedAt: state.quarantinedAt,
            quarantineReason: state.quarantineReason,
            hardDisabled: this.providerHardDisabled.has(state.provider),
            hardDisableReason: hardDisabledReason,
          } satisfies AIProviderLabelTelemetry;
        }),
      availableProviders,
      quarantinedLabels: Array.from(this.providerLabelStats.entries())
        .filter(([, state]) => !!state.quarantineReason)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, state]) => ({
          label,
          provider: state.provider,
          reason: state.quarantineReason || 'unknown',
          quarantinedAt: state.quarantinedAt,
        })),
      hardDisabledProviders: Array.from(this.providerHardDisabled)
        .sort()
        .map((provider) => ({
          provider,
          reason: this.providerHardDisableReason.get(provider) || 'unknown',
        })),
      coolingDownProviders: Array.from(this.providerCooldownUntil.entries())
        .filter(([, until]) => until > now)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, until]) => ({
          label,
          until: new Date(until).toISOString(),
          msRemaining: Math.max(until - now, 0),
          reason: this.providerCooldownReason.get(label) || 'unknown',
        })),
      fallbackRouting: inspection.fallbackRouting,
      workersAi: {
        usageFile: WORKERS_AI_USAGE_FILE,
        model: workersBudgetState.model,
        callsThisRun: this.workersAiCallsThisRun,
        dailyDate: this.workersAiDailyDate,
        dailyCalls: workersBudgetState.dailyCalls,
        dailyRemaining: workersBudgetState.dailyRemaining,
        runRemaining: workersBudgetState.runRemaining,
        maxCallsPerRun: workersBudgetState.maxCallsPerRun,
        maxCallsPerDay: workersBudgetState.maxCallsPerDay,
        maxTokens: workersBudgetState.maxTokens,
        canUse: workersBudgetState.canUse,
        status: workersBudgetState.status,
        blockedReason: workersBudgetState.blockedReason,
      },
    };
  }

  public restoreTelemetrySnapshot(snapshot: AIProviderTelemetrySnapshot | null | undefined): void {
    if (!snapshot) return;
    const now = Date.now();
    const sanitizeCount = (value: number | null | undefined): number =>
      typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const normalizeText = (value: string | null | undefined): string | null =>
      typeof value === 'string' && value.trim().length > 0 ? value : null;

    this.stats = {
      nvidia: sanitizeCount(snapshot.stats?.nvidia),
      siliconflow: sanitizeCount(snapshot.stats?.siliconflow),
      openrouter: sanitizeCount(snapshot.stats?.openrouter),
      cloudflare: sanitizeCount(snapshot.stats?.cloudflare),
      nvidiaFail: sanitizeCount(snapshot.stats?.nvidiaFail),
    };

    this.providerHardDisabled.clear();
    this.providerHardDisableReason.clear();
    this.providerCooldownUntil.clear();
    this.providerCooldownReason.clear();
    this.providerLabelStats.clear();
    this.fallbackActivations = [];
    this.providerEvents = Array.isArray(snapshot.recentEvents)
      ? snapshot.recentEvents
          .slice(-AI_PROVIDER_EVENT_LIMIT)
          .map((event) => ({ ...event, detail: this.trimEventDetail(event?.detail || '') }))
      : [];
    this.restoreWorkersAiState(snapshot.workersAi);

    for (const labelState of Array.isArray(snapshot.labelStats) ? snapshot.labelStats : []) {
      if (!labelState?.label || !labelState?.provider) continue;
      const quarantineReason = normalizeText(labelState.quarantineReason);
      const shouldRestoreQuarantine = this.shouldRestoreRunScopedQuarantine(labelState.provider, quarantineReason);
      this.providerLabelStats.set(labelState.label, {
        provider: labelState.provider,
        successCount: sanitizeCount(labelState.successCount),
        failureCount: sanitizeCount(labelState.failureCount),
        consecutiveRetryableFailures: sanitizeCount(labelState.consecutiveRetryableFailures),
        consecutive429s: sanitizeCount(labelState.consecutive429s),
        recentRetryableFailureCount: sanitizeCount(labelState.recentRetryableFailureCount),
        recent429Count: sanitizeCount(labelState.recent429Count),
        recentCooldownCount: sanitizeCount(labelState.recentCooldownCount),
        lastPressureAt: normalizeText(labelState.lastPressureAt),
        lastStatus:
          typeof labelState.lastStatus === 'number' && Number.isFinite(labelState.lastStatus)
            ? labelState.lastStatus
            : null,
        lastError: normalizeText(labelState.lastError),
        lastEventAt: normalizeText(labelState.lastEventAt),
        lastSuccessAt: normalizeText(labelState.lastSuccessAt),
        lastFailureAt: normalizeText(labelState.lastFailureAt),
        quarantinedAt: shouldRestoreQuarantine ? normalizeText(labelState.quarantinedAt) : null,
        quarantineReason: shouldRestoreQuarantine ? quarantineReason : null,
      });

      const hardDisableReason =
        normalizeText(labelState.hardDisableReason) || `${labelState.label}:restored-hard-disabled`;
      if (labelState.hardDisabled && this.shouldRestoreProviderHardDisable(labelState.provider, hardDisableReason)) {
        this.providerHardDisabled.add(labelState.provider);
        this.providerHardDisableReason.set(labelState.provider, hardDisableReason);
      }

      const cooldownUntilMs =
        typeof labelState.cooldownUntil === 'string' ? Date.parse(labelState.cooldownUntil) : Number.NaN;
      if (Number.isFinite(cooldownUntilMs) && cooldownUntilMs > now) {
        this.providerCooldownUntil.set(labelState.label, cooldownUntilMs);
        this.providerCooldownReason.set(
          labelState.label,
          normalizeText(labelState.cooldownReason) || `${labelState.label}:restored-cooldown`,
        );
      }
    }

    const hasExplicitPressureMemory = Array.isArray(snapshot.labelStats)
      ? snapshot.labelStats.some(
          (labelState) =>
            typeof labelState?.recent429Count === 'number' ||
            typeof labelState?.recentCooldownCount === 'number' ||
            typeof labelState?.recentRetryableFailureCount === 'number' ||
            typeof labelState?.lastPressureAt === 'string',
        )
      : false;
    if (!hasExplicitPressureMemory) {
      this.rebuildRecentPressureMemoryFromEvents();
    }

    for (const entry of Array.isArray(snapshot.hardDisabledProviders) ? snapshot.hardDisabledProviders : []) {
      if (!entry?.provider) continue;
      const reason = normalizeText(entry.reason) || 'restored-from-checkpoint';
      if (!this.shouldRestoreProviderHardDisable(entry.provider, reason)) continue;
      this.providerHardDisabled.add(entry.provider);
      this.providerHardDisableReason.set(entry.provider, reason);
    }

    this.fallbackActivations = Array.isArray(snapshot.fallbackRouting?.recentActivations)
      ? snapshot.fallbackRouting.recentActivations
          .filter((entry) => entry?.label && entry?.provider)
          .slice(-AI_PROVIDER_EVENT_LIMIT)
          .map((entry) => ({
            timestamp:
              typeof entry.timestamp === 'string' && entry.timestamp.trim().length > 0
                ? entry.timestamp
                : new Date().toISOString(),
            provider: entry.provider,
            label: entry.label,
            reason: this.trimEventDetail(typeof entry.reason === 'string' ? entry.reason : 'unknown'),
            policy: parseFallbackPolicy(entry.policy),
            attempt:
              typeof entry.attempt === 'number' && Number.isFinite(entry.attempt)
                ? Math.max(1, Math.floor(entry.attempt))
                : null,
          }))
      : this.providerEvents
          .filter(
            (event) =>
              event.type === 'fallback_activated' && event.label && event.provider && event.provider !== 'nvidia',
          )
          .map((event) => ({
            timestamp: event.timestamp,
            provider: event.provider as BackupProviderName,
            label: event.label!,
            reason: this.trimEventDetail(event.detail || 'unknown'),
            policy: this.fallbackPolicy,
            attempt:
              typeof event.attempt === 'number' && Number.isFinite(event.attempt)
                ? Math.max(1, Math.floor(event.attempt))
                : null,
          }));

    const firstNvidiaLabel = (snapshot.availableProviders || []).find((entry) => entry.provider === 'nvidia')?.label;
    const firstOpenrouterLabel = (snapshot.availableProviders || []).find(
      (entry) => entry.provider === 'openrouter',
    )?.label;
    const restoredNvidiaIndex = this.extractProviderLabelIndex(firstNvidiaLabel, 'N');
    const restoredOpenrouterIndex = this.extractProviderLabelIndex(firstOpenrouterLabel, 'O');
    if (restoredNvidiaIndex != null && this.config.nvidiaKeys.length > 0) {
      this.currentNvidiaKeyIndex = restoredNvidiaIndex % this.config.nvidiaKeys.length;
    }
    if (restoredOpenrouterIndex != null && this.config.openRouterKeys.length > 0) {
      this.currentOpenrouterKeyIndex = restoredOpenrouterIndex % this.config.openRouterKeys.length;
    }
  }

  constructor(
    config?: Partial<AIConfig> & {
      fallbackPolicy?: AIFallbackRoutingPolicy;
      fallbackAlwaysReason?: string;
      workloadProfile?: AIProviderWorkloadProfileName;
    },
  ) {
    this.config = {
      nvidiaKeys: config?.nvidiaKeys ?? splitAIProviderKeys(process.env.NVIDIA_API_KEYS, process.env.NVIDIA_API_KEY),
      siliconFlowKey: config?.siliconFlowKey ?? process.env.SILICONFLOW_API_KEY ?? '',
      openRouterKeys:
        config?.openRouterKeys ?? splitAIProviderKeys(process.env.OPENROUTER_API_KEYS, process.env.OPENROUTER_API_KEY),
      cfAccountId: config?.cfAccountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
      cfApiToken: config?.cfApiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '',
      workloadProfile: parseAIProviderWorkloadProfile(
        config?.workloadProfile || process.env.AI_PROVIDER_WORKLOAD_PROFILE,
        'batch_generation',
      ),
    };
    this.fallbackPolicy = parseFallbackPolicy(config?.fallbackPolicy || AI_FALLBACK_POLICY);
    this.fallbackAlwaysReason =
      String(config?.fallbackAlwaysReason || AI_FALLBACK_ALWAYS_REASON).trim() || 'policy_always';
    this.defaultWorkloadProfile = this.config.workloadProfile || 'batch_generation';
  }

  private sanitizeSeoKeywordList(skillName: string, keywords: string[], category?: string): string[] {
    const normalizedSkillName = normalizeKeywordToken(skillName);
    const seen = new Set<string>();
    const cleaned: string[] = [];

    for (const rawKeyword of keywords || []) {
      const keyword = sanitizeKeywordToken(rawKeyword);
      const normalized = normalizeKeywordToken(keyword);
      if (!normalized) continue;
      if (normalized.length < 3 || normalized.length > 48) continue;
      if (keyword.includes('/')) continue;
      if (INVALID_SEO_KEYWORD_PATTERNS.some((pattern) => pattern.test(keyword))) continue;
      if (LOW_INTENT_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
      if (GENERIC_FILLER_KEYWORDS.has(normalized)) continue;
      if (normalized === normalizedSkillName) continue;

      // Cross-category contamination filter: reject domain-specific filler
      // that doesn't match the skill's actual category.
      const catLower = (category || '').toLowerCase();
      if (
        /browser automation/i.test(normalized) &&
        !catLower.includes('browser') &&
        !skillName.toLowerCase().includes('browser') &&
        !skillName.toLowerCase().includes('playwright') &&
        !skillName.toLowerCase().includes('puppeteer')
      )
        continue;
      if (
        /\bmcp server\b/i.test(normalized) &&
        !catLower.includes('mcp') &&
        !skillName.toLowerCase().includes('mcp') &&
        !skillName.toLowerCase().includes('server')
      )
        continue;
      if (
        /\bskill installation\b/i.test(normalized) &&
        !catLower.includes('install') &&
        !skillName.toLowerCase().includes('install') &&
        !skillName.toLowerCase().includes('setup')
      )
        continue;

      if (isAsciiKeyword(keyword)) {
        const tokenCount = normalized.split(' ').filter(Boolean).length;
        if (tokenCount === 1 && normalized.length < 6) continue;
        if (tokenCount > 6) continue;
      }

      if (seen.has(normalized)) continue;
      seen.add(normalized);
      cleaned.push(keyword);
      if (cleaned.length >= 10) break;
    }

    if (cleaned.length > 0) {
      // Theme compliance: ensure at least 2 keywords contain theme terms.
      // If AI-generated keywords passed low-intent filter but are all generic tech terms,
      // inject theme-anchored keywords to prevent SEO theme drift.
      const THEME_TERMS = [
        'agent skill',
        'ai agent',
        'claude code',
        'cursor',
        'windsurf',
        'mcp',
        'killer-skills',
        'workflow',
        'automation',
        '.claude',
        'agentic',
      ];
      const themeCount = cleaned.filter((kw) => {
        const kwLower = kw.toLowerCase();
        return THEME_TERMS.some((t) => kwLower.includes(t));
      }).length;

      if (themeCount < 2) {
        // Inject ONLY theme anchors (no generic fillers), keeping total ≤ 10
        const injected = [`${skillName} AI agent skill`, `${skillName} for Claude Code`]
          .map((item) => sanitizeKeywordToken(item))
          .filter(Boolean);
        const combined = [...cleaned, ...injected];
        const deduped: string[] = [];
        const seenNorm = new Set<string>();
        for (const kw of combined) {
          const n = normalizeKeywordToken(kw);
          if (!seenNorm.has(n)) {
            seenNorm.add(n);
            deduped.push(kw);
          }
          if (deduped.length >= 10) break;
        }
        return deduped;
      }
      return cleaned;
    }

    // Category-aware fallback keywords
    const fallback = this.generateCategoryAwareFallback(skillName, category);

    return Array.from(new Set(fallback.map((item) => normalizeKeywordToken(item))))
      .map((normalized) => fallback.find((item) => normalizeKeywordToken(item) === normalized)!)
      .slice(0, 6);
  }

  /**
   * Generate category-aware fallback keywords based on skill category.
   * This produces more relevant keywords than generic templates.
   */
  private generateCategoryAwareFallback(skillName: string, category?: string): string[] {
    const categoryLower = (category || '').toLowerCase();

    // Category-specific keyword templates
    const categoryKeywords: Record<string, string[]> = {
      browser: [
        `${skillName} browser automation skill`,
        `${skillName} web scraping workflow`,
        `${skillName} Playwright automation`,
        `${skillName} Puppeteer integration`,
        `${skillName} for Claude Code browser tasks`,
        `${skillName} AI agent web automation`,
      ],
      data: [
        `${skillName} data analysis workflow`,
        `${skillName} SQL query automation`,
        `${skillName} database integration skill`,
        `${skillName} ETL pipeline automation`,
        `${skillName} for data-driven AI agents`,
        `${skillName} analytics skill for Cursor`,
      ],
      developer: [
        `${skillName} developer tool skill`,
        `${skillName} code automation workflow`,
        `${skillName} CLI integration for AI agents`,
        `${skillName} for Claude Code development`,
        `${skillName} TypeScript automation skill`,
        `${skillName} AI coding assistant plugin`,
      ],
      productivity: [
        `${skillName} productivity automation`,
        `${skillName} workflow integration skill`,
        `${skillName} Notion Slack automation`,
        `${skillName} task automation for AI agents`,
        `${skillName} for Claude Code workflows`,
        `${skillName} AI assistant productivity`,
      ],
      ai: [
        `${skillName} AI model integration`,
        `${skillName} LLM workflow skill`,
        `${skillName} prompt engineering automation`,
        `${skillName} RAG pipeline skill`,
        `${skillName} for AI agent development`,
        `${skillName} Claude Code AI integration`,
      ],
      devops: [
        `${skillName} DevOps automation skill`,
        `${skillName} CI/CD pipeline workflow`,
        `${skillName} Docker Kubernetes integration`,
        `${skillName} deployment automation for AI`,
        `${skillName} infrastructure as code skill`,
        `${skillName} for Claude Code DevOps`,
      ],
      security: [
        `${skillName} security audit skill`,
        `${skillName} authentication workflow`,
        `${skillName} vulnerability detection automation`,
        `${skillName} compliance automation for AI`,
        `${skillName} secure coding skill`,
        `${skillName} AI agent security integration`,
      ],
      documentation: [
        `${skillName} documentation automation`,
        `${skillName} markdown PDF workflow`,
        `${skillName} knowledge base skill`,
        `${skillName} content generation for AI`,
        `${skillName} for Claude Code docs`,
        `${skillName} AI documentation assistant`,
      ],
      finance: [
        `${skillName} fintech automation skill`,
        `${skillName} payment workflow integration`,
        `${skillName} financial data skill`,
        `${skillName} trading automation for AI`,
        `${skillName} crypto blockchain skill`,
        `${skillName} AI agent finance integration`,
      ],
      communication: [
        `${skillName} messaging automation skill`,
        `${skillName} Discord Slack integration`,
        `${skillName} notification workflow for AI`,
        `${skillName} team communication skill`,
        `${skillName} for Claude Code messaging`,
        `${skillName} AI agent communication`,
      ],
      design: [
        `${skillName} UI design automation`,
        `${skillName} frontend workflow skill`,
        `${skillName} creative automation for AI`,
        `${skillName} Figma Tailwind integration`,
        `${skillName} for Claude Code design`,
        `${skillName} AI design assistant skill`,
      ],
    };

    // Find matching category keywords (require non-empty category for match)
    if (categoryLower) {
      for (const [catKey, keywords] of Object.entries(categoryKeywords)) {
        if (categoryLower.includes(catKey) || catKey.includes(categoryLower)) {
          return keywords.map((item) => sanitizeKeywordToken(item)).filter(Boolean);
        }
      }
    }

    // Default fallback: 2 theme anchors only (capability keywords must come from AI)
    return [`${skillName} AI agent skill`, `${skillName} for Claude Code`]
      .map((item) => sanitizeKeywordToken(item))
      .filter(Boolean);
  }

  private sanitizeSeoKeywordsMap(
    skillName: string,
    keywordsByLocale: Record<string, string[]>,
    category?: string,
  ): Record<string, string[]> {
    // Locale-aware theme term anchors for injection when AI output lacks theme terms.
    // Product names (Claude Code, Cursor, MCP) stay in English per terminology glossary.
    const LOCALE_THEME_ANCHORS: Record<string, string[]> = {
      zh: [`${skillName} AI Agent Skill`, `${skillName} Claude Code 技能`, `${skillName} MCP 工作流`],
      ja: [`${skillName} AIエージェントスキル`, `${skillName} Claude Code スキル`, `${skillName} MCP ワークフロー`],
      ko: [`${skillName} AI 에이전트 스킬`, `${skillName} Claude Code 스킬`, `${skillName} MCP 워크플로`],
      es: [`${skillName} habilidad AI agent`, `${skillName} para Claude Code`, `${skillName} flujo MCP`],
      fr: [`${skillName} compétence AI agent`, `${skillName} pour Claude Code`, `${skillName} flux MCP`],
      de: [`${skillName} KI-Agent-Skill`, `${skillName} für Claude Code`, `${skillName} MCP-Workflow`],
      pt: [`${skillName} habilidade AI agent`, `${skillName} para Claude Code`, `${skillName} fluxo MCP`],
      ru: [`${skillName} навык ИИ-агента`, `${skillName} для Claude Code`, `${skillName} MCP рабочий процесс`],
      ar: [`${skillName} مهارة وكيل الذكاء الاصطناعي`, `${skillName} لـ Claude Code`, `${skillName} سير عمل MCP`],
    };

    const entries = Object.entries(keywordsByLocale || {});
    const cleaned: Record<string, string[]> = {};
    for (const [locale, keywords] of entries) {
      const sanitized = this.sanitizeSeoKeywordList(skillName, keywords || [], category);
      if (sanitized.length > 0) {
        // For non-English locales, check theme compliance using broader match
        // (includes both English product names and localized theme terms)
        const THEME_TERMS = [
          'agent skill',
          'ai agent',
          'claude code',
          'cursor',
          'windsurf',
          'mcp',
          'killer-skills',
          'agentic',
          'workflow',
          'automation',
          // Localized variants
          '智能体',
          'エージェント',
          '에이전트',
          'агент',
          'وكيل',
        ];
        const themeCount = sanitized.filter((kw) => {
          const kwLower = kw.toLowerCase();
          return THEME_TERMS.some((t) => kwLower.includes(t));
        }).length;

        if (locale !== 'en' && themeCount < 1 && LOCALE_THEME_ANCHORS[locale]) {
          const anchors = LOCALE_THEME_ANCHORS[locale].map((item) => sanitizeKeywordToken(item)).filter(Boolean);
          cleaned[locale] = [...sanitized, ...anchors].slice(0, 10);
        } else {
          cleaned[locale] = sanitized;
        }
      }
    }

    if (!cleaned.en || cleaned.en.length === 0) {
      cleaned.en = this.sanitizeSeoKeywordList(skillName, keywordsByLocale?.en || []);
    }
    return cleaned;
  }

  /**
   * Validate that CJK locale fields are non-empty in a parsed JSON response.
   * Checks description and suitability for zh, ja, ko locales.
   */
  private validateCJKFields(parsed: any, provider: string): void {
    const fieldsToCheck = ['description', 'suitability'];
    const cjkLocales = ['zh', 'ja', 'ko'];
    for (const field of fieldsToCheck) {
      if (parsed[field] && typeof parsed[field] === 'object') {
        for (const locale of cjkLocales) {
          if (
            parsed[field][locale] !== undefined &&
            (!parsed[field][locale] || String(parsed[field][locale]).trim() === '')
          ) {
            throw new Error(`${provider} returned empty ${locale}.${field}`);
          }
        }
      }
    }
  }

  /**
   * Call a single AI provider. Returns content string or throws on failure.
   * Extracted to enable dedicated worker-per-provider architecture.
   */
  private async callAISingle(
    prompt: string,
    provider: ProviderName,
    apiKey: string,
    jsonMode: boolean = false,
    externalSignal?: AbortSignal,
  ): Promise<string> {
    let url: string;
    let headers: Record<string, string>;
    let bodyObj: any;
    let isCloudflareFormat = false; // CF has different response format

    switch (provider) {
      case 'nvidia': {
        url = 'https://integrate.api.nvidia.com/v1/chat/completions';
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
        bodyObj = {
          model: getOnlineProviderModel('nvidia'),
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
          stream: false,
        };
        if (jsonMode) bodyObj.response_format = { type: 'json_object' };
        break;
      }
      case 'siliconflow': {
        url = 'https://api.siliconflow.cn/v1/chat/completions';
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
        bodyObj = {
          model: getOnlineProviderModel('siliconflow'),
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
          stream: false,
        };
        break;
      }
      case 'openrouter': {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://killerskills.com',
          'X-Title': 'Killer-Skills Translation',
        };
        bodyObj = {
          model: getOnlineProviderModel('openrouter'),
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        };
        break;
      }
      case 'cloudflare': {
        const workersBudgetState = this.getWorkersAiBudgetState();
        if (!workersBudgetState.canUse || !this.reserveWorkersAiCall()) {
          throw new Error(`cloudflare budget exceeded: ${workersBudgetState.blockedReason || 'budget_unavailable'}`);
        }
        const selectedModel = WORKERS_AI_FREE_MODEL;
        const workersMaxTokens = Math.min(WORKERS_AI_FREE_MAX_TOKENS, 1024);
        url = `https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/${selectedModel}`;
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
        bodyObj = {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: workersMaxTokens,
        };
        isCloudflareFormat = true;
        break;
      }
    }

    // Combine external race signal with timeout signal
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), 50000);
    const signals = [timeoutController.signal];
    if (externalSignal) signals.push(externalSignal);
    const combinedSignal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj),
        signal: combinedSignal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`${provider} ${res.status}`);
    }

    const data = (await res.json()) as any;
    // Cloudflare Workers AI returns { result: { response: "..." } }
    // Others return { choices: [{ message: { content: "..." } }] }
    const rawContent = isCloudflareFormat ? data?.result?.response : data?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error(`${provider} empty response`);

    // Normalize: Cloudflare sometimes returns object instead of string
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

    // CJK validation in jsonMode
    if (jsonMode) {
      try {
        const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
        const jsonStartIndex = cleanContent.indexOf('{');
        const jsonEndIndex = cleanContent.lastIndexOf('}');

        let jsonStr = cleanContent;
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
          jsonStr = cleanContent.slice(jsonStartIndex, jsonEndIndex + 1);
        }

        const parsed = JSON.parse(jsonStr);
        this.validateCJKFields(parsed, provider);
      } catch (e) {
        throw new Error(`${provider} returned invalid JSON`, { cause: e }); // Propagate error for retry
      }
    }

    return content;
  }

  /**
   * Call AI with rate limiting and exponential backoff retry.
   * - Limits concurrent requests to MAX_CONCURRENT_REQUESTS
   * - Retries on retryable transient failures with exponential backoff
   * - Applies provider cooldown / hard-disable policy on quota/auth failures
   */
  async callAI(
    prompt: string,
    jsonMode: boolean = false,
    workloadProfile: AIProviderWorkloadProfileName = this.defaultWorkloadProfile,
  ): Promise<string | null> {
    const releaseSlot = await acquireSlot();
    try {
      return await this.executeCallWithRetry(prompt, jsonMode, 0, workloadProfile);
    } finally {
      releaseSlot();
    }
  }

  private inspectAvailableProviders(
    recordEvents: boolean = true,
    advanceCursor: boolean = true,
    workloadProfile: AIProviderWorkloadProfileName = this.defaultWorkloadProfile,
  ): ProviderPoolInspection {
    const primaryProviders: ProviderEntry[] = [];
    const backupProviders: ProviderEntry[] = [];
    const workersBudgetState = this.getWorkersAiBudgetState();
    const stateByLabel = this.buildRoutingStateByLabel();
    const isEntryCurrentlyAvailable = (entry: ProviderEntry): boolean => {
      this.ensureProviderLabelState(entry.label, entry.provider);
      if (this.isProviderLabelQuarantined(entry.label)) return false;
      if (this.providerHardDisabled.has(entry.provider)) return false;
      if (this.isEntryCoolingDown(entry.label)) return false;
      if (entry.provider === 'cloudflare' && !workersBudgetState.canUse) {
        if (recordEvents) {
          this.recordProviderEvent({
            type: 'workers_budget_exhausted',
            provider: 'cloudflare',
            label: entry.label,
            detail: workersBudgetState.blockedReason || 'workers-ai unavailable under current free-only budget',
          });
        }
        return false;
      }
      return true;
    };
    const onlinePool = buildAIOnlineProviderPool({
      nvidiaKeys: this.config.nvidiaKeys,
      siliconFlowKey: this.config.siliconFlowKey,
      openRouterKeys: this.config.openRouterKeys,
      nvidiaRotationIndex: this.currentNvidiaKeyIndex,
      openRouterRotationIndex: this.currentOpenrouterKeyIndex,
      isAvailable: ({ provider, key, label }) => isEntryCurrentlyAvailable({ provider, key, label }),
    });

    const primaryCandidates = onlinePool.primaryCandidates.map((candidate) => ({ ...candidate }));
    const backupProviderPostures = getBackupProviderPostures();
    const backupCandidates: Array<
      Omit<ProviderEntry, 'provider'> & {
        provider: BackupProviderName;
        groupPriority: number;
        rotationOrder: number;
        available: boolean;
        posture: AIBackupProviderPostureConfig['posture'];
        postureReason: string | null;
      }
    > = onlinePool.backupCandidates.map((candidate) => ({
      ...candidate,
      posture: 'disabled',
      postureReason: null,
    }));

    for (const candidate of backupCandidates) {
      const posture = backupProviderPostures[candidate.provider];
      candidate.posture = posture.posture;
      candidate.postureReason = posture.reason;
      candidate.available = candidate.available && posture.posture !== 'disabled';
      candidate.groupPriority += resolveBackupPosturePriorityOffset(posture.posture);
    }

    if (this.config.cfAccountId && this.config.cfApiToken) {
      const cloudflarePosture = backupProviderPostures.cloudflare;
      backupCandidates.push({
        provider: 'cloudflare',
        key: this.config.cfApiToken,
        label: 'C',
        groupPriority: 2 + resolveBackupPosturePriorityOffset(cloudflarePosture.posture),
        rotationOrder: 0,
        available:
          isEntryCurrentlyAvailable({ provider: 'cloudflare', key: this.config.cfApiToken, label: 'C' }) === true &&
          cloudflarePosture.posture !== 'disabled',
        posture: cloudflarePosture.posture,
        postureReason: cloudflarePosture.reason,
      });
    }

    const routing = buildProviderRoutingPlan({
      primaryCandidates,
      backupCandidates,
      stateByLabel,
      policy: this.fallbackPolicy,
      workloadProfile,
      nvidiaConfigured: this.config.nvidiaKeys.length > 0,
      alwaysReason: this.fallbackAlwaysReason,
    });

    primaryProviders.push(...routing.primaryOrder.map(({ provider, key, label }) => ({ provider, key, label })));
    if (advanceCursor && !this.providerHardDisabled.has('nvidia') && onlinePool.nvidiaPoolSize > 0) {
      this.currentNvidiaKeyIndex++;
    }

    if (routing.fallbackRouting.backupsAllowed) {
      backupProviders.push(...routing.backupOrder.map(({ provider, key, label }) => ({ provider, key, label })));
      if (advanceCursor && !this.providerHardDisabled.has('openrouter') && onlinePool.openRouterPoolSize > 0) {
        this.currentOpenrouterKeyIndex++;
      }
    }

    return {
      primaryProviders,
      backupProviders,
      providers: [...primaryProviders, ...backupProviders],
      fallbackRouting: {
        ...routing.fallbackRouting,
        recentActivations: this.fallbackActivations.slice(),
        eligibleBackupProviders: backupProviders.map((entry) => ({
          label: entry.label,
          provider: entry.provider as BackupProviderName,
        })),
      },
    };
  }

  private getAvailableProviders(
    recordEvents: boolean = true,
    advanceCursor: boolean = true,
    workloadProfile: AIProviderWorkloadProfileName = this.defaultWorkloadProfile,
  ): ProviderEntry[] {
    return this.inspectAvailableProviders(recordEvents, advanceCursor, workloadProfile).providers;
  }

  private async executeCallWithRetry(
    prompt: string,
    jsonMode: boolean,
    attempt: number = 0,
    workloadProfile: AIProviderWorkloadProfileName = this.defaultWorkloadProfile,
  ): Promise<string | null> {
    const inspection = this.inspectAvailableProviders(true, true, workloadProfile);
    if (inspection.providers.length === 0) {
      const nextCooldownMs = this.getSoonestCooldownRemainingMs();
      if (nextCooldownMs != null && attempt < RETRY_DELAYS.length) {
        const delay = Math.max(RETRY_DELAYS[attempt], nextCooldownMs);
        this.recordProviderEvent({
          type: 'retry_scheduled',
          attempt: attempt + 1,
          delayMs: delay,
          detail: `waiting for provider cooldown window (${nextCooldownMs}ms remaining)`,
        });
        await sleep(delay);
        return this.executeCallWithRetry(prompt, jsonMode, attempt + 1, workloadProfile);
      }
      this.recordProviderEvent({
        type: 'providers_unavailable',
        attempt: attempt + 1,
        detail: 'no providers available after current disablement, cooldown, and budget checks',
      });
      return null;
    }

    const providerErrors: string[] = [];
    const failures: Array<{ entry: ProviderEntry; status?: number; message: string; quarantined?: boolean }> = [];
    const attemptedLabels = new Set<string>();

    const attemptProviders = async (
      providers: ProviderEntry[],
      fallbackRouting: AIFallbackRoutingSnapshot,
    ): Promise<string | null> => {
      for (const p of providers) {
        if (attemptedLabels.has(p.label)) continue;
        attemptedLabels.add(p.label);

        const controller = new AbortController();
        try {
          if (p.provider !== 'nvidia') {
            this.recordFallbackActivation(
              p,
              fallbackRouting.activationReason || 'fallback_provider_selected',
              attempt + 1,
            );
          }
          const result = await this.callAISingle(prompt, p.provider, p.key, jsonMode, controller.signal);

          if (p.provider === 'nvidia') this.stats.nvidia++;
          else if (p.provider === 'siliconflow') this.stats.siliconflow++;
          else if (p.provider === 'openrouter') this.stats.openrouter++;
          else if (p.provider === 'cloudflare') this.stats.cloudflare++;
          this.recordProviderEvent({
            type: 'provider_success',
            provider: p.provider,
            label: p.label,
            attempt: attempt + 1,
            detail: jsonMode ? 'json response received' : 'response received',
          });

          process.stdout.write(p.label);
          return result;
        } catch (error: any) {
          controller.abort();
          const message = error instanceof Error ? error.message : String(error);
          if (p.provider === 'nvidia') this.stats.nvidiaFail++;
          providerErrors.push(`${p.label}:${message}`);
          const status = this.extractStatusCode(message);
          this.recordProviderEvent({
            type: 'provider_failure',
            provider: p.provider,
            label: p.label,
            status,
            attempt: attempt + 1,
            detail: message,
          });
          const quarantined = this.maybeQuarantineProviderLabel(p, status, message);
          failures.push({ entry: p, status, message, quarantined });
          if (!quarantined) this.applyFailurePolicy(p, status, message);
        }
      }

      return null;
    };

    const initialProviders =
      inspection.primaryProviders.length > 0 ? inspection.primaryProviders : inspection.providers;
    const primaryResult = await attemptProviders(initialProviders, inspection.fallbackRouting);
    if (primaryResult) return primaryResult;

    let backupInspection = inspection;
    if (inspection.backupProviders.length === 0) {
      backupInspection = this.inspectAvailableProviders(true, false, workloadProfile);
      if (
        backupInspection !== inspection &&
        backupInspection.backupProviders.length > 0 &&
        !this.providerHardDisabled.has('openrouter') &&
        this.config.openRouterKeys.length > 0
      ) {
        this.currentOpenrouterKeyIndex++;
      }
    }

    if (backupInspection.backupProviders.length > 0) {
      const backupResult = await attemptProviders(backupInspection.backupProviders, backupInspection.fallbackRouting);
      if (backupResult) return backupResult;
    }

    const hasRetryableFailure = failures.some(
      (f) => !f.quarantined && this.isRetryableFailure(f.entry.provider, f.status, f.message),
    );

    if (hasRetryableFailure && attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      this.recordProviderEvent({
        type: 'retry_scheduled',
        attempt: attempt + 1,
        delayMs: delay,
        detail: providerErrors.join(' ; '),
      });
      console.warn(
        `\n[AIService] All providers failed. Retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS.length})... | Errors: ${providerErrors.join(' ; ')}`,
      );
      await sleep(delay);
      return this.executeCallWithRetry(prompt, jsonMode, attempt + 1, workloadProfile);
    }

    console.error(
      `\n[AIService] All providers failed after ${attempt + 1} attempts. Errors:`,
      providerErrors.join('; '),
    );
    return null;
  }

  /**
   * Pre-summarize massive READMEs (Map-Reduce step)
   * Reads up to 40,000 characters of raw input and condenses it into an 800-word technical summary.
   */
  async generateLongContextSummary(skillName: string, rawText: string): Promise<string> {
    const hasProviderCapacity =
      this.config.nvidiaKeys.length > 0 ||
      !!this.config.siliconFlowKey ||
      this.config.openRouterKeys.length > 0 ||
      (!!this.config.cfAccountId && !!this.config.cfApiToken && WORKERS_AI_MODE !== 'disabled');

    if (!hasProviderCapacity) return rawText.slice(0, 3000);

    console.log(
      `[AIService] 🧠 Long Context Detected for ${skillName} (${rawText.length} chars). Running Map-Reduce Summary...`,
    );
    const prompt = `You are a Senior Technical Architect.
Please read this complete open-source project documentation for "${skillName}":

=== DOCUMENTATION START ===
${rawText.slice(0, 40000)}
=== DOCUMENTATION END ===

TASK:
Provide a highly condensed, information-dense 800-word technical summary.
DO NOT omit any advanced use cases, CLI commands, or ecosystem compatibilities (e.g., integrations mentioned at the bottom of the docs).
Output ONLY the summary, no intro/outro.`;

    try {
      const result = await this.callAI(prompt, false, 'batch_generation');
      return result || rawText.slice(0, 3000);
    } catch (e) {
      console.warn(`[WARN] Long Context Summary failed for ${skillName}, falling back to slice:`, e);
      return rawText.slice(0, 3000);
    }
  }

  /**
   * Translate and Generate Metadata with Full SEO Prompt
   * Uses batch-locale strategy: splits 10 locales into 3-4 batches
   * to keep output token count manageable (prevents timeouts).
   */
  async translateMetadata(
    text: string,
    context?: TranslateContext,
  ): Promise<{
    description: Record<string, string>;
    seo: SeoData;
  }> {
    const skillName = context?.name || '';
    const defaultResult = this.buildDeterministicMetadataFallback(text, context);

    const hasNvidia = this.config.nvidiaKeys.length > 0;
    const hasSiliconFlow = !!this.config.siliconFlowKey;
    const hasCloudflare = this.config.cfAccountId && this.config.cfApiToken;

    if (!hasNvidia && !hasSiliconFlow && !hasCloudflare) return defaultResult;

    console.log(`[AIService] Translating ${skillName}...`);

    let processedText = text;
    const topics = context?.topics?.join(', ') || '';
    const bodyPreview = context?.bodyPreview || '';

    // Map-Reduce for extremely long texts
    if (text.length > LONG_CONTEXT_TRIGGER_CHARS || bodyPreview.length > LONG_CONTEXT_TRIGGER_CHARS) {
      const fullRawText = text + '\n---\n' + bodyPreview;
      processedText = await this.generateLongContextSummary(skillName, fullRawText);
    } else {
      processedText = text.slice(0, 3000);
    }

    // Include bodyPreview snippet for skill-specific extraction (up to 2000 chars)
    const bodySnippet = bodyPreview ? bodyPreview.slice(0, 2000).replace(/"/g, '\\"').replace(/\n/g, ' ') : '';

    // Merged result accumulators
    const mergedDesc: Record<string, string> = {};
    const mergedSeoTitle: Record<string, string> = {};
    const mergedMetaDesc: Record<string, string> = {};
    const mergedDefinition: Record<string, string> = {};
    const mergedFeatures: Record<string, string[]> = {};
    const mergedKeywords: Record<string, string[]> = {};

    let successCount = 0;

    // ═══════════════════════════════════════════════════════════════
    // STEP 0: Generate English SEO content FIRST (dedicated prompt)
    // SUPPORTED_LOCALES does NOT include "en", so batch translation
    // never generates English content. This step fills the gap.
    // ═══════════════════════════════════════════════════════════════
    const enPrompt = `You are a Senior Technical SEO Specialist & Developer Advocate specializing in AI Agent Ecosystems.
Analyze this AI Agent Skill (for Claude Code, Cursor, Windsurf, or other AI coding assistants) and generate ENGLISH SEO content for a developer audience.

## Skill Information
- **Skill Name**: "${skillName}"
- **Description**: "${processedText.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
- **Tags**: ${topics}
${bodySnippet ? `- **Technical Content (from SKILL.md)**:\n"${bodySnippet}"` : ''}

## 🚨 STRICT THEME ENFORCEMENT (FAIL IF NOT FOLLOWED)
1. SEO Title MUST include ONE of these identifiers (non-negotiable):
   - "AI Agent Skill" OR "Agent Skill"
   - OR "for Claude Code" / "for Cursor" / "for Windsurf"
   - OR "| Killer-Skills" or "| AI Agent Skills"
   
2. Keywords structure (STRICT — exactly this ratio):
   - EXACTLY 2 theme anchors from: "AI agent skill", "for Claude Code", "for Cursor"
   - REMAINING 4-8 keywords MUST be CAPABILITY-SPECIFIC to THIS skill:
     They must describe what THIS skill uniquely does — its technologies, methods, or use cases.
     Ask yourself: "Would this keyword ONLY apply to THIS skill, not to every other skill?"
     If the answer is no, do NOT include it.

3. FORBIDDEN keyword patterns:
   - ❌ Low-intent: "how to", "what is", "why", "learn", "tutorial", "guide", "vs", "alternative"
   - ❌ Generic fillers that apply to ALL skills (these WILL be rejected):
     "agentic workflow", "agentic workflow automation", "ai coding workflow",
     "ai coding agent workflow", "cursor workflow automation", "workflow automation",
     "workflow optimization", "automation skill", "ai agent skills for developers"
   - ❌ Cross-domain: "browser automation" (unless browser skill), "MCP server" (unless server skill)

4. Title format examples:
   ✅ GOOD: "PostgreSQL: Optimized SQL Queries | AI Agent Skills"
   ✅ GOOD: "Browser Automation: Playwright Setup | Claude Code Skill"
   ✅ GOOD: "Slack Integration: Team Notifications for Cursor"
   ❌ BAD: "expo-tailwind-setup: Universal Styling Setup Guide"
   ❌ BAD: "Python Patterns: Best Practices & PEP 8"

## Generate these fields (English only):

### A. SEO Title (50-60 chars)
Format: "[Capability]: [Specific Use Case] | AI Agent Skills"
MUST include "AI Agent Skills" or IDE reference in the title.

### B. Meta Description (150-160 chars)
SERP-optimized. Focus on what the skill DOES and WHO benefits.
Include CTA or unique angle. DIFFERENT from Description.

### C. Main Description (1-2 sentences, 50-80 words)
Technical summary: WHAT it does + WHO benefits + HOW it helps with AI coding.

### D. Definition (40-60 words)
Start with "${skillName} is a..." for Featured Snippet format.

### E. Key Features (4-6 items)
Extract from SKILL.md content - specific capabilities, not generic benefits.
Format: "[Action] using [Technology/Method]"

### F. Keywords (6-10 items)
STRICTLY 2 theme anchors + 4-8 capability keywords.
Capability keywords MUST name specific technologies, methods, or use cases unique to THIS skill.

Example for a "docx" skill:
✅ GOOD: ["AI agent skill", "for Claude Code", "docx creation", "Word document parsing", "tracked changes automation", "docx-js XML manipulation", "pandoc document conversion", "document template generation"]
❌ BAD: ["AI agent skill", "claude code skills", "cursor workflow automation", "agentic workflow automation", "ai coding agent workflow", "document automation", "workflow optimization"]
   (BAD because 5 out of 7 are generic fillers that apply to ANY skill, not specific to docx)

High-value seed terms to cluster around (use when relevant to this skill):
- Navigational: ${SEED_KEYWORDS.navigational
      .slice(0, 4)
      .map((k) => `"${k}"`)
      .join(', ')}
- Informational: ${SEED_KEYWORDS.informational
      .slice(0, 4)
      .map((k) => `"${k}"`)
      .join(', ')}
- Long-tail: ${SEED_KEYWORDS.long_tail
      .slice(0, 4)
      .map((k) => `"${k}"`)
      .join(', ')}

Output STRICT JSON only:
{
  "seoTitle": { "en": "..." },
  "metaDescription": { "en": "..." },
  "description": { "en": "..." },
  "definition": { "en": "..." },
  "features": { "en": ["...", "...", "...", "..."] },
  "keywords": { "en": ["...", "...", "...", "...", "...", "..."] }
}`;

    try {
      const enResponse = await this.callAI(enPrompt, true);
      if (enResponse) {
        const enCandidates = extractJSONCandidates(enResponse);
        if (enCandidates.length === 0) {
          this.logMetadataDebug('en', skillName, 'No JSON candidate found in English SEO response', enResponse);
        }
        for (const item of enCandidates) {
          const parsed = robustParseJSON(item);
          if (parsed && typeof parsed === 'object') {
            const seoTitle = typeof parsed.seoTitle === 'string' ? parsed.seoTitle : parsed.seoTitle?.en;
            const metaDescription =
              typeof parsed.metaDescription === 'string'
                ? parsed.metaDescription
                : parsed.metaDescription?.en || parsed.meta_description?.en;
            const description = typeof parsed.description === 'string' ? parsed.description : parsed.description?.en;
            const definition = typeof parsed.definition === 'string' ? parsed.definition : parsed.definition?.en;
            const features = Array.isArray(parsed.features) ? parsed.features : parsed.features?.en;
            const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : parsed.keywords?.en;

            if (seoTitle) mergedSeoTitle.en = seoTitle;
            if (metaDescription) mergedMetaDesc.en = metaDescription;
            if (description) mergedDesc.en = description;
            if (definition) mergedDefinition.en = definition;
            if (Array.isArray(features) && features.length > 0) mergedFeatures.en = features;
            if (Array.isArray(keywords) && keywords.length > 0) mergedKeywords.en = keywords;

            const hasUsefulEnglishPayload =
              !!(seoTitle || metaDescription || description || definition) ||
              (Array.isArray(features) && features.length > 0) ||
              (Array.isArray(keywords) && keywords.length > 0);

            if (hasUsefulEnglishPayload) {
              successCount++;
              process.stdout.write('E');
              break;
            }

            this.logMetadataDebug(
              'en',
              skillName,
              `Parsed English candidate without usable fields: ${Object.keys(parsed).join(', ')}`,
              item,
            );
          } else {
            this.logMetadataDebug('en', skillName, 'Failed to parse English JSON candidate', item);
          }
        }
        if (!mergedDesc.en && !mergedSeoTitle.en) {
          this.logMetadataDebug(
            'en',
            skillName,
            'English SEO response produced candidates but no usable English fields were extracted',
            enResponse,
          );
        }
      }
    } catch (e) {
      console.warn(`⚠️ English SEO generation failed for ${skillName}:`, e);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Batch translate to non-English locales (existing logic)
    // ═══════════════════════════════════════════════════════════════
    const localeBatches: string[][] = [];
    const localeBatchSize = Math.max(1, Math.min(AI_LOCALE_BATCH_SIZE, SUPPORTED_LOCALES.length));
    for (let i = 0; i < SUPPORTED_LOCALES.length; i += localeBatchSize) {
      localeBatches.push(SUPPORTED_LOCALES.slice(i, i + localeBatchSize));
    }

    // Run ALL batches in PARALLEL — each batch races all providers
    const batchResults = await Promise.allSettled(
      localeBatches.map(async (batch) => {
        const localeStr = batch.join(', ');
        const localeExample = batch.map((l) => `"${l}": "..."`).join(', ');
        const localeArrayExample = batch.map((l) => `"${l}": ["..."]`).join(', ');

        const prompt = `You are a Senior Technical SEO Specialist & Developer Advocate specializing in AI Agent Ecosystems.
Analyze this AI Agent Skill (for Claude Code, Cursor, Windsurf, or other AI coding assistants) and generate SEO content for a developer audience.

## Input
- **Skill Name**: "${skillName}"
- **Description & Content**: "${processedText.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
- **Tags**: ${topics}
${bodySnippet ? `- **Technical Content (from SKILL.md)**:\n"${bodySnippet}"` : ''}

## Generate for locales: ${localeStr}

## 🚨 STRICT THEME ENFORCEMENT (FAIL IF NOT FOLLOWED)
1. SEO Title MUST include ONE of these identifiers (non-negotiable):
   - "AI Agent Skill" OR "Agent Skill" (translated to locale language)
   - OR "for Claude Code" / "for Cursor" / "for Windsurf"
   - OR "| Killer-Skills" or "| AI Agent Skills"
   
2. Keywords structure (STRICT — exactly this ratio, translated appropriately):
   - EXACTLY 2 theme anchors from: "AI agent skill", "for Claude Code", "for Cursor" (translated)
   - REMAINING 4-8 keywords MUST be CAPABILITY-SPECIFIC to THIS skill:
     They must describe what THIS skill uniquely does — its technologies, methods, or use cases.
     If a keyword could apply to ANY skill, do NOT include it.

3. FORBIDDEN keyword patterns (or locale equivalents):
   - ❌ Low-intent: "how to", "what is", "why", "learn", "tutorial", "guide", "vs", "alternative"
   - ❌ Generic fillers: "agentic workflow", "ai coding workflow", "cursor workflow automation",
     "workflow automation", "workflow optimization", "automation skill"
   - ❌ Cross-domain: "browser automation" (unless browser skill), "MCP server" (unless server skill)

4. Title format examples:
   ✅ GOOD: "PostgreSQL: Optimized SQL Queries | AI Agent Skills"
   ✅ GOOD: "Browser Automation: Playwright Setup | Claude Code Skill"
   ✅ GOOD: "Slack Integration: Team Notifications for Cursor"
   ❌ BAD: "expo-tailwind-setup: Universal Styling Setup Guide"
   ❌ BAD: "Python Patterns: Best Practices & PEP 8"

5. For non-English locales, seamlessly integrate the most popular local search term for "AI Agents" or "AI Tools" (e.g., Japanese: "AIエージェント", Chinese: "AI智能体", Russian: "ИИ Агенты"). Keep technical terms (React, Python, CLI) in English.

### A. SEO Title (50-60 chars) — MUST include theme identifier
### B. Meta Description (150-160 chars) — different from main description, for SERP CTR
### C. Main Description (1-2 sentences, 50-80 words) — clear, technical summary
### D. Definition (40-60 words) — encyclopedic "what is it" for Featured Snippet
### E. Key Features (4-6 items) — real technical highlights extracted from content
### F. Keywords (6-10 items) — STRICTLY 2 theme anchors + 4-8 capability keywords
- Capability keywords MUST name specific technologies, methods, or use cases unique to THIS skill
- Do NOT pad with generic fillers like "agentic workflow automation" or "ai coding agent workflow"
- NEVER output low-intent wrappers or comparison bait

Output STRICT JSON only, no markdown wrapping:
{
  "seoTitle": { ${localeExample} },
  "metaDescription": { ${localeExample} },
  "description": { ${localeExample} },
  "definition": { ${localeExample} },
  "features": { ${localeArrayExample} },
  "keywords": { ${localeArrayExample} }
}`;

        const response = await this.callAI(prompt, true);
        if (!response) throw new Error(`No response for [${localeStr}]`);

        const candidates = extractJSONCandidates(response);
        if (candidates.length === 0) {
          this.logMetadataDebug('batch', skillName, `No JSON candidate found for batch [${localeStr}]`, response);
        }
        for (const item of candidates) {
          const candidate = robustParseJSON(item);
          if (
            candidate &&
            typeof candidate === 'object' &&
            (candidate.description || candidate.definition || candidate.features)
          ) {
            return { parsed: candidate, batch };
          }
          this.logMetadataDebug(
            'batch',
            skillName,
            `Candidate parsed without expected metadata fields for batch [${localeStr}]`,
            item,
          );
        }
        throw new Error(`No valid JSON for [${localeStr}]`);
      }),
    );

    // Merge all successful batch results
    const mergeMap = (target: Record<string, string>, source: any, batch: string[]) => {
      if (!source || typeof source !== 'object') return;
      if (typeof source === 'string') {
        target[batch[0]] = source;
        return;
      }
      for (const [k, v] of Object.entries(source)) {
        if (typeof v === 'string' && v.trim()) target[k] = v;
      }
    };
    const mergeArray = (target: Record<string, string[]>, source: any) => {
      if (!source || typeof source !== 'object') return;
      for (const [k, v] of Object.entries(source)) {
        if (Array.isArray(v) && v.length > 0) target[k] = v;
      }
    };

    const batchErrors: string[] = [];
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { parsed, batch } = result.value;
        mergeMap(mergedDesc, parsed.description, batch);
        mergeMap(mergedSeoTitle, parsed.seoTitle || parsed.title, batch);
        mergeMap(mergedMetaDesc, parsed.metaDescription || parsed.meta_description, batch);
        mergeMap(mergedDefinition, parsed.definition, batch);
        mergeArray(mergedFeatures, parsed.features);
        mergeArray(mergedKeywords, parsed.keywords);
        successCount++;
      } else {
        batchErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
    }
    process.stdout.write('.');

    // If no batches succeeded, return default
    if (successCount === 0) {
      const detail = batchErrors.length > 0 ? ` Reasons: ${batchErrors.join('; ')}` : '';
      console.warn(`⚠️ All batches failed for ${skillName}, using default.${detail}`);
      return defaultResult;
    }

    // Ensure en fallback (only if English step also failed)
    for (const locale of ['en', ...SUPPORTED_LOCALES]) {
      if (!mergedDesc[locale]) {
        mergedDesc[locale] = defaultResult.description[locale] || defaultResult.description.en;
      }
    }
    if (!mergedSeoTitle.en) mergedSeoTitle.en = defaultResult.seo.title.en;
    if (!mergedMetaDesc.en) mergedMetaDesc.en = defaultResult.seo.description.en;
    if (!mergedDefinition.en) mergedDefinition.en = defaultResult.seo.definition.en;
    if (!Object.values(mergedFeatures).some((items) => Array.isArray(items) && items.length > 0)) {
      mergedFeatures.en = defaultResult.seo.features.en;
    } else if (!Array.isArray(mergedFeatures.en) || mergedFeatures.en.length === 0) {
      mergedFeatures.en = defaultResult.seo.features.en;
    }
    if (!Object.values(mergedKeywords).some((items) => Array.isArray(items) && items.length > 0)) {
      mergedKeywords.en = defaultResult.seo.keywords.en;
    } else if (!Array.isArray(mergedKeywords.en) || mergedKeywords.en.length === 0) {
      mergedKeywords.en = defaultResult.seo.keywords.en;
    }

    return {
      description: cleanAndTruncate(mergedDesc, 300),
      seo: {
        title: this.sanitizeSeoTitleMap(skillName || 'AI Skill', mergedSeoTitle),
        description: this.sanitizeSeoDescriptionMap(mergedMetaDesc.en ? mergedMetaDesc : mergedDesc, mergedDesc),
        definition: mergedDefinition.en ? mergedDefinition : defaultResult.seo.definition,
        features: mergedFeatures,
        keywords: this.sanitizeSeoKeywordsMap(skillName || 'AI Skill', mergedKeywords, context?.category),
      },
    };
  }

  /**
   * Generate Agent Analysis (Suitability, Recommendation, Use Cases)
   */
  async generateAgentAnalysis(
    skillName: string,
    description: string,
    bodyPreview: string,
  ): Promise<
    | { suitability: string; recommendation: string; useCases: string[]; limitations: string[]; version?: number }
    | undefined
  > {
    const fallback = this.buildDeterministicAgentAnalysisFallback(skillName, description, bodyPreview);
    let processedText = description + '\n' + bodyPreview;
    if (processedText.length > LONG_CONTEXT_TRIGGER_CHARS) {
      processedText = await this.generateLongContextSummary(skillName, processedText);
    } else {
      processedText = processedText.slice(0, 3000);
    }

    const prompt = `You are an AI Agent Ecosystem Expert. Analyze this skill for compatibility with modern AI Agents (e.g., Cursor, Windsurf, Claude Code, AutoGPT, LangChain).
        
Skill: ${skillName}
Comprehensive Content Analysis:
${processedText}

Analyze this skill and provide structured data optimized for SEO and Agent Developers.
CRITICAL: Content must be specific to "${skillName}". Avoid generic filler.

1. Suitability: A click-worthy one-sentence hook describing the *ideal* agent persona.
   - Good: "Perfect for Python Analysis Agents needing advanced data visualization capabilities."
   - Bad: "Suitable for AI agents." (Too generic)

2. Recommendation: A persuasive paragraph (2-3 sentences) on *why* to install this.
   - Focus on the "Superpower" it gives the agent.
   - **MANDATORY**: Include specific technical keywords from the content (e.g., libraries like 'p5.js', file formats like '.svg', protocols).
   - Start directly with the capability. Do NOT say "This skill allows...".
   - Bad: "This skill helps agents do art." -> Good: "Empowers agents to generate deterministic SVG flow fields using p5.js."

3. Use Cases: 3-5 specific, action-oriented scenarios.
   - Start with strong verbs (e.g., "Automating", "Generating", "Debugging").
   - **Must be distinct** and directly derived from the skill's specific features.
   - example: "Generating SVG flow fields for hero sections" (Specific) vs "Creating art" (Generic).

4. Limitations: Real constraints found in the text.
   - e.g., "Requires OpenAI API Key", "Filesystem Access Needed", "Python 3.10+ only".

Return JSON ONLY (Do NOT copy the example below, generate for "${skillName}"):

Example JSON (for a 'PostgreSQL Database' skill):
{
  "suitability": "Perfect for Backend Agents needing optimized SQL query generation.",
  "recommendation": "Allows the agent to safely interact with PostgreSQL databases. It provides schema introspection and query validation.",
  "useCases": ["Optimizing slow queries", "Generating schema migrations", "Validating SQL syntax"],
  "limitations": ["Requires active database connection", "PostgreSQL only"]
}

Your Response (for "${skillName}"):
{
  "suitability": "...",
  "recommendation": "...",
  "useCases": ["...", "...", "..."],
  "limitations": ["..."]
}`;

    try {
      const result = await this.callAI(prompt, true);
      if (result) {
        const candidates = extractJSONCandidates(result);
        for (const candidate of candidates) {
          const parsed = robustParseJSON(candidate);
          if (parsed && typeof parsed === 'object') {
            return {
              suitability: parsed.suitability || fallback.suitability,
              recommendation: parsed.recommendation || fallback.recommendation,
              useCases:
                Array.isArray(parsed.useCases) && parsed.useCases.length > 0 ? parsed.useCases : fallback.useCases,
              limitations:
                Array.isArray(parsed.limitations) && parsed.limitations.length > 0
                  ? parsed.limitations
                  : fallback.limitations,
              version: 4, // v4: dedicated English SEO generation + skill-specific prompts
            };
          }
        }
      }
    } catch (e) {
      console.error(`Failed to generate agent analysis for ${skillName}`, e);
    }
    return fallback;
  }

  /**
   * Translate Agent Analysis to all supported languages
   * Uses batch-locale strategy (same as translateMetadata) to avoid timeout.
   * Includes validation to reject suspiciously short translations.
   */
  async translateAgentAnalysis(raw: {
    suitability: string;
    recommendation: string;
    useCases: string[];
    limitations: string[];
    version?: number;
  }): Promise<AgentAnalysis> {
    // Helper: validate string fields, reject suspiciously short translations
    const validateField = (
      source: string,
      targetWrapper: Record<string, string>,
      kind: 'suitability' | 'recommendation',
    ) => {
      const verified: Record<string, string> = { en: source };
      for (const lang of SUPPORTED_LOCALES) {
        const val = targetWrapper[lang];
        const isSuspiciousLength = source.length > 20 && val && val.length < 10;
        const fellBackToEnglish = !!val && val === source;
        if (isSuspiciousLength || fellBackToEnglish) {
          console.warn(
            `[WARN] Discarding suspicious translation for ${lang}: "${val}" (Source length: ${source.length})`,
          );
          verified[lang] = this.buildLocalizedFallbackText(lang, kind, source, 220);
        } else {
          verified[lang] = val || this.buildLocalizedFallbackText(lang, kind, source, 220);
        }
      }
      return verified;
    };

    // Helper: validate array fields
    const validateArrayField = (
      source: string[],
      targetWrapper: Record<string, string[]>,
      kind: 'useCase' | 'limitation',
    ) => {
      const verified: Record<string, string[]> = { en: source };
      for (const lang of SUPPORTED_LOCALES) {
        const val = targetWrapper[lang];
        const fellBackToEnglish =
          Array.isArray(val) && val.length === source.length && val.every((item, index) => item === source[index]);
        if (Array.isArray(val) && val.length > 0 && !fellBackToEnglish) {
          verified[lang] = val;
        } else {
          verified[lang] = this.buildLocalizedFallbackArray(lang, kind, source);
        }
      }
      return verified;
    };

    // Accumulators for merged results
    const suitabilityMap: Record<string, string> = { en: raw.suitability };
    const recommendationMap: Record<string, string> = { en: raw.recommendation };
    const useCasesMap: Record<string, string[]> = { en: raw.useCases };
    const limitationsMap: Record<string, string[]> = { en: raw.limitations };

    // Split locales into batches
    const BATCH_SIZE = Math.max(1, Math.min(AI_LOCALE_BATCH_SIZE, SUPPORTED_LOCALES.length));
    const localeBatches: string[][] = [];
    for (let i = 0; i < SUPPORTED_LOCALES.length; i += BATCH_SIZE) {
      localeBatches.push(SUPPORTED_LOCALES.slice(i, i + BATCH_SIZE));
    }

    // Run ALL batches in PARALLEL — each batch races all providers
    const batchResults = await Promise.allSettled(
      localeBatches.map(async (batch) => {
        const localeStr = batch.join(', ');
        const localeExample = batch.map((l) => `"${l}": "..."`).join(', ');
        const localeArrayExample = batch.map((l) => `"${l}": ["..."]`).join(', ');

        const prompt = `You are a professional translator for technical documentation.
Translate the following AI Agent Skill analysis from English to: ${localeStr}.

GUIDELINES:
- Complete sentences, not single keywords. 
- **CRITICAL**: Preserve technical terms (e.g. "React", "Python", "CLI", "API", framework names) in their original English. Do NOT translate them into local scripts.
- Translate EVERY array item. Same count as English source.

Input (English):
{
  "suitability": "${raw.suitability.replace(/"/g, '\\"')}",
  "recommendation": "${raw.recommendation.replace(/"/g, '\\"')}",
  "useCases": ${JSON.stringify(raw.useCases)},
  "limitations": ${JSON.stringify(raw.limitations)}
}

Output STRICT JSON only, no markdown:
{
  "suitability": { ${localeExample} },
  "recommendation": { ${localeExample} },
  "useCases": { ${localeArrayExample} },
  "limitations": { ${localeArrayExample} }
}`;

        const result = await this.callAI(prompt, true);
        if (!result) throw new Error(`No response for [${localeStr}]`);

        const candidates = extractJSONCandidates(result);
        for (const candidate of candidates) {
          const p = robustParseJSON(candidate);
          if (p && typeof p === 'object' && p.suitability && typeof p.suitability === 'object') {
            return { parsed: p, batch };
          }
        }
        throw new Error(`No valid JSON for [${localeStr}]`);
      }),
    );

    // Merge all successful batch results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { parsed, batch } = result.value;
        for (const lang of batch) {
          if (parsed.suitability?.[lang]) suitabilityMap[lang] = parsed.suitability[lang];
          if (parsed.recommendation?.[lang]) recommendationMap[lang] = parsed.recommendation[lang];
          if (Array.isArray(parsed.useCases?.[lang]) && parsed.useCases[lang].length > 0) {
            useCasesMap[lang] = parsed.useCases[lang];
          }
          if (Array.isArray(parsed.limitations?.[lang]) && parsed.limitations[lang].length > 0) {
            limitationsMap[lang] = parsed.limitations[lang];
          }
        }
      }
    }
    process.stdout.write('.');

    // Apply validation on merged results
    return {
      suitability: validateField(raw.suitability, suitabilityMap, 'suitability'),
      recommendation: validateField(raw.recommendation, recommendationMap, 'recommendation'),
      useCases: validateArrayField(raw.useCases, useCasesMap, 'useCase'),
      limitations: validateArrayField(raw.limitations, limitationsMap, 'limitation'),
      version: raw.version || 1,
    };
  }
}
