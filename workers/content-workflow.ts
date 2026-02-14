/**
 * Cloudflare Workflow: Unified Content Processing
 *
 * 统一处理 Skill 内容：
 * 1. 获取 SKILL.md
 * 2. AI 生成 SEO definition
 * 3. 翻译到所有支持语言
 * 4. 存入 KV 缓存
 */

import {
    WorkflowEntrypoint,
    type WorkflowStep,
    type WorkflowEvent,
} from "cloudflare:workers";
import { isValidAgentSkill } from "./lib/validation";

// ===== Types =====

export interface ContentProcessingParams {
    owner: string;
    repo: string;
    skillPath?: string; // sub-skill 路径，如 "skills/my-skill"
    forceRefresh?: boolean; // 强制重新处理
}

export interface Env {
    SKILLS_CACHE: KVNamespace;
    TRANSLATIONS: KVNamespace;
    AI: Ai;
    NVIDIA_API_KEYS?: string;
    NVIDIA_API_KEY?: string;
    NVIDIA_API_KEYS_2?: string;
    NVIDIA_API_KEYS_3?: string;
}

interface SkillMdContent {
    name: string;
    description: string;
    version?: string;
    tags?: string[];
    body: string;
}

interface ProcessedContent {
    skillMd: SkillMdContent;
    seo: {
        definition: Record<string, string>;
        features: Record<string, string[]>;
    };
    aiQualityScore?: number;
    aiQualityReason?: string;
    faq: Record<string, Array<{ question: string; answer: string }>>; // AI-generated FAQ
    translations: {
        description: Record<string, string>;
        body: Record<string, string>;
    };
    processedAt: string;
    agentAnalysis?: {
        suitability: string | Record<string, string>;
        recommendation: string | Record<string, string>;
        useCases: string[] | Record<string, string[]>;
        limitations: string[] | Record<string, string[]>;
    };
}

// 支持的语言
const SUPPORTED_LOCALES = ["en", "zh", "es", "ja", "ko", "fr", "de", "pt", "ru", "ar"];

// ===== Workflow Definition =====

export class ContentProcessingWorkflow extends WorkflowEntrypoint<Env> {
    private nvidiaKeys: string[] = [];
    private currentKeyIndex = 0;

    async run(event: WorkflowEvent<ContentProcessingParams>, step: WorkflowStep) {
        const { owner, repo, skillPath, forceRefresh } = event.payload;
        const cacheKey = skillPath ? `skill:${owner}/${repo}/${skillPath}` : `skill:${owner}/${repo}`;

        // 初始化 API Keys
        this.initializeKeys();

        // Step 1: 检查是否已有缓存
        if (!forceRefresh) {
            const cached = await step.do("check-cache", async () => {
                const data = await this.env.SKILLS_CACHE.get(cacheKey, "json") as ProcessedContent | null;
                // 7 天内的缓存视为有效
                if (data?.processedAt) {
                    const age = Date.now() - new Date(data.processedAt).getTime();
                    if (age < 7 * 24 * 60 * 60 * 1000) {
                        return data;
                    }
                }
                return null;
            });

            if (cached) {
                return { success: true, cached: true, cacheKey };
            }
        }

        // Step 2: 获取 SKILL.md 内容
        const skillMd = await step.do(
            "fetch-skill-md",
            { retries: { limit: 2, delay: "3 second" }, timeout: "30 seconds" },
            async () => {
                return await this.fetchSkillMd(owner, repo, skillPath);
            }
        );

        if (!skillMd) {
            throw new Error(`Failed to fetch SKILL.md for ${cacheKey}`);
        }

        // Step 3: 验证内容质量 (防止垃圾 Skill 进入缓存)
        const validation = this.validateSkill(skillMd, owner, repo);
        if (!validation.valid) {
            console.warn(`Skipping invalid skill ${cacheKey}: ${validation.reason}`);
            // 可选：存入一个标记，表明该 repo 无效，避免重复抓取
            return { success: false, reason: validation.reason, cacheKey };
        }

        // Step 4: 生成 SEO 内容 (如果 description 存在)
        const seoContent = await step.do(
            "generate-seo",
            { retries: { limit: 2, delay: "5 second" }, timeout: "2 minutes" },
            async () => {
                return await this.generateSeoContent(skillMd.description, skillMd.name);
            }
        );

        // Step 5: 翻译所有内容
        const translations = await step.do(
            "translate-all",
            { retries: { limit: 2, delay: "10 second" }, timeout: "5 minutes" },
            async () => {
                return await this.translateAllContent(skillMd, seoContent);
            }
        );

        // Step 6: Generate AI FAQ
        const faq = await step.do(
            "generate-faq",
            { retries: { limit: 2, delay: "5 second" }, timeout: "3 minutes" },
            async () => {
                return await this.generateFAQ(skillMd, seoContent.definition);
            }
        );

        // Step 7: Generate Agent Analysis (New Phase 2)
        const agentAnalysisRaw = await step.do(
            "generate-agent-analysis",
            { retries: { limit: 2, delay: "5 second" }, timeout: "3 minutes" },
            async () => {
                return await this.generateAgentAnalysis(skillMd, seoContent.definition);
            }
        );

        // Step 8: Translate Agent Analysis to all languages
        const agentAnalysis = await step.do(
            "translate-agent-analysis",
            { retries: { limit: 1, delay: "5 second" }, timeout: "5 minutes" },
            async () => {
                return await this.translateAgentAnalysis(agentAnalysisRaw);
            }
        );

        // Step 9: 组装并存入 KV
        const processedContent: ProcessedContent = {
            skillMd,
            seo: translations.seo,
            aiQualityScore: seoContent.qualityScore,
            aiQualityReason: seoContent.qualityReason,
            faq,
            agentAnalysis,
            translations: {
                description: translations.description,
                body: translations.body,
            },
            processedAt: new Date().toISOString(),
        };

        await step.do("save-to-kv", async () => {
            await this.env.SKILLS_CACHE.put(cacheKey, JSON.stringify(processedContent), {
                expirationTtl: 60 * 60 * 24 * 30, // 30 days
            });
        });

        return { success: true, cached: false, cacheKey, locales: SUPPORTED_LOCALES };
    }

    // ===== Helper Methods =====

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
    }

    private getNextKey(): string {
        if (this.nvidiaKeys.length === 0) {
            throw new Error("No NVIDIA API Keys configured");
        }
        const key = this.nvidiaKeys[this.currentKeyIndex];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.nvidiaKeys.length;
        return key;
    }

    /**
     * 从 GitHub 获取并解析 SKILL.md
     * 尝试多种路径模式以处理不同的仓库结构
     */
    private async fetchSkillMd(
        owner: string,
        repo: string,
        skillPath?: string
    ): Promise<SkillMdContent | null> {
        // 构建多个可能的路径尝试
        const pathsToTry: string[] = [];

        if (skillPath) {
            // 1. 直接路径: skillPath/SKILL.md
            pathsToTry.push(`${skillPath}/SKILL.md`);
            // 2. 带 skills/ 前缀: skills/skillPath/SKILL.md (常见于官方 skills 仓库)
            if (!skillPath.startsWith('skills/')) {
                pathsToTry.push(`skills/${skillPath}/SKILL.md`);
                pathsToTry.push(`.codex/skills/${skillPath}/SKILL.md`);
                pathsToTry.push(`.claude/skills/${skillPath}/SKILL.md`);
            }
        } else {
            // 无 skillPath 时尝试根目录及常见位置
            pathsToTry.push("SKILL.md");
            pathsToTry.push(".codex/skills/SKILL.md");
            pathsToTry.push(".claude/skills/SKILL.md");
            pathsToTry.push(".agent/skills/SKILL.md");
            pathsToTry.push(`skills/${repo}/SKILL.md`);
            pathsToTry.push(`.codex/skills/${repo}/SKILL.md`);
            pathsToTry.push(`.claude/skills/${repo}/SKILL.md`);
        }

        for (const path of pathsToTry) {
            // 尝试 main 分支
            const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
            const mainResponse = await fetch(mainUrl);
            if (mainResponse.ok) {
                return this.parseSkillMd(await mainResponse.text());
            }

            // 尝试 master 分支
            const masterUrl = mainUrl.replace("/main/", "/master/");
            const masterResponse = await fetch(masterUrl);
            if (masterResponse.ok) {
                return this.parseSkillMd(await masterResponse.text());
            }
        }

        return null;
    }


    /**
     * 解析 SKILL.md frontmatter
     */
    private parseSkillMd(content: string): SkillMdContent {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

        if (!frontmatterMatch) {
            return {
                name: "Unknown",
                description: "",
                body: content,
            };
        }

        const [, frontmatter, body] = frontmatterMatch;
        const metadata: Record<string, string | string[]> = {};

        // 简单的 YAML 解析
        for (const line of frontmatter.split("\n")) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                // 处理数组格式
                if (value.startsWith("[") && value.endsWith("]")) {
                    metadata[key] = value
                        .slice(1, -1)
                        .split(",")
                        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
                } else {
                    metadata[key] = value.replace(/^["']|["']$/g, "");
                }
            }
        }

        return {
            name: (metadata.name as string) || "Unknown",
            description: (metadata.description as string) || "",
            version: metadata.version as string,
            tags: metadata.tags as string[],
            body: body.trim(),
        };
    }

    /**
     * 验证 Skill 内容质量
     * 使用共享验证模块，保持逻辑一致性
     */
    private validateSkill(skill: SkillMdContent, owner: string, repo: string): { valid: boolean; reason: string } {
        return isValidAgentSkill({
            name: skill.name,
            owner,
            repo,
            body: skill.body,
            description: skill.description,
            topics: skill.tags
        });
    }

    /**
     * 使用 AI 生成 SEO 内容
     */
    private async generateSeoContent(
        description: string,
        name: string
    ): Promise<{ definition: string; features: string[]; qualityScore?: number; qualityReason?: string }> {
        if (!description || description.length < 10) {
            return { definition: description || "", features: [] };
        }

        const prompt = `You are an SEO expert. Based on this AI Agent skill:

Name: ${name}
Description: ${description}

Generate:
1. An SEO-friendly definition (2-3 sentences, explaining what it does and who it's for)
2. 3-5 key features as short phrases
3. A Quality Score (0-100) based on:
   - Clarity of instructions
   - Context provided
   - Use of examples/few-shot prompting
   - Definition of constraints
4. A short reason for the score (1 sentence)

Respond in JSON format:
{"definition": "...", "features": ["feature1", "feature2"], "qualityScore": 85, "qualityReason": "Good context but lacks examples."}

Only output the JSON, nothing else.`;

        try {
            const result = await this.callAI(prompt);
            const parsed = JSON.parse(result);
            return {
                definition: parsed.definition || description,
                features: parsed.features || [],
                qualityScore: typeof parsed.qualityScore === 'number' ? parsed.qualityScore : undefined,
                qualityReason: parsed.qualityReason || undefined,
            };
        } catch {
            // 如果 AI 失败，使用原始描述
            return { definition: description, features: [] };
        }
    }

    /**
     * 使用 AI 生成个性化 FAQ
     */
    private async generateFAQ(
        skillMd: SkillMdContent,
        seoDefinition: string
    ): Promise<Record<string, Array<{ question: string; answer: string }>>> {
        const result: Record<string, Array<{ question: string; answer: string }>> = {};

        // 生成英文 FAQ
        const enFaq = await this.generateFAQForLang(skillMd, seoDefinition, "en");
        result["en"] = enFaq;

        // 翻译 FAQ 到其他语言
        for (const locale of SUPPORTED_LOCALES) {
            if (locale === "en") continue;
            try {
                result[locale] = await this.translateFAQ(enFaq, locale);
            } catch (error) {
                console.error(`Failed to translate FAQ to ${locale}:`, error);
                result[locale] = enFaq; // fallback to English
            }
        }

        return result;
    }

    /**
     * 为特定语言生成 FAQ
     */
    private async generateFAQForLang(
        skillMd: SkillMdContent,
        seoDefinition: string,
        _lang: string
    ): Promise<Array<{ question: string; answer: string }>> {
        const prompt = `You are an SEO expert creating FAQ content for an AI Agent Skill.

Skill Name: ${skillMd.name}
Description: ${skillMd.description || seoDefinition}
Tags: ${skillMd.tags?.join(", ") || "N/A"}

Content Preview:
${skillMd.body.slice(0, 1500)}

Generate 4-5 unique, helpful FAQ questions and answers about this skill. Focus on:
1. What the skill does and its main purpose
2. Key features or capabilities
3. Who should use it (target audience)
4. How it works or common use cases
5. Any prerequisites or compatibility notes

Return ONLY valid JSON array:
[
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."}
]

Make answers detailed but concise (2-3 sentences each). Do not include generic installation questions.`;

        try {
            const result = await this.callAI(prompt);
            // 提取 JSON 部分
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
     * 翻译 FAQ 到目标语言
     */
    private async translateFAQ(
        faq: Array<{ question: string; answer: string }>,
        targetLang: string
    ): Promise<Array<{ question: string; answer: string }>> {
        if (faq.length === 0) return [];

        const langName = this.getLangName(targetLang);
        const prompt = `Translate this FAQ to ${langName}. Return ONLY the translated JSON array.

${JSON.stringify(faq, null, 2)}`;

        try {
            const result = await this.callAI(prompt);
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return faq;
        } catch {
            return faq;
        }
    }

    /**
     * Phase 2: Generate Agent Analysis
     */
    private async generateAgentAnalysis(
        skillMd: SkillMdContent,
        seoDefinition: string
    ): Promise<{ suitability: string; recommendation: string; useCases: string[]; limitations: string[] } | undefined> {
        const prompt = `You are an AI Agent Ecosystem Expert. Analyze this skill for compatibility with modern AI Agents (e.g., Cursor, Windsurf, Claude Code, AutoGPT, LangChain).

Skill: ${skillMd.name}
Description: ${skillMd.description || seoDefinition}
Content Preview:
${skillMd.body.slice(0, 1500)}

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
            const result = await this.callAI(prompt);
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
        } catch (e) {
            console.error("Failed to generate agent analysis", e);
        }
        return undefined;
    }

    /**
     * Translate Agent Analysis to all supported languages
     * Converts single-language agentAnalysis to multi-language Records
     */
    private async translateAgentAnalysis(
        raw: { suitability: string; recommendation: string; useCases: string[]; limitations: string[] } | undefined
    ): Promise<ProcessedContent['agentAnalysis'] | undefined> {
        if (!raw) return undefined;

        const result: ProcessedContent['agentAnalysis'] = {
            suitability: { en: raw.suitability } as Record<string, string>,
            recommendation: { en: raw.recommendation } as Record<string, string>,
            useCases: { en: raw.useCases } as Record<string, string[]>,
            limitations: { en: raw.limitations } as Record<string, string[]>,
        };

        for (const locale of SUPPORTED_LOCALES) {
            if (locale === "en") continue;

            try {

                // Translate suitability (short text)
                if (raw.suitability) {
                    (result.suitability as Record<string, string>)[locale] = await this.translateText(
                        raw.suitability, locale, "text"
                    );
                }

                // Translate recommendation (paragraph)
                if (raw.recommendation) {
                    (result.recommendation as Record<string, string>)[locale] = await this.translateText(
                        raw.recommendation, locale, "text"
                    );
                }

                // Translate useCases (array of short phrases)
                if (raw.useCases.length > 0) {
                    const useCasesText = raw.useCases.join("\n");
                    const translated = await this.translateText(useCasesText, locale, "text");
                    (result.useCases as Record<string, string[]>)[locale] = translated.split("\n").filter(Boolean);
                }

                // Translate limitations (array of short phrases)
                if (raw.limitations.length > 0) {
                    const limitationsText = raw.limitations.join("\n");
                    const translated = await this.translateText(limitationsText, locale, "text");
                    (result.limitations as Record<string, string[]>)[locale] = translated.split("\n").filter(Boolean);
                }
            } catch (error) {
                console.error(`Failed to translate agent analysis to ${locale}:`, error);
                // Fallback: skip this locale, en is already set
            }
        }

        return result;
    }

    /**
     * 翻译所有内容到所有语言
     */
    private async translateAllContent(

        skillMd: SkillMdContent,
        seoContent: { definition: string; features: string[] }
    ): Promise<{
        seo: { definition: Record<string, string>; features: Record<string, string[]> };
        description: Record<string, string>;
        body: Record<string, string>;
    }> {
        const result = {
            seo: {
                definition: { en: seoContent.definition } as Record<string, string>,
                features: { en: seoContent.features } as Record<string, string[]>,
            },
            description: { en: skillMd.description } as Record<string, string>,
            body: { en: skillMd.body } as Record<string, string>,
        };

        // 翻译到其他语言
        for (const locale of SUPPORTED_LOCALES) {
            if (locale === "en") continue;

            try {
                // 翻译 SEO definition
                if (seoContent.definition) {
                    result.seo.definition[locale] = await this.translateText(
                        seoContent.definition,
                        locale,
                        "text"
                    );
                }

                // 翻译 features
                if (seoContent.features.length > 0) {
                    const featuresText = seoContent.features.join("\n");
                    const translatedFeatures = await this.translateText(featuresText, locale, "text");
                    result.seo.features[locale] = translatedFeatures.split("\n").filter(Boolean);
                }

                // 翻译 description
                if (skillMd.description) {
                    result.description[locale] = await this.translateText(
                        skillMd.description,
                        locale,
                        "text"
                    );
                }

                // 翻译 body (SKILL.md 全文)
                if (skillMd.body) {
                    result.body[locale] = await this.translateText(skillMd.body, locale, "markdown");
                }
            } catch (error) {
                console.error(`Failed to translate to ${locale}:`, error);
                // 继续处理其他语言
            }
        }

        return result;
    }

    /**
     * 调用 AI 翻译
     */
    private async translateText(
        text: string,
        targetLang: string,
        type: "text" | "markdown"
    ): Promise<string> {
        const langName = this.getLangName(targetLang);
        const prompt =
            type === "markdown"
                ? `Translate the following Markdown content into ${langName}. Keep ALL Markdown formatting intact. Do NOT translate code blocks. Output ONLY the translated Markdown.\n\n${text}`
                : `Translate the following text into ${langName}. Output ONLY the translated text.\n\n${text}`;

        return await this.callAI(prompt);
    }

    /**
     * 调用 AI (NVIDIA 优先，Workers AI 备用)
     */
    private async callAI(prompt: string): Promise<string> {
        // 尝试 NVIDIA
        if (this.nvidiaKeys.length > 0) {
            try {
                const apiKey = this.getNextKey();
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
                            messages: [{ role: "user", content: prompt }],
                            temperature: 0.2,
                            max_tokens: 4096,
                        }),
                    }
                );

                if (response.ok) {
                    const data = (await response.json()) as {
                        choices: Array<{ message: { content: string } }>;
                    };
                    return data.choices[0]?.message?.content || "";
                }
            } catch {
                console.log("[NVIDIA] Failed, falling back to Workers AI");
            }
        }

        // 备用 Workers AI
        const result = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [{ role: "user", content: prompt }],
            max_tokens: 4096,
        });

        return result.response || "";
    }

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

// ===== Default Export =====

export default {
    async fetch(): Promise<Response> {
        return new Response(
            "Content Processing Workflow - use wrangler workflows trigger to invoke",
            { status: 200 }
        );
    },
};
