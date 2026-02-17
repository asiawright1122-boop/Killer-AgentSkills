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
     * Validate that CJK locale fields are non-empty in a parsed JSON response.
     * Checks description and suitability for zh, ja, ko locales.
     */
    private validateCJKFields(parsed: any, provider: string): void {
        const fieldsToCheck = ['description', 'suitability'];
        const cjkLocales = ['zh', 'ja', 'ko'];
        for (const field of fieldsToCheck) {
            if (parsed[field] && typeof parsed[field] === 'object') {
                for (const locale of cjkLocales) {
                    if (parsed[field][locale] !== undefined && (!parsed[field][locale] || String(parsed[field][locale]).trim() === '')) {
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
        jsonMode: boolean = false
    ): Promise<string> {
        let url: string;
        let headers: Record<string, string>;
        let bodyObj: any;
        let isCloudflareFormat = false; // CF has different response format

        switch (provider) {
            case 'nvidia': {
                url = 'https://integrate.api.nvidia.com/v1/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                bodyObj = {
                    model: 'deepseek-ai/deepseek-v3.2',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 4096,
                    stream: false
                };
                if (jsonMode) bodyObj.response_format = { type: "json_object" };
                break;
            }
            case 'siliconflow': {
                url = 'https://api.siliconflow.cn/v1/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                bodyObj = {
                    model: 'deepseek-ai/DeepSeek-V3.2',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 4096,
                    stream: false
                };
                break;
            }
            case 'openrouter': {
                url = 'https://openrouter.ai/api/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://killerskills.com',
                    'X-Title': 'Killer-Skills Translation'
                };
                bodyObj = {
                    model: 'google/gemma-3-27b-it:free',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 4096
                };
                break;
            }
            case 'cloudflare': {
                url = `https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`;
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                bodyObj = {
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 4096
                };
                isCloudflareFormat = true;
                break;
            }
        }

        const res = await fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyObj)
        }, 120000);

        if (!res.ok) {
            throw new Error(`${provider} ${res.status}`);
        }

        const data = await res.json() as any;
        // Cloudflare Workers AI returns { result: { response: "..." } }
        // Others return { choices: [{ message: { content: "..." } }] }
        const content = isCloudflareFormat
            ? data?.result?.response
            : data?.choices?.[0]?.message?.content;
        if (!content) throw new Error(`${provider} empty response`);

        // CJK validation in jsonMode
        if (jsonMode) {
            const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            this.validateCJKFields(parsed, provider);
        }

        return content;
    }

    /**
     * Call AI with dedicated NVIDIA primary + sequential SF/OR fallback.
     * 
     * Architecture (Plan B):
     * - 4 NVIDIA keys each handle different tasks in parallel (16 concurrent slots)
     * - SiliconFlow is backup #1 (only called when NVIDIA fails)
     * - OpenRouter is backup #2 (only called when SF also fails)
     * - Cloudflare Workers AI is the last-resort fallback
     * 
     * @param nvidiaKeyIndex - Which NVIDIA key to use (0-3). Auto-rotates if not specified.
     */
    async callAI(prompt: string, jsonMode: boolean = false, skipNvidia: boolean = false, nvidiaKeyIndex?: number): Promise<string | null> {

        // 1️⃣ Primary: NVIDIA (dedicated key)
        if (!skipNvidia && this.config.nvidiaKeys.length > 0) {
            const idx = nvidiaKeyIndex ?? (this.currentNvidiaKeyIndex++ % this.config.nvidiaKeys.length);
            const key = this.config.nvidiaKeys[idx % this.config.nvidiaKeys.length];
            try {
                const result = await this.callAISingle(prompt, 'nvidia', key, jsonMode);
                this.stats.nvidia++;
                process.stdout.write(`N${idx % this.config.nvidiaKeys.length}`);
                return result;
            } catch (e) {
                this.stats.nvidiaFail++;
                console.warn(`⚠️ NVIDIA-${idx % this.config.nvidiaKeys.length}: ${(e as Error).message}`);
            }
        }

        // 2️⃣ Backup #1: SiliconFlow
        if (this.config.siliconFlowKey) {
            try {
                const result = await this.callAISingle(prompt, 'siliconflow', this.config.siliconFlowKey, jsonMode);
                this.stats.siliconflow++;
                process.stdout.write('S');
                return result;
            } catch (e) {
                console.warn(`⚠️ SiliconFlow: ${(e as Error).message}`);
            }
        }

        // 3️⃣ Backup #2: OpenRouter
        if (this.config.openRouterKeys.length > 0) {
            const orKey = this.config.openRouterKeys[this.currentOpenrouterKeyIndex % this.config.openRouterKeys.length];
            this.currentOpenrouterKeyIndex = (this.currentOpenrouterKeyIndex + 1) % this.config.openRouterKeys.length;
            try {
                const result = await this.callAISingle(prompt, 'openrouter', orKey, jsonMode);
                this.stats.openrouter++;
                process.stdout.write('O');
                return result;
            } catch (e) {
                console.warn(`⚠️ OpenRouter: ${(e as Error).message}`);
            }
        }

        // 4️⃣ Last resort: Cloudflare Workers AI
        if (this.config.cfAccountId && this.config.cfApiToken) {
            try {
                const result = await this.callAISingle(prompt, 'cloudflare', this.config.cfApiToken, jsonMode);
                this.stats.cloudflare++;
                process.stdout.write('C');
                return result;
            } catch (e) {
                console.warn(`⚠️ Cloudflare: ${(e as Error).message}`);
            }
        }

        return null;
    }

    /**
     * Translate and Generate Metadata with Full SEO Prompt
     * Uses robust JSON extraction with multiple fallback strategies
     */
    async translateMetadata(text: string, context?: TranslateContext, nvidiaKeyIndex?: number): Promise<{
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
        let response = await this.callAI(prompt, true, useCloudflare, nvidiaKeyIndex);

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
                response = await this.callAI(prompt, false, useCloudflare, nvidiaKeyIndex);
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
        bodyPreview: string,
        nvidiaKeyIndex?: number
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
            const result = await this.callAI(prompt, true, false, nvidiaKeyIndex);
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
        nvidiaKeyIndex: number | undefined,
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
            const result = await this.callAI(prompt, true, false, nvidiaKeyIndex);
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
