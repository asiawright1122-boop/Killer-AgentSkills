/**
 * Unified AI Service
 * 
 * Consolidates all AI provider interactions used across:
 * - build-skills-cache.ts (translation, analysis, agent analysis)
 * - translate-blog.ts (blog translation)
 * - build-docs-cache.ts (docs translation)
 * - translate-locales.ts (UI translation)
 */

import 'dotenv/config';
import { SUPPORTED_LOCALES } from './constants';
import type { SeoData, AgentAnalysis, TranslateContext } from './types';
import { tryParseJSON, robustParseJSON, extractJSONCandidates, cleanAndTruncate, fetchWithTimeout } from './utils';

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
     * Call AI with race strategy (NVIDIA + SiliconFlow + OpenRouter parallel -> Cloudflare fallback)
     * 
     * Enhanced features vs legacy:
     * - Uses fetchWithTimeout (60s) on all providers to prevent hanging
     * - CJK validation in jsonMode: reject responses with empty zh fields
     * - All OpenRouter keys race in parallel (not just one)
     * - Progress indicators via stdout (N/S/O/C)
     */
    async callAI(prompt: string, jsonMode: boolean = false, skipNvidia: boolean = false): Promise<string | null> {
        const raceProviders: Promise<{ content: string; provider: string }>[] = [];

        // --- Provider 1: NVIDIA ---
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

                const res = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify(body)
                }, 60000);

                if (!res.ok) {
                    this.stats.nvidiaFail++;
                    throw new Error(`NVIDIA ${res.status}`);
                }
                const data = await res.json() as any;
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('NVIDIA empty response');

                // CJK validation in jsonMode
                if (jsonMode) {
                    try {
                        const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
                        const parsed = JSON.parse(cleanContent);
                        if (parsed.description && typeof parsed.description === 'object') {
                            if (!parsed.description.zh || parsed.description.zh.trim() === '') {
                                throw new Error('NVIDIA returned empty CJK description');
                            }
                        }
                    } catch (e) {
                        throw new Error(`NVIDIA invalid JSON or empty CJK: ${e}`);
                    }
                }

                return { content, provider: 'N' };
            })();
            raceProviders.push(nvidiaPromise);
        }

        // --- Provider 2: SiliconFlow ---
        if (this.config.siliconFlowKey) {
            const sfPromise = (async () => {
                const res = await fetchWithTimeout('https://api.siliconflow.cn/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.siliconFlowKey}` },
                    body: JSON.stringify({
                        model: 'Qwen/Qwen2.5-7B-Instruct',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.3,
                        max_tokens: 2500,
                        stream: false
                    })
                }, 60000);

                if (!res.ok) throw new Error(`SiliconFlow ${res.status}`);
                const data = await res.json() as any;
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('SiliconFlow empty response');

                if (jsonMode) {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed.description && typeof parsed.description === 'object') {
                            if (!parsed.description.zh || parsed.description.zh.trim() === '') {
                                throw new Error('SiliconFlow returned empty CJK description');
                            }
                        }
                    } catch (e) {
                        throw new Error(`SiliconFlow invalid JSON or empty CJK: ${e}`);
                    }
                }

                return { content, provider: 'S' };
            })();
            raceProviders.push(sfPromise);
        }

        // --- Provider 3: OpenRouter (each key races in parallel) ---
        for (let i = 0; i < this.config.openRouterKeys.length; i++) {
            const orKey = this.config.openRouterKeys[(this.currentOpenrouterKeyIndex + i) % this.config.openRouterKeys.length];
            const orPromise = (async () => {
                const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${orKey}`,
                        'HTTP-Referer': 'https://killerskills.com',
                        'X-Title': 'Killer-Skills Translation'
                    },
                    body: JSON.stringify({
                        model: 'qwen/qwen3-30b-a3b-instruct-2507:free',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.3,
                        max_tokens: 2500
                    })
                }, 60000);

                if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
                const data = await res.json() as any;
                const content = data?.choices?.[0]?.message?.content;
                if (!content) throw new Error('OpenRouter empty response');

                if (jsonMode) {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed.description && typeof parsed.description === 'object') {
                            if (!parsed.description.zh || parsed.description.zh.trim() === '') {
                                throw new Error('OpenRouter returned empty CJK description');
                            }
                        }
                    } catch (e) {
                        throw new Error(`OpenRouter invalid JSON or empty CJK: ${e}`);
                    }
                }
                return { content, provider: 'O' };
            })();
            raceProviders.push(orPromise);
        }
        this.currentOpenrouterKeyIndex = (this.currentOpenrouterKeyIndex + 1) % Math.max(this.config.openRouterKeys.length, 1);

        // --- Race all providers ---
        if (raceProviders.length > 0) {
            try {
                const winner = await Promise.any(raceProviders);
                if (winner.provider === 'N') this.stats.nvidia++;
                else if (winner.provider === 'S') this.stats.siliconflow++;
                else if (winner.provider === 'O') this.stats.openrouter++;
                process.stdout.write(winner.provider);
                return winner.content;
            } catch (e) {
                // All providers failed, fall through to Cloudflare
                const reasons = (e as any)?.errors?.map((err: Error) => err.message).join(', ') || String(e);
                console.warn(`⚠️ All AI providers failed: ${reasons}`);
            }
        }

        // --- Final Fallback: Cloudflare Workers AI ---
        if (this.config.cfAccountId && this.config.cfApiToken) {
            try {
                const res = await fetchWithTimeout(
                    `https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.cfApiToken}` },
                        body: JSON.stringify({
                            messages: [{ role: 'user', content: prompt }],
                            max_tokens: 1500
                        })
                    },
                    60000
                );

                if (res.ok) {
                    const data = await res.json() as any;
                    this.stats.cloudflare++;
                    process.stdout.write('C');
                    return data?.result?.response || null;
                }
            } catch (e) {
                // All failed
            }
        }

        return null;
    }

    /**
     * Translate and Generate Metadata with Full SEO Prompt
     * Uses robust JSON extraction with multiple fallback strategies
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
                description: { en: text.slice(0, 160) },
                definition: { en: text.slice(0, 200) },
                features: { en: [] as string[] },
                keywords: { en: [] as string[] }
            }
        };

        const hasNvidia = this.config.nvidiaKeys.length > 0;
        const hasCloudflare = this.config.cfAccountId && this.config.cfApiToken;

        if (!hasNvidia && !hasCloudflare) return defaultResult;

        console.log(`[AIService] Translating ${skillName}...`);
        const topics = context?.topics?.join(', ') || '';
        const bodyPreview = context?.bodyPreview?.slice(0, 1500) || '';

        const prompt = `You are a Senior Technical SEO Specialist & Developer Advocate.
Your task is to analyze this AI Agent Skill and generate premium, personalized SEO content for a developer audience.

## Input Data
- **Skill Name**: "${skillName}"
- **Original Description**: "${text.replace(/"/g, '\\"')}"
- **Tags**: ${topics}
- **Content Preview**: "${bodyPreview.replace(/"/g, '\\"').replace(/\n/g, ' ').slice(0, 1000)}..."

## 1. QUALITY GUIDELINES (CRITICAL)
- **NO GENERIC FLUFF**: Do not use "This skill allows you to...", "A powerful tool for...". Start directly with the value or definition.
- **Be Specific**: If it's a Python library, mention Python. If it uses an API, mention the API.
- **Tone**: Professional, authoritative, yet accessible (like Stripe or Vercel docs).
- **TRANSLATION**: Provide complete, native-quality translations for all requested locales.

## 2. GENERATION TASKS (For Locales: ${SUPPORTED_LOCALES.join(', ')})

### A. SEO Title (50-60 chars)
- **Goal**: unique, clickable title with main keyword.
- **Format**: [Product Name]: [Main Benefit] (Agent Ready)

### B. Meta Description (150-160 chars) — SEPARATE from the main description!
- **Goal**: High CTR summary optimized for search engine result pages.
- **Format**: [Action Verb] [Object] with [Specific Feature]. Includes [Benefit].
- **CRITICAL**: This must be different from the main description. Focus on click-through rate.

### C. Main Description (1-2 sentences)
- **Goal**: A clear, informative summary of the skill.
- **Constraint**: 50-80 words. Technical and specific.

### D. Introduction / Definition (The "What is it?")
- **Goal**: A clear, encyclopedic definition for the "Featured Snippet".
- **Format**: "${skillName} is a [Category] library for [Language/Platform] that enables [Core Capability]..."
- **Constraint**: 40-60 words. No marketing fluff.

### E. Key Features (4-6 items) — MUST NOT BE EMPTY
- **Goal**: Technical highlights derived from the Content Preview.
- **Format**: short, feature-focused bullet points (e.g. "Zero-dependency", "Async Support", "TypeScript native")
- **CRITICAL**: Extract real features from the content. If you cannot find specific features, infer from the description and tags.

### F. Keywords (6-10 items) — MUST NOT BE EMPTY
- **Goal**: Long-tail search terms that developers would actually search for.
- **Examples**: "claude code pdf skill", "ai agent excel automation", "mcp server python"
- **CRITICAL**: Include the skill name, technology stack, and use-case keywords.

## Output Format (STRICT JSON)
{
  "seoTitle": { "en": "...", "zh": "...", ... },
  "metaDescription": { "en": "...", "zh": "...", ... },
  "description": { "en": "...", "zh": "...", ... },
  "definition": { "en": "...", "zh": "...", ... },
  "features": { "en": ["...", "...", "...", "..."], "zh": ["..."], ... },
  "keywords": { "en": ["...", "...", "..."], "zh": ["..."], ... }
}`;

        let useCloudflare = false;
        let response = await this.callAI(prompt, true, useCloudflare);

        // Validation loop
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!response) break;

            // Extract JSON candidates using shared utility
            const candidates = extractJSONCandidates(response);

            // Validate candidates
            for (const item of candidates) {
                const parsed = robustParseJSON(item);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.description || parsed.seo || parsed.definition || parsed.features) {
                        // Deep merge/validation
                        const seoTitleMap = parsed.seoTitle || parsed.title || { en: skillName };
                        const descMap = parsed.description || { en: text };
                        const metaDescMap = parsed.metaDescription || parsed.meta_description || descMap;

                        const safeDesc = (typeof descMap === 'string') ? { en: descMap } : descMap;
                        const safeTitle = (typeof seoTitleMap === 'string') ? { en: seoTitleMap } : seoTitleMap;
                        const safeMetaDesc = (typeof metaDescMap === 'string') ? { en: metaDescMap } : metaDescMap;

                        // Validate features and keywords are non-empty
                        const featuresMap = parsed.features || parsed.seo?.features || { en: [] };
                        const keywordsMap = parsed.keywords || parsed.seo?.keywords || { en: [] };

                        // Reject candidates with empty features/keywords — try next candidate
                        if (Array.isArray(featuresMap.en) && featuresMap.en.length === 0) {
                            console.warn(`⚠️ Empty features for ${skillName}, trying next candidate...`);
                            continue;
                        }
                        if (Array.isArray(keywordsMap.en) && keywordsMap.en.length === 0) {
                            console.warn(`⚠️ Empty keywords for ${skillName}, trying next candidate...`);
                            continue;
                        }

                        return {
                            description: cleanAndTruncate(safeDesc as Record<string, string>, 300),
                            seo: {
                                title: cleanAndTruncate(safeTitle as Record<string, string>, 60),
                                description: cleanAndTruncate(safeMetaDesc as Record<string, string>, 160),
                                definition: parsed.definition || parsed.seo?.definition || { en: text },
                                features: featuresMap,
                                keywords: keywordsMap
                            }
                        };
                    }
                }
            }

            console.warn(`⚠️ Failed to extract valid JSON (or found empty translations)`);

            // Retry with Cloudflare if failed and not used yet
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

    /**
     * Generate Agent Analysis (Suitability, Recommendation, Use Cases)
     */
    async generateAgentAnalysis(
        skillName: string,
        description: string,
        bodyPreview: string
    ): Promise<{ suitability: string; recommendation: string; useCases: string[]; limitations: string[]; version?: number } | undefined> {
        const prompt = `You are an AI Agent Ecosystem Expert. Analyze this skill for compatibility with modern AI Agents (e.g., Cursor, Windsurf, Claude Code, AutoGPT, LangChain).
        
Skill: ${skillName}
Description: ${description}
Content Preview:
${bodyPreview.slice(0, 1500)}

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
            const result = await this.callAI(prompt, true, false);
            if (result) {
                const candidates = extractJSONCandidates(result);
                for (const candidate of candidates) {
                    const parsed = robustParseJSON(candidate);
                    if (parsed && typeof parsed === 'object') {
                        return {
                            suitability: parsed.suitability || "Suitable for general AI agents.",
                            recommendation: parsed.recommendation || "",
                            useCases: Array.isArray(parsed.useCases) ? parsed.useCases : [],
                            limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
                            version: 3 // v3: quality audit fixes (features, keywords, array translations)
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
     * Includes validation to reject suspiciously short translations
     */
    async translateAgentAnalysis(
        raw: { suitability: string; recommendation: string; useCases: string[]; limitations: string[]; version?: number }
    ): Promise<AgentAnalysis> {
        const localesStr = SUPPORTED_LOCALES.join(', ');
        const prompt = `You are a professional translator for technical documentation.
Translate the following AI Agent Skill analysis fields from English to these languages: ${localesStr}.

IMPORTANT GUIDELINES:
1.  **Completeness**: Translations MUST be complete sentences if the source is a sentence. 
    - BAD: "Python"
    - GOOD: "非常适合需要直接文件系统操作的 Python 编码 Agent。" (translated)
    - **CRITICAL**: Do NOT summarize into single keywords. If you return a single word for a long sentence, it will be rejected.
2.  **Accuracy**: Preserve technical terms (Python, p5.js, API, etc.) but ensure the surrounding text is grammatically correct in the target language.
3.  **Array Fields (useCases, limitations)**: You MUST translate EVERY item in the array.
    - **CRITICAL**: Empty arrays [] for non-English locales will be REJECTED. Each locale MUST have the same number of items as the English source.
    - Example: if English has 3 useCases, Chinese must also have 3 useCases.
4.  **Fallback**: If a translation is impossible or uncertain, return an empty string "" instead of a bad guess. But NEVER return an empty array [] if the source has items.

Input (English):
{
  "suitability": "${raw.suitability.replace(/"/g, '\\"')}",
  "recommendation": "${raw.recommendation.replace(/"/g, '\\"')}",
  "useCases": ${JSON.stringify(raw.useCases)},
  "limitations": ${JSON.stringify(raw.limitations)}
}

Return JSON ONLY with this structure (include "en" key with original English text).
EVERY locale MUST have ALL array items translated:
{
  "suitability": { "en": "...", "zh": "...", "ja": "...", ... },
  "recommendation": { "en": "...", "zh": "...", "ja": "...", ... },
  "useCases": { "en": ["item1", "item2", "item3"], "zh": ["翻译1", "翻译2", "翻译3"], "ja": ["翻訳1", "翻訳2", "翻訳3"], ... },
  "limitations": { "en": ["item1", "item2"], "zh": ["翻译1", "翻译2"], "ja": ["翻訳1", "翻訳2"], ... }
}`;

        try {
            const result = await this.callAI(prompt, true, false);
            if (result) {
                const candidates = extractJSONCandidates(result);
                for (const candidate of candidates) {
                    const parsed = robustParseJSON(candidate);
                    if (parsed && typeof parsed === 'object') {
                        // Validate structure
                        if (parsed.suitability && typeof parsed.suitability === 'object') {

                            // Helper: validate string fields, reject suspiciously short translations
                            const validateField = (source: string, targetWrapper: Record<string, string>) => {
                                const verified: Record<string, string> = { en: source };
                                for (const lang of SUPPORTED_LOCALES) {
                                    const val = targetWrapper[lang];
                                    const isSuspiciousLength = source.length > 20 && val && val.length < 10;

                                    if (isSuspiciousLength) {
                                        console.warn(`[WARN] Discarding suspicious translation for ${lang}: "${val}" (Source length: ${source.length})`);
                                        verified[lang] = "";
                                    } else {
                                        verified[lang] = val || "";
                                    }
                                }
                                return verified;
                            };

                            // Helper: validate array fields
                            // NOTE: We preserve all items to maintain count consistency with source.
                            // Only warn about suspicious items, don't filter them out.
                            const validateArrayField = (source: string[], targetWrapper: Record<string, string[]>) => {
                                const verified: Record<string, string[]> = { en: source };
                                for (const lang of SUPPORTED_LOCALES) {
                                    const val = targetWrapper[lang];
                                    if (Array.isArray(val) && val.length > 0) {
                                        verified[lang] = val;
                                    } else {
                                        // Fallback: use English if translation is empty
                                        verified[lang] = source;
                                    }
                                }
                                return verified;
                            };

                            return {
                                suitability: validateField(raw.suitability, parsed.suitability),
                                recommendation: validateField(raw.recommendation, parsed.recommendation || {}),
                                useCases: validateArrayField(raw.useCases, parsed.useCases || {}),
                                limitations: validateArrayField(raw.limitations, parsed.limitations || {}),
                                version: raw.version || 1
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to translate agent analysis:`, e);
        }

        // Fallback: return English-only Record structure
        return {
            suitability: { en: raw.suitability },
            recommendation: { en: raw.recommendation },
            useCases: { en: raw.useCases },
            limitations: { en: raw.limitations },
            version: raw.version || 1
        };
    }
}
