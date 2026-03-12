import type { Locale } from '../i18n';

type IntentConfig = {
  id: string;
  patterns: RegExp[];
  label: {
    en: string;
    zh: string;
  };
  description: {
    en: string;
    zh: string;
  };
  keywords: string[];
};

export type QueryIntent = {
  id: string;
  displayTerm: string;
  description: string;
  keywords: string[];
};

const INTENTS: IntentConfig[] = [
  {
    id: 'mcp-servers',
    patterns: [/\bmcp\b/i, /\bmcp\s*server/i, /model\s*context\s*protocol/i],
    label: {
      en: 'MCP Servers',
      zh: 'MCP Servers',
    },
    description: {
      en: 'Discover practical MCP servers for AI coding agents with one-command installation and workflow-ready use cases.',
      zh: '发现适用于 AI 编码助手的实用 MCP Servers，提供一键安装与可落地工作流场景。',
    },
    keywords: ['mcp server', 'model context protocol', 'ai agent tools'],
  },
  {
    id: 'workflow-automation',
    patterns: [/\bworkflow\s*automation\b/i, /\bautomated\s*workflow/i, /\bagentic\s*workflow/i, /\bworkflow\s*agent/i],
    label: {
      en: 'Workflow Automation Skills',
      zh: '工作流自动化技能',
    },
    description: {
      en: 'Find workflow automation skills and MCP servers for repeatable agent tasks, multi-step execution, and practical AI operations.',
      zh: '查找适合工作流自动化的技能与 MCP Servers，用于重复任务、多步骤执行与可落地的 AI 流程。',
    },
    keywords: ['workflow automation', 'agent workflow', 'automation workflow', 'ai workflow tools'],
  },
  {
    id: 'process-automation',
    patterns: [
      /\bprocess\s*automation\b/i,
      /\bbusiness\s*process\b/i,
      /\bworkflow\s*process/i,
      /\bsop\s*automation\b/i,
    ],
    label: {
      en: 'Process Automation Skills',
      zh: '流程自动化技能',
    },
    description: {
      en: 'Discover process automation skills for SOPs, handoffs, repetitive operations, and AI-assisted business workflows.',
      zh: '发现适合 SOP、交接、重复操作与 AI 辅助业务流程的流程自动化技能。',
    },
    keywords: ['process automation', 'business process automation', 'sop automation', 'workflow process'],
  },
  {
    id: 'document-automation',
    patterns: [
      /\bdocument\s*automation\b/i,
      /\breport\s*automation\b/i,
      /\bpdf\s*automation\b/i,
      /\bdocx?\s*automation\b/i,
    ],
    label: {
      en: 'Document Automation Skills',
      zh: '文档自动化技能',
    },
    description: {
      en: 'Explore document automation skills for reports, PDFs, spreadsheets, templates, and repeatable content workflows.',
      zh: '探索文档自动化技能，覆盖报告、PDF、表格、模板与可复用内容流程。',
    },
    keywords: ['document automation', 'report automation', 'pdf automation', 'document workflow'],
  },
  {
    id: 'browser-automation',
    patterns: [/\bbrowser\s*automation\b/i, /\bweb\s*automation\b/i, /\bsite\s*automation\b/i, /\bweb\s*scraping\b/i],
    label: {
      en: 'Browser Automation Skills',
      zh: '浏览器自动化技能',
    },
    description: {
      en: 'Browse browser automation skills and MCP servers for web actions, scraping, research, and repeatable site workflows.',
      zh: '浏览适合网页操作、采集、研究与可重复站点流程的浏览器自动化技能与 MCP Servers。',
    },
    keywords: ['browser automation', 'web automation', 'web scraping', 'site workflow'],
  },
  {
    id: 'data-extraction',
    patterns: [/\bdata\s*extraction\b/i, /\bdata\s*pipeline\b/i, /\bdata\s*workflow\b/i, /\betl\b/i],
    label: {
      en: 'Data Workflow Skills',
      zh: '数据流程技能',
    },
    description: {
      en: 'Find data workflow skills for extraction, ETL, reporting, and structured AI-assisted data operations.',
      zh: '查找适合抽取、ETL、报表与结构化 AI 数据处理的数据流程技能。',
    },
    keywords: ['data extraction', 'data workflow', 'etl automation', 'reporting automation'],
  },
  {
    id: 'skill-installation',
    patterns: [
      /\binstall\s+(an?\s+)?(ai\s+)?(agent\s+)?skill/i,
      /\bskill\s*installation\b/i,
      /\bskill\s*setup\b/i,
      /\bsetup\s+(an?\s+)?(ai\s+)?(agent\s+)?skill/i,
      /\bkiller-skills\s+add\b/i,
    ],
    label: {
      en: 'Skill Installation Guides',
      zh: '技能安装指南',
    },
    description: {
      en: 'Find installation guides, setup docs, and CLI steps for adding AI agent skills to Cursor, Claude Code, VS Code, and more.',
      zh: '查找技能安装指南、配置文档与 CLI 步骤，把 AI Agent Skills 添加到 Cursor、Claude Code、VS Code 等环境中。',
    },
    keywords: ['install AI agent skills', 'skill installation', 'agent setup', 'killer-skills add'],
  },
  {
    id: 'workflow-templates',
    patterns: [
      /\bworkflow\s*template/i,
      /\bautomation\s*template/i,
      /\bskill\s*template/i,
      /\bagent\s*playbook/i,
      /\bworkflow\s*starter/i,
    ],
    label: {
      en: 'Workflow Templates',
      zh: '工作流模板',
    },
    description: {
      en: 'Browse workflow templates, automation starters, and reusable skill playbooks for repeatable AI tasks.',
      zh: '浏览工作流模板、自动化 starter 与可复用技能手册，用于可重复的 AI 任务。',
    },
    keywords: ['workflow templates', 'automation templates', 'skill templates', 'agent playbook'],
  },
  {
    id: 'ai-agent-skills',
    patterns: [/\bai\s*agent\s*skills?\b/i, /\bagent\s*skills?\b/i, /ai\s*skills?/i],
    label: {
      en: 'AI Agent Skills',
      zh: 'AI Agent Skills',
    },
    description: {
      en: 'Browse high-quality AI agent skills for coding, automation, data, and productivity across major IDEs.',
      zh: '浏览高质量 AI Agent Skills，覆盖编码、自动化、数据与效率场景，支持主流 IDE。',
    },
    keywords: ['ai agent skills', 'agent skills', 'ai coding assistant'],
  },
  {
    id: 'claude-code-skills',
    patterns: [/\bclaude\s*code\b/i, /\bclaude\s*skills?\b/i],
    label: {
      en: 'Claude Code Skills',
      zh: 'Claude Code Skills',
    },
    description: {
      en: 'Find Claude Code compatible skills and MCP servers to expand coding, debugging, and automation capabilities.',
      zh: '查找适配 Claude Code 的技能与 MCP Servers，扩展编码、调试与自动化能力。',
    },
    keywords: ['claude code skills', 'claude mcp', 'claude tools'],
  },
  {
    id: 'cursor-skills',
    patterns: [/\bcursor\b/i, /\bcursor\s*skills?\b/i],
    label: {
      en: 'Cursor Skills',
      zh: 'Cursor Skills',
    },
    description: {
      en: 'Explore Cursor-ready skills and MCP servers for rapid coding workflows and AI-assisted development.',
      zh: '探索适配 Cursor 的技能与 MCP Servers，提升 AI 辅助开发与快速编码效率。',
    },
    keywords: ['cursor skills', 'cursor mcp', 'cursor ai tools'],
  },
  {
    id: 'windsurf-skills',
    patterns: [/\bwindsurf\b/i, /\bwindsurf\s*skills?\b/i],
    label: {
      en: 'Windsurf Skills',
      zh: 'Windsurf Skills',
    },
    description: {
      en: 'Discover Windsurf-compatible AI agent skills and MCP servers for coding, docs, and workflow automation.',
      zh: '发现适配 Windsurf 的 AI Agent Skills 与 MCP Servers，覆盖编码、文档与流程自动化。',
    },
    keywords: ['windsurf skills', 'windsurf mcp', 'windsurf ai tools'],
  },
];

const normalizeQuery = (query: string) => query.toLowerCase().replace(/\s+/g, ' ').trim();

export function resolveQueryIntent(query: string, locale: Locale): QueryIntent | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const matched = INTENTS.find((intent) => intent.patterns.some((pattern) => pattern.test(normalized)));
  if (!matched) return null;

  const isZh = locale === 'zh';
  return {
    id: matched.id,
    displayTerm: isZh ? matched.label.zh : matched.label.en,
    description: isZh ? matched.description.zh : matched.description.en,
    keywords: matched.keywords,
  };
}
