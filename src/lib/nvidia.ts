import { parseAIFallbackPolicy } from './ai-fallback-policy';
import { resolveAIProviderModel } from './ai-provider-models';
import { parseAIProviderWorkloadProfile, type AIProviderWorkloadProfileName } from './ai-provider-routing';
import type { Env } from './kv';
import { LiveAIRuntime, type LiveAIProviderName, type LiveAIProviderRequest } from './live-ai-runtime';
import { appendNoHiddenReasoningInstruction, sanitizePublicAIOutput } from './public-ai-output';

type TranslationEnv = Env & Record<string, unknown>;

interface ChatCompletionResponse {
  choices: Array<{
    message?: { content: string };
    delta?: { content: string };
  }>;
}

type TranslationProviderExecution =
  | {
      kind: 'stream';
      response: Response;
    }
  | {
      kind: 'text';
      text: string;
    };

const DEFAULT_WORKLOAD_PROFILE: AIProviderWorkloadProfileName = 'interactive_demo';
const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

function getEnvString(env: TranslationEnv | undefined, key: string): string {
  const runtimeValue = env?.[key];
  if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
    return runtimeValue.trim();
  }

  const processValue = typeof process !== 'undefined' ? process.env?.[key] : '';
  return typeof processValue === 'string' ? processValue.trim() : '';
}

function getProviderModel(provider: LiveAIProviderName, env?: TranslationEnv): string {
  return resolveAIProviderModel(provider, {
    scope: 'translate',
    env,
    getEnvString,
  }).model;
}

function getLangName(code: string): string {
  const langMap: Record<string, string> = {
    zh: 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    ko: 'Korean',
    ru: 'Russian',
    pt: 'Portuguese',
    ar: 'Arabic',
  };

  return langMap[code] || code;
}

function buildSystemPrompt(targetLang: string, type: 'text' | 'markdown'): string {
  const langName = getLangName(targetLang);

  if (type === 'markdown') {
    return appendNoHiddenReasoningInstruction(`You are a technical document translator.
Translate the input Markdown content into ${langName}.

CRITICAL SEO RULE:
You MUST seamlessly integrate the most popular local search term for "AI Agents" or "AI Tools" in ${langName} into the very first paragraph of your translation.

FORMATTING RULES (STRICT):
1. Keep ALL Markdown structure intact.
2. INSERT A BLANK LINE before every Header (#, ##, ###).
3. INSERT A BLANK LINE between paragraphs.
4. Do NOT collapse text into a single block.
5. Do NOT translate inside code blocks (\`\`\`) or inline code (\` \`).
6. Maintain technical terms (e.g. "React", "Hook", "CI/CD") in English.

Output ONLY the translated Markdown.`);
  }

  return appendNoHiddenReasoningInstruction(`You are a professional translator. Translate the following text into ${langName}.
Maintain technical terms in their original language if appropriate.
Output ONLY the translated text.`);
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

const translationRuntime = new LiveAIRuntime<TranslationEnv>({
  getEnvString,
  fallbackPolicy: (env) => parseAIFallbackPolicy(getEnvString(env, 'AI_FALLBACK_POLICY') || 'guarded'),
  workloadProfile: (env) =>
    parseAIProviderWorkloadProfile(getEnvString(env, 'TRANSLATE_WORKLOAD_PROFILE'), DEFAULT_WORKLOAD_PROFILE),
  fallbackAlwaysReason: (env) => getEnvString(env, 'AI_FALLBACK_ALWAYS_REASON') || 'policy_always',
  providerModels: (env, provider) => getProviderModel(provider, env),
  defaultOpenRouterTitle: 'Killer-Skills Translation API',
  requestTimeoutMs: PROVIDER_REQUEST_TIMEOUT_MS,
});

async function callProvider(request: LiveAIProviderRequest, stream: boolean): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);

  try {
    const messages = request.systemPrompt
      ? [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ]
      : [{ role: 'user', content: request.userPrompt }];

    const response = await fetch(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
        ...request.extraHeaders,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        temperature: 0.2,
        max_tokens: 2048,
        top_p: 1,
        stream,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorBody = await response.text();
      try {
        const json = JSON.parse(errorBody);
        errorBody = json.error?.message || json.message || errorBody;
      } catch {
        // keep raw text
      }
      throw new Error(`${request.provider} HTTP ${response.status}: ${errorBody}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function callProviderText(request: LiveAIProviderRequest): Promise<string> {
  const response = await callProvider(request, false);
  const raw = await response.text();

  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`${request.provider} returned non-JSON response`);
  }

  const text = extractAiText(payload);
  if (!text) {
    throw new Error(`${request.provider} returned empty translation output`);
  }

  return text;
}

async function* streamNvidiaResponse(response: Response): AsyncGenerator<ChatCompletionResponse> {
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        yield {
          choices: [
            {
              delta: { content: data.choices?.[0]?.delta?.content || '' },
            },
          ],
        };
      } catch {
        console.warn('Failed to parse NVIDIA SSE line:', line);
      }
    }
  }
}

/**
 * 使用 AI provider 翻译文本 (流式传输)
 * NVIDIA 优先；在 guarded/always 策略下按需降级到 SiliconFlow / OpenRouter。
 */
export async function* translateTextStream(
  text: string,
  targetLang: string,
  type: 'text' | 'markdown' = 'text',
  env?: Env,
) {
  if (!text) throw new Error('Text is empty');

  const runtimeEnv = env as TranslationEnv | undefined;
  const systemPrompt = buildSystemPrompt(targetLang, type);
  const executed = await translationRuntime.runWithExecutor(
    runtimeEnv || ({} as TranslationEnv),
    {
      systemPrompt,
      userPrompt: text,
      maxTokens: 2048,
      temperature: 0.2,
      topP: 1,
    },
    async (request) => {
      if (request.provider === 'nvidia') {
        return {
          kind: 'stream',
          response: await callProvider(request, true),
        } satisfies TranslationProviderExecution;
      }

      return {
        kind: 'text',
        text: await callProviderText(request),
      } satisfies TranslationProviderExecution;
    },
  );

  if (executed.result.kind === 'stream') {
    let streamedText = '';
    for await (const chunk of streamNvidiaResponse(executed.result.response)) {
      streamedText += chunk?.choices?.[0]?.delta?.content || '';
    }

    yield {
      choices: [
        {
          delta: { content: sanitizePublicAIOutput(streamedText) },
        },
      ],
    };
    return;
  }

  yield {
    choices: [
      {
        delta: { content: sanitizePublicAIOutput(executed.result.text) },
      },
    ],
  };
}

/**
 * 使用 AI provider 翻译文本 (非流式)
 */
export async function translateText(
  text: string,
  targetLang: string,
  type: 'text' | 'markdown' = 'text',
  env?: Env,
): Promise<string> {
  if (!text) return '';

  const runtimeEnv = env as TranslationEnv | undefined;
  const systemPrompt = buildSystemPrompt(targetLang, type);
  const result = await translationRuntime.callText(runtimeEnv || ({} as TranslationEnv), {
    systemPrompt,
    userPrompt: text,
    maxTokens: 2048,
    temperature: 0.2,
    topP: 1,
  });

  return sanitizePublicAIOutput(result.text);
}
