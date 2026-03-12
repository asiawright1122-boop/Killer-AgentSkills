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
