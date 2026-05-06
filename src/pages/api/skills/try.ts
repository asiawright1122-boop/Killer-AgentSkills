import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { parseAIFallbackPolicy, type AIFallbackRoutingPolicy } from '../../../lib/ai-fallback-policy';
import { resolveAIProviderModel, SKILL_TRY_PROVIDER_MODEL_ALLOWLIST } from '../../../lib/ai-provider-models';
import { parseAIProviderWorkloadProfile, type AIProviderWorkloadProfileName } from '../../../lib/ai-provider-routing';
import type { Env } from '../../../lib/kv';
import {
  LiveAIRuntime,
  type LiveAIProviderName as LiveProvider,
  type LiveAIRoutingSnapshot as LiveRoutingSnapshot,
} from '../../../lib/live-ai-runtime';
import { createRateLimiter, getClientIP, rateLimitResponse } from '../../../lib/rate-limit';
import { getSkillTryProfile, type SkillTryProfile, type SkillTryProfileId } from '../../../lib/skill-try-profiles';
import { getSkillById } from '../../../lib/skills';
import { getRuntimeEnv } from '../../../lib/runtime-env';

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
  workloadProfile?: AIProviderWorkloadProfileName;
}

type TrialEnv = Env & Record<string, unknown>;

type TryMode = 'ai' | 'template';
const DEFAULT_SKILL_TRY_WORKLOAD_PROFILE: AIProviderWorkloadProfileName = 'interactive_demo';

const OUTPUT_CACHE_TTL_SECONDS = 6 * 60 * 60;
const USAGE_COUNTER_TTL_SECONDS = 3 * 24 * 60 * 60;
const DEFAULT_DAILY_LIVE_LIMIT = 500;
const warnedRejectedSkillTryModels = new Set<string>();

const localKvFallback = new Map<string, { value: string; expiresAt: number }>();

function isZhLocale(locale?: string): boolean {
  return (locale || '').toLowerCase().startsWith('zh');
}

function buildSystemPrompt(locale?: string, customRules?: string): string {
  const outputLanguage = isZhLocale(locale) ? 'Simplified Chinese' : 'English';
  return `You are an AI skill runtime preview engine.
You are simulating how an installed skill would respond.

${customRules ? `--- SKILL EXECUTION RULES ---\n${customRules}\n-----------------------------\n` : ''}

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
  const resolution = resolveAIProviderModel(provider, {
    scope: 'skill_try',
    env,
    getEnvString: (sourceEnv, key) => getEnvString((sourceEnv || env) as TrialEnv, key),
    allowList: SKILL_TRY_PROVIDER_MODEL_ALLOWLIST[provider],
  });

  if (resolution.rejectedOverride) {
    const warnKey = `${provider}:${resolution.rejectedOverride.envKey}:${resolution.rejectedOverride.model}`;
    if (!warnedRejectedSkillTryModels.has(warnKey)) {
      warnedRejectedSkillTryModels.add(warnKey);
      console.warn(
        `[SkillTryDemo] Ignoring non-allowlisted ${provider} model from ${resolution.rejectedOverride.envKey}: ${resolution.rejectedOverride.model}`,
      );
    }
  }

  return resolution.model;
}

function getSkillTryFallbackPolicy(env: TrialEnv): AIFallbackRoutingPolicy {
  return parseAIFallbackPolicy(getEnvString(env, 'AI_FALLBACK_POLICY'));
}

function getSkillTryWorkloadProfile(env: TrialEnv): AIProviderWorkloadProfileName {
  return parseAIProviderWorkloadProfile(
    getEnvString(env, 'SKILL_TRY_WORKLOAD_PROFILE'),
    DEFAULT_SKILL_TRY_WORKLOAD_PROFILE,
  );
}

function getSkillTryFallbackAlwaysReason(env: TrialEnv): string {
  return getEnvString(env, 'AI_FALLBACK_ALWAYS_REASON') || 'policy_always';
}

const skillTryRuntime = new LiveAIRuntime<TrialEnv>({
  fallbackPolicy: (env) => getSkillTryFallbackPolicy(env),
  workloadProfile: (env) => getSkillTryWorkloadProfile(env),
  fallbackAlwaysReason: (env) => getSkillTryFallbackAlwaysReason(env),
  providerModels: (env, provider) => getProviderModel(env, provider),
  defaultOpenRouterTitle: 'Killer-Skills Skill Trial',
  requestTimeoutMs: 30_000,
});

async function runLiveProviders(
  env: TrialEnv,
  systemPrompt: string,
  userPrompt: string,
  origin: string,
): Promise<{
  provider: LiveProvider;
  output: string;
  workloadProfile: AIProviderWorkloadProfileName;
  routing: LiveRoutingSnapshot;
}> {
  const result = await skillTryRuntime.callText(env, {
    systemPrompt,
    userPrompt,
    maxTokens: 700,
    temperature: 0.25,
    openRouterReferer: origin,
  });

  return {
    provider: result.provider,
    output: result.text,
    workloadProfile: result.workloadProfile,
    routing: result.routing,
  };
}

const FALLBACK_TEMPLATES: Readonly<{
  [K in SkillTryProfileId]: Readonly<{ zh: string; en: string }>;
}> = {
  copywriting: {
    zh: `## 标题
让 {{input}} 立刻更高效

## 副标题
用更少时间完成更多高价值任务，减少重复劳动，提升团队交付速度。

## 核心卖点
- 更快落地：把复杂流程拆成可执行步骤
- 更稳结果：减少人工波动，输出更一致
- 更省成本：让团队把时间用在关键决策上

## CTA
立即体验，7 天内看到可衡量提升。`,
    en: `## Headline
Make {{input}} dramatically more efficient

## Subheadline
Deliver high-value outcomes faster, reduce repetitive work, and improve team velocity.

## Core Benefits
- Faster execution: break complex work into clear steps
- Better consistency: reduce manual variance in outputs
- Lower cost: keep the team focused on high-impact decisions

## CTA
Start now and see measurable improvements in 7 days.`,
  },
  'meta-tags-optimizer': {
    zh: `## Title Tag
{{input}} | 免费在线工具与最佳实践

## Meta Description
快速获取 {{input}} 的实用方案与操作步骤。支持在线试用，帮助你更快完成落地并提升转化效率。

## OG Title
{{input}}：一键生成可落地结果

## OG Description
在线试用 + 清晰步骤 + 可复用模板，快速把想法变成可执行方案。`,
    en: `## Title Tag
{{input}} | Free Online Tool and Practical Guide

## Meta Description
Get actionable steps for {{input}}. Try it online and move from idea to implementation faster with conversion-focused copy.

## OG Title
{{input}}: Get Production-Ready Output Fast

## OG Description
Try online, follow clear steps, and reuse practical templates to ship faster.`,
  },
  'schema-markup-generator': {
    zh: `## JSON-LD（示例）
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "{{input}}",
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
- 上线后观察抓取和展现变化`,
    en: `## JSON-LD (Sample)
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "{{input}}",
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
- Monitor impressions and rich-result visibility after publish`,
  },
  'doc-coauthoring': {
    zh: `## 文档草稿大纲
### 1. 背景与目标
说明为什么要做：{{input}}

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
- M3: 正式发布`,
    en: `## Draft Outline
### 1. Context and Goal
Why this matters: {{input}}

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
- M3: Production rollout`,
  },
} as const;

function fallbackPreview(profileId: SkillTryProfileId, input: string, locale?: string): string {
  const shortInput = input.trim().length > 220 ? `${input.trim().slice(0, 220)}...` : input.trim();
  const template = FALLBACK_TEMPLATES[profileId];
  if (!template) {
    // Dynamic skills won't have a template in the hardcoded map.
    return isZhLocale(locale)
      ? `## 动态预览输出 (基于模板)\n\n针对输入: ${shortInput}\n(请使用实时模型查看完整运行结果)`
      : `## Dynamic Preview Output (Template Mode)\n\nInput: ${shortInput}\n(Enable Live Model for complete output)`;
  }
  return (isZhLocale(locale) ? template.zh : template.en).replace('{{input}}', shortInput);
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
    let profile = getSkillTryProfile(skillId);
    let dynamicRules = '';

    const env = ((await getRuntimeEnv<TrialEnv>(locals)) || {}) as TrialEnv;

    if (!profile) {
      // dynamic generation fallback
      const dynamicSkill = await getSkillById(env, skillId);
      if (!dynamicSkill) {
        return json({ success: false, error: 'Unsupported skillId and no dynamic skill found in database.' }, 400);
      }

      const rawDescEn =
        typeof dynamicSkill.description === 'object'
          ? dynamicSkill.description.en || dynamicSkill.description.zh || ''
          : typeof dynamicSkill.description === 'string'
            ? dynamicSkill.description
            : '';
      const skillMdBody = dynamicSkill.skillMd?.body || dynamicSkill.skillMd?.bodyPreview || '';

      // Pass the real skill rules safely up to ~4000 chars to avoid breaking openrouter limits on small models
      dynamicRules = skillMdBody.slice(0, 4000);

      const fallbackDescEn = `Provides logic based on: ${rawDescEn}`;
      const fallbackDescZh = `基于该技能逻辑：${rawDescEn}`;

      profile = {
        id: dynamicSkill.id as SkillTryProfileId,
        skillRef: `${dynamicSkill.owner}/${dynamicSkill.repo}`,
        label: { en: dynamicSkill.skillName || dynamicSkill.name, zh: dynamicSkill.skillName || dynamicSkill.name },
        description: { en: fallbackDescEn, zh: fallbackDescZh },
        inputLabel: { en: 'Preview Input', zh: '预览请求' },
        inputPlaceholder: { en: 'Enter your request to test this skill...', zh: '输入请求测试技能效果...' },
        outputHint: {
          en: 'Apply the custom skill rules to format the output.',
          zh: '严格遵循该技能的自定义规则生成输出。',
        },
      };
    }

    const input = body.input?.trim() || '';
    if (!input) {
      return json({ success: false, error: 'Input is required.' }, 400);
    }

    const sanitizedInput = input.slice(0, 3000);
    const locale = body.locale || 'en';

    const systemPrompt = buildSystemPrompt(locale, dynamicRules);
    const userPrompt = buildUserPrompt(profile, sanitizedInput, locale);
    const origin = new URL(request.url).origin;
    const cacheKey = createOutputCacheKey(profile.id, sanitizedInput, locale);

    let mode: TryMode = 'template';
    let provider: LiveProvider | 'template' = 'template';
    let workloadProfile = getSkillTryWorkloadProfile(env);
    let outputMarkdown = fallbackPreview(profile.id as SkillTryProfileId, sanitizedInput, locale);
    let fallbackReason = '';
    let routing: LiveRoutingSnapshot | undefined;

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
            workloadProfile: cached.workloadProfile || workloadProfile,
            routing,
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
        workloadProfile,
        routing,
        fallbackReason,
        installCommand: `npx killer-skills add ${profile.skillRef}`,
      });
    }

    try {
      const liveResult = await runLiveProviders(env, systemPrompt, userPrompt, origin);
      outputMarkdown = liveResult.output;
      mode = 'ai';
      provider = liveResult.provider;
      workloadProfile = liveResult.workloadProfile;
      routing = liveResult.routing;

      await writeStringStore(
        env,
        cacheKey,
        JSON.stringify({
          provider: liveResult.provider,
          outputMarkdown: liveResult.output,
          workloadProfile: liveResult.workloadProfile,
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
      workloadProfile,
      routing,
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
