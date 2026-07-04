// Hand-authored user-facing copy for authority surfaces, keyed by surface id.
// Generator (scripts/sync-authority-surface-public-data.ts) merges this with
// structural fields from data/authority-surfaces.json. The generator hard-fails
// if a manifest surface is missing here so new surfaces must be added here first.
// DO NOT regenerate this file.
export const authoritySurfacePublicCopy: Record<
  string,
  {
    title: { en: string; zh: string };
    description: { en: string; zh: string };
  }
> = {
  'home-root': {
    title: { en: 'Killer-Skills Homepage', zh: '首页总入口' },
    description: {
      en: 'Start with curated collections, official tools, solution pages, and installation guidance.',
      zh: '从精选合集、官方工具、场景方案和安装文档开始。',
    },
  },
  'collections-hub': {
    title: { en: 'Skill Collections', zh: 'Collections 总入口' },
    description: {
      en: 'Browse curated collections for trusted tools, workflows, and clear setup paths.',
      zh: '浏览精选合集，快速找到可信工具、工作流组合和清晰安装路径。',
    },
  },
  'collection-official-trusted-tools': {
    title: { en: 'Official AI Skills & Trusted Tools', zh: '官方 AI Skills 与可信工具' },
    description: {
      en: 'Start with official projects and established ecosystems before exploring broader community tools.',
      zh: '先查看官方项目和成熟生态，再继续探索更广泛的社区工具。',
    },
  },
  'collection-agent-workflows': {
    title: { en: 'Agent Workflow Building Tools', zh: 'Agent 工作流构建工具' },
    description: {
      en: 'A curated collection for building multi-step agent workflows with clearer tool selection and execution paths.',
      zh: '面向多步 Agent 工作流的精选合集，帮助你更快选择合适工具并进入执行路径。',
    },
  },
  'collection-claude-code': {
    title: { en: 'Top Claude Code Skills', zh: '顶级 Claude Code Skills' },
    description: {
      en: 'A curated Claude Code collection for teams exploring installable tools, workflow helpers, and day-to-day developer tasks.',
      zh: '面向 Claude Code 团队的精选合集，适合探索可安装工具、工作流辅助能力与日常开发任务。',
    },
  },
  'collection-cursor': {
    title: { en: 'Cursor-Compatible Skills', zh: 'Cursor 兼容 Skills' },
    description: {
      en: 'A curated Cursor collection for editor-specific workflows with clear setup paths.',
      zh: '这是面向 Cursor 工作流的精选合集，适合按具体需求查找工具和安装路径。',
    },
  },
  'collection-windsurf': {
    title: { en: 'Top Windsurf Skills', zh: '顶级 Windsurf Skills' },
    description: {
      en: 'A Windsurf-focused collection for coding speed, rules sync, and team collaboration.',
      zh: '这是面向 Windsurf 的精选合集，聚焦编码提速、规则同步和团队协作。',
    },
  },
  'collection-gemini': {
    title: { en: 'Gemini Workflow Tools to Install First', zh: '优先安装的 Gemini 工作流工具' },
    description: {
      en: 'A Gemini-specific collection for coding support, rules sync, and installable workflow tools.',
      zh: '这是 Gemini 场景下的精选合集，聚焦编码支持、规则同步和可安装工作流工具。',
    },
  },
  'collection-opencode': {
    title: { en: 'OpenCode Workflow Tools to Install First', zh: '优先安装的 OpenCode 工作流工具' },
    description: {
      en: 'A focused OpenCode collection that shortens companion-tool selection before installation and team adoption.',
      zh: '这是聚焦 OpenCode 的精选合集，帮助团队在安装前更快筛选配套工具。',
    },
  },
  'collection-nextjs': {
    title: { en: 'Next.js Workflow Tools to Install First', zh: '优先安装的 Next.js 工作流工具' },
    description: {
      en: 'A full-stack workflow collection for Next.js teams that want faster setup and team adoption.',
      zh: '这是面向 Next.js 团队的全栈工作流合集，帮助你更快完成安装并进入实际使用。',
    },
  },
  'collection-python': {
    title: { en: 'Python Workflow Tools to Install First', zh: '优先安装的 Python 工作流工具' },
    description: {
      en: 'A Python engineering collection built for teams choosing installable workflow helpers instead of browsing raw packages.',
      zh: '这是面向 Python 工程团队的精选合集，适合选择可安装的工作流工具，而不是继续浏览原始包列表。',
    },
  },
  'collection-react': {
    title: { en: 'React Workflow Tools to Install First', zh: '优先安装的 React 工作流工具' },
    description: {
      en: 'A UI-focused React collection for teams comparing component, review, and interface workflow tools.',
      zh: '这是面向 UI 团队的 React 精选合集，适合比较组件、评审和界面工作流工具。',
    },
  },
  'collection-typescript': {
    title: { en: 'TypeScript Workflow Tools to Install First', zh: '优先安装的 TypeScript 工作流工具' },
    description: {
      en: 'A typed-development collection that helps product teams shortlist TypeScript workflow tools with clear setup paths.',
      zh: '这是面向类型化开发的精选合集，帮助产品团队更快筛出 TypeScript 工作流工具和安装路径。',
    },
  },
  'collection-rust': {
    title: { en: 'Rust Workflow Tools to Install First', zh: '优先安装的 Rust 工作流工具' },
    description: {
      en: 'A systems-focused Rust collection for teams comparing reliability, release, and performance workflows.',
      zh: '这是面向系统工程的 Rust 精选合集，适合比较可靠性、发布和性能相关工作流工具。',
    },
  },
  'collection-devops': {
    title: { en: 'DevOps Workflow Tools to Install First', zh: '优先安装的 DevOps 工作流工具' },
    description: {
      en: 'An operations-first collection for platform teams choosing release, incident, and automation helpers.',
      zh: '这是运维优先的精选合集，适合平台团队筛选发布、事故响应和自动化辅助工具。',
    },
  },
  'collection-framework': {
    title: { en: 'Agent Framework Tools to Install First', zh: '优先安装的 Agent Framework 工具' },
    description: {
      en: 'A framework and SDK collection for teams building agent foundations, not just browsing vendor names.',
      zh: '这是 framework 与 SDK 精选合集，适合搭建 agent 基础设施的团队，而不是只看厂商品牌名单。',
    },
  },
  'collection-community': {
    title: { en: 'Community Skills to Install First', zh: '优先安装的 Community Skills' },
    description: {
      en: 'A community-tested collection for builders who want reusable skills without falling back to unfiltered repository browsing.',
      zh: '这是面向构建者的 community 精选合集，适合查找可复用 skills，而不是回到无筛选的仓库浏览。',
    },
  },
  'collection-productivity': {
    title: { en: 'AI Productivity Tools for Developers', zh: '开发者 AI 生产力工具' },
    description: {
      en: 'A practical collection around everyday execution gains instead of generic repository breadth.',
      zh: '这是围绕日常执行效率的实用合集，而不是泛泛的仓库覆盖。',
    },
  },
  'solutions-hub': {
    title: { en: 'Workflow Solutions', zh: 'Solutions 总入口' },
    description: {
      en: 'Solution pages group common use cases so you can compare relevant skills faster.',
      zh: 'Solutions 页面按常见使用场景组织内容，帮助你更快比较相关 skills。',
    },
  },
  'solution-agent-workflows': {
    title: { en: 'Agent Workflows Solution', zh: 'Agent 工作流方案页' },
    description: {
      en: 'A scenario page for teams that already know the workflow problem they need to solve.',
      zh: '这是面向“已经知道自己要解决什么工作流问题”的团队场景页。',
    },
  },
  'solution-workflow-automation': {
    title: { en: 'Workflow Automation Solution', zh: '工作流自动化方案页' },
    description: {
      en: 'A use-case page for repeatable automation patterns instead of one-off tools.',
      zh: '这是面向“可复用自动化模式”而不是一次性工具的场景页。',
    },
  },
  'solution-process-automation': {
    title: { en: 'Process Automation Solution', zh: '流程自动化方案页' },
    description: {
      en: 'A solution page for teams turning SOPs, shared workflows, and operations into repeatable AI-assisted execution paths.',
      zh: '这是为 SOP、协作流程和运营流程寻找可复用 AI 执行路径的团队准备的方案页。',
    },
  },
  'solution-document-automation': {
    title: { en: 'Document Automation Solution', zh: '文档自动化方案页' },
    description: {
      en: 'A solution page for reports, PDFs, templates, and repeatable content delivery workflows.',
      zh: '这是面向报告、PDF、模板与可复用内容交付流程的方案页。',
    },
  },
  'solution-browser-automation': {
    title: { en: 'Browser Automation Solution', zh: '浏览器自动化方案页' },
    description: {
      en: 'A solution page for web actions, browser agents, and repeatable site operations.',
      zh: '这是面向网页操作、浏览器 Agent 与可复用站点任务的方案页。',
    },
  },
  'solution-data-extraction': {
    title: { en: 'Data Extraction Solution', zh: '数据提取方案页' },
    description: {
      en: 'A solution page for ETL, structured output, reporting pipelines, and data-heavy automation work.',
      zh: '这是为 ETL、结构化输出、报表管线和重数据自动化场景准备的方案页。',
    },
  },
  'docs-installation': {
    title: { en: 'Installation Docs', zh: '安装文档' },
    description: {
      en: 'Step-by-step installation guidance for getting skills set up and ready to use.',
      zh: '逐步安装指南，帮助你完成配置并尽快开始使用 skills。',
    },
  },
  'docs-cli-overview': {
    title: { en: 'CLI Overview Docs', zh: 'CLI 总览文档' },
    description: {
      en: 'Learn command behavior, sync rules, and what to check after installation.',
      zh: '了解命令行为、同步规则，以及安装后需要检查的内容。',
    },
  },
  'blog-official-ai-agent-skills-guide': {
    title: { en: 'Official AI Agent Skills Guide', zh: '官方 AI Agent Skills 指南' },
    description: {
      en: 'A practical guide for choosing official and well-maintained AI agent skills.',
      zh: '这是一篇实用指南，帮助你选择官方和维护良好的 AI Agent Skills。',
    },
  },
  'blog-how-to-install-ai-agent-skills': {
    title: { en: 'How to Install AI Agent Skills', zh: '如何安装 AI Agent Skills' },
    description: {
      en: 'A practical onboarding guide for moving from install commands into CLI and docs.',
      zh: '这是一篇实操型入门指南，适合从安装命令继续进入 CLI 和文档。',
    },
  },
  'blog-ide-comparison': {
    title: { en: 'Claude Code vs Cursor vs Windsurf', zh: 'Claude Code vs Cursor vs Windsurf 对比' },
    description: {
      en: 'A practical comparison guide for choosing between Claude Code, Cursor, and Windsurf.',
      zh: '实用对比指南，帮助你在 Claude Code、Cursor 和 Windsurf 之间做选择。',
    },
  },
  'blog-mcp-vs-rest-api': {
    title: { en: 'MCP vs REST API Comparison', zh: 'MCP vs REST API 对比' },
    description: {
      en: 'A comparison guide for choosing between MCP and REST API implementation paths.',
      zh: '这是一份对比指南，帮助团队在 MCP 与 REST API 实现路径之间做选择。',
    },
  },
  'skills-directory': {
    title: { en: 'Full Skills Directory', zh: '全量 Skills 目录' },
    description: {
      en: 'Browse the full skills directory when you want wider coverage after checking curated starting points.',
      zh: '看过精选入口后，如果还需要更广的覆盖范围，可以继续浏览完整 skills 目录。',
    },
  },
  // --- Backfilled surfaces (en + zh only). Other locales are a Phase 2 task. ---
  'collection-go': {
    title: { en: 'Go Workflow Tools to Install First', zh: '优先安装的 Go 工作流工具' },
    description: {
      en: 'A systems-focused Go collection helping engineers configure robust and concurrent backend utility modules.',
      zh: '面向系统级 Go 语言工程师的精选合集，帮助团队配置高效、高并发的后端实用程序模块。',
    },
  },
  'collection-java': {
    title: { en: 'Java Workflow Tools to Install First', zh: '优先安装的 Java 工作流工具' },
    description: {
      en: 'An enterprise-focused Java collection guiding development teams through stable backend component configuration.',
      zh: '面向企业级 Java 开发团队的精选合集，指导工程师配置稳定且高性能的后端组件。',
    },
  },
  'collection-mobile': {
    title: { en: 'Mobile Workflow Tools to Install First', zh: '优先安装的移动端工作流工具' },
    description: {
      en: 'A mobile engineering collection helping iOS and Android teams construct optimized native developer pipelines.',
      zh: '面向移动端工程的精选合集，帮助 iOS 与 Android 团队构建更优化的原生开发流水线。',
    },
  },
  'collection-agent-workflow-automation-tools': {
    title: { en: 'Agent Workflow Automation Tools to Install First', zh: '优先安装的 Agent 工作流自动化工具' },
    description: {
      en: 'A curated collection for agent workflow automation, comparing setup quality, common use cases, and IDE fit.',
      zh: '优先安装的 Agent 工作流自动化工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-ai-assistant-workflow-tools-developers': {
    title: {
      en: 'AI Assistant Workflow Tools for Developers to Install First',
      zh: '开发者优先安装的 AI 助手工作流工具',
    },
    description: {
      en: 'A curated collection of AI assistant workflow tools for developers, comparing setup quality, use cases, and IDE fit.',
      zh: '开发者优先安装的 AI 助手工作流工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-cli-terminal-ai-agent-tools': {
    title: { en: 'CLI Workflow Tools to Install First', zh: '优先安装的 CLI 工作流工具' },
    description: {
      en: 'A curated collection of CLI and terminal AI agent tools, comparing setup quality, use cases, and IDE fit.',
      zh: '优先安装的 CLI 工作流工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-codex-workflow-skills-developer-integrations': {
    title: { en: 'Best Codex Workflow Tools to Install First', zh: '优先安装的 Codex 工作流工具' },
    description: {
      en: 'A curated collection of Codex workflow skills and developer integrations, comparing setup quality, use cases, and IDE fit.',
      zh: '优先安装的 Codex 工作流工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-developer-tooling-ai-agent-work': {
    title: { en: 'Developer Workflow Tools to Install First', zh: '优先安装的开发工作流工具' },
    description: {
      en: 'A curated collection of developer tooling for AI agent work, comparing setup quality, use cases, and IDE fit.',
      zh: '优先安装的开发工作流工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-gemini-cli-workflow-tools-terminal-automation-skills': {
    title: { en: 'Gemini CLI Workflow Tools to Install First', zh: '优先安装的 Gemini CLI 工作流工具' },
    description: {
      en: 'A curated collection of Gemini CLI workflow tools and terminal automation skills, comparing setup quality, use cases, and IDE fit.',
      zh: '优先安装的 Gemini CLI 工作流工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-github-copilot-companion-skills-dev-tools': {
    title: { en: 'Copilot Workflow Tools to Install First', zh: '优先安装的 Copilot 工作流工具' },
    description: {
      en: 'A curated collection of GitHub Copilot companion skills and dev tools, comparing setup quality, use cases, and IDE fit.',
      zh: '优先安装的 Copilot 工作流工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-openai-powered-ai-agent-tools': {
    title: {
      en: 'OpenAI Workflow Tools for Prompt, Eval, and Agent Teams',
      zh: '面向 Prompt、评估与 Agent 团队的 OpenAI 工具',
    },
    description: {
      en: 'A curated collection of OpenAI-powered tools for prompt, eval, and agent teams, comparing setup quality, use cases, and IDE fit.',
      zh: '面向 Prompt、评估与 Agent 团队的 OpenAI 工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
  'collection-orchestration-platforms-agent-execution': {
    title: { en: 'Agent Orchestration Tools to Install First', zh: '优先安装的 Agent 编排执行工具' },
    description: {
      en: 'A curated collection of agent orchestration and execution platforms, comparing setup quality, use cases, and IDE fit.',
      zh: '优先安装的 Agent 编排执行工具，查看安装路径、实际用途和适合的开发环境。',
    },
  },
};
