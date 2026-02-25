// 官方 Agent Skills 仓库配置
// Agent Skills 必须包含 SKILL.md 文件
// 只保留已验证存在且有 Skills 的仓库

/**
 * 精选技能的 qualityScore 阈值
 * 满分 100，评分维度：
 *   - 结构有效基础分 10 分
 *   - 标准 header（usage/install 等）15 分
 *   - 功能关键词密度 最高 15 分
 *   - 代码示例 10 分
 *   - 标准路径（.claude/ 等）10 分
 *   - 元数据完整度（version/tags/description）最高 15 分
 *   - 官方仓库加 30 分，近期更新加 5 分
 *   - Stars > 100 加 10 分，> 20 加 5 分
 *
 * 阈值 40 = 需有：header + 关键词 + 代码示例 + 一定的元数据完整度
 * 不同组成可达 40：
 *   典型通过：基础 10 + header 15 + 2 关键词 6 + 代码 10 = 41 ✅
 *   典型不通过：基础 10 + 1 关键词 3 + 无代码 = 13 ❌
 */
export const FEATURED_SCORE_THRESHOLD = 40;

export const OFFICIAL_REPOS: Record<string, {
    owner: string;
    repo: string;
    skillsPath: string;
    name: string;
    description: { zh: string; en: string;[key: string]: string };
    logo: string;
    color: string;
    stars: number;
    verified: boolean;
    type: 'official' | 'featured';
    category?: string;
    subSkills?: Array<{
        owner: string;
        repo: string;
        name: string;
        description: { zh: string; en: string;[key: string]: string };
        logo?: string;
        color?: string;
        skillPath?: string;
    }>;
}> = {
    // === 已验证含 SKILL.md 的官方 Skills ===
    anthropic: {
        owner: "anthropics",
        repo: "skills",
        skillsPath: "skills",
        name: "Anthropic",
        description: {
            zh: "Claude 官方 Agent Skills，由 Anthropic 团队维护",
            en: "Official Claude Agent Skills, maintained by Anthropic"
        },
        logo: "🧠",
        color: "from-amber-500/20 to-orange-500/10",
        stars: 52267,
        verified: true,
        type: 'official'
    },
    vercel: {
        owner: "vercel-labs",
        repo: "skills",
        skillsPath: "skills",
        name: "Vercel",
        description: {
            zh: "Vercel 官方 Skills，包含 find-skills 等",
            en: "Official Vercel Skills, including find-skills"
        },
        logo: "▲",
        color: "from-primary/20 to-primary/10",
        stars: 1200,
        verified: true,
        type: 'official',
        category: 'developer'
    },
    superpowers: {
        owner: "obra",
        repo: "superpowers",
        skillsPath: "skills",
        name: "Superpowers",
        description: {
            zh: "Agentic Skills 框架与软件开发方法论",
            en: "Agentic Skills framework and software development methodology"
        },
        logo: "⚡",
        color: "from-yellow-500/20 to-orange-500/10",
        stars: 35484,
        verified: true,
        type: 'featured',
        category: 'productivity'
    },
    "everything-claude-code": {
        owner: "affaan-m",
        repo: "everything-claude-code",
        skillsPath: "skills",
        name: "Everything Claude Code",
        description: {
            zh: "完整的 Claude Code 配置集合 - agents, skills, hooks, commands",
            en: "Complete Claude Code configurations - agents, skills, hooks, commands"
        },
        logo: "🎯",
        color: "from-purple-500/20 to-indigo-500/10",
        stars: 26367,
        verified: true,
        type: 'featured',
        category: 'developer'
    },
    "awesome-claude-skills": {
        owner: "ComposioHQ",
        repo: "awesome-claude-skills",
        skillsPath: "",
        name: "Awesome Claude Skills",
        description: {
            zh: "精选 Claude Skills、资源和工具列表",
            en: "Curated Claude Skills, resources, and tools collection"
        },
        logo: "✨",
        color: "from-pink-500/20 to-rose-500/10",
        stars: 25427,
        verified: true,
        type: 'featured',
        category: 'ai'
    },
    remotion: {
        owner: "remotion-dev",
        repo: "skills",
        skillsPath: "skills",
        name: "Remotion",
        description: {
            zh: "使用 React 以编程方式创建视频",
            en: "Make videos programmatically with React"
        },
        logo: "🎬",
        color: "from-rose-500/20 to-pink-500/10",
        stars: 1200,
        verified: true,
        type: 'official',
        category: 'design'
    },
    callstack: {
        owner: "callstackincubator",
        repo: "agent-skills",
        skillsPath: "skills",
        name: "Callstack",
        description: {
            zh: "React Native 开发最佳实践",
            en: "React Native development best practices"
        },
        logo: "📲",
        color: "from-cyan-500/20 to-blue-500/10",
        stars: 850,
        verified: true,
        type: 'featured',
        category: 'developer'
    },
    sentry: {
        owner: "getsentry",
        repo: "skills",
        skillsPath: "plugins/sentry-skills/skills",
        name: "Sentry",
        description: {
            zh: "Sentry 官方 Skills，包含代码审查、Bug 查找、性能优化等",
            en: "Official Sentry Skills, including code review, bug finding, performance optimization, etc."
        },
        logo: "🛡️",
        color: "from-violet-500/20 to-fuchsia-500/10",
        stars: 1000,
        verified: true,
        type: 'official',
        category: 'developer'
    },
    expo: {
        owner: "expo",
        repo: "skills",
        skillsPath: "plugins/expo-app-design/skills",
        name: "Expo (App Design)",
        description: {
            zh: "Expo 官方应用设计 Skills，包含 UI, Navigation, Data Fetching 等",
            en: "Official Expo App Design Skills, including UI, Navigation, Data Fetching, etc."
        },
        logo: "📱",
        color: "from-gray-500/20 to-slate-500/10",
        stars: 1000,
        verified: true,
        type: 'official',
        category: 'design'
    },
    stripe: {
        owner: "stripe",
        repo: "ai",
        skillsPath: "skills",
        name: "Stripe",
        description: {
            zh: "Stripe 官方 AI Skills，包含集成最佳实践和升级工具",
            en: "Official Stripe AI Skills, including integration best practices and upgrade tools"
        },
        logo: "💳",
        color: "from-indigo-500/20 to-purple-500/10",
        stars: 1000,
        verified: true,
        type: 'official',
        category: 'finance'
    },
    huggingface: {
        owner: "huggingface",
        repo: "skills",
        skillsPath: "skills",
        name: "Hugging Face",
        description: {
            zh: "Hugging Face 官方 Skills，包含 CLI, Dataset, Model Trainer 等",
            en: "Official Hugging Face Skills, including CLI, Dataset, Model Trainer, etc."
        },
        logo: "🤗",
        color: "from-yellow-500/20 to-orange-500/10",
        stars: 1000,
        verified: true,
        type: 'official',
        category: 'ai'
    },
    google: {
        owner: "google-labs-code",
        repo: "stitch-skills",
        skillsPath: "skills",
        name: "Google Labs",
        description: {
            zh: "Google Labs 官方 Stitch Skills，包含 Prompt 增强等实用工具",
            en: "Official Google Labs Stitch Skills, including prompt enhancement tools"
        },
        logo: "🧪",
        color: "from-blue-500/20 to-yellow-500/10",
        stars: 1000,
        verified: true,
        type: 'official',
        category: 'developer'
    },
    supabase: {
        owner: "supabase",
        repo: "agent-skills",
        skillsPath: "skills",
        name: "Supabase",
        description: {
            zh: "Supabase 官方 Agent Skills，包含 Postgres 最佳实践等",
            en: "Official Supabase Agent Skills, including Postgres best practices"
        },
        logo: "🗄️",
        color: "from-emerald-500/20 to-green-500/10",
        stars: 1200,
        verified: true,
        type: 'official',
        category: 'data'
    },
    neon: {
        owner: "neondatabase",
        repo: "mcp-server-neon",
        skillsPath: "README.md",
        name: "Neon (Postgres)",
        description: {
            zh: "Neon 官方 MCP Server，通过自然语言管理 Postgres 数据库",
            en: "Official Neon MCP Server for managing Postgres with natural language"
        },
        logo: "🐘",
        color: "from-green-400/20 to-emerald-500/10",
        stars: 500,
        verified: true,
        type: 'official',
        category: 'data'
    },
    fastapi: {
        owner: "tadata-org",
        repo: "fastapi_mcp",
        skillsPath: "README.md",
        name: "FastAPI",
        description: {
            zh: "FastAPI MCP 集成，将 FastAPI 应用转换为 MCP 服务器",
            en: "FastAPI MCP integration to turn FastAPI apps into MCP servers"
        },
        logo: "⚡",
        color: "from-teal-500/20 to-green-500/10",
        stars: 200,
        verified: true,
        type: 'official',
        category: 'developer'
    },
    cloudflare: {
        owner: "cloudflare",
        repo: "skills",
        skillsPath: "skills",
        name: "Cloudflare",
        description: {
            zh: "Cloudflare 官方 Agent Skills，构建智能应用",
            en: "Official Cloudflare Agent Skills for building intelligent apps"
        },
        logo: "☁️",
        color: "from-orange-500/20 to-amber-500/10",
        stars: 1500,
        verified: true,
        type: 'official',
        category: 'developer'
    },
    dify: {
        owner: "langgenius",
        repo: "dify",
        skillsPath: ".agents/skills",
        name: "Dify",
        description: {
            zh: "Dify.AI 官方 Agent Skills，LLM 应用开发",
            en: "Official Dify.AI Agent Skills for LLM App Development"
        },
        logo: "🤖",
        color: "from-blue-500/20 to-sky-500/10",
        stars: 45000,
        verified: true,
        type: 'featured',
        category: 'ai',
        subSkills: [
            {
                owner: "langgenius",
                repo: "dify",
                name: "component-refactoring",
                description: {
                    zh: "重构组件以提高可维护性和性能",
                    en: "Refactor components for better maintainability and performance"
                },
                skillPath: ".agents/skills/component-refactoring"
            },
            {
                owner: "langgenius",
                repo: "dify",
                name: "frontend-code-review",
                description: {
                    zh: "自动审核前端代码，确保最佳实践",
                    en: "Automated frontend code review for best practices"
                },
                skillPath: ".agents/skills/frontend-code-review"
            },
            {
                owner: "langgenius",
                repo: "dify",
                name: "frontend-testing",
                description: {
                    zh: "前端自动化测试与用例生成",
                    en: "Frontend automated testing and test case generation"
                },
                skillPath: ".agents/skills/frontend-testing"
            },
            {
                owner: "langgenius",
                repo: "dify",
                name: "orpc-contract-first",
                description: {
                    zh: "契约优先的 oRPC 开发流程",
                    en: "Contract-first oRPC development workflow"
                },
                skillPath: ".agents/skills/orpc-contract-first"
            }
        ]
    }
};
