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
        jsonMode: boolean = false,
        externalSignal?: AbortSignal
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
                    model: 'deepseek-ai/deepseek-v3.1',
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
                    model: 'deepseek-ai/DeepSeek-V3',
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
                signal: combinedSignal
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!res.ok) {
            throw new Error(`${provider} ${res.status}`);
        }

        const data = await res.json() as any;
        // Cloudflare Workers AI returns { result: { response: "..." } }
        // Others return { choices: [{ message: { content: "..." } }] }
        const rawContent = isCloudflareFormat
            ? data?.result?.response
            : data?.choices?.[0]?.message?.content;
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
                throw new Error(`${provider} returned invalid JSON: ${e}`); // Propagate error for retry
            }
        }

        return content;
    }

    /**
     * Call AI with RACE mode: all providers called simultaneously.
     * First successful response wins. Maximum speed.
     * 
     * Architecture: Promise.any() across all available providers.
     * - All NVIDIA keys + SiliconFlow + OpenRouter + Cloudflare fire at once
     * - First valid response is returned immediately
     * - Losers are discarded (AbortController cancels them)
     */
    async callAI(prompt: string, jsonMode: boolean = false): Promise<string | null> {
        const controllers: AbortController[] = [];
        const promises: Promise<{ result: string; provider: string }>[] = [];

        // Helper: wrap callAISingle with abort support
        const raceEntry = (provider: 'nvidia' | 'siliconflow' | 'openrouter' | 'cloudflare', key: string, label: string) => {
            const controller = new AbortController();
            controllers.push(controller);
            promises.push(
                this.callAISingle(prompt, provider, key, jsonMode, controller.signal)
                    .then(result => ({ result, provider: label }))
            );
        };

        // Add all available providers
        for (let i = 0; i < this.config.nvidiaKeys.length; i++) {
            raceEntry('nvidia', this.config.nvidiaKeys[i], `N${i}`);
        }
        if (this.config.siliconFlowKey) {
            raceEntry('siliconflow', this.config.siliconFlowKey, 'S');
        }
        if (this.config.openRouterKeys.length > 0) {
            const orKey = this.config.openRouterKeys[this.currentOpenrouterKeyIndex % this.config.openRouterKeys.length];
            this.currentOpenrouterKeyIndex++;
            raceEntry('openrouter', orKey, 'O');
        }
        if (this.config.cfAccountId && this.config.cfApiToken) {
            raceEntry('cloudflare', this.config.cfApiToken, 'C');
        }

        if (promises.length === 0) return null;

        try {
            const winner = await Promise.any(promises);
            // Cancel all other in-flight requests
            controllers.forEach(c => c.abort());
            // Track stats
            if (winner.provider.startsWith('N')) this.stats.nvidia++;
            else if (winner.provider === 'S') this.stats.siliconflow++;
            else if (winner.provider === 'O') this.stats.openrouter++;
            else if (winner.provider === 'C') this.stats.cloudflare++;
            process.stdout.write(winner.provider);
            return winner.result;
        } catch (e) {
            // All providers failed
            controllers.forEach(c => c.abort());
            return null;
        }
    }

    /**
     * Pre-summarize massive READMEs (Map-Reduce step)
     * Reads up to 40,000 characters of raw input and condenses it into an 800-word technical summary.
     */
    async generateLongContextSummary(skillName: string, rawText: string): Promise<string> {
        if (!this.config.nvidiaKeys.length) return rawText.slice(0, 3000); // Fallback if NVIDIA not configured

        console.log(`[AIService] 🧠 Long Context Detected for ${skillName} (${rawText.length} chars). Running Map-Reduce Summary...`);
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
        const hasSiliconFlow = !!this.config.siliconFlowKey;
        const hasCloudflare = this.config.cfAccountId && this.config.cfApiToken;

        if (!hasNvidia && !hasSiliconFlow && !hasCloudflare) return defaultResult;

        console.log(`[AIService] Translating ${skillName}...`);

        let processedText = text;
        const topics = context?.topics?.join(', ') || '';
        const bodyPreview = context?.bodyPreview || '';

        // Map-Reduce for extremely long texts
        if (text.length > 3000 || bodyPreview.length > 3000) {
            const fullRawText = text + "\n---\n" + bodyPreview;
            processedText = await this.generateLongContextSummary(skillName, fullRawText);
        } else {
            processedText = text.slice(0, 3000);
        }

        // Split locales into batches of 3-4 to avoid output token timeout
        const localeBatches: string[][] = [];
        const BATCH_SIZE = 3;
        for (let i = 0; i < SUPPORTED_LOCALES.length; i += BATCH_SIZE) {
            localeBatches.push(SUPPORTED_LOCALES.slice(i, i + BATCH_SIZE));
        }

        // Merged result accumulators
        const mergedDesc: Record<string, string> = {};
        const mergedSeoTitle: Record<string, string> = {};
        const mergedMetaDesc: Record<string, string> = {};
        const mergedDefinition: Record<string, string> = {};
        const mergedFeatures: Record<string, string[]> = {};
        const mergedKeywords: Record<string, string[]> = {};

        let successCount = 0;

        // Run ALL batches in PARALLEL — each batch races all providers
        const batchResults = await Promise.allSettled(localeBatches.map(async (batch) => {
            const localeStr = batch.join(', ');
            const localeExample = batch.map(l => `"${l}": "..."`).join(', ');
            const localeArrayExample = batch.map(l => `"${l}": ["..."]`).join(', ');

            const prompt = `You are a Senior Technical SEO Specialist & Developer Advocate.
Analyze this AI Agent Skill and generate SEO content for a developer audience.

## Input
- **Skill Name**: "${skillName}"
- **Description & Content**: "${processedText.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
- **Tags**: ${topics}

## Generate for locales: ${localeStr}

CRITICAL SEO RULE for Title & Description:
For non-English locales, you MUST seamlessly integrate the most popular local search term for "AI Agents" or "AI Tools" (e.g., if Japanese, use "AIエージェント"; if Russian, use "ИИ Агенты"). Keep technical terms (React, Python, Node.js, CLI, Agent) in English.

### A. SEO Title (50-60 chars) — unique, clickable with main keyword
### B. Meta Description (150-160 chars) — different from main description, for SERP CTR
### C. Main Description (1-2 sentences, 50-80 words) — clear, technical summary
### D. Definition (40-60 words) — encyclopedic "what is it" for Featured Snippet
### E. Key Features (4-6 items) — technical highlights from content
### F. Keywords (6-10 items) — long-tail dev search terms

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
            for (const item of candidates) {
                const candidate = robustParseJSON(item);
                if (candidate && typeof candidate === 'object' && (candidate.description || candidate.definition || candidate.features)) {
                    return { parsed: candidate, batch };
                }
            }
            throw new Error(`No valid JSON for [${localeStr}]`);
        }));

        // Merge all successful batch results
        const mergeMap = (target: Record<string, string>, source: any, batch: string[]) => {
            if (!source || typeof source !== 'object') return;
            if (typeof source === 'string') { target[batch[0]] = source; return; }
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
            }
        }
        process.stdout.write('.');

        // If no batches succeeded, return default
        if (successCount === 0) {
            console.warn(`⚠️ All batches failed for ${skillName}, using default`);
            return defaultResult;
        }

        // Ensure en fallback
        if (!mergedDesc.en) mergedDesc.en = text;
        if (!mergedSeoTitle.en) mergedSeoTitle.en = skillName || 'AI Skill';

        return {
            description: cleanAndTruncate(mergedDesc, 300),
            seo: {
                title: cleanAndTruncate(mergedSeoTitle, 60),
                description: cleanAndTruncate(mergedMetaDesc.en ? mergedMetaDesc : mergedDesc, 160),
                definition: mergedDefinition.en ? mergedDefinition : { en: text },
                features: mergedFeatures,
                keywords: mergedKeywords
            }
        };
    }

    /**
     * Generate Agent Analysis (Suitability, Recommendation, Use Cases)
     */
    async generateAgentAnalysis(
        skillName: string,
        description: string,
        bodyPreview: string
    ): Promise<{ suitability: string; recommendation: string; useCases: string[]; limitations: string[]; version?: number } | undefined> {

        let processedText = description + "\n" + bodyPreview;
        if (processedText.length > 3000) {
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
     * Uses batch-locale strategy (same as translateMetadata) to avoid timeout.
     * Includes validation to reject suspiciously short translations.
     */
    async translateAgentAnalysis(
        raw: { suitability: string; recommendation: string; useCases: string[]; limitations: string[]; version?: number }
    ): Promise<AgentAnalysis> {
        // Helper: validate string fields, reject suspiciously short translations
        const validateField = (source: string, targetWrapper: Record<string, string>) => {
            const verified: Record<string, string> = { en: source };
            for (const lang of SUPPORTED_LOCALES) {
                const val = targetWrapper[lang];
                const isSuspiciousLength = source.length > 20 && val && val.length < 10;
                if (isSuspiciousLength) {
                    console.warn(`[WARN] Discarding suspicious translation for ${lang}: "${val}" (Source length: ${source.length})`);
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
        const BATCH_SIZE = 3;
        const localeBatches: string[][] = [];
        for (let i = 0; i < SUPPORTED_LOCALES.length; i += BATCH_SIZE) {
            localeBatches.push(SUPPORTED_LOCALES.slice(i, i + BATCH_SIZE));
        }

        let successCount = 0;

        // Run ALL batches in PARALLEL — each batch races all providers
        const batchResults = await Promise.allSettled(localeBatches.map(async (batch) => {
            const localeStr = batch.join(', ');
            const localeExample = batch.map(l => `"${l}": "..."`).join(', ');
            const localeArrayExample = batch.map(l => `"${l}": ["..."]`).join(', ');

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
        }));

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
            version: raw.version || 1
        };
    }
}
