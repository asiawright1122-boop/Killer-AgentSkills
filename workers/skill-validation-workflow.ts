/**
 * Cloudflare Workflow: Skill Validation
 *
 * 接收 GitHub Webhook 后验证 Skill 并更新缓存：
 * - 获取 SKILL.md 内容
 * - 解析 frontmatter
 * - 更新 KV 缓存
 * - 触发多语言翻译
 */

import {
    WorkflowEntrypoint,
    WorkflowStep,
} from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";

// ===== Types =====

export interface SkillValidationParams {
    owner: string;
    repo: string;
    skillPath?: string; // 子目录路径，用于 monorepo
}

export interface Env {
    SKILLS_CACHE: KVNamespace;
    TRANSLATION_WORKFLOW: {
        create(options: { params: unknown }): Promise<unknown>;
    };
}

interface ParsedSkill {
    name: string;
    description: string;
    version?: string;
    author?: string;
    tags?: string[];
}

interface RepoInfo {
    stars: number;
    description: string;
    topics: string[];
}

// ===== Workflow Definition =====

export class SkillValidationWorkflow extends WorkflowEntrypoint<Env> {
    async run(event: WorkflowEvent<SkillValidationParams>, step: WorkflowStep) {
        const { owner, repo, skillPath = "" } = event.payload;
        const repoPath = `${owner}/${repo}${skillPath ? `/${skillPath}` : ""}`;

        // Step 1: 获取 SKILL.md
        const skillMd = await step.do(
            "fetch-skill-md",
            {
                retries: { limit: 2, delay: "5 second" },
                timeout: "30 seconds",
            },
            async () => {
                const branch = "main";
                const path = skillPath ? `${skillPath}/SKILL.md` : "SKILL.md";
                const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

                const response = await fetch(url);
                if (!response.ok) {
                    // 尝试 master 分支
                    const masterUrl = url.replace("/main/", "/master/");
                    const masterResponse = await fetch(masterUrl);
                    if (!masterResponse.ok) {
                        throw new Error(`Failed to fetch SKILL.md: ${response.status}`);
                    }
                    return masterResponse.text();
                }
                return response.text();
            }
        );

        // Step 2: 解析 SKILL.md
        const parsed: ParsedSkill = await step.do("parse-frontmatter", async () => {
            return this.parseSkillMd(skillMd as string);
        });

        // Step 3: 获取仓库信息 (stars, description, etc.)
        const repoInfo: RepoInfo | null = await step.do(
            "fetch-repo-info",
            {
                retries: { limit: 2, delay: "3 second" },
            },
            async () => {
                const url = `https://api.github.com/repos/${owner}/${repo}`;
                const response = await fetch(url, {
                    headers: {
                        Accept: "application/vnd.github.v3+json",
                        "User-Agent": "Killer-Skills-Workflow",
                    },
                });

                if (!response.ok) {
                    console.warn(`Failed to fetch repo info: ${response.status}`);
                    return null;
                }

                const data = (await response.json()) as {
                    stargazers_count?: number;
                    description?: string;
                    topics?: string[];
                };

                return {
                    stars: data.stargazers_count || 0,
                    description: data.description || "",
                    topics: data.topics || [],
                };
            }
        );

        // Step 4: 更新 KV 缓存
        await step.do("update-cache", async () => {
            const skillData = {
                repoPath,
                owner,
                repo,
                skillPath: skillPath || null,
                name: parsed.name,
                description: parsed.description,
                version: parsed.version,
                author: parsed.author,
                tags: parsed.tags,
                stars: (repoInfo as RepoInfo | null)?.stars || 0,
                repoDescription: (repoInfo as RepoInfo | null)?.description || "",
                topics: (repoInfo as RepoInfo | null)?.topics || [],
                updatedAt: new Date().toISOString(),
            };

            // 单独存储该 skill
            await this.env.SKILLS_CACHE.put(
                `skill:${repoPath}`,
                JSON.stringify(skillData),
                { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
            );
        });

        // Step 5: 触发多语言翻译 (可选)
        if (parsed.description) {
            await step.do("trigger-translations", async () => {
                const languages = ["zh", "es", "ja", "ko", "fr", "de", "pt", "ru", "ar"];

                for (const lang of languages) {
                    try {
                        await this.env.TRANSLATION_WORKFLOW.create({
                            params: {
                                text: parsed.description,
                                targetLang: lang,
                                type: "text",
                                cacheKey: `skill:${repoPath}:desc:${lang}`,
                            },
                        });
                    } catch (e) {
                        console.warn(`Failed to trigger translation for ${lang}:`, e);
                    }
                }
            });
        }

        return {
            success: true,
            repoPath,
            name: parsed.name,
        };
    }

    /**
     * 解析 SKILL.md frontmatter
     */
    private parseSkillMd(content: string): ParsedSkill {
        const result: ParsedSkill = {
            name: "",
            description: "",
        };

        // 匹配 YAML frontmatter
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            return result;
        }

        const frontmatter = frontmatterMatch[1];

        // 解析各字段
        const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m);
        if (nameMatch) result.name = nameMatch[1].trim();

        const descMatch = frontmatter.match(
            /^description:\s*["']?(.+?)["']?\s*$/m
        );
        if (descMatch) result.description = descMatch[1].trim();

        const versionMatch = frontmatter.match(
            /^version:\s*["']?(.+?)["']?\s*$/m
        );
        if (versionMatch) result.version = versionMatch[1].trim();

        const authorMatch = frontmatter.match(/^author:\s*["']?(.+?)["']?\s*$/m);
        if (authorMatch) result.author = authorMatch[1].trim();

        // 解析 tags (可能是数组格式)
        const tagsMatch = frontmatter.match(/^tags:\s*\[([^\]]+)\]/m);
        if (tagsMatch) {
            result.tags = tagsMatch[1]
                .split(",")
                .map((t) => t.trim().replace(/["']/g, ""))
                .filter(Boolean);
        }

        return result;
    }
}

// ===== Default Export for Wrangler =====

export default {
    async fetch(): Promise<Response> {
        return new Response(
            "Skill Validation Workflow - use wrangler workflows trigger to invoke",
            { status: 200 }
        );
    },
};
