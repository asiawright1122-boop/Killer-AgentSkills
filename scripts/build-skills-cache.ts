/**
 * Skills 缓存构建脚本
 * 运行: npx ts-node scripts/build-skills-cache.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import 'dotenv/config'; // Load env vars
import * as dotenv from 'dotenv';

// Try loading .env.local if available
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

// Import shared validation logic
import { calculateQualityScore as sharedCalculateQualityScore, type SkillScoringInput } from '../src/lib/shared/validation';
import { OFFICIAL_REPOS } from '../src/lib/shared/official-repos';

// 缓存数据结构
// SEO 数据结构
interface SeoData {
    definition: Record<string, string>;
    features: Record<string, string[]>;
    keywords: Record<string, string[]>;
}

// Agent Analysis Data Structure
interface AgentAnalysis {
    suitability: string;
    recommendation: string;
    useCases: string[];
    limitations: string[];
}

// 缓存数据结构
interface SkillCache {
    id: string;
    name: string;
    description: string | Record<string, string>;
    owner: string;
    repo: string;
    repoPath: string;
    stars: number;
    forks: number;
    updatedAt: string;
    topics: string[];
    skillMd?: {
        name: string;
        description: string;
        version?: string;
        tags?: string[];
        bodyPreview: string;
        body?: string;
    };
    qualityScore?: number;
    category?: string;
    lastSynced: string;
    seo?: SeoData;
    agentAnalysis?: AgentAnalysis;
}

interface CacheData {
    version: number;
    lastUpdated: string;
    totalCount: number;
    skills: SkillCache[];
}

// GitHub API 配置
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SUPPORTED_LOCALES = ["zh", "ja", "ko", "es", "fr", "de", "pt", "ru", "ar"]; // All supported locales
const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5'; // SKILLS_CACHE

// ========== AI API 配置 ==========
// 并行竞速: NVIDIA + SiliconFlow + OpenRouter 同时发请求，谁先成功用谁
// 最终备选: Cloudflare Workers AI

// NVIDIA API
const nvidiaApiKeys = (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || "").split(',').map(k => k.trim()).filter(Boolean);
let currentNvidiaKeyIndex = 0;

// SiliconFlow API (Qwen2.5-7B-Instruct - 免费)
const siliconflowApiKey = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';

// OpenRouter API (Qwen3 30B MoE - 免费, 多 key 并行)
const openrouterApiKeys = (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
let currentOpenrouterKeyIndex = 0;
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Cloudflare Workers AI (最终兜底)
const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || '';
const CF_AI_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run`;

// 统计
let nvidiaCallCount = 0;
let siliconflowCallCount = 0;
let openrouterCallCount = 0;
let cloudflareCallCount = 0;
let nvidiaFailCount = 0;

/**
 * 调用 AI API 进行翻译扩写
 * 并行竞速: NVIDIA + SiliconFlow + OpenRouter 同时发请求
 * 最终兜底: Cloudflare Workers AI
 */
async function callAI(prompt: string, jsonMode: boolean = false, skipNvidia: boolean = false): Promise<string | null> {
    const raceProviders: Promise<{ content: string; provider: string }>[] = [];

    // --- Provider 1: NVIDIA ---
    if (!skipNvidia && nvidiaApiKeys.length > 0) {
        const apiKey = nvidiaApiKeys[currentNvidiaKeyIndex];
        currentNvidiaKeyIndex = (currentNvidiaKeyIndex + 1) % nvidiaApiKeys.length;

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
                nvidiaFailCount++;
                throw new Error(`NVIDIA ${res.status}`);
            }
            const data = await res.json();
            const content = (data as any)?.choices?.[0]?.message?.content;
            if (!content) throw new Error('NVIDIA empty response');

            // Validation: Must be valid JSON and have non-empty CJK fields if jsonMode is true
            if (jsonMode) {
                try {
                    // Pre-clean content to remove occasional markdown fences even in json_mode
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
    if (siliconflowApiKey) {
        const sfPromise = (async () => {
            const res = await fetch(SILICONFLOW_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${siliconflowApiKey}` },
                body: JSON.stringify({
                    model: 'Qwen/Qwen2.5-7B-Instruct',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 2500,
                    stream: false
                })
            });
            if (!res.ok) throw new Error(`SiliconFlow ${res.status}`);
            const data = await res.json();
            const content = (data as any)?.choices?.[0]?.message?.content;
            if (!content) throw new Error('SiliconFlow empty response');

            // Validation: Must be valid JSON and have non-empty CJK fields if jsonMode is true
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

    // --- Provider 3: OpenRouter (每个 key 各发一个并行请求) ---
    for (let i = 0; i < openrouterApiKeys.length; i++) {
        const orKey = openrouterApiKeys[(currentOpenrouterKeyIndex + i) % openrouterApiKeys.length];
        const orPromise = (async () => {
            const res = await fetch(OPENROUTER_ENDPOINT, {
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
            });
            if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
            const data = await res.json();
            const content = (data as any)?.choices?.[0]?.message?.content;
            if (!content) throw new Error('OpenRouter empty response');

            // Validation: Must be valid JSON and have non-empty CJK fields if jsonMode is true
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
    currentOpenrouterKeyIndex = (currentOpenrouterKeyIndex + 1) % Math.max(openrouterApiKeys.length, 1);

    // --- Race all providers ---
    if (raceProviders.length > 0) {
        try {
            const winner = await Promise.any(raceProviders);
            // Update stats based on winner
            if (winner.provider === 'N') nvidiaCallCount++;
            else if (winner.provider === 'S') siliconflowCallCount++;
            else if (winner.provider === 'O') openrouterCallCount++;
            process.stdout.write(winner.provider);
            return winner.content;
        } catch (e) {
            // All providers failed, fall through to Cloudflare
        }
    }

    // --- Final Fallback: Cloudflare Workers AI ---
    if (cfAccountId && cfApiToken) {
        try {
            const res = await fetch(`${CF_AI_ENDPOINT}/@cf/meta/llama-3.1-8b-instruct-fast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfApiToken}` },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 1500
                })
            });

            if (res.ok) {
                const data = await res.json();
                cloudflareCallCount++;
                process.stdout.write('C');
                return (data as any)?.result?.response || null;
            }
        } catch (e) {
            // All failed
        }
    }

    return null;
}

const openai = createOpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: nvidiaApiKeys[0] || 'mock-key',
});
// Use .chat to ensure correct endpoint
const model = openai.chat('meta/llama-3.1-70b-instruct');

// Category Mapping Rules
const CATEGORY_RULES: Record<string, string[]> = {
    'ai': ['ai', 'llm', 'machine-learning', 'gpt', 'openai', 'anthropic', 'claude', 'gemini', 'model'],
    'development': ['development', 'dev-tools', 'debugging', 'linter', 'typescript', 'javascript', 'python', 'go', 'rust', 'backend', 'frontend'],
    'testing': ['testing', 'test', 'jest', 'vitest', 'pytest', 'e2e', 'unit-test'],
    'data': ['data', 'analytics', 'analysis', 'visualization', 'chart', 'pandas', 'sql'],
    'database': ['database', 'db', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'qdrant', 'vector-db'],
    'search': ['search', 'seo', 'exa', 'google-search', 'bing'],
    'web-scraping': ['scraping', 'crawler', 'spider', 'puppeteer', 'playwright', 'browser-use'],
    'browser': ['browser', 'automation', 'chrome'],
    'api': ['api', 'rest', 'graphql', 'http', 'request'],
    'devops': ['devops', 'docker', 'kubernetes', 'aws', 'cloud', 'deploy', 'ci-cd', 'terraform', 'infrastructure'],
    'security': ['security', 'auth', 'authentication', 'oauth', 'secret', 'vulnerability'],
    'git': ['git', 'github', 'version-control', 'commit', 'pr'],
    'code-review': ['code-review', 'review'],
    'design': ['design', 'ui', 'ux', 'css', 'tailwind', 'component', 'figma', 'svg', 'image'],
    'productivity': ['productivity', 'efficiency', 'workflow', 'automation', 'tool', 'utility', 'notion', 'obsidian'],
    'cli': ['cli', 'terminal', 'shell', 'bash', 'zsh', 'command-line'],
    'documentation': ['documentation', 'docs', 'markdown'],
};

function determineCategory(skill: SkillCache): string {
    const text = `${skill.name} ${JSON.stringify(skill.description)} ${(skill.topics || []).join(' ')}`.toLowerCase();
    const topics = new Set((skill.topics || []).map(t => t.toLowerCase()));

    // 1. Priority: Check specific topics first
    if (topics.has('code-review')) return 'code-review';
    if (topics.has('testing') || topics.has('test')) return 'testing';
    if (topics.has('design') || topics.has('ui')) return 'design';
    if (topics.has('security')) return 'security';
    if (topics.has('database')) return 'database';

    // 2. Score based matching
    let bestCategory = 'development'; // Default fallback
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
        let score = 0;
        for (const keyword of keywords) {
            // Topic match gives higher score
            if (topics.has(keyword)) score += 10;
            // Name match
            if (skill.name.toLowerCase().includes(keyword)) score += 5;
            // Description match
            if (text.includes(keyword)) score += 1;
        }

        if (score > maxScore) {
            maxScore = score;
            bestCategory = category;
        }
    }

    // 3. Special handling for specific known repos if needed
    if (skill.name === 'backend-patterns') return 'development';

    // If "official" was the only thing found (low score), try harder or default to generic
    if (maxScore === 0) {
        if (text.includes('agent')) return 'ai';
        if (text.includes('code')) return 'development';
    }

    return bestCategory;
}

/**
 * 翻译并生成深度 SEO 内容 (Description + Featured Snippet + Keywords)
 * @param text 原始描述文本
 * @param context 上下文信息（技能名称、topics、内容预览）
 */
interface TranslateContext {
    name?: string;
    topics?: string[];
    bodyPreview?: string;
}

async function translateMetadata(text: string, context?: TranslateContext): Promise<{
    description: Record<string, string>;
    seo: SeoData;
}> {
    // Default fallback
    const defaultResult = {
        description: { en: text },
        seo: {
            definition: { en: text.slice(0, 200) },
            features: { en: [] },
            keywords: { en: [] }
        }
    };

    // Check API availability
    const hasNvidia = nvidiaApiKeys.length > 0;
    const hasCloudflare = cfAccountId && cfApiToken;

    if (!hasNvidia && !hasCloudflare) return defaultResult;

    // Build Context
    const skillName = context?.name || '';
    console.log(`[DEBUG] Translating ${skillName}. Context:`, JSON.stringify(context, null, 2).slice(0, 500));
    const topics = context?.topics?.join(', ') || '';
    // Use larger preview for better analysis
    const bodyPreview = context?.bodyPreview?.slice(0, 1500) || '';

    try {
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

### A. Meta Description (Strictly 140-160 chars)
- **Goal**: High CTR in Search Results.
- **Format**: [Action Verb] [Key Value Proposition]. Includes [Specific Feature 1] and [Specific Feature 2].
- **Example**: "Generate production-ready React components with Tailwind support. Features automated prop validation, responsive layouts, and Shadcn UI integration."

### B. Featured Snippet / Definition (40-60 words)
- **Goal**: Win Google's "Position Zero" (What is [Skill]?).
- **Format**: A clear, encyclopedic definition.
- **Structure**: "[Skill Name] is an [Category] capability for [Target User] that [Core Function]. It specifically handles [Unique Selling Point]..."

### C. Key Features (3-4 items)
- **Goal**: Show "Why use this?" in a glance.
- **Format**: Short, punchy bullet points (max 6 words each).
- **Example**: ["Zero-config setup", "Type-safe schema validation", "Multi-modal support"]

### D. Keywords (5-8 items)
- **Goal**: Long-tail SEO targeting.
- **Format**: Specific terms (e.g. "Next.js 14 agent", "PDF parsing ai")

## Output Format (STRICT JSON)
- **IMPORTANT**: Your response must be a valid JSON object. Do not include any conversational text, markdown formatting, or code blocks.
- **Ensure all quotes within strings are properly escaped (e.g. \\" instead of ").**
- **Do not use trailing commas.** 

{
  "description": { "en": "...", "zh": "...", ... },
  "definition": { "en": "...", "zh": "...", ... },
  "features": { "en": ["...", "..."], "zh": ["...", "..."], ... },
  "keywords": { "en": ["..."], "zh": ["..."], ... }
}`;

        let useCloudflare = false;
        // Enable jsonMode=true for NVIDIA to ensure valid JSON and reduce hallucinations
        let response = await callAI(prompt, true, useCloudflare);
        let parsedResult: any = null;

        // Validation loop
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!response) {
                console.error(`[ERROR] API returned null/empty for ${skillName}`);
                break;
            }
            if (response) {
                console.log('Raw Response:', response);
                // ... parsing logic ...
                // Robust JSON extraction with Validation
                // We'll gather multiple candidates and try to parse them one by one.
                const candidates: string[] = [];

                // 1. Explicit ```json blocks (High confidence)
                const jsonBlockMatches = [...response.matchAll(/```json\s*([\s\S]*?)```/g)];
                jsonBlockMatches.forEach(m => candidates.push(m[1]));

                // 2. Any code block that starts with { (Medium confidence)
                const anyCodeBlockMatches = [...response.matchAll(/```(?:\w+)?\s*([\s\S]*?)```/g)];
                anyCodeBlockMatches.forEach(m => {
                    const content = m[1].trim();
                    // Avoid duplicating if it was already caught by json block
                    if (content.startsWith('{') && !candidates.includes(m[1])) {
                        candidates.push(content);
                    }
                });

                // 3. Raw text fallback - Look for { ... } patterns containing specific keywords (Low confidence)
                // We look for the "widest" match that looks like it contains our keys
                if (response.includes('description') || response.includes('seo')) {
                    const firstBrace = response.indexOf('{');
                    const lastBrace = response.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        candidates.push(response.slice(firstBrace, lastBrace + 1));
                    }
                }

                function repairTruncatedJSON(jsonString: string): string {
                    let repaired = jsonString.trim();
                    const stack: string[] = [];
                    let inString = false;
                    let escaped = false;

                    for (let i = 0; i < repaired.length; i++) {
                        const char = repaired[i];
                        if (escaped) { escaped = false; continue; }
                        if (char === '\\') { escaped = true; continue; }
                        if (char === '"') { inString = !inString; continue; }
                        if (!inString) {
                            if (char === '{') stack.push('}');
                            else if (char === '[') stack.push(']');
                            else if (char === '}' || char === ']') {
                                if (stack.length > 0 && stack[stack.length - 1] === char) stack.pop();
                            }
                        }
                    }

                    if (inString) repaired += '"';
                    while (stack.length > 0) repaired += stack.pop();
                    return repaired;
                }

                // Helper to clean and parse
                function tryParseJSON(str: string): any {
                    str = str.trim();
                    // Auto-fix if missing braces
                    if (!str.startsWith('{')) str = `{${str}}`;

                    // Sanitize matches logic from before
                    str = str.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()
                        .replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')
                        .replace(/,(\s*[}\]])/g, '$1');

                    // Clean formatting characters that might break JSON (newlines in strings, control chars)
                    str = str.replace(/[\u0000-\u001F]+/g, (match) => {
                        return match === '\n' || match === '\r' || match === '\t' ? match : '';
                    });

                    // Try Strict
                    try {
                        // Attempt to escape newlines inside strings (heuristic)
                        const clean = str.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
                        return JSON.parse(clean);
                    } catch (e1) {
                        // Try Repair Truncated -> Loose Parse
                        try {
                            const repaired = repairTruncatedJSON(str);
                            // eslint-disable-next-line no-new-func
                            return (new Function(`return ${repaired}`))();
                        } catch (e2) {
                            try {
                                // Quote keys if missing (last resort)
                                const quoted = str.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
                                // eslint-disable-next-line no-new-func
                                return (new Function(`return ${quoted}`))();
                            } catch (e3) {
                                return null;
                            }
                        }
                    }
                }

                // 4. Iterate and Validate
                for (const item of candidates) {
                    const parsed = tryParseJSON(item);
                    if (parsed && (typeof parsed === 'object')) {
                        // Accept any valid result that has structure
                        // Partial translations (e.g. zh filled, ru empty) are better than no translations

                        // Validation: Must have at least "description" or "seo" or "definition"
                        if (parsed.description || parsed.seo || parsed.definition || parsed.features) {

                            // Deep merge/validation to ensure structure
                            return {
                                description: parsed.description || { en: text },
                                seo: {
                                    definition: parsed.definition || (parsed.seo?.definition) || { en: text },
                                    features: parsed.features || (parsed.seo?.features) || { en: [] },
                                    keywords: parsed.keywords || (parsed.seo?.keywords) || { en: [] }
                                }
                            };
                        }
                    }
                }

                console.warn(`⚠️ Failed to extract valid JSON (or found empty translations)`);
                if (response.length < 500) console.log('Raw Response:', response);
            }

            // If we get here, parsing failed or result was incomplete
            if (!useCloudflare && hasCloudflare) {
                console.log('🔄 NVIDIA result incomplete or invalid. Retrying with Cloudflare...');
                useCloudflare = true;
                response = await callAI(prompt, false, useCloudflare);
            } else {
                break; // Valid result or ran out of retries
            }
        }

    } catch (e) {
        console.error('AI Generation Failed:', e);
    }
    return defaultResult;
}

/**
 * Generate Agent Analysis (Suitability, Recommendation, Use Cases)
 */
async function generateAgentAnalysis(
    skillName: string,
    description: string,
    bodyPreview: string
): Promise<AgentAnalysis | undefined> {
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

    // Use AI to generate analysis
    // We reuse simple callAI logic here.
    try {
        const result = await callAI(prompt, true, false); // Try NVIDIA/SiliconFlow first
        if (result) {
            // Extract JSON
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

// SEO 数据现在直接从缓存的 description 字段获取，无需单独生成

// 官方仓库列表 — 从 src/lib/shared/official-repos.ts 导入 (单一数据源)

async function searchGitHubSkills(): Promise<any[]> {
    console.log('🔍 Loading skills from data/expanded-github-skills.json...');
    const expandedPath = path.join(process.cwd(), 'data/expanded-github-skills.json');
    const morePath = path.join(process.cwd(), 'data/more-github-skills.json');
    let items: any[] = [];

    if (fs.existsSync(expandedPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(expandedPath, 'utf-8'));
            items = items.concat(Array.isArray(data) ? data : data.items || []);
        } catch (e) {
            console.error('Error reading expanded-github-skills.json', e);
        }
    }

    if (fs.existsSync(morePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(morePath, 'utf-8'));
            items = items.concat(Array.isArray(data) ? data : data.items || []);
        } catch (e) {
            console.error('Error reading more-github-skills.json', e);
        }
    }

    console.log(`   → Found ${items.length} items from local backups`);

    // If local backups are empty, try to fetch some from GitHub API directly to bootstrap
    if (items.length === 0) {
        console.log('   ⚠️ No local backups found. Fetching initial batch from GitHub API...');
        // Use a broad search to bootstrap
        const bootstrapQueries = [
            'filename:SKILL.md sort:input',
            'filename:SKILL.md stars:>10'
        ];

        for (const query of bootstrapQueries) {
            try {
                const searchUrl = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=100`;
                const response = await fetch(searchUrl, { headers: getHeaders() });
                if (response.ok) {
                    const data = await response.json() as any;
                    const newItems = data.items || [];
                    console.log(`      Found ${newItems.length} items via API (${query})`);

                    // Transform to matching structure
                    const transformed = newItems.map((item: any) => ({
                        owner: item.repository.owner.login,
                        repo: item.repository.name,
                        stars: item.repository.stargazers_count,
                        forks: item.repository.forks_count,
                        topics: item.repository.topics || [],
                        description: item.repository.description,
                        updatedAt: item.repository.updated_at,
                        filePath: item.path
                    }));

                    items = items.concat(transformed);
                }
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.error('Bootstrap search failed:', e);
            }
        }

        // Save to expanded-github-skills.json for next time
        if (items.length > 0) {
            fs.writeFileSync(expandedPath, JSON.stringify(items, null, 2));
            console.log(`   💾 Saved ${items.length} bootstrapped items to ${expandedPath}`);
        }
    }

    return items;
}

/**
 * 自动发现 GitHub 上新发布的 Skills
 * 使用 GitHub Code Search API 搜索包含 SKILL.md 的仓库
 * - 动态日期: 基于缓存的 lastUpdated 搜索新仓库
 * - 翻页: 每个查询最多 3 页 × 100 结果
 * - 扩大搜索: 覆盖所有常见 IDE/Agent 目录
 */
async function discoverNewSkillsFromGitHub(existingIds: Set<string>, lastCacheUpdate?: string, fullDiscovery: boolean = false): Promise<any[]> {
    if (!GITHUB_TOKEN) {
        console.log('⚠️ GITHUB_TOKEN not set, skipping auto-discovery');
        return [];
    }

    console.log('🔎 Discovering new Skills from GitHub...');
    const newSkills: any[] = [];
    const processedRepoFiles = new Set<string>(); // 去重: repo/path

    // 动态日期: 使用缓存的 lastUpdated - 2天 作为搜索起点，确保不遗漏
    let searchSince = '2024-01-01';

    if (fullDiscovery) {
        console.log('   🌍 Full Discovery Mode: Searching from 2024-01-01');
        searchSince = '2024-01-01';
    } else if (lastCacheUpdate) {
        const d = new Date(lastCacheUpdate);
        d.setDate(d.getDate() - 2); // 往前推 2 天，留余量
        searchSince = d.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    console.log(`   📅 Searching for repos pushed since: ${searchSince}`);

    // 搜索策略: 覆盖所有常见的 Skill 存放位置
    const searchQueries = [
        `filename:SKILL.md path:/ pushed:>${searchSince}`,           // 根目录
        `filename:SKILL.md path:skills pushed:>${searchSince}`,      // skills/
        `filename:SKILL.md path:.claude pushed:>${searchSince}`,     // .claude/
        `filename:SKILL.md path:.agents pushed:>${searchSince}`,     // .agents/
        `filename:SKILL.md path:.codex pushed:>${searchSince}`,      // .codex/
        `filename:SKILL.md path:.cursor pushed:>${searchSince}`,     // .cursor/
        `filename:SKILL.md path:.windsurf pushed:>${searchSince}`,   // .windsurf/
        `filename:SKILL.md path:.kiro pushed:>${searchSince}`,       // .kiro/
        `filename:SKILL.md path:.gemini pushed:>${searchSince}`,     // .gemini/
        `filename:SKILL.md "name:" "description:" pushed:>${searchSince}`, // 通用搜索，不限路径
    ];

    // Add generic broad searches if in full discovery mode
    if (fullDiscovery) {
        searchQueries.push(`filename:SKILL.md language:markdown star:>0`);
        searchQueries.push(`filename:SKILL.md path:.custom`);
    }

    const DISCOVERY_LIMIT = 2000; // 提升上限: 100 -> 2000
    const MAX_PAGES = 10;         // 提升翻页: 3 -> 10 (GitHub API max 1000 results per query)

    for (const query of searchQueries) {
        if (newSkills.length >= DISCOVERY_LIMIT) break;

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const searchUrl = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}&sort=indexed&order=desc`;
                const response = await fetch(searchUrl, { headers: getHeaders() });

                if (!response.ok) {
                    if (response.status === 403 || response.status === 422) {
                        console.log('   ⚠️ GitHub API rate limit reached, skipping remaining queries');
                        return newSkills; // 限流时直接返回已有结果
                    }
                    break; // 其他错误，跳到下一个查询
                }

                const data = await response.json() as any;
                const items = data.items || [];

                if (items.length === 0) break; // 没有更多结果，跳到下一个查询

                for (const item of items) {
                    const repoFullName = item.repository?.full_name;
                    if (!repoFullName) continue;

                    const [owner, repo] = repoFullName.split('/');
                    const filePath = item.path;
                    const repoFileKey = `${repoFullName}/${filePath}`;

                    // 去重: 同一 repo/path 只处理一次
                    if (processedRepoFiles.has(repoFileKey)) continue;
                    processedRepoFiles.add(repoFileKey);

                    // 生成唯一 ID
                    const skillId = filePath === 'SKILL.md'
                        ? repoFullName
                        : `${repoFullName}/${filePath.replace('/SKILL.md', '').replace('SKILL.md', '')}`.replace(/\/$/, '');

                    // 跳过已存在的
                    if (existingIds.has(skillId) || existingIds.has(repoFullName)) {
                        continue;
                    }

                    // 获取 SKILL.md 内容
                    const branch = item.repository?.default_branch || 'main';
                    const rawUrl = `https://raw.githubusercontent.com/${repoFullName}/${branch}/${filePath}`;

                    try {
                        const contentRes = await fetch(rawUrl);
                        if (!contentRes.ok) continue;

                        const content = await contentRes.text();

                        // 验证是否有有效的 frontmatter
                        if (!content.includes('---') || !content.includes('name:')) {
                            continue;
                        }

                        // 获取仓库信息
                        const repoInfo = await fetchRepoInfo(owner, repo);
                        if (!repoInfo) continue;

                        newSkills.push({
                            owner,
                            repo,
                            content,
                            stars: repoInfo.stargazers_count || 0,
                            forks: repoInfo.forks_count || 0,
                            topics: repoInfo.topics || [],
                            description: repoInfo.description || '',
                            fetchedAt: new Date().toISOString(),
                            filePath,
                            skillId,
                        });

                        process.stdout.write('N'); // N for New discovery

                        if (newSkills.length >= DISCOVERY_LIMIT) {
                            console.log(`\n   → Reached discovery limit (${DISCOVERY_LIMIT}), stopping...`);
                            return newSkills;
                        }
                    } catch {
                        continue;
                    }
                }

                // 如果返回不满 100 条，说明没有下一页了
                if (items.length < 100) break;

                // 翻页间隔，避免触发限流
                await new Promise(r => setTimeout(r, 2000));

            } catch (e) {
                console.error(`   Error searching with query "${query}" page ${page}:`, e);
                break;
            }
        }

        // 查询间隔
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n   → Discovered ${newSkills.length} new Skills from GitHub`);
    return newSkills;
}

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Killer-Skills-Build-Script'
    };
    if (GITHUB_TOKEN) {
        headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }
    return headers;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, { headers: getHeaders() });
            if (response.status === 403) {
                console.warn('⚠️ GitHub API rate limit, waiting 60s...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error('Max retries exceeded');
}

async function fetchRepoInfo(owner: string, repo: string): Promise<any> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    return response.json();
}

async function fetchSkillMd(owner: string, repo: string, skillsPath: string): Promise<string | null> {
    // If skillsPath ends in .md (or other extensions), treat it as a specific file, not a directory
    if (skillsPath && (skillsPath.endsWith('.md') || skillsPath.endsWith('.cursorrules'))) {
        const paths = [skillsPath];
        for (const p of paths) {
            for (const branch of ['main', 'master', 'canary', 'develop']) {
                try {
                    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`;
                    const response = await fetch(url);
                    if (response.ok) return response.text();
                } catch { continue; }
            }
        }
        return null;
    }

    const paths = skillsPath
        ? [`${skillsPath}/SKILL.md`, 'SKILL.md']
        : [
            'SKILL.md',
            '.cursorrules', // Support .cursorrules as top-level skill
            '.codex/skills/SKILL.md',
            '.claude/skills/SKILL.md',
            '.agent/skills/SKILL.md',
            `skills/${repo}/SKILL.md`,
            `.codex/skills/${repo}/SKILL.md`,
            `.claude/skills/${repo}/SKILL.md`
        ];

    const branchesToTry = ['main', 'master', 'canary', 'develop'];
    for (const p of paths) {
        for (const branch of branchesToTry) {
            try {
                const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`;
                const response = await fetch(url);
                if (response.ok) return response.text();
            } catch {
                continue;
            }
        }
    }
    return null;
}

function parseSkillMd(content: string): SkillCache['skillMd'] & { body?: string } | undefined {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) return undefined;

    const [, frontmatter, body] = match;
    const meta: Record<string, any> = {};

    frontmatter.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let value = line.slice(colonIdx + 1).trim().replace(/['\"]/g, '');

            // 处理数组
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1);
                meta[key] = value.split(',').map(s => s.trim().replace(/['\"]/g, ''));
            } else {
                meta[key] = value;
            }
        }
    });

    return {
        name: meta.name || '',
        description: meta.description || '',
        version: meta.version,
        tags: meta.tags,
        bodyPreview: body.slice(0, 500).trim(),
        body: body // Return full body for validation
    };
}

/**
 * Calculate quality score using shared validation module
 * This is a wrapper to adapt SkillCache to SkillScoringInput
 */
function calculateQualityScore(skill: SkillCache): number {
    if (!skill.skillMd) return 0;

    const bodyRaw = (skill.skillMd as any).body || skill.skillMd.bodyPreview || '';
    const desc = typeof skill.description === 'string' ? skill.description : (skill.description?.en || '');

    return sharedCalculateQualityScore({
        name: skill.skillMd.name || skill.name,
        owner: skill.owner,
        repo: skill.repo,
        body: bodyRaw,
        repoPath: skill.repoPath,
        description: desc,
        stars: skill.stars,
        updatedAt: skill.updatedAt,
        version: skill.skillMd.version,
        tags: skill.skillMd.tags
    });
}



async function buildCache(): Promise<void> {
    // Parse arguments
    const args = process.argv.slice(2);
    const modeArg = args.find(arg => arg.startsWith('--mode='));
    const mode = modeArg ? modeArg.split('=')[1] : 'update'; // default to update (full)
    const force = args.includes('--force'); // Force re-generation of AI content
    const filterArg = args.find(arg => arg.startsWith('--filter='));
    const filters = filterArg ? filterArg.split('=')[1].toLowerCase().split(',') : [];

    console.log(`🚀 Starting cache build in [${mode.toUpperCase()}] mode... (Force: ${force}, Filter: ${filters.join(',') || 'None'})\n`);

    if (!['discover', 'update', 'full-discovery'].includes(mode)) {
        console.error(`❌ Invalid mode: ${mode}. Use --mode=discover, --mode=update, or --mode=full-discovery`);
        process.exit(1);
    }

    // Load existing cache
    let existingMap = new Map<string, SkillCache>();
    let lastCacheUpdate: string | undefined;
    const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
    if (fs.existsSync(cachePath)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheData;
            oldData.skills.forEach(s => existingMap.set(s.id, s));
            lastCacheUpdate = oldData.lastUpdated;
            console.log(`📚 Loaded ${existingMap.size} skills from cache (last updated: ${lastCacheUpdate || 'unknown'})`);
        } catch { }
    }

    const skills: SkillCache[] = [];
    globalSkillsRef = skills; // Store reference for SIGINT handler
    const processedRepos = new Set<string>();

    // Helper: 检查翻译是否完整 (所有 9 种语言都有 SEO 数据 且包含 agentAnalysis)
    function isTranslationComplete(skill: SkillCache): boolean {
        if (!skill.seo || !skill.description) return false;

        // NEW: Check for Agent Analysis
        if (!skill.agentAnalysis) return false;

        // 检查 description 是否有所有语言版本
        const desc = skill.description;
        if (typeof desc === 'string') return false; // 纯字符串 = 未翻译
        const hasAllDesc = SUPPORTED_LOCALES.every(loc => desc[loc] && desc[loc].trim().length > 0);
        if (!hasAllDesc) return false;

        return true;
    }

    // Helper: 检查 skill 是否有更新 (updatedAt > lastSynced)
    function hasSkillUpdated(skill: SkillCache, freshUpdatedAt?: string): boolean {
        if (!skill.lastSynced) return true; // 从未同步过
        if (freshUpdatedAt) {
            return new Date(freshUpdatedAt) > new Date(skill.lastSynced);
        }
        if (skill.updatedAt) {
            return new Date(skill.updatedAt) > new Date(skill.lastSynced);
        }
        return false;
    }

    // Helper to get or translate metadata (Description + SEO)
    async function processMetadata(
        id: string,
        text: string,
        context?: TranslateContext,
        freshUpdatedAt?: string
    ): Promise<{ description: string | Record<string, string>, seo?: SeoData }> {
        const existing = existingMap.get(id);

        // 增量翻译: 已完整翻译 + 没有更新 → 跳过
        if (!force && existing && isTranslationComplete(existing) && !hasSkillUpdated(existing, freshUpdatedAt)) {
            process.stdout.write('s'); // s = skip (已完成)
            return { description: existing.description, seo: existing.seo };
        }

        process.stdout.write('T'); // T for Translating/Generating
        return await translateMetadata(text, context);
    }

    // 1. 处理官方仓库 (仅在 update 模式下，或者 discover 模式下检查是否存在)
    if (mode === 'update') {
        console.log('📦 Processing official repos...');
        for (const repo of OFFICIAL_REPOS) {
            const repoPath = `${repo.owner}/${repo.repo}`;
            console.log(`   → ${repoPath}`);

            const repoInfo = await fetchRepoInfo(repo.owner, repo.repo);
            if (!repoInfo) {
                console.log(`   ⚠️ Failed to fetch repo info`);
                continue;
            }

            if (repo.skillsPath) {
                try {
                    const contentsUrl = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${repo.skillsPath}`;
                    const contentsRes = await fetchWithRetry(contentsUrl);
                    if (contentsRes.ok) {
                        const contents = await contentsRes.json() as any;

                        let skillDirs: any[] = [];
                        if (Array.isArray(contents)) {
                            skillDirs = contents.filter((item: any) => item.type === 'dir' && !item.name.startsWith('.'));
                        } else if (contents.type === 'file') {
                            // If skillsPath points to a file (like README.md), use the filename (e.g. README.md) as the skill name
                            // This ensures the skillId becomes 'owner/repo/README.md'
                            skillDirs = [{ name: repo.skillsPath, type: 'file', path: contents.path, download_url: contents.download_url }];
                        }

                        console.log(`      Found ${skillDirs.length} skills in ${repo.skillsPath}`);

                        for (const skillDir of skillDirs) {
                            const skillId = `${repoPath}/${skillDir.name}`;
                            if (processedRepos.has(skillId)) continue;

                            console.log(`      Found candidate: ${skillDir.name}`);

                            // Check filter for individual skills within the repo
                            if (filters.length > 0) {
                                const match = filters.some(f =>
                                    skillDir.name.toLowerCase().includes(f) ||
                                    repo.owner.toLowerCase().includes(f) ||
                                    repo.repo.toLowerCase().includes(f)
                                );
                                if (!match) continue;
                            }

                            processedRepos.add(skillId);

                            // INCREMENTAL CHECK: If we already have this skill in cache with a body, and it's recent, skip fetching
                            const existing = existingMap.get(skillId);
                            // If we have existing data, and it has a body, and we are not forcing update
                            // And it was synced recently (e.g. within 24 hours), we can likely skip fetching content
                            // We still might want to check for updates if it's been a while, but for now let's trust the body
                            if (existing && existing.skillMd?.body && !force) {
                                // Check if it needs update based on repo updated_at
                                if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                                    console.log(`      ⏩ Skipping fetch (Cached & Fresh): ${skillDir.name}`);
                                    skills.push(existing);
                                    process.stdout.write('s');
                                    continue;
                                }
                            }

                            let skillMdContent = '';
                            let isSingleFile = false;

                            if (skillDir.type === 'file') {
                                isSingleFile = true;
                                try {
                                    // Use download_url from API if available, otherwise construct raw URL
                                    const url = skillDir.download_url || `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/${repo.skillsPath}`;
                                    const res = await fetch(url);
                                    if (res.ok) {
                                        skillMdContent = await res.text();
                                    }
                                } catch (e) {
                                    console.log(`      ⚠️ Failed to fetch file content: ${e}`);
                                }
                            } else {
                                const skillMdPath = `${repo.skillsPath}/${skillDir.name}/SKILL.md`;
                                const defaultBranch = repoInfo?.default_branch;
                                const branches = [defaultBranch, 'main', 'master', 'canary', 'develop'].filter((b, i, a) => b && a.indexOf(b) === i);
                                for (const branch of branches) {
                                    try {
                                        const mdUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${skillMdPath}`;
                                        const mdRes = await fetch(mdUrl);
                                        if (mdRes.ok) {
                                            skillMdContent = await mdRes.text();
                                            break;
                                        }
                                    } catch { }
                                }
                            }

                            const parsed = skillMdContent ? parseSkillMd(skillMdContent) : undefined;

                            // Fallback for README.md or non-standard skills
                            const skillMd = parsed || (isSingleFile ? {
                                name: (repo as any).displayName || repoInfo.name, // Use displayName from config if available
                                description: repoInfo.description,
                                bodyPreview: skillMdContent.slice(0, 5000), // Use content as body for AI to analyze
                                tags: repoInfo.topics
                            } : undefined);

                            const rawDesc = skillMd?.description || '';

                            const metadata = await processMetadata(skillId, rawDesc, {
                                name: skillMd?.name || skillDir.name,
                                topics: repoInfo.topics || [],
                                bodyPreview: skillMd?.bodyPreview
                            });

                            const skill: SkillCache = {
                                id: skillId,
                                name: skillMd?.name || skillDir.name,
                                description: metadata.description,
                                owner: repo.owner,
                                repo: repo.repo,
                                repoPath,
                                stars: repoInfo.stargazers_count,
                                forks: repoInfo.forks_count,
                                updatedAt: repoInfo.updated_at,
                                topics: repoInfo.topics || [],
                                skillMd,
                                category: 'official',
                                lastSynced: new Date().toISOString(),
                                seo: metadata.seo,
                            };

                            // Generate Agent Analysis
                            const agentAnalysis = await generateAgentAnalysis(skill.name, rawDesc, skillMd?.bodyPreview || '');
                            if (agentAnalysis) {
                                skill.agentAnalysis = agentAnalysis;
                            }

                            console.log(`      ✅ Added skill: ${skill.name} (${skill.id})`);
                            skill.qualityScore = calculateQualityScore(skill);
                            skills.push(skill);
                            process.stdout.write('.');
                        }
                    }
                } catch (e) {
                    console.log(`      ⚠️ Failed to list skills directory: ${e}`);
                }
            } else {
                const skillId = repoPath;

                if (!processedRepos.has(skillId)) {
                    processedRepos.add(skillId);

                    // INCREMENTAL CHECK: Single-file repo
                    const existing = existingMap.get(skillId);
                    if (existing && existing.skillMd?.body && !force) {
                        if (!hasSkillUpdated(existing, repoInfo.updated_at)) {
                            console.log(`      ⏩ Skipping fetch (Cached & Fresh): ${repo.repo}`);
                            skills.push(existing);
                            process.stdout.write('s');
                            continue;
                        }
                    }

                    const skillMdContent = await fetchSkillMd(repo.owner, repo.repo, '');
                    const skillMd = skillMdContent ? parseSkillMd(skillMdContent) : undefined;
                    const rawDesc = skillMd?.description || repoInfo.description || '';

                    const metadata = await processMetadata(skillId, rawDesc, {
                        name: skillMd?.name || repoInfo.name,
                        topics: repoInfo.topics || [],
                        bodyPreview: skillMd?.bodyPreview
                    });

                    const skill: SkillCache = {
                        id: skillId,
                        name: skillMd?.name || repoInfo.name,
                        description: metadata.description,
                        seo: metadata.seo,
                        owner: repo.owner,
                        repo: repo.repo,
                        repoPath,
                        stars: repoInfo.stargazers_count,
                        forks: repoInfo.forks_count,
                        updatedAt: repoInfo.updated_at,
                        topics: repoInfo.topics || [],
                        skillMd,
                        category: 'official',
                        lastSynced: new Date().toISOString(),
                    };

                    // Generate Agent Analysis
                    const agentAnalysis = await generateAgentAnalysis(skill.name, rawDesc, skillMd?.bodyPreview || '');
                    if (agentAnalysis) {
                        skill.agentAnalysis = agentAnalysis;
                    }

                    skill.qualityScore = calculateQualityScore(skill);
                    skills.push(skill);
                    process.stdout.write('.');
                }
            }
        }
    } else {
        console.log('📦 Skipping official repos check (Discover Mode)');
        // In discover mode, we still need to keep existing official skills in the list
        // We'll load them from existingMap later in step 3
    }

    // 2. 搜索更多 Skills
    console.log('\n🔍 Searching for more skills...');
    const searchResults = await searchGitHubSkills();

    for (const item of searchResults) {
        // Handle both GitHub API format and local backup format
        let repoName = '';
        let ownerLogin = '';
        let stars = 0;
        let forks = 0;
        let updatedAt = new Date().toISOString();
        let topics: string[] = [];
        let rawDesc = '';
        let content = '';
        let filePath = '';

        if (item.repository) {
            // GitHub API format
            const repo = item.repository;
            repoName = repo.name;
            ownerLogin = typeof repo.owner === 'object' ? repo.owner.login : repo.owner;
            stars = repo.stargazers_count;
            forks = repo.forks_count;
            updatedAt = repo.updated_at;
            topics = repo.topics || [];
            rawDesc = repo.description || '';
            filePath = item.path || '';
        } else {
            // Local backup format (flat structure)
            repoName = item.repo;
            ownerLogin = item.owner;
            stars = item.stars || 0;
            forks = item.forks || 0;
            updatedAt = item.fetchedAt || item.updatedAt || new Date().toISOString();
            topics = item.topics || [];
            rawDesc = item.description || '';
            content = item.content || '';
            filePath = item.filePath || '';
        }

        // Bug Fix: 使用 repoPath + skillName 作为去重键
        // Note: we can't be 100% sure of skillId until we parse skillMd
        // But we can check if any skill from this repo/path is already in processed-repos
        const repoPath = `${ownerLogin}/${repoName}`;
        const dedupeKey = filePath ? `${repoPath}/${filePath}` : repoPath;
        if (processedRepos.has(dedupeKey)) continue;

        // NEW: Check if this repo/path is already in existingMap and complete
        // We look for any skill that matches this owner/repo/path
        const existingSkill = Array.from(existingMap.values()).find(s =>
            s.owner === ownerLogin && s.repo === repoName && (s.repoPath === repoPath || s.id.startsWith(repoPath))
        );

        if (existingSkill && isTranslationComplete(existingSkill)) {
            skills.push(existingSkill);
            // We need a unique ID for processedRepos, use the one from cache
            processedRepos.add(existingSkill.id);
            process.stdout.write('s');
            continue;
        }

        // Bug Fix: 严格验证文件名，过滤 skill.md / Skill.md 等误报
        if (filePath) {
            const fileName = filePath.split('/').pop() || '';
            const isValidFile = fileName === 'SKILL.md' || fileName === 'SKILL.MD'
                || (filePath.includes('/skills/') && fileName.toLowerCase() === 'skill.md');
            if (!isValidFile) continue;
        }

        // 1. Fetch content if not available
        if (!content && filePath) {
            try {
                const branch = 'main';
                const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${filePath}`;
                const res = await fetch(rawUrl);
                if (res.ok) {
                    content = await res.text();
                } else {
                    // Try master branch
                    const masterUrl = `https://raw.githubusercontent.com/${repoPath}/master/${filePath}`;
                    const masterRes = await fetch(masterUrl);
                    if (masterRes.ok) {
                        content = await masterRes.text();
                    }
                }
                // Brief delay to avoid GitHub rate limiting
                await new Promise(r => setTimeout(r, 500));
            } catch {
                // Failed to fetch, skip this item
            }
        }

        // If still no content, try fetchSkillMd as fallback
        if (!content) {
            try {
                const fetched = await fetchSkillMd(ownerLogin, repoName, filePath ? filePath.replace('/SKILL.md', '').replace('SKILL.md', '') : '');
                if (fetched) content = fetched;
            } catch {
                continue; // Truly unfetchable, skip
            }
        }

        if (!content) continue;

        const skillMd = parseSkillMd(content);
        if (!skillMd || !skillMd.name) {
            // Invalid structure - not a proper SKILL.md
            continue;
        }

        // 2. Generate Unique ID
        // Use repoPath + skillName to allow multiple skills per repo
        const skillId = `${repoPath}/${skillMd.name}`;

        if (processedRepos.has(skillId)) continue;
        processedRepos.add(skillId);

        // console.log(`   → ${skillId}`);
        process.stdout.write('.');

        const metadata = await processMetadata(skillId, rawDesc, {
            name: skillMd.name,
            topics: topics,
            bodyPreview: skillMd.bodyPreview
        });

        const skill: SkillCache = {
            id: skillId,
            name: skillMd.name,
            description: metadata.description,
            seo: metadata.seo,
            owner: ownerLogin,
            repo: repoName,
            repoPath,
            stars: stars,
            forks: forks,
            updatedAt: updatedAt,
            topics: topics,
            category: 'community',
            skillMd: skillMd,
            lastSynced: new Date().toISOString(),
        };

        // Generate Agent Analysis
        const agentAnalysis = await generateAgentAnalysis(skill.name, typeof skill.description === 'string' ? skill.description : skill.description.en, skillMd.bodyPreview || '');
        if (agentAnalysis) {
            skill.agentAnalysis = agentAnalysis;
        }

        skill.category = determineCategory(skill);
        skill.qualityScore = calculateQualityScore(skill);
        skills.push(skill);
    }

    // 2.5 自动发现 GitHub 上新发布的 Skills
    console.log('\n🔎 Auto-discovering new Skills from GitHub...');
    const discoveredSkills = await discoverNewSkillsFromGitHub(processedRepos, lastCacheUpdate, mode === 'full-discovery');

    for (const item of discoveredSkills) {
        const skillMd = parseSkillMd(item.content);
        if (!skillMd || !skillMd.name) continue;

        const skillId = item.skillId || `${item.owner}/${item.repo}/${skillMd.name}`;
        if (processedRepos.has(skillId)) continue;

        // Apply Filter for discovered skills
        if (filters.length > 0) {
            const match = filters.some(f =>
                skillMd.name.toLowerCase().includes(f) ||
                item.repo.toLowerCase().includes(f) ||
                item.owner.toLowerCase().includes(f)
            );
            if (!match) continue;
        }

        // 快速预验证：如果质量分太低，直接跳过不处理元数据
        // 构造一个临时对象进行评分
        const tempSkill: any = {
            id: skillId,
            name: skillMd.name,
            description: skillMd.description || item.description || '',
            owner: item.owner,
            repo: item.repo,
            repoPath: `${item.owner}/${item.repo}`,
            stars: item.stars || 0,
            updatedAt: item.updatedAt || new Date().toISOString(),
            skillMd: skillMd
        };

        const strictScore = calculateQualityScore(tempSkill);

        // 严格模式：新发现的技能如果分数低于 20 (was 30)，直接丢弃
        if (strictScore < 20) {
            // console.log(`Skipping low quality skill: ${skillId} (Score: ${strictScore})`);
            continue;
        }

        processedRepos.add(skillId);

        const rawDesc = skillMd.description || item.description || '';
        const metadata = await processMetadata(skillId, rawDesc, {
            name: skillMd.name,
            topics: item.topics || [],
            bodyPreview: skillMd.bodyPreview
        });

        const skill: SkillCache = {
            id: skillId,
            name: skillMd.name,
            description: metadata.description,
            seo: metadata.seo,
            agentAnalysis: undefined, // Will be populated in update step
            owner: item.owner,
            repo: item.repo,
            repoPath: `${item.owner}/${item.repo}`,
            stars: item.stars || 0,
            forks: item.forks || 0,
            updatedAt: item.fetchedAt || new Date().toISOString(),
            topics: item.topics || [],
            category: 'community',
            skillMd: skillMd,
            lastSynced: new Date().toISOString(),
        };

        skill.category = determineCategory(skill);
        skill.qualityScore = calculateQualityScore(skill);
        skills.push(skill);
        process.stdout.write('+'); // + for newly discovered and added
    }

    if (discoveredSkills.length > 0) {
        console.log(`\n   → Added ${discoveredSkills.length} newly discovered Skills`);
    }

    // 3. 保留并重新优化现有缓存项 (Preserve & Smart Update)
    console.log(`\n📦 Auditing & Optimizing existing cache items (Concurrency: 5)...`);

    // 准备任务列表
    const tasks: SkillCache[] = [];
    let processedCount = 0;

    if (mode === 'update') {
        for (const [id, skill] of existingMap.entries()) {
            if (!processedRepos.has(id)) {
                // Apply Filter for existing items
                if (filters.length > 0) {
                    const match = filters.some(f =>
                        skill.name.toLowerCase().includes(f) ||
                        skill.repo.toLowerCase().includes(f) ||
                        skill.owner.toLowerCase().includes(f)
                    );
                    if (!match) {
                        skills.push(skill); // Preserve without processing
                        continue; // Skip adding to tasks
                    }
                }
                tasks.push(skill);
            }
        }
    } else {
        // In DISCOVER mode, we just keep existing skills without re-processing/verifying
        // unless they are completely missing from our current 'skills' array (which contains new discoveries)
        console.log(`\n⏭️  Skipping deep update of existing skills (Discover Mode)`);
        for (const [id, skill] of existingMap.entries()) {
            if (!processedRepos.has(id)) {
                skills.push(skill); // Just add them back directly
            }
        }
    }

    if (mode === 'update') {
        // Simple p-limit implementation to avoid adding dependencies
        const pLimit = (concurrency: number) => {
            const queue: (() => Promise<void>)[] = [];
            let activeCount = 0;

            const next = () => {
                activeCount--;
                if (queue.length > 0) {
                    const job = queue.shift()!;
                    activeCount++;
                    job().then(next);
                }
            };

            const run = (fn: () => Promise<void>) => new Promise<void>((resolve, reject) => {
                const job = async () => {
                    try {
                        await fn();
                    } catch (e) {
                        reject(e);
                    } finally {
                        resolve();
                    }
                };

                if (activeCount < concurrency) {
                    activeCount++;
                    job().then(next);
                } else {
                    queue.push(job);
                }
            });

            return run;
        };

        // 4 NVIDIA API keys × ~4 concurrent requests per key
        const CONCURRENCY = 15;
        const limit = pLimit(CONCURRENCY);

        console.log(`\n🚀 Processing ${tasks.length} skills with Concurrency=${CONCURRENCY} (4 NVIDIA keys)...`);

        const promises = tasks.map(skill => limit(async () => {
            // No delay needed - 4 NVIDIA keys handle rate limiting via rotation

            const currentDesc = typeof skill.description === 'string' ? skill.description : (skill.description.en || '');

            // 增量翻译: 翻译完整 + 无更新 → 跳过
            if (isTranslationComplete(skill) && !hasSkillUpdated(skill)) {
                skills.push(skill);
                process.stdout.write('s'); // skip (已完整翻译)
            } else {
                const rawDesc = skill.skillMd?.description || currentDesc || '';
                const context = {
                    name: skill.name,
                    topics: skill.topics,
                    bodyPreview: skill.skillMd?.bodyPreview
                };

                // Add random delay to prevent initial burst
                await new Promise(r => setTimeout(r, Math.random() * 2000));

                const metadata = await processMetadata(skill.id, rawDesc, context);
                skill.description = metadata.description;
                skill.seo = metadata.seo;

                // Generate Agent Analysis
                const agentAnalysis = await generateAgentAnalysis(skill.name, currentDesc, context.bodyPreview || '');
                if (agentAnalysis) {
                    skill.agentAnalysis = agentAnalysis;
                }

                skill.lastSynced = new Date().toISOString();

                skills.push(skill);
                processedCount++;
                process.stdout.write('U'); // update (需要翻译)

                // Periodic Save every 50 updates
                if (processedCount % 50 === 0) {
                    console.log(`\n💾 Auto-saving checkpoint (${processedCount} updates)...`);
                    await saveStateOnly(skills);
                }
            }
        }));

        await Promise.all(promises);
    } // End of if (mode === 'update')

    console.log(`\n   → Processed ${tasks.length} existing skills (Optimized: ${processedCount})`);

    await finalizeAndSave(skills);
}

/**
 * Finalize, clean up, and save the cache to file and KV
 */
async function finalizeAndSave(skills: SkillCache[]): Promise<void> {
    console.log(`\n🧹 Running final cleanup & saving...`);
    const beforeCount = skills.length;

    // helper to get desc text
    const getDescText = (s: SkillCache) =>
        typeof s.description === 'string' ? s.description : (s.description.en || '');

    // Map by name to find duplicates
    const nameMap = new Map<string, SkillCache>();

    for (const skill of skills) {
        const desc = getDescText(skill);
        // Explicitly check if it is an official repo
        const isOfficial = OFFICIAL_REPOS.some(or => or.owner === skill.owner && or.repo === skill.repo) || skill.category === 'official';

        // Rule 0: Critical Quality Score (Must be > 20) for non-official
        if (!isOfficial && (skill.qualityScore || 0) < 20) {
            continue;
        }

        // Rule 1: Minimum Description Length (10 chars)
        if (!isOfficial && desc.length < 10) {
            continue;
        }

        // Rule 2: Minimum Stars (1) for non-official
        if (!isOfficial && skill.stars < 1) {
            continue;
        }

        // Rule 3: Deduplication
        if (nameMap.has(skill.name)) {
            const existing = nameMap.get(skill.name)!;
            const existingIsOfficial = OFFICIAL_REPOS.some(or => or.owner === existing.owner && or.repo === existing.repo) || existing.category === 'official';

            // Official always wins
            if (isOfficial && !existingIsOfficial) {
                nameMap.set(skill.name, skill);
                continue;
            }
            if (existingIsOfficial && !isOfficial) {
                continue;
            }

            // If both official or both community, compare Stars
            if (skill.stars > existing.stars) {
                nameMap.set(skill.name, skill);
            }
        } else {
            nameMap.set(skill.name, skill);
        }
    }

    const cleanedSkills = Array.from(nameMap.values()).sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    console.log(`   → Removed ${beforeCount - cleanedSkills.length} low-quality/duplicate skills`);
    console.log(`   → Final count: ${cleanedSkills.length}`);

    // 4. 保存缓存
    const cacheData: CacheData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        totalCount: cleanedSkills.length,
        skills: cleanedSkills,
    };

    const outputDir = path.join(process.cwd(), 'data');
    const outputFile = path.join(outputDir, 'skills-cache.json');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));

    console.log(`\n✅ Cache saved successfully!`);
    console.log(`   📊 Total skills: ${cleanedSkills.length}`);
    console.log(`   📁 Output: ${outputFile}`);

    // ========== Generate Sitemap Data ==========
    const sitemapData = cleanedSkills
        .filter(s => s.owner && s.repo)
        .map(s => ({ owner: s.owner, repo: s.repo, updatedAt: s.updatedAt }));
    const sitemapFile = path.join(outputDir, 'sitemap-skills.json');
    fs.writeFileSync(sitemapFile, JSON.stringify(sitemapData, null, 2));
    console.log(`   🗺️  Sitemap data generated: ${sitemapFile} (${sitemapData.length} items)`);

    // ========== 直接同步到 Cloudflare KV ==========
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5'; // SKILLS_CACHE

    if (CF_API_TOKEN && CF_ACCOUNT_ID) {
        console.log(`\n📤 Syncing to Cloudflare KV...`);
        try {
            const slimmedSkills = cleanedSkills.map(skill => {
                const summary = { ...skill };
                if (summary.skillMd) {
                    const { body, bodyPreview, raw, ...keep } = summary.skillMd as any;
                    summary.skillMd = keep;
                }
                delete (summary as any).readme;
                delete (summary as any).content;
                return summary;
            });

            const kvUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/all-skills`;
            const response = await fetch(kvUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(slimmedSkills),
            });

            if (response.ok) {
                console.log(`   ✅ Successfully synced ${slimmedSkills.length} skills to KV (slimmed)!`);
            } else {
                const error = await response.text();
                console.error(`   ❌ KV sync failed: ${error}`);
            }
        } catch (error) {
            console.error(`   ❌ KV sync error:`, error);
        }
    }
    // ========== 清除本地 miniflare KV 缓存 ==========
    // 确保 dev server 使用最新的 skills-cache.json 而非过期的 miniflare KV 数据
    const miniflareKvDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'kv', KV_NAMESPACE_ID);
    if (fs.existsSync(miniflareKvDir)) {
        try {
            fs.rmSync(miniflareKvDir, { recursive: true, force: true });
            console.log(`   🧹 Cleared local miniflare KV cache (${miniflareKvDir})`);
        } catch (error) {
            console.warn(`   ⚠️ Failed to clear miniflare KV cache:`, error);
        }
    }
}
/**
 * Quick save state (Raw JSON only, no KV sync)
 */
async function saveStateOnly(skills: SkillCache[]): Promise<void> {
    const outputDir = path.join(process.cwd(), 'data');
    const outputFile = path.join(outputDir, 'skills-cache.json');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // IMPORTANT: Merge current session progress with existingMap to avoid losing data
    // existingMap contains the full previous cache items
    const allSkillsMap = new Map<string, SkillCache>();

    // 1. Load from file first if it exists (in case other processes or manual edits happened)
    if (fs.existsSync(outputFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8')) as CacheData;
            if (data.skills) data.skills.forEach(s => allSkillsMap.set(s.id, s));
        } catch (e) { /* ignore */ }
    }

    // 2. Overwrite with current session skills
    skills.forEach(s => allSkillsMap.set(s.id, s));

    const uniqueSkills = Array.from(allSkillsMap.values());

    const cacheData: CacheData = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        totalCount: uniqueSkills.length,
        skills: uniqueSkills,
    };
    fs.writeFileSync(outputFile, JSON.stringify(cacheData, null, 2));
}

// Global reference for SIGINT handler
let globalSkillsRef: SkillCache[] = [];

// 运行
(async () => {
    globalSkillsRef = []; // Initialize
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Received SIGINT (Ctrl+C). Saving current progress...');
        await saveStateOnly(globalSkillsRef);
        console.log('✅ Progress saved. Exiting.');
        process.exit(0);
    });

    await buildCache();
})().catch(console.error);

