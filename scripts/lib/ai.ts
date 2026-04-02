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

// Load default .env first
dotenv.config();

// Then explicitly override with .env.local if present
const localEnv = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}
import { SUPPORTED_LOCALES } from './constants';
import type { SeoData, AgentAnalysis, TranslateContext } from './types';
import { robustParseJSON, extractJSONCandidates, cleanAndTruncate, cleanAndClamp } from './utils';

export interface AIConfig {
  nvidiaKeys: string[];
  siliconFlowKey: string;
  openRouterKeys: string[];
  cfAccountId: string;
  cfApiToken: string;
}

export interface AIStats {
  nvidia: number;
  siliconflow: number;
  openrouter: number;
  cloudflare: number;
  nvidiaFail: number;
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
const sanitizeKeywordToken = (raw: string): string =>
  String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:|/\\\-\s]+|[,.;:|/\\\-\s]+$/g, '')
    .trim();
const normalizeKeywordToken = (raw: string): string => sanitizeKeywordToken(raw).toLowerCase();
const isAsciiKeyword = (text: string): boolean => [...text].every((char) => char.charCodeAt(0) <= 0x7f);

export class AIService {
  private config: AIConfig;
  public stats: AIStats = {
    nvidia: 0,
    siliconflow: 0,
    openrouter: 0,
    cloudflare: 0,
    nvidiaFail: 0,
  };

  private currentOpenrouterKeyIndex = 0;
  private currentNvidiaKeyIndex = 0;

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
    const fallbackBase = String(skillName || 'AI Skill').replace(/\s+/g, ' ').trim();
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
        const base = source.replace(rule.pattern, '').replace(/[|:;,\-–\s]+$/g, '').trim() || fallbackBase;
        return this.fitEnglishTitleWithSuffix(base, rule.suffix, 60);
      }
    }

    if (/(agent skill|ai agent|claude code|cursor|windsurf|mcp|killer-skills|agentic|skill guide)/i.test(source)) {
      return this.clampSeoText(source, 60);
    }

    const base = source.replace(/\s*\|\s*.*$/, '').replace(/[|:;,\-–\s]+$/g, '').trim() || fallbackBase;
    return this.fitEnglishTitleWithSuffix(base, ' | AI Agent Skills', 60);
  }

  private sanitizeEnglishSeoDescription(description: string, fallback: string): string {
    const normalized = String(description || '')
      .replace(/(\.\.\.|…)+/g, ' ')
      .replace(/\b(Get started|Learn now|Read more)\b[\s:,-]*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const source = normalized || String(fallback || '').replace(/\s+/g, ' ').trim();
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
      const normalized = String(value || '').replace(/\s+/g, ' ').trim();
      if (!normalized) continue;
      cleaned[locale] = locale === 'en' ? this.sanitizeEnglishSeoTitle(skillName, normalized) : this.clampSeoText(normalized, 60);
    }
    if (!cleaned.en) {
      cleaned.en = this.sanitizeEnglishSeoTitle(skillName, titles?.en || skillName || 'AI Skill');
    }
    return cleaned;
  }

  constructor(config?: Partial<AIConfig>) {
    this.config = {
      nvidiaKeys:
        config?.nvidiaKeys ||
        (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || '')
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      siliconFlowKey: config?.siliconFlowKey || process.env.SILICONFLOW_API_KEY || '',
      openRouterKeys:
        config?.openRouterKeys ||
        (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '')
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      cfAccountId: config?.cfAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '',
      cfApiToken: config?.cfApiToken || process.env.CLOUDFLARE_API_TOKEN || '',
    };
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
      if (/browser automation/i.test(normalized) && !catLower.includes('browser') && !skillName.toLowerCase().includes('browser') && !skillName.toLowerCase().includes('playwright') && !skillName.toLowerCase().includes('puppeteer')) continue;
      if (/\bmcp server\b/i.test(normalized) && !catLower.includes('mcp') && !skillName.toLowerCase().includes('mcp') && !skillName.toLowerCase().includes('server')) continue;
      if (/\bskill installation\b/i.test(normalized) && !catLower.includes('install') && !skillName.toLowerCase().includes('install') && !skillName.toLowerCase().includes('setup')) continue;

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
        'agent skill', 'ai agent', 'claude code', 'cursor', 'windsurf', 'mcp',
        'killer-skills', 'workflow', 'automation', '.claude', 'agentic',
      ];
      const themeCount = cleaned.filter((kw) => {
        const kwLower = kw.toLowerCase();
        return THEME_TERMS.some((t) => kwLower.includes(t));
      }).length;

      if (themeCount < 2) {
        // Inject ONLY theme anchors (no generic fillers), keeping total ≤ 10
        const injected = [
          `${skillName} AI agent skill`,
          `${skillName} for Claude Code`,
        ].map((item) => sanitizeKeywordToken(item)).filter(Boolean);
        const combined = [...cleaned, ...injected];
        const deduped: string[] = [];
        const seenNorm = new Set<string>();
        for (const kw of combined) {
          const n = normalizeKeywordToken(kw);
          if (!seenNorm.has(n)) { seenNorm.add(n); deduped.push(kw); }
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
    return [
      `${skillName} AI agent skill`,
      `${skillName} for Claude Code`,
    ]
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
          'agent skill', 'ai agent', 'claude code', 'cursor', 'windsurf', 'mcp',
          'killer-skills', 'agentic', 'workflow', 'automation',
          // Localized variants
          '智能体', 'エージェント', '에이전트', 'агент', 'وكيل',
        ];
        const themeCount = sanitized.filter((kw) => {
          const kwLower = kw.toLowerCase();
          return THEME_TERMS.some((t) => kwLower.includes(t));
        }).length;

        if (locale !== 'en' && themeCount < 1 && LOCALE_THEME_ANCHORS[locale]) {
          const anchors = LOCALE_THEME_ANCHORS[locale]
            .map((item) => sanitizeKeywordToken(item))
            .filter(Boolean);
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
    provider: 'nvidia' | 'siliconflow' | 'openrouter' | 'cloudflare',
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
          model: 'meta/llama-3.3-70b-instruct',
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
          model: 'Qwen/Qwen2.5-72B-Instruct',
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
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        };
        break;
      }
      case 'cloudflare': {
        url = `https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
        bodyObj = {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
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
   * - Retries on 429 errors with exponential backoff
   * - Uses Promise.race across all available providers
   */
  async callAI(prompt: string, jsonMode: boolean = false): Promise<string | null> {
    const releaseSlot = await acquireSlot();
    try {
      return await this.executeCallWithRetry(prompt, jsonMode);
    } finally {
      releaseSlot();
    }
  }

  private getAvailableProviders(): { provider: 'nvidia' | 'siliconflow' | 'openrouter' | 'cloudflare'; key: string; label: string }[] {
    const list: { provider: 'nvidia' | 'siliconflow' | 'openrouter' | 'cloudflare'; key: string; label: string }[] = [];
    
    if (this.config.nvidiaKeys.length > 0) {
      for (let i = 0; i < this.config.nvidiaKeys.length; i++) {
        const nvIndex = (this.currentNvidiaKeyIndex + i) % this.config.nvidiaKeys.length;
        list.push({ provider: 'nvidia', key: this.config.nvidiaKeys[nvIndex], label: `N${nvIndex}` });
      }
      this.currentNvidiaKeyIndex++;
    }
    
    if (this.config.siliconFlowKey) {
      list.push({ provider: 'siliconflow', key: this.config.siliconFlowKey, label: 'S' });
    }
    
    if (this.config.openRouterKeys.length > 0) {
      for (let i = 0; i < this.config.openRouterKeys.length; i++) {
        const orIndex = (this.currentOpenrouterKeyIndex + i) % this.config.openRouterKeys.length;
        list.push({ provider: 'openrouter', key: this.config.openRouterKeys[orIndex], label: `O${orIndex}` });
      }
      this.currentOpenrouterKeyIndex++;
    }
    
    if (this.config.cfAccountId && this.config.cfApiToken) {
      list.push({ provider: 'cloudflare', key: this.config.cfApiToken, label: 'C' });
    }
    
    return list;
  }

  private async executeCallWithRetry(prompt: string, jsonMode: boolean, attempt: number = 0): Promise<string | null> {
    const providers = this.getAvailableProviders();
    if (providers.length === 0) return null;

    const providerErrors: string[] = [];

    // Waterfall + Strict Round-Robin Single Trial
    for (const p of providers) {
      const controller = new AbortController();
      try {
        const result = await this.callAISingle(prompt, p.provider, p.key, jsonMode, controller.signal);
        
        if (p.provider === 'nvidia') this.stats.nvidia++;
        else if (p.provider === 'siliconflow') this.stats.siliconflow++;
        else if (p.provider === 'openrouter') this.stats.openrouter++;
        else if (p.provider === 'cloudflare') this.stats.cloudflare++;

        process.stdout.write(p.label);
        return result;
      } catch (error: any) {
        controller.abort();
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`${p.label}:${message}`);
        // If a request fails, we simply loop to the next provider in the sequence!
        // No waiting. This seamlessly switches from a 429'd NVIDIA key to the next NVIDIA key.
        continue;
      }
    }

    // If ALL providers failed, check if ANY failed due to 429 to trigger an exponential backoff retry.
    const has429 = providerErrors.some((error) => error.includes('429'));

    if (has429 && attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      console.warn(
        `\n[AIService] All providers failed. Found 429, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS.length})... | Errors: ${providerErrors.join(' ; ')}`,
      );
      await sleep(delay);
      return this.executeCallWithRetry(prompt, jsonMode, attempt + 1);
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
    if (!this.config.nvidiaKeys.length) return rawText.slice(0, 3000); // Fallback if NVIDIA not configured

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

    // Direct call to NVIDIA (guaranteed to have long context support via Llama 3.1 70B inside callAISingle)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000); // Allow 40s for long reduction
      const result = await this.callAISingle(prompt, 'nvidia', this.config.nvidiaKeys[0], false, controller.signal);
      clearTimeout(timeout);
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
    const defaultResult = {
      description: { en: text },
      seo: {
        title: { en: skillName || 'AI Skill' },
        description: { en: text.slice(0, 160) },
        definition: { en: text.slice(0, 200) },
        features: { en: [] as string[] },
        keywords: { en: [] as string[] },
      },
    };

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
- Navigational: ${SEED_KEYWORDS.navigational.slice(0, 4).map((k) => `"${k}"`).join(', ')}
- Informational: ${SEED_KEYWORDS.informational.slice(0, 4).map((k) => `"${k}"`).join(', ')}
- Long-tail: ${SEED_KEYWORDS.long_tail.slice(0, 4).map((k) => `"${k}"`).join(', ')}

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
    const BATCH_SIZE = SUPPORTED_LOCALES.length; // Massive Language Batching
    for (let i = 0; i < SUPPORTED_LOCALES.length; i += BATCH_SIZE) {
      localeBatches.push(SUPPORTED_LOCALES.slice(i, i + BATCH_SIZE));
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
    if (!mergedDesc.en) mergedDesc.en = text;
    if (!mergedSeoTitle.en) mergedSeoTitle.en = skillName || 'AI Skill';

    return {
      description: cleanAndTruncate(mergedDesc, 300),
      seo: {
        title: this.sanitizeSeoTitleMap(skillName || 'AI Skill', mergedSeoTitle),
        description: this.sanitizeSeoDescriptionMap(mergedMetaDesc.en ? mergedMetaDesc : mergedDesc, mergedDesc),
        definition: mergedDefinition.en ? mergedDefinition : { en: text },
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
              suitability: parsed.suitability || 'Suitable for general AI agents.',
              recommendation: parsed.recommendation || '',
              useCases: Array.isArray(parsed.useCases) ? parsed.useCases : [],
              limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
              version: 4, // v4: dedicated English SEO generation + skill-specific prompts
            };
          }
        }
      }
    } catch (e) {
      console.error(`Failed to generate agent analysis for ${skillName}`, e);
    }
    return undefined;
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
    const validateField = (source: string, targetWrapper: Record<string, string>) => {
      const verified: Record<string, string> = { en: source };
      for (const lang of SUPPORTED_LOCALES) {
        const val = targetWrapper[lang];
        const isSuspiciousLength = source.length > 20 && val && val.length < 10;
        if (isSuspiciousLength) {
          console.warn(
            `[WARN] Discarding suspicious translation for ${lang}: "${val}" (Source length: ${source.length})`,
          );
          verified[lang] = source;
        } else {
          verified[lang] = val || source;
        }
      }
      return verified;
    };

    // Helper: validate array fields
    const validateArrayField = (source: string[], targetWrapper: Record<string, string[]>) => {
      const verified: Record<string, string[]> = { en: source };
      for (const lang of SUPPORTED_LOCALES) {
        const val = targetWrapper[lang];
        if (Array.isArray(val) && val.length > 0) {
          verified[lang] = val;
        } else {
          verified[lang] = source; // Fallback: use English
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
    const BATCH_SIZE = SUPPORTED_LOCALES.length; // Massive Language Batching
    const localeBatches: string[][] = [];
    for (let i = 0; i < SUPPORTED_LOCALES.length; i += BATCH_SIZE) {
      localeBatches.push(SUPPORTED_LOCALES.slice(i, i + BATCH_SIZE));
    }

    let successCount = 0;

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
        successCount++;
      }
    }
    process.stdout.write('.');

    // Apply validation on merged results
    return {
      suitability: validateField(raw.suitability, suitabilityMap),
      recommendation: validateField(raw.recommendation, recommendationMap),
      useCases: validateArrayField(raw.useCases, useCasesMap),
      limitations: validateArrayField(raw.limitations, limitationsMap),
      version: raw.version || 1,
    };
  }
}
