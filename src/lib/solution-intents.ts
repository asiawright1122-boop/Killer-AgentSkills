import type { Locale } from '../i18n';
import type { KeywordClusterId } from './seo-keywords';

export type SolutionSlug =
  | 'workflow-automation'
  | 'process-automation'
  | 'document-automation'
  | 'browser-automation'
  | 'data-extraction'
  | 'agent-workflows';

type LocalizedText = {
  en: string;
  zh: string;
};

type SolutionIntentConfig = {
  slug: SolutionSlug;
  query: string;
  queries: string[];
  label: LocalizedText;
  cardDescription: LocalizedText;
  pageTitle: LocalizedText;
  pageDescription: LocalizedText;
  keywordClusters: KeywordClusterId[];
  fallbackCategories: string[];
};

type LocalizedSolutionIntent = Omit<
  SolutionIntentConfig,
  'label' | 'cardDescription' | 'pageTitle' | 'pageDescription'
> & {
  label: string;
  cardDescription: string;
  pageTitle: string;
  pageDescription: string;
  href: string;
};

export type SolutionIntent = LocalizedSolutionIntent;

const SOLUTION_INTENTS: SolutionIntentConfig[] = [
  {
    slug: 'workflow-automation',
    query: 'workflow automation',
    queries: ['workflow automation', 'agent workflow', 'multi-step automation'],
    label: {
      en: 'Workflow Automation',
      zh: '工作流自动化',
    },
    cardDescription: {
      en: 'Multi-step AI workflows, orchestration chains, and reusable execution patterns.',
      zh: '多步骤 AI 工作流、编排链路与可复用执行模板。',
    },
    pageTitle: {
      en: 'Workflow Automation AI Agent Skills & MCP Servers',
      zh: '工作流自动化 AI Agent Skills 与 MCP Servers',
    },
    pageDescription: {
      en: 'Discover installable AI agent skills and MCP servers for workflow automation, repeatable task chains, and multi-step execution.',
      zh: '发现适合工作流自动化的 AI Agent Skills 与 MCP Servers，用于重复任务链路和多步骤执行。',
    },
    keywordClusters: ['workflowAutomation', 'templates', 'core', 'mcp'],
    fallbackCategories: ['productivity', 'developer', 'ai'],
  },
  {
    slug: 'process-automation',
    query: 'process automation',
    queries: ['process automation', 'SOP automation', 'operations workflow'],
    label: {
      en: 'Process Automation',
      zh: '流程自动化',
    },
    cardDescription: {
      en: 'SOP execution, handoff automation, and repeatable team operations.',
      zh: '覆盖 SOP 执行、交接自动化和可复用团队流程。',
    },
    pageTitle: {
      en: 'Process Automation Skills for SOP and Team Workflows',
      zh: 'SOP 与团队流程自动化技能',
    },
    pageDescription: {
      en: 'Find AI agent skills for process automation, SOP handoffs, operations workflows, and team-ready execution patterns.',
      zh: '查找适合流程自动化、SOP 交接、运营流程和团队执行的 AI Agent Skills。',
    },
    keywordClusters: ['processAutomation', 'enterpriseWorkflows', 'core', 'mcp'],
    fallbackCategories: ['productivity', 'communication', 'devops'],
  },
  {
    slug: 'document-automation',
    query: 'document automation',
    queries: ['document automation', 'PDF automation', 'report automation', 'template workflow'],
    label: {
      en: 'Document Automation',
      zh: '文档自动化',
    },
    cardDescription: {
      en: 'PDF, DOCX, reports, templates, and repeatable content operations.',
      zh: '聚焦 PDF、DOCX、报告、模板与内容流程自动化。',
    },
    pageTitle: {
      en: 'Document Automation Skills for PDF, Reports, and Templates',
      zh: 'PDF、报告与模板文档自动化技能',
    },
    pageDescription: {
      en: 'Browse AI agent skills for document automation across PDFs, reports, template workflows, and content production pipelines.',
      zh: '浏览面向 PDF、报告、模板流程和内容生产管线的文档自动化技能。',
    },
    keywordClusters: ['documentAutomation', 'templates', 'workflowAutomation', 'core'],
    fallbackCategories: ['documentation', 'productivity'],
  },
  {
    slug: 'browser-automation',
    query: 'browser automation',
    queries: ['browser automation', 'web automation', 'web scraping workflow', 'site automation'],
    label: {
      en: 'Browser Automation',
      zh: '浏览器自动化',
    },
    cardDescription: {
      en: 'Web actions, scraping flows, browser agents, and repeatable site operations.',
      zh: '网页操作、采集流程、浏览器 Agent 与站点任务自动化。',
    },
    pageTitle: {
      en: 'Browser Automation Skills for Web Actions and Scraping',
      zh: '网页操作与采集的浏览器自动化技能',
    },
    pageDescription: {
      en: 'Install AI agent skills for browser automation, web scraping workflows, and repeatable web operations.',
      zh: '安装适用于浏览器自动化、网页采集与可复用网站操作流程的 AI Agent Skills。',
    },
    keywordClusters: ['browserAutomation', 'workflowAutomation', 'core', 'mcp'],
    fallbackCategories: ['browser'],
  },
  {
    slug: 'data-extraction',
    query: 'data extraction',
    queries: ['data extraction', 'data workflow', 'ETL automation', 'reporting pipeline'],
    label: {
      en: 'Data Extraction',
      zh: '数据提取',
    },
    cardDescription: {
      en: 'Data extraction, ETL automation, reporting pipelines, and structured output.',
      zh: '覆盖数据提取、ETL 自动化、报表管线与结构化输出。',
    },
    pageTitle: {
      en: 'Data Extraction & ETL Automation AI Agent Skills',
      zh: '数据提取与 ETL 自动化 AI Agent Skills',
    },
    pageDescription: {
      en: 'Explore AI agent skills for data extraction, ETL automation, and reporting workflows with structured output.',
      zh: '探索适合数据提取、ETL 自动化与报表流程的 AI Agent Skills，支持结构化结果输出。',
    },
    keywordClusters: ['dataWorkflow', 'workflowAutomation', 'core', 'mcp'],
    fallbackCategories: ['data', 'devops'],
  },
  {
    slug: 'agent-workflows',
    query: 'agent workflow',
    queries: ['agent workflow', 'Claude Code skills workflow', 'Cursor skills workflow'],
    label: {
      en: 'Agent Workflows',
      zh: 'Agent 工作流',
    },
    cardDescription: {
      en: 'Scenario-driven skill stacks for Claude Code, Cursor, and Windsurf teams.',
      zh: '面向 Claude Code、Cursor、Windsurf 的场景化技能组合。',
    },
    pageTitle: {
      en: 'Agent Workflow Skills for Claude Code, Cursor, and Windsurf',
      zh: 'Claude Code、Cursor、Windsurf 的 Agent 工作流技能',
    },
    pageDescription: {
      en: 'Find installable AI agent workflow skills optimized for Claude Code, Cursor, Windsurf, and cross-IDE execution.',
      zh: '查找适用于 Claude Code、Cursor、Windsurf 与跨 IDE 协作的可安装 Agent 工作流技能。',
    },
    keywordClusters: ['workflowAutomation', 'ideCompat', 'developerExperience', 'core'],
    fallbackCategories: ['developer', 'ai', 'productivity'],
  },
];

function resolveText(text: LocalizedText, locale: Locale): string {
  return locale === 'zh' ? text.zh : text.en;
}

export const SOLUTION_INTENT_SLUGS: SolutionSlug[] = SOLUTION_INTENTS.map((item) => item.slug);

export function buildSolutionPath(locale: string, slug: SolutionSlug): string {
  return `/${locale}/solutions/${slug}`;
}

export function getSolutionIntents(locale: Locale): LocalizedSolutionIntent[] {
  return SOLUTION_INTENTS.map((item) => ({
    ...item,
    label: resolveText(item.label, locale),
    cardDescription: resolveText(item.cardDescription, locale),
    pageTitle: resolveText(item.pageTitle, locale),
    pageDescription: resolveText(item.pageDescription, locale),
    href: buildSolutionPath(locale, item.slug),
  }));
}

export function getSolutionIntentBySlug(locale: Locale, slug: string): LocalizedSolutionIntent | null {
  const found = SOLUTION_INTENTS.find((item) => item.slug === slug);
  if (!found) return null;

  return {
    ...found,
    label: resolveText(found.label, locale),
    cardDescription: resolveText(found.cardDescription, locale),
    pageTitle: resolveText(found.pageTitle, locale),
    pageDescription: resolveText(found.pageDescription, locale),
    href: buildSolutionPath(locale, found.slug),
  };
}
