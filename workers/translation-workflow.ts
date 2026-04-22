/**
 * Cloudflare Workflow: Translation Queue
 *
 * 后台执行 AI 翻译任务，支持：
 * - NVIDIA 多 key + 健康度排序
 * - SiliconFlow / OpenRouter guarded fallback
 * - 自动重试
 * - KV 缓存结果
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { WorkerAiRuntime, type WorkerAiRuntimeEnv } from './lib/ai-runtime';

export interface TranslationParams {
  text: string;
  targetLang: string;
  type: 'text' | 'markdown';
  cacheKey: string;
}

export interface Env extends WorkerAiRuntimeEnv {
  TRANSLATIONS: KVNamespace;
}

export class TranslationWorkflow extends WorkflowEntrypoint<Env> {
  private aiRuntime: WorkerAiRuntime<Env> | null = null;

  async run(event: WorkflowEvent<TranslationParams>, step: WorkflowStep) {
    const { text, targetLang, type, cacheKey } = event.payload;

    const cached = await step.do('check-cache', async () => {
      return await this.env.TRANSLATIONS.get(cacheKey);
    });

    if (cached) {
      return { success: true, cacheKey, cached: true, provider: 'cache' };
    }

    let provider = 'unknown';
    const translated = await step.do(
      'translate-ai',
      {
        retries: { limit: 2, delay: '5 second', backoff: 'exponential' },
        timeout: '2 minutes',
      },
      async () => {
        const result = await this.getAiRuntime().callText(this.env, {
          systemPrompt: this.getPrompt(targetLang, type),
          userPrompt: text,
          maxTokens: 2048,
          temperature: 0.2,
          topP: 1,
        });
        provider = result.provider;
        return result.text;
      },
    );

    if (!translated) {
      throw new Error('All translation providers failed');
    }

    await step.do('save-cache', async () => {
      await this.env.TRANSLATIONS.put(cacheKey, translated, {
        expirationTtl: 60 * 60 * 24 * 30,
      });
    });

    return { success: true, cacheKey, cached: false, provider };
  }

  private getAiRuntime(): WorkerAiRuntime<Env> {
    if (!this.aiRuntime) {
      this.aiRuntime = new WorkerAiRuntime({
        workloadProfile: 'balanced',
        defaultOpenRouterTitle: 'Killer-Skills Translation Workflow',
      });
    }

    return this.aiRuntime;
  }

  private getPrompt(lang: string, type: 'text' | 'markdown'): string {
    const langName = this.getLangName(lang);

    if (type === 'markdown') {
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

  private getLangName(code: string): string {
    const langMap: Record<string, string> = {
      zh: 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      es: 'Spanish',
      ja: 'Japanese',
      ko: 'Korean',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      ru: 'Russian',
      ar: 'Arabic',
    };
    return langMap[code] || code;
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response('Translation Workflow - use wrangler workflows trigger to invoke', { status: 200 });
  },
};
