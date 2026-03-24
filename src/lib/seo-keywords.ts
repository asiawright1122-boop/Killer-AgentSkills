import type { Locale } from '../i18n';
import { normalizeCategoryId } from './category-taxonomy';

export type KeywordClusterId =
  | 'core'
  | 'mcp'
  | 'workflowAutomation'
  | 'processAutomation'
  | 'documentAutomation'
  | 'browserAutomation'
  | 'dataWorkflow'
  | 'installSetup'
  | 'compatibility'
  | 'templates'
  | 'ideCompat'
  | 'cli'
  | 'docs'
  | 'developerExperience'
  | 'enterpriseWorkflows'
  | 'creativeWorkflows';

const CLUSTERS: Record<KeywordClusterId, { en: string[]; zh: string[] }> = {
  core: {
    en: ['AI agent skills', 'installable AI agent skills', 'Claude Code skills', 'developer skills for AI coding assistants'],
    zh: ['AI Agent Skills', '可安装 AI Agent Skills', 'Claude Code 技能', '面向 AI 编程助手的开发者技能'],
  },
  mcp: {
    en: ['AI agent skills with MCP integrations', 'developer workflow integrations with MCP', 'Claude Code MCP integrations'],
    zh: ['带 MCP 集成的 AI Agent Skills', '面向开发工作流的 MCP 集成', 'Claude Code MCP 集成'],
  },
  workflowAutomation: {
    en: ['workflow automation skills', 'developer workflow automation', 'agent workflow skills', 'multi-step execution skills'],
    zh: ['工作流自动化技能', '开发者工作流自动化', 'Agent 工作流技能', '多步骤执行技能'],
  },
  processAutomation: {
    en: ['process automation skills', 'business process workflow skills', 'SOP automation skills', 'operations workflow skills'],
    zh: ['流程自动化技能', '业务流程技能', 'SOP 自动化技能', '运营流程技能'],
  },
  documentAutomation: {
    en: ['document automation skills', 'report automation skills', 'PDF automation skills', 'document workflow skills'],
    zh: ['文档自动化技能', '报告自动化技能', 'PDF 自动化技能', '文档流程技能'],
  },
  browserAutomation: {
    en: ['browser automation skills', 'web automation skills', 'web scraping skills', 'site workflow automation'],
    zh: ['浏览器自动化技能', '网页自动化技能', '网页抓取技能', '站点工作流自动化'],
  },
  dataWorkflow: {
    en: ['data workflow skills', 'data extraction skills', 'ETL automation skills', 'analytics workflow skills'],
    zh: ['数据流程技能', '数据提取技能', 'ETL 自动化技能', '分析工作流技能'],
  },
  installSetup: {
    en: ['install AI agent skills', 'Killer-Skills install flow', 'Claude Code skill setup', 'killer-skills add'],
    zh: ['安装 AI Agent Skills', 'Killer-Skills 安装流程', 'Claude Code 技能配置', 'killer-skills add'],
  },
  compatibility: {
    en: ['IDE compatibility for AI agent skills', 'supported IDEs for skills', 'Claude Code Cursor Windsurf compatibility', 'skill environment support'],
    zh: ['AI Agent Skills 的 IDE 兼容性', '支持 Skills 的 IDE', 'Claude Code Cursor Windsurf 兼容性', '技能运行环境支持'],
  },
  templates: {
    en: ['skill templates', 'workflow skill templates', 'automation skill templates', 'reusable agent playbooks'],
    zh: ['技能模板', '工作流技能模板', '自动化技能模板', '可复用 Agent 手册'],
  },
  ideCompat: {
    en: ['Claude Code skills', 'Cursor skills', 'Windsurf skills', 'VS Code AI agent skills'],
    zh: ['Claude Code 技能', 'Cursor 技能', 'Windsurf 技能', 'VS Code AI Agent 技能'],
  },
  cli: {
    en: ['AI agent skills CLI', 'killer-skills add', 'skill installation CLI', 'CLI for installable skills'],
    zh: ['AI Agent Skills CLI', 'killer-skills add', '技能安装 CLI', '面向可安装技能的命令行'],
  },
  docs: {
    en: ['AI agent skills docs', 'skill setup docs', 'installation docs for Claude Code', 'developer skill documentation'],
    zh: ['AI Agent Skills 文档', '技能配置文档', 'Claude Code 安装文档', '开发者技能文档'],
  },
  developerExperience: {
    en: ['developer workflow skills', 'coding automation skills', 'developer productivity skills', 'AI developer tools for coding'],
    zh: ['开发者工作流技能', '编码自动化技能', '开发效率技能', '面向编码的 AI 开发工具'],
  },
  enterpriseWorkflows: {
    en: ['team workflow skills', 'operations automation skills', 'business workflow skills', 'operations playbooks for AI agents'],
    zh: ['团队工作流技能', '运营自动化技能', '业务流程技能', '面向 AI Agent 的运营手册'],
  },
  creativeWorkflows: {
    en: ['creative workflow skills', 'design automation skills', 'content creation workflow skills', 'creative tools for AI agents'],
    zh: ['创意工作流技能', '设计自动化技能', '内容创作流程技能', '面向 AI Agent 的创意工具'],
  },
};

const LOW_INTENT_KEYWORD_PATTERNS = [
  /(^|\b)(how to|what is|why|guide|tutorial|vs|versus|alternative|alternatives|best|top\s*\d*|comparison|compare|free|download)\b/i,
  /(是什么|怎么用|如何|教程|指南|对比|替代|最佳|免费)/,
  /\b(interview|product\s*manager|product\s*management|mvp\s*builder|mvp-builder|startup)\b/i,
];

const EXACT_BLOCKED_KEYWORDS = new Set([
  'mcp',
  'server',
  'servers',
  'tools',
  'tool',
  'automation',
  'workflow',
  'workflows',
  'guide',
  'guides',
  'docs',
]);

const normalizeKeyword = (keyword: string) => keyword.trim();
const normalizeKeywordForMatch = (keyword: string) => normalizeKeyword(keyword).toLowerCase();

function isAllowedKeyword(keyword: string): boolean {
  const normalized = normalizeKeywordForMatch(keyword);
  if (!normalized) return false;
  if (normalized.length < 3 || normalized.length > 96) return false;
  if (EXACT_BLOCKED_KEYWORDS.has(normalized)) return false;
  if (LOW_INTENT_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return true;
}

export function getKeywordCluster(id: KeywordClusterId, locale: Locale): string[] {
  const isZh = locale === 'zh';
  return isZh ? CLUSTERS[id].zh : CLUSTERS[id].en;
}

export function buildKeywordString(
  locale: Locale,
  ...parts: Array<KeywordClusterId | string | string[] | undefined>
): string {
  const keywords = parts.flatMap((part) => {
    if (!part) return [];
    if (Array.isArray(part)) return part;
    if (part in CLUSTERS) return getKeywordCluster(part as KeywordClusterId, locale);
    return [part];
  });

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const rawKeyword of keywords) {
    const keyword = normalizeKeyword(rawKeyword);
    const normalized = normalizeKeywordForMatch(keyword);
    if (!isAllowedKeyword(keyword) || seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(keyword);
  }

  return cleaned.join(', ');
}

export function getIntentKeywordClusters(intentId: string | undefined): KeywordClusterId[] {
  switch (intentId) {
    case 'workflow-automation':
      return ['workflowAutomation'];
    case 'process-automation':
      return ['processAutomation'];
    case 'document-automation':
      return ['documentAutomation'];
    case 'browser-automation':
      return ['browserAutomation'];
    case 'data-extraction':
      return ['dataWorkflow'];
    case 'skill-installation':
      return ['installSetup', 'cli', 'docs'];
    case 'workflow-templates':
      return ['templates', 'workflowAutomation'];
    case 'claude-code-skills':
    case 'cursor-skills':
    case 'windsurf-skills':
      return ['ideCompat', 'compatibility'];
    case 'mcp-servers':
      return ['developerExperience', 'ideCompat', 'installSetup', 'workflowAutomation', 'mcp'];
    case 'ai-agent-skills':
      return ['core', 'workflowAutomation'];
    default:
      return [];
  }
}

export function getCollectionKeywordClusters(category: string | undefined, slug: string): KeywordClusterId[] {
  const normalizedCategory = normalizeCategoryId(category);
  const clusters = new Set<KeywordClusterId>(['core']);

  for (const cluster of getCategoryKeywordClusters(normalizedCategory)) {
    clusters.add(cluster);
  }

  if (!normalizedCategory) {
    clusters.add('developerExperience');
  }

  if (/claude|cursor|windsurf|vscode|codex/i.test(slug)) {
    clusters.add('ideCompat');
  }

  if (/mcp/i.test(slug)) {
    clusters.add('mcp');
    clusters.add('developerExperience');
  }

  if (/pdf|docx|xlsx|document|file|report|presentation/i.test(slug)) {
    clusters.add('documentAutomation');
  }

  if (/browser|playwright|puppeteer|scrap|crawl/i.test(slug)) {
    clusters.add('browserAutomation');
  }

  if (/data|sql|analytics|etl|database/i.test(slug)) {
    clusters.add('dataWorkflow');
  }

  if (/template|starter|boilerplate/i.test(slug)) {
    clusters.add('templates');
  }

  return Array.from(clusters);
}

export function getCategoryKeywordClusters(category: string | undefined): KeywordClusterId[] {
  switch (normalizeCategoryId(category)) {
    case 'browser':
      return ['browserAutomation', 'workflowAutomation'];
    case 'productivity':
      return ['workflowAutomation', 'processAutomation'];
    case 'developer':
      return ['developerExperience', 'workflowAutomation'];
    case 'data':
      return ['dataWorkflow', 'workflowAutomation'];
    case 'ai':
      return ['workflowAutomation', 'developerExperience'];
    case 'design':
      return ['creativeWorkflows'];
    case 'documentation':
      return ['documentAutomation'];
    case 'devops':
      return ['developerExperience', 'processAutomation'];
    case 'security':
      return ['developerExperience', 'enterpriseWorkflows'];
    case 'communication':
      return ['enterpriseWorkflows', 'processAutomation'];
    case 'finance':
      return ['processAutomation', 'dataWorkflow'];
    default:
      return [];
  }
}
