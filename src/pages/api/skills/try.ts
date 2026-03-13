import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import type { Env } from '../../../lib/kv';
import { createRateLimiter, getClientIP, rateLimitResponse } from '../../../lib/rate-limit';
import { getSkillTryProfile, type SkillTryProfile, type SkillTryProfileId } from '../../../lib/skill-try-profiles';

export const prerender = false;

const trialLimiter = createRateLimiter({ windowMs: 60_000, max: 12 });

interface TrySkillRequestBody {
  skillId?: string;
  input?: string;
  locale?: string;
}

interface CachedTrialOutput {
  provider: LiveProvider;
  outputMarkdown: string;
}

type TrialEnv = Env & Record<string, unknown>;

type TryMode = 'ai' | 'template';
type LiveProvider = 'nvidia' | 'siliconflow' | 'openrouter';

const OUTPUT_CACHE_TTL_SECONDS = 6 * 60 * 60;
const USAGE_COUNTER_TTL_SECONDS = 3 * 24 * 60 * 60;
const DEFAULT_DAILY_LIVE_LIMIT = 500;
const PROVIDER_FAILURE_THRESHOLD = 4;
const PROVIDER_COOLDOWN_MS = 2 * 60 * 1000;

const FREE_MODEL_WHITELIST: Record<LiveProvider, readonly string[]> = {
  nvidia: ['deepseek-ai/deepseek-v3.1'],
  siliconflow: ['deepseek-ai/DeepSeek-V3'],
  openrouter: ['google/gemma-3-27b-it:free'],
};

const DEFAULT_PROVIDER_MODEL: Record<LiveProvider, string> = {
  nvidia: 'deepseek-ai/deepseek-v3.1',
  siliconflow: 'deepseek-ai/DeepSeek-V3',
  openrouter: 'google/gemma-3-27b-it:free',
};

const PROVIDER_MODEL_ENV_KEYS: Record<LiveProvider, string> = {
  nvidia: 'SKILL_TRY_MODEL_NVIDIA',
  siliconflow: 'SKILL_TRY_MODEL_SILICONFLOW',
  openrouter: 'SKILL_TRY_MODEL_OPENROUTER',
};

const localKvFallback = new Map<string, { value: string; expiresAt: number }>();
const providerState = new Map<LiveProvider, { failures: number; openUntil: number }>();

function isZhLocale(locale?: string): boolean {
  return (locale || '').toLowerCase().startsWith('zh');
}

function buildSystemPrompt(locale?: string): string {
  const outputLanguage = isZhLocale(locale) ? 'Simplified Chinese' : 'English';
  return `You are an AI skill runtime preview engine.
You are simulating how an installed skill would respond.
Return practical, actionable output in ${outputLanguage}.
Use Markdown headings and bullets.
Do not add policy disclaimers unless safety is directly relevant.
Do not mention that this is a simulation.`;
}

function buildUserPrompt(profile: SkillTryProfile, input: string, locale?: string): string {
  const outputHint = isZhLocale(locale) ? profile.outputHint.zh : profile.outputHint.en;
  return `Skill ID: ${profile.id}
Skill Ref: ${profile.skillRef}
Skill Purpose: ${profile.description.en}
Expected Output Shape: ${outputHint}

User Input:
${input}

Please produce the final answer directly.`;
}

function extractAiText(payload: unknown): string | null {
  const data = payload as any;
  const candidates: unknown[] = [
    data?.result?.response,
    data?.response,
    data?.result?.text,
    data?.result?.output_text,
    data?.output_text,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (Array.isArray(candidate)) {
      const merged = candidate
        .map((item) => (typeof item === 'string' ? item : item?.text || item?.content || ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (merged) return merged;
    }
  }

  return null;
}

function getEnvString(env: TrialEnv, key: string): string {
  const runtimeValue = env?.[key];
  if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
    return runtimeValue.trim();
  }
  const processValue = typeof process !== 'undefined' ? process.env?.[key] : '';
  return typeof processValue === 'string' ? processValue.trim() : '';
}

function cleanLocalKvFallback() {
  const now = Date.now();
  for (const [key, item] of localKvFallback) {
    if (item.expiresAt <= now) {
      localKvFallback.delete(key);
    }
  }
}

async function readStringStore(env: TrialEnv, key: string): Promise<string | null> {
  if (env?.TRANSLATIONS && typeof env.TRANSLATIONS.get === 'function') {
    return env.TRANSLATIONS.get(key);
  }

  cleanLocalKvFallback();
  const item = localKvFallback.get(key);
  return item ? item.value : null;
}

async function writeStringStore(env: TrialEnv, key: string, value: string, ttlSeconds: number): Promise<void> {
  if (env?.TRANSLATIONS && typeof env.TRANSLATIONS.put === 'function') {
    await env.TRANSLATIONS.put(key, value, { expirationTtl: ttlSeconds });
    return;
  }

  localKvFallback.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function getDailyLimit(env: TrialEnv): number {
  const raw = getEnvString(env, 'SKILL_TRY_DAILY_LIMIT');
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return DEFAULT_DAILY_LIVE_LIMIT;
}

function getUsageCounterKey(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10);
  return `skill-try:v1:usage:${datePart}`;
}

async function reserveDailyLiveBudget(env: TrialEnv): Promise<{ allowed: boolean; count: number; limit: number }> {
  const limit = getDailyLimit(env);
  const key = getUsageCounterKey();
  const raw = await readStringStore(env, key);
  const current = raw ? Number(raw) : 0;
  const safeCurrent = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;

  if (safeCurrent >= limit) {
    return { allowed: false, count: safeCurrent, limit };
  }

  const next = safeCurrent + 1;
  await writeStringStore(env, key, String(next), USAGE_COUNTER_TTL_SECONDS);
  return { allowed: true, count: next, limit };
}

function createOutputCacheKey(profileId: string, input: string, locale: string): string {
  const fingerprint = crypto.createHash('sha256').update(`${profileId}|${locale}|${input}`).digest('hex');
  return `skill-try:v1:out:${fingerprint}`;
}

function getProviderModel(env: TrialEnv, provider: LiveProvider): string {
  const modelEnvKey = PROVIDER_MODEL_ENV_KEYS[provider];
  const override = getEnvString(env, modelEnvKey);
  const allowList = FREE_MODEL_WHITELIST[provider];

  if (override && allowList.includes(override)) {
    return override;
  }

  if (override && !allowList.includes(override)) {
    console.warn(`[SkillTryDemo] Ignoring non-whitelisted ${provider} model: ${override}`);
  }

  return DEFAULT_PROVIDER_MODEL[provider];
}

function isProviderCoolingDown(provider: LiveProvider): boolean {
  const entry = providerState.get(provider);
  if (!entry) return false;
  return Date.now() < entry.openUntil;
}

function noteProviderSuccess(provider: LiveProvider) {
  providerState.set(provider, { failures: 0, openUntil: 0 });
}

function noteProviderFailure(provider: LiveProvider) {
  const current = providerState.get(provider) || { failures: 0, openUntil: 0 };
  const failures = current.failures + 1;
  const openUntil = failures >= PROVIDER_FAILURE_THRESHOLD ? Date.now() + PROVIDER_COOLDOWN_MS : 0;
  providerState.set(provider, { failures, openUntil });
}

function splitKeys(...sources: string[]): string[] {
  return sources
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNvidiaKeys(env: TrialEnv): string[] {
  return splitKeys(
    getEnvString(env, 'NVIDIA_API_KEYS'),
    getEnvString(env, 'NVIDIA_API_KEY'),
    getEnvString(env, 'NVIDIA_API_KEYS_2'),
    getEnvString(env, 'NVIDIA_API_KEYS_3'),
    getEnvString(env, 'NVIDIA_API_KEYS_4'),
    getEnvString(env, 'NVIDIA_API_KEYS_5'),
  );
}

function getOpenRouterKeys(env: TrialEnv): string[] {
  return splitKeys(getEnvString(env, 'OPENROUTER_API_KEYS'), getEnvString(env, 'OPENROUTER_API_KEY'));
}

interface ProviderRequest {
  provider: LiveProvider;
  url: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  extraHeaders?: Record<string, string>;
}

async function callProvider(request: ProviderRequest): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
        ...request.extraHeaders,
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature: 0.25,
        max_tokens: 700,
        stream: false,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`${request.provider} HTTP ${response.status}: ${raw.slice(0, 220)}`);
    }

    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`${request.provider} returned non-JSON response`);
    }

    const text = extractAiText(payload);
    if (!text) {
      throw new Error(`${request.provider} returned empty text output`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function runLiveProviders(
  env: TrialEnv,
  systemPrompt: string,
  userPrompt: string,
  origin: string,
): Promise<{ provider: LiveProvider; output: string }> {
  const errors: string[] = [];
  const nvidiaModel = getProviderModel(env, 'nvidia');
  const siliconFlowModel = getProviderModel(env, 'siliconflow');
  const openRouterModel = getProviderModel(env, 'openrouter');

  if (!isProviderCoolingDown('nvidia')) {
    const nvidiaKeys = getNvidiaKeys(env);
    for (const apiKey of nvidiaKeys) {
      try {
        const output = await callProvider({
          provider: 'nvidia',
          url: 'https://integrate.api.nvidia.com/v1/chat/completions',
          apiKey,
          model: nvidiaModel,
          systemPrompt,
          userPrompt,
        });
        noteProviderSuccess('nvidia');
        return { provider: 'nvidia', output };
      } catch (error) {
        noteProviderFailure('nvidia');
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    errors.push('nvidia cooling down after recent failures');
  }

  if (!isProviderCoolingDown('siliconflow')) {
    const siliconFlowKey = getEnvString(env, 'SILICONFLOW_API_KEY');
    if (siliconFlowKey) {
      try {
        const output = await callProvider({
          provider: 'siliconflow',
          url: 'https://api.siliconflow.cn/v1/chat/completions',
          apiKey: siliconFlowKey,
          model: siliconFlowModel,
          systemPrompt,
          userPrompt,
        });
        noteProviderSuccess('siliconflow');
        return { provider: 'siliconflow', output };
      } catch (error) {
        noteProviderFailure('siliconflow');
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    errors.push('siliconflow cooling down after recent failures');
  }

  if (!isProviderCoolingDown('openrouter')) {
    const openRouterKeys = getOpenRouterKeys(env);
    for (const apiKey of openRouterKeys) {
      try {
        const output = await callProvider({
          provider: 'openrouter',
          url: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey,
          model: openRouterModel,
          systemPrompt,
          userPrompt,
          extraHeaders: {
            'HTTP-Referer': origin,
            'X-Title': 'Killer-Skills Skill Trial',
          },
        });
        noteProviderSuccess('openrouter');
        return { provider: 'openrouter', output };
      } catch (error) {
        noteProviderFailure('openrouter');
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    errors.push('openrouter cooling down after recent failures');
  }

  const reason = errors.length > 0 ? errors.join(' | ') : 'No NVIDIA/SiliconFlow/OpenRouter keys configured.';
  throw new Error(reason);
}

function fallbackPreview(profileId: SkillTryProfileId, input: string, locale?: string): string {
  const trimmed = input.trim();
  const shortInput = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
  const zh = isZhLocale(locale);

  if (profileId === 'copywriting') {
    return zh
      ? `## 标题
让 ${shortInput} 立刻更高效

## 副标题
用更少时间完成更多高价值任务，减少重复劳动，提升团队交付速度。

## 核心卖点
- 更快落地：把复杂流程拆成可执行步骤
- 更稳结果：减少人工波动，输出更一致
- 更省成本：让团队把时间用在关键决策上

## CTA
立即体验，7 天内看到可衡量提升。`
      : `## Headline
Make ${shortInput} dramatically more efficient

## Subheadline
Deliver high-value outcomes faster, reduce repetitive work, and improve team velocity.

## Core Benefits
- Faster execution: break complex work into clear steps
- Better consistency: reduce manual variance in outputs
- Lower cost: keep the team focused on high-impact decisions

## CTA
Start now and see measurable improvements in 7 days.`;
  }

  if (profileId === 'meta-tags-optimizer') {
    return zh
      ? `## Title Tag
${shortInput} | 免费在线工具与最佳实践

## Meta Description
快速获取 ${shortInput} 的实用方案与操作步骤。支持在线试用，帮助你更快完成落地并提升转化效率。

## OG Title
${shortInput}：一键生成可落地结果

## OG Description
在线试用 + 清晰步骤 + 可复用模板，快速把想法变成可执行方案。`
      : `## Title Tag
${shortInput} | Free Online Tool and Practical Guide

## Meta Description
Get actionable steps for ${shortInput}. Try it online and move from idea to implementation faster with conversion-focused copy.

## OG Title
${shortInput}: Get Production-Ready Output Fast

## OG Description
Try online, follow clear steps, and reuse practical templates to ship faster.`;
  }

  if (profileId === 'schema-markup-generator') {
    return zh
      ? `## JSON-LD（示例）
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "${shortInput}",
  "description": "围绕该主题的可执行步骤说明",
  "step": [
    { "@type": "HowToStep", "name": "准备输入信息" },
    { "@type": "HowToStep", "name": "执行核心步骤" },
    { "@type": "HowToStep", "name": "校验与发布" }
  ]
}
\`\`\`

## 实施清单
- 放到页面 \`<head>\` 或主体末尾
- 用 Rich Results Test 校验语法
- 上线后观察抓取和展现变化`
      : `## JSON-LD (Sample)
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "${shortInput}",
  "description": "Actionable step-by-step implementation",
  "step": [
    { "@type": "HowToStep", "name": "Prepare your input data" },
    { "@type": "HowToStep", "name": "Run the core workflow" },
    { "@type": "HowToStep", "name": "Validate and publish" }
  ]
}
\`\`\`

## Implementation Checklist
- Add this block in your page head or near the end of body
- Validate with Rich Results Test
- Monitor impressions and rich-result visibility after publish`;
  }

  return zh
    ? `## 文档草稿大纲
### 1. 背景与目标
说明为什么要做：${shortInput}

### 2. 范围
- 本次包含
- 本次不包含

### 3. 方案设计
- 用户流程
- 数据结构
- 风险与回滚

### 4. 里程碑
- M1: Demo 可用
- M2: 小范围验证
- M3: 正式发布`
    : `## Draft Outline
### 1. Context and Goal
Why this matters: ${shortInput}

### 2. Scope
- In scope
- Out of scope

### 3. Solution Design
- User flow
- Data model
- Risks and rollback

### 4. Milestones
- M1: Working demo
- M2: Limited validation
- M3: Production rollout`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const clientIP = getClientIP(request);
  if (trialLimiter.isLimited(clientIP)) {
    return rateLimitResponse();
  }

  try {
    const body = (await request.json()) as TrySkillRequestBody;
    const skillId = body.skillId?.trim() || '';
    const profile = getSkillTryProfile(skillId);
    if (!profile) {
      return json({ success: false, error: 'Unsupported skillId.' }, 400);
    }

    const input = body.input?.trim() || '';
    if (!input) {
      return json({ success: false, error: 'Input is required.' }, 400);
    }

    const sanitizedInput = input.slice(0, 3000);
    const locale = body.locale || 'en';

    const env = (locals.runtime?.env || {}) as TrialEnv;
    const systemPrompt = buildSystemPrompt(locale);
    const userPrompt = buildUserPrompt(profile, sanitizedInput, locale);
    const origin = new URL(request.url).origin;
    const cacheKey = createOutputCacheKey(profile.id, sanitizedInput, locale);

    let mode: TryMode = 'template';
    let provider: LiveProvider | 'template' = 'template';
    let outputMarkdown = fallbackPreview(profile.id, sanitizedInput, locale);
    let fallbackReason = '';

    const cachedRaw = await readStringStore(env, cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as CachedTrialOutput;
        if (cached?.provider && cached?.outputMarkdown) {
          return json({
            success: true,
            mode: 'ai',
            provider: cached.provider,
            skillId: profile.id,
            skillRef: profile.skillRef,
            outputMarkdown: cached.outputMarkdown,
            cached: true,
            installCommand: `npx killer-skills add ${profile.skillRef}`,
          });
        }
      } catch {
        // Ignore broken cache and continue with live generation.
      }
    }

    const budget = await reserveDailyLiveBudget(env);
    if (!budget.allowed) {
      fallbackReason = `daily_live_limit_reached:${budget.count}/${budget.limit}`;
      return json({
        success: true,
        mode,
        provider,
        skillId: profile.id,
        skillRef: profile.skillRef,
        outputMarkdown,
        fallbackReason,
        installCommand: `npx killer-skills add ${profile.skillRef}`,
      });
    }

    try {
      const liveResult = await runLiveProviders(env, systemPrompt, userPrompt, origin);
      outputMarkdown = liveResult.output;
      mode = 'ai';
      provider = liveResult.provider;

      await writeStringStore(
        env,
        cacheKey,
        JSON.stringify({
          provider: liveResult.provider,
          outputMarkdown: liveResult.output,
        } satisfies CachedTrialOutput),
        OUTPUT_CACHE_TTL_SECONDS,
      );
    } catch (error) {
      console.warn('[SkillTryDemo] Falling back to template mode:', error);
      fallbackReason = 'provider_unavailable';
    }

    return json({
      success: true,
      mode,
      provider,
      skillId: profile.id,
      skillRef: profile.skillRef,
      outputMarkdown,
      fallbackReason: fallbackReason || undefined,
      installCommand: `npx killer-skills add ${profile.skillRef}`,
    });
  } catch (error) {
    console.error('[SkillTryDemo] API error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
};
