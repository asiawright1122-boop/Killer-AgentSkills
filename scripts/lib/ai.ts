import 'dotenv/config';
import { SUPPORTED_LOCALES } from './constants';
import type { SeoData, AgentAnalysis, TranslateContext } from './types';
import { tryParseJSON, cleanAndTruncate } from './utils';

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

export class AIService {
    private config: AIConfig;
    public stats: AIStats = {
        nvidia: 0,
        siliconflow: 0,
        openrouter: 0,
        cloudflare: 0,
        nvidiaFail: 0
    };

    private currentNvidiaKeyIndex = 0;
    private currentOpenrouterKeyIndex = 0;

    constructor(config?: Partial<AIConfig>) {
        this.config = {
            nvidiaKeys: config?.nvidiaKeys || (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || "").split(',').map(k => k.trim()).filter(Boolean),
            siliconFlowKey: config?.siliconFlowKey || process.env.SILICONFLOW_API_KEY || '',
            openRouterKeys: config?.openRouterKeys || (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean),
            cfAccountId: config?.cfAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '',
            cfApiToken: config?.cfApiToken || process.env.CLOUDFLARE_API_TOKEN || ''
        };
    }

    /**
     * Call AI with race strategy (NVIDIA -> SiliconFlow -> OpenRouter -> Cloudflare fallback)
     */
    async callAI(prompt: string, jsonMode: boolean = false, skipNvidia: boolean = false): Promise<string | null> {
        const raceProviders: Promise<{ content: string; provider: string }>[] = [];

        // 1. NVIDIA
        if (!skipNvidia && this.config.nvidiaKeys.length > 0) {
            const apiKey = this.config.nvidiaKeys[this.currentNvidiaKeyIndex];
            this.currentNvidiaKeyIndex = (this.currentNvidiaKeyIndex + 1) % this.config.nvidiaKeys.length;

            const nvidiaPromise = (async () => {
                const body: any = {
                    model: 'meta/llama-3.3-70b-instruct',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 2500,
                    stream: false
                };
                if (jsonMode) body.response_format = { type: "json_object" };

                const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify(body)
                });

                if (!res.ok) {
                    this.stats.nvidiaFail++;
                    throw new Error(`NVIDIA ${res.status}`);
                }
                const data = await res.json() as any;
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('NVIDIA empty response');

                if (jsonMode) {
                    try {
                        const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
                        tryParseJSON(cleanContent); // Verify
                        return { content: cleanContent, provider: 'nvidia' };
                    } catch (e) { throw new Error('NVIDIA invalid JSON'); }
                }
                return { content, provider: 'nvidia' };
            })();
            raceProviders.push(nvidiaPromise);
        }

        // 2. SiliconFlow
        if (this.config.siliconFlowKey) {
            const sfPromise = (async () => {
                const body: any = {
                    model: 'Qwen/Qwen2.5-7B-Instruct',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 2048,
                    stream: false
                };
                if (jsonMode) body.response_format = { type: "json_object" };

                const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.siliconFlowKey}` },
                    body: JSON.stringify(body)
                });

                if (!res.ok) throw new Error(`SiliconFlow ${res.status}`);
                const data = await res.json() as any;
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('SiliconFlow empty');

                if (jsonMode) {
                    try {
                        const clean = content.replace(/```json\s*|\s*```/g, '').trim();
                        tryParseJSON(clean);
                        return { content: clean, provider: 'siliconflow' };
                    } catch { throw new Error('SiliconFlow invalid JSON'); }
                }
                return { content, provider: 'siliconflow' };
            })();
            raceProviders.push(sfPromise);
        }

        // 3. OpenRouter
        if (this.config.openRouterKeys.length > 0) {
            const orKey = this.config.openRouterKeys[this.currentOpenrouterKeyIndex];
            this.currentOpenrouterKeyIndex = (this.currentOpenrouterKeyIndex + 1) % this.config.openRouterKeys.length;

            const orPromise = (async () => {
                const body: any = {
                    model: 'qwen/qwen-2.5-72b-instruct',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 2500
                };
                if (jsonMode) body.response_format = { type: "json_object" };

                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orKey}` },
                    body: JSON.stringify(body)
                });

                if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
                const data = await res.json() as any;
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('OpenRouter empty');

                if (jsonMode) {
                    try {
                        const clean = content.replace(/```json\s*|\s*```/g, '').trim();
                        tryParseJSON(clean);
                        return { content: clean, provider: 'openrouter' };
                    } catch { throw new Error('OpenRouter invalid JSON'); }
                }
                return { content, provider: 'openrouter' };
            })();
            raceProviders.push(orPromise);
        }

        // Execute Race
        if (raceProviders.length > 0) {
            try {
                const winner = await Promise.any(raceProviders);
                if (winner.provider === 'nvidia') this.stats.nvidia++;
                if (winner.provider === 'siliconflow') this.stats.siliconflow++;
                if (winner.provider === 'openrouter') this.stats.openrouter++;
                return winner.content;
            } catch (e) {
                // Ignore
            }
        }

        // Final Fallback: Cloudflare Workers AI
        if (this.config.cfAccountId && this.config.cfApiToken) {
            try {
                const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.cfApiToken}` },
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 1500
                    })
                });

                if (res.ok) {
                    const data = await res.json() as any;
                    const content = data?.result?.response;
                    if (content) {
                        this.stats.cloudflare++;
                        if (jsonMode) {
                            try { return content.replace(/```json\s*|\s*```/g, '').trim(); }
                            catch { return null; }
                        }
                        return content;
                    }
                }
            } catch { /* ignore */ }
        }
        return null;
    }

    /**
     * Translate and Generate Metadata with Full SEO Prompt
     */
    async translateMetadata(text: string, context?: TranslateContext): Promise<{
        description: Record<string, string>;
        seo: SeoData;
    }> {
        const skillName = context?.name || '';
        const defaultResult = {
            description: { en: text },
            seo: {
                title: { en: skillName || 'AI Skill' },
                definition: { en: text.slice(0, 200) },
                features: { en: [] },
                keywords: { en: [] }
            }
        };

        const hasNvidia = this.config.nvidiaKeys.length > 0;
        const hasCloudflare = this.config.cfAccountId && this.config.cfApiToken;

        if (!hasNvidia && !hasCloudflare) return defaultResult;

        console.log(`[AIService] Translating ${skillName}...`);
        const topics = context?.topics?.join(', ') || '';
        const bodyPreview = context?.bodyPreview?.slice(0, 1500) || '';

        const prompt = `You are a Senior Technical SEO Specialist & UX Copywriter.
Your task is to analyze this AI Agent Skill and generate premium, personalized SEO content.

## Input Data
- **Skill Name**: "${skillName}"
- **Original Description**: "${text.replace(/"/g, '\\"')}"
- **Tags**: ${topics}
- **Content Preview**: "${bodyPreview.replace(/"/g, '\\"').replace(/\n/g, ' ').slice(0, 1000)}..."

## 1. ANALYSIS GUIDELINES (CRITICAL)
- **NO GENERIC FLUFF**: Do not use "This skill allows you to...", "A powerful tool for...". Be direct.
- **Identify Specifics**: Look for supported versions (e.g. "React 19"), specific APIs (e.g. "Notion API"), or concrete actions (e.g. "Converts PDF to Markdown").
- **Tone**: Professional, authoritative, yet accessible. "Stripe-documentation" quality.
- **TRANSLATION REQUIREMENT**: You MUST provide translations for ALL requested locales. Do NOT return empty strings. If unsure, provide a best-effort translation.

## 2. GENERATION TASKS (For Locales: ${SUPPORTED_LOCALES.join(', ')})

### A. SEO Title (50-60 chars) - NEW!
- **Goal**: High CTR and Keyword Relevance.
- **Format**: [Product Name]: [Main Benefit/Feature] (Agent Ready)
- **Example**: "Stripe Agent: Secure Payment Processing for AI (Agent Ready)"

### B. Meta Description (Strictly 140-160 chars)
- **Goal**: High CTR in Search Results.
- **Format**: [Action Verb] [Key Value Proposition]. Includes [Specific Feature 1] and [Specific Feature 2].
- **Constraint**: Must be between 140 and 160 characters. Pad with value if too short, trim if too long.
- **Example**: "Generate production-ready React components with Tailwind support. Features automated prop validation, responsive layouts, and Shadcn UI integration."

### C. Featured Snippet / Definition (40-60 words)
- **Goal**: Win Google's "Position Zero" (What is [Skill]?).
- **Format**: A clear, encyclopedic definition.
- **Structure**: "[Skill Name] is an [Category] capability for [Target User] that [Core Function]. It specifically handles [Unique Selling Point]..."

### D. Key Features (3-4 items)
- **Goal**: Show "Why use this?" in a glance.
- **Format**: Short, punchy bullet points (max 6 words each).
- **Example**: ["Zero-config setup", "Type-safe schema validation", "Multi-modal support"]

### E. Keywords (5-8 items)
- **Goal**: Long-tail SEO targeting.
- **Format**: Specific terms (e.g. "Next.js 14 agent", "PDF parsing ai")

## Output Format (STRICT JSON)
- **IMPORTANT**: Your response must be a valid JSON object. Do not include any conversational text, markdown formatting, or code blocks.
- **Ensure all quotes within strings are properly escaped (e.g. \\" instead of ").**
- **Do not use trailing commas.** 

{
  "seoTitle": { "en": "...", "zh": "...", ... },
  "description": { "en": "...", "zh": "...", ... },
  "definition": { "en": "...", "zh": "...", ... },
  "features": { "en": ["...", "..."], "zh": ["...", "..."], ... },
  "keywords": { "en": ["..."], "zh": ["..."], ... }
}`;

        let useCloudflare = false;
        let response = await this.callAI(prompt, true, useCloudflare);

        // Validation loop
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!response) break;

            // Extract JSON candidates
            const candidates: string[] = [];

            // 1. Explicit ```json blocks
            const jsonBlockMatches = [...response.matchAll(/```json\s*([\s\S]*?)```/g)];
            jsonBlockMatches.forEach(m => candidates.push(m[1]));

            // 2. Any code block starting with {
            const anyCodeBlocks = [...response.matchAll(/```(?:\w+)?\s*([\s\S]*?)```/g)];
            anyCodeBlocks.forEach(m => {
                const content = m[1].trim();
                if (content.startsWith('{') && !candidates.includes(content)) candidates.push(content);
            });

            // 3. Raw text fallback
            if (response.trim().startsWith('{') && !candidates.includes(response.trim())) {
                candidates.push(response.trim());
            }

            // Validate
            for (const item of candidates) {
                const parsed = tryParseJSON(item);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.description || parsed.seo || parsed.definition || parsed.features) {
                        // Deep merge/validation
                        const seoTitleMap = parsed.seoTitle || parsed.title || { en: skillName };
                        const descMap = parsed.description || { en: text };

                        let safeDesc = (typeof descMap === 'string') ? { en: descMap } : descMap;
                        let safeTitle = (typeof seoTitleMap === 'string') ? { en: seoTitleMap } : seoTitleMap;

                        return {
                            description: cleanAndTruncate(safeDesc as Record<string, string>, 160),
                            seo: {
                                title: cleanAndTruncate(safeTitle as Record<string, string>, 60),
                                definition: parsed.definition || (parsed.seo?.definition) || { en: text },
                                features: parsed.features || (parsed.seo?.features) || { en: [] },
                                keywords: parsed.keywords || (parsed.seo?.keywords) || { en: [] }
                            }
                        };
                    }
                }
            }

            // Retry with CF if failed and not used yet
            if (!useCloudflare && hasCloudflare) {
                console.log('🔄 Retry with Cloudflare...');
                useCloudflare = true;
                response = await this.callAI(prompt, false, useCloudflare);
            } else {
                break;
            }
        }

        return defaultResult;
    }

    async generateAgentAnalysis(skillName: string, description: string, bodyPreview: string): Promise<AgentAnalysis | undefined> {
        const prompt = `You are an AI Agent Ecosystem Expert. Analyze this skill for compatibility with modern AI Agents (e.g., Cursor, Windsurf, Claude Code, AutoGPT, LangChain).

Skill: ${skillName}
Description: ${description}
Content Preview:
${bodyPreview.slice(0, 1500)}

Analyze this skill and provide structured data optimized for SEO and Agent Developers:

1. Suitability: A click-worthy one-sentence hook describing the *ideal* agent persona (e.g., "Perfect for Autonomous Python Coding Agents").
2. Recommendation: A persuasive paragraph (2-3 sentences) on *why* to install this. Explicitly mention what "Superpower" it gives the agent.
3. Use Cases: 3-5 specific, action-oriented scenarios. Use strong verbs and keywords (e.g., "Automating", "Scraping", "Debugging").
4. Limitations: Any security warnings, API key requirements, or platform constraints (e.g., "No Sandbox", "Requires API Key").

Return JSON ONLY:
{
  "suitability": "Essential for Python coding agents needing direct file system manipulation.",
  "recommendation": "This skill grants your agent the ability to read, write, and patch files directly. It is a critical dependency for any autonomous coding workflow in Cursor or Windsurf.",
  "useCases": ["Refactoring legacy implementations", "Automating test generation", "Scraping local log files"],
  "limitations": ["Requires local filesystem permissions", "Not safe for untrusted sandboxes"]
}`;

        try {
            const result = await this.callAI(prompt, true);
            if (result) {
                const jsonMatch = result.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        suitability: parsed.suitability || "Suitable for general AI agents.",
                        recommendation: parsed.recommendation || "",
                        useCases: Array.isArray(parsed.useCases) ? parsed.useCases : [],
                        limitations: Array.isArray(parsed.limitations) ? parsed.limitations : []
                    };
                }
            }
        } catch (e) {
            console.error(`Failed to generate agent analysis for ${skillName}`, e);
        }
        return undefined;
    }
}
