import type { Locale } from '../i18n';

type CategoryDef = {
  id: string;
  icon: string;
  color: string;
  labelKey: string;
  seoDescription: {
    en: string;
    zh: string;
  };
};

const CATEGORY_ALIASES: Record<string, string> = {
  development: 'developer',
  testing: 'developer',
  'code-review': 'developer',
  git: 'developer',
  cli: 'developer',
  library: 'developer',
  api: 'developer',
  database: 'data',
  search: 'browser',
  'web-scraping': 'browser',
  automation: 'productivity',
  social: 'communication',
};

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'browser',
    icon: 'globe',
    color: 'cyan',
    labelKey: 'Sidebar.categories.browser',
    seoDescription: {
      en: 'Discover Browser Automation and Web Scraping MCP servers for AI agents. Let Claude Code, Cursor, and Windsurf navigate sites, click elements, and extract structured data.',
      zh: '发现适用于 AI Agent 的浏览器自动化与网页抓取 MCP Server，让 Claude Code、Cursor、Windsurf 能浏览网页、点击元素并提取结构化数据。',
    },
  },
  {
    id: 'finance',
    icon: 'credit-card',
    color: 'emerald',
    labelKey: 'Sidebar.categories.finance',
    seoDescription: {
      en: 'Explore finance and payments MCP servers for AI agents. Connect billing, subscriptions, and transaction workflows directly into Claude Code, Cursor, and automation agents.',
      zh: '探索面向 AI Agent 的金融与支付 MCP Server，将账单、订阅和交易工作流接入 Claude Code、Cursor 与自动化智能体。',
    },
  },
  {
    id: 'productivity',
    icon: 'zap',
    color: 'indigo',
    labelKey: 'Sidebar.categories.productivity',
    seoDescription: {
      en: 'Best productivity MCP servers for AI agents. Connect Notion, Slack, calendars, and workflow tools to automate daily execution.',
      zh: '适合 AI Agent 的生产力 MCP Server，连接 Notion、Slack、日历和工作流工具，自动处理日常执行任务。',
    },
  },
  {
    id: 'developer',
    icon: 'code',
    color: 'blue',
    labelKey: 'Sidebar.categories.developer',
    seoDescription: {
      en: 'Find developer tool MCP servers for Claude Code, Cursor, and other AI agents. Automate coding, debugging, refactoring, and project workflows.',
      zh: '查找适用于 Claude Code、Cursor 等 AI Agent 的开发工具 MCP Server，自动处理编码、调试、重构和项目工作流。',
    },
  },
  {
    id: 'data',
    icon: 'bar-chart',
    color: 'sky',
    labelKey: 'Sidebar.categories.data',
    seoDescription: {
      en: 'Browse data MCP servers for SQL querying, analytics, ETL, and database workflows. Give AI agents access to structured data and pipelines.',
      zh: '浏览适用于 SQL 查询、分析、ETL 和数据库工作的 Data MCP Server，让 AI Agent 具备结构化数据访问能力。',
    },
  },
  {
    id: 'ai',
    icon: 'cpu',
    color: 'violet',
    labelKey: 'Sidebar.categories.ai',
    seoDescription: {
      en: 'Browse AI and ML workflow skills for model integration, prompt engineering, evaluations, and LLM automation across major IDEs.',
      zh: '浏览 AI 与机器学习工作流技能，覆盖模型集成、提示词工程、评测和 LLM 自动化，适配主流 IDE。',
    },
  },
  {
    id: 'design',
    icon: 'pen-tool',
    color: 'pink',
    labelKey: 'Sidebar.categories.design',
    seoDescription: {
      en: 'Creative and design automation skills for UI generation, visual systems, branding, and front-end workflows.',
      zh: '适用于 UI 生成、视觉系统、品牌设计与前端工作流的创意设计技能。',
    },
  },
  {
    id: 'documentation',
    icon: 'book',
    color: 'amber',
    labelKey: 'Sidebar.categories.documentation',
    seoDescription: {
      en: 'Documentation skills and MCP servers for markdown, PDFs, knowledge bases, and content operations.',
      zh: '面向 Markdown、PDF、知识库与内容运营的文档技能和 MCP Server。',
    },
  },
  {
    id: 'devops',
    icon: 'server',
    color: 'orange',
    labelKey: 'Sidebar.categories.devops',
    seoDescription: {
      en: 'Top DevOps and cloud MCP servers for deployment, infrastructure, Docker, Kubernetes, and CI/CD workflows.',
      zh: '适用于部署、基础设施、Docker、Kubernetes 和 CI/CD 流程的 DevOps 与云服务 MCP Server。',
    },
  },
  {
    id: 'security',
    icon: 'shield',
    color: 'rose',
    labelKey: 'Sidebar.categories.security',
    seoDescription: {
      en: 'Security skills for audits, auth flows, vulnerability detection, and compliance checks in AI-assisted development.',
      zh: '适用于安全审计、认证流程、漏洞检测和合规检查的安全技能，服务 AI 辅助开发场景。',
    },
  },
  {
    id: 'communication',
    icon: 'message-circle',
    color: 'teal',
    labelKey: 'Sidebar.categories.communication',
    seoDescription: {
      en: 'Communication skills for messaging, collaboration, social publishing, and handoff workflows across teams and agents.',
      zh: '适用于消息沟通、协作、社交发布和交接流程的沟通协作技能，支持团队与智能体协同。',
    },
  },
];

export function normalizeCategoryId(category: string | undefined): string {
  const normalized = String(category || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  return CATEGORY_ALIASES[normalized] || normalized;
}

export function getCategoryDef(category: string | undefined): CategoryDef | undefined {
  const normalized = normalizeCategoryId(category);
  return CATEGORY_DEFS.find((def) => def.id === normalized);
}

export function getCategorySeoDescription(category: string | undefined, locale: Locale): string {
  const def = getCategoryDef(category);
  if (!def) return '';
  return locale === 'zh' ? def.seoDescription.zh : def.seoDescription.en;
}

export function getCategoryLabel(category: string | undefined, t: (key: string) => string): string {
  const def = getCategoryDef(category);
  const normalized = normalizeCategoryId(category);
  if (!def || !normalized) return category || '';

  const primary = t(def.labelKey);
  if (primary && primary !== def.labelKey) return primary;

  const fallbackKey = `Categories.${normalized}`;
  const fallback = t(fallbackKey);
  if (fallback && fallback !== fallbackKey) return fallback;

  return normalized;
}
