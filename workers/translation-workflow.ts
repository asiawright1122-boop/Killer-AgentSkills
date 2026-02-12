/**
 * Cloudflare Workflow: Translation Queue
 *
 * 后台执行 AI 翻译任务，支持：
 * - 多 NVIDIA API Key 轮询
 * - Workers AI 作为备用
 * - 自动重试 (3 次，指数退避)
 * - 状态持久化
 * - KV 缓存结果
 */

import {
    WorkflowEntrypoint,
    WorkflowStep,
    WorkflowEvent,
} from "cloudflare:workers";

// ===== Types =====

export interface TranslationParams {
    text: string;
    targetLang: string;
    type: "text" | "markdown";
    cacheKey: string;
}

export interface Env {
    TRANSLATIONS: KVNamespace;
    AI: Ai; // Workers AI binding
    // 多个 NVIDIA API Key (通过环境变量配置)
    NVIDIA_API_KEY?: string;
    NVIDIA_API_KEYS?: string; // 逗号分隔的多个 key
    NVIDIA_API_KEYS_2?: string;
    NVIDIA_API_KEYS_3?: string;
}

// Workers AI binding type
interface Ai {
    run(
        model: string,
        inputs: {
            messages: Array<{ role: string; content: string }>;
            max_tokens?: number;
        }
    ): Promise<{ response?: string }>;
}

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

// ===== Workflow Definition =====

export class TranslationWorkflow extends WorkflowEntrypoint<Env> {
    private nvidiaKeys: string[] = [];
    private currentKeyIndex = 0;

    async run(event: WorkflowEvent<TranslationParams>, step: WorkflowStep) {
        const { text, targetLang, type, cacheKey } = event.payload;

        // 初始化 API Keys
        this.initializeKeys();

        // Step 1: 检查缓存 (避免重复翻译)
        const cached = await step.do("check-cache", async () => {
            return await this.env.TRANSLATIONS.get(cacheKey);
        });

        if (cached) {
            return { success: true, cacheKey, cached: true, provider: "cache" };
        }

        // Step 2: 尝试使用 NVIDIA API (多 key 轮询)
        let translated: string | null = null;
        let provider = "unknown";

        if (this.nvidiaKeys.length > 0) {
            translated = await step.do(
                "translate-nvidia",
                {
                    retries: { limit: this.nvidiaKeys.length, delay: "5 second", backoff: "linear" },
                    timeout: "2 minutes",
                },
                async () => {
                    return await this.translateWithNvidia(text, targetLang, type);
                }
            );

            if (translated) {
                provider = "nvidia";
            }
        }

        // Step 3: 如果 NVIDIA 失败，使用 Workers AI 作为备用
        if (!translated) {
            translated = await step.do(
                "translate-workers-ai",
                {
                    retries: { limit: 2, delay: "3 second" },
                    timeout: "1 minute",
                },
                async () => {
                    return await this.translateWithWorkersAI(text, targetLang, type);
                }
            );
            provider = "workers-ai";
        }

        if (!translated) {
            throw new Error("All translation providers failed");
        }

        // Step 4: 保存到 KV
        await step.do("save-cache", async () => {
            await this.env.TRANSLATIONS.put(cacheKey, translated!, {
                expirationTtl: 60 * 60 * 24 * 30, // 30 days
            });
        });

        return { success: true, cacheKey, cached: false, provider };
    }

    /**
     * 初始化 NVIDIA API Keys (从多个环境变量读取)
     */
    private initializeKeys(): void {
        const rawKeys = [
            this.env.NVIDIA_API_KEYS,
            this.env.NVIDIA_API_KEY,
            this.env.NVIDIA_API_KEYS_2,
            this.env.NVIDIA_API_KEYS_3,
        ]
            .filter(Boolean)
            .join(",");

        this.nvidiaKeys = rawKeys
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);

        console.log(`[Workflow] Initialized ${this.nvidiaKeys.length} NVIDIA API keys`);
    }

    /**
     * 轮询获取下一个 NVIDIA API Key
     */
    private getNextKey(): string {
        if (this.nvidiaKeys.length === 0) {
            throw new Error("No NVIDIA API Keys configured");
        }
        const key = this.nvidiaKeys[this.currentKeyIndex];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.nvidiaKeys.length;
        return key;
    }

    /**
     * 使用 NVIDIA API 翻译 (支持 key 轮询)
     */
    private async translateWithNvidia(
        text: string,
        targetLang: string,
        type: "text" | "markdown"
    ): Promise<string> {
        const apiKey = this.getNextKey();
        console.log(`[NVIDIA] Using key ending in ...${apiKey.slice(-4)}`);

        const response = await fetch(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "meta/llama-3.1-70b-instruct",
                    messages: [
                        { role: "system", content: this.getPrompt(targetLang, type) },
                        { role: "user", content: text },
                    ] as ChatMessage[],
                    temperature: 0.2,
                    max_tokens: 2048,
                    top_p: 1,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NVIDIA API Error ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as {
            choices: Array<{ message: { content: string } }>;
        };
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error("Empty translation result from NVIDIA");
        }

        return content;
    }

    /**
     * 使用 Cloudflare Workers AI 翻译 (备用方案)
     */
    private async translateWithWorkersAI(
        text: string,
        targetLang: string,
        type: "text" | "markdown"
    ): Promise<string> {
        console.log("[Workers AI] Using as fallback");

        const result = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
                { role: "system", content: this.getPrompt(targetLang, type) },
                { role: "user", content: text },
            ],
            max_tokens: 2048,
        });

        if (!result.response) {
            throw new Error("Empty response from Workers AI");
        }

        return result.response;
    }

    /**
     * 生成翻译 prompt
     */
    private getPrompt(lang: string, type: "text" | "markdown"): string {
        const langName = this.getLangName(lang);

        if (type === "markdown") {
            return `You are a technical document translator. 
Translate the input Markdown content into ${langName}.

FORMATTING RULES (STRICT):
1. Keep ALL Markdown structure intact.
2. INSERT A BLANK LINE before every Header (#, ##, ###).
3. INSERT A BLANK LINE between paragraphs.
4. Do NOT collapse text into a single block. 
5. Do NOT translate inside code blocks (\`\`\`) or inline code (\`).
6. Maintain technical terms (e.g. "React", "Hook", "CI/CD") in English.

Output ONLY the translated Markdown.`;
        }

        return `You are a professional translator. Translate the following text into ${langName}. 
Maintain technical terms in their original language if appropriate. 
Output ONLY the translated text.`;
    }

    /**
     * 语言代码转名称
     */
    private getLangName(code: string): string {
        const langMap: Record<string, string> = {
            zh: "Chinese (Simplified)",
            "zh-TW": "Chinese (Traditional)",
            es: "Spanish",
            ja: "Japanese",
            ko: "Korean",
            fr: "French",
            de: "German",
            pt: "Portuguese",
            ru: "Russian",
            ar: "Arabic",
        };
        return langMap[code] || code;
    }
}

// ===== Default Export for Wrangler =====

export default {
    async fetch(): Promise<Response> {
        return new Response(
            "Translation Workflow - use wrangler workflows trigger to invoke",
            { status: 200 }
        );
    },
};
