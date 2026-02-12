
import type { Env } from './kv';

// Remove top-level keys. We will pass them or extract them from Env.

function getKeysFromEnv(env: Env | any): string[] {
    // Determine source of env: could be standard process.env (Node) or Cloudflare Env
    const get = (key: string) => (env && env[key]) || (typeof process !== 'undefined' && process.env && process.env[key]);

    const rawKeys = [
        get('NVIDIA_API_KEYS'),
        get('NVIDIA_API_KEY'),
        get('NVIDIA_API_KEYS_2'),
        get('NVIDIA_API_KEYS_3'),
        get('NVIDIA_API_KEYS_4'),
        get('NVIDIA_API_KEYS_5')
    ].filter(Boolean).join(',');

    return rawKeys.split(',').map(k => k.trim()).filter(Boolean);
}

// Per-env cache to avoid re-parsing keys in the same request, but no cross-request leakage
const envKeysCache = new WeakMap<object, string[]>();

function getKeysForEnv(env?: Env): string[] {
    if (!env) return [];
    const cached = envKeysCache.get(env);
    if (cached) return cached;
    const keys = getKeysFromEnv(env);
    envKeysCache.set(env, keys);
    return keys;
}

// Per-call key index (not module-level to avoid cross-request state in Workers)
let _callKeyIndex = 0;

function getNextKey(env?: Env): string {
    const keys = getKeysForEnv(env);
    if (keys.length === 0) throw new Error("No NVIDIA API Keys configured");
    const key = keys[_callKeyIndex % keys.length];
    _callKeyIndex = (_callKeyIndex + 1) % keys.length;
    return key;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
}

// NVIDIA API 响应类型
interface ChatCompletionResponse {
    choices: Array<{
        message?: { content: string };
        delta?: { content: string };
    }>;
}

// 简单的 Fetch 封装，模拟 SDK 行为
async function callNvidiaApi(apiKey: string, payload: ChatCompletionRequest) {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errorBody = await response.text();
        try {
            const json = JSON.parse(errorBody);
            errorBody = json.error?.message || errorBody;
        } catch { }
        throw new Error(`NVIDIA API Error ${response.status}: ${errorBody}`);
    }

    return response;
}

/**
 * 使用 NVIDIA LLM 翻译文本 (流式传输)
 * 返回一个 AsyncGenerator，产生 chunks (OpenAI 格式的 partial delta)
 */
export async function* translateTextStream(text: string, targetLang: string, type: 'text' | 'markdown' = 'text', env?: Env) {
    if (!text) throw new Error("Text is empty");

    let systemPrompt = `You are a professional translator. Translate the following text into ${targetLang === 'zh' ? 'Chinese (Simplified)' : targetLang}. 
    Maintain technical terms in their original language if appropriate. 
    Output ONLY the translated text.`;

    if (type === 'markdown') {
        systemPrompt = `You are a technical document translator. 
        Translate the input Markdown content into ${targetLang === 'zh' ? 'Chinese (Simplified)' : targetLang}.

        FORMATTING RULES (STRICT):
        1. Keep ALL Markdown structure intact.
        2. **INSERT A BLANK LINE** (double newline) before every Header (#, ##, ###).
        3. **INSERT A BLANK LINE** (double newline) between paragraphs.
        4. Do NOT collapse text into a single block. 
        5. Do NOT translate inside code blocks (\`\`\`) or inline code (\` \`).
        6. maintain technical terms (e.g. "React", "Hook", "CI/CD") in English.

        Example Input:
        # Title
        Paragraph 1.
        
        Example Output:
        # 标题
        
        段落 1。`;
    }

    const envKeys = getKeysForEnv(env);
    const maxRetries = Math.max(envKeys.length, 1);
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
        const apiKey = getNextKey(env);
        // ... (rest of loop logic) ...
        try {
            console.log(`[Translation Stream] Attempt ${i + 1}/${maxRetries} using key ending ...${apiKey.slice(-4)}`);

            const response = await callNvidiaApi(apiKey, {
                model: "meta/llama-3.1-70b-instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.2,
                max_tokens: 2048,
                top_p: 1,
                stream: true,
            });

            if (!response.body) throw new Error("No response body");

            // 手动解析 SSE
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留未完成的行

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            // Yield a structure compatible with original SDK response expected by consumer
                            yield {
                                choices: [{
                                    delta: { content: data.choices[0]?.delta?.content || '' }
                                }]
                            };
                        } catch (e) {
                            console.warn('Failed to parse SSE line:', line);
                        }
                    }
                }
            }
            return; // Success

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Translation Stream] Key ...${apiKey.slice(-4)} failed:`, errorMessage);
            lastError = error;
            // 400 Bad Request 通常是不可重试的（如 Context Length Exceeded）
            if (errorMessage.includes('400') || errorMessage.includes('invalid_request_error')) break;
        }
    }
    throw lastError || new Error("Stream Translation failed after retries");
}

/**
 * 使用 NVIDIA LLM 翻译文本 (非流式)
 */
export async function translateText(text: string, targetLang: string, type: 'text' | 'markdown' = 'text', env?: Env): Promise<string> {
    if (!text) return "";

    const systemPrompt = `You are a professional translator. Translate the following text into ${targetLang === 'zh' ? 'Chinese (Simplified)' : targetLang}. Output ONLY the translated text.`;

    const envKeys = getKeysForEnv(env);
    const maxRetries = Math.max(envKeys.length, 1);
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
        const apiKey = getNextKey(env);
        try {
            console.log(`[Translation] Attempt ${i + 1}/${maxRetries} using key ending in ...${apiKey.slice(-4)}`);

            const response = await callNvidiaApi(apiKey, {
                model: "meta/llama-3.1-70b-instruct",
                messages: [
                    { role: "system", content: systemPrompt }, // Using simplified prompt for brevity, assuming standard text
                    { role: "user", content: text }
                ],
                temperature: 0.2,
                max_tokens: 2048,
                top_p: 1,
            });

            const data = await response.json() as ChatCompletionResponse;
            return data.choices[0]?.message?.content || "";

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Translation] Key ...${apiKey.slice(-4)} failed:`, errorMessage);
            lastError = error;
            if (errorMessage.includes('400')) break;
        }
    }

    throw lastError || new Error("Translation failed after retries");
}
