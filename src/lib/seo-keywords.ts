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
    en: ['AI agent skills', 'agent skills', 'AI coding assistant', 'installable AI skills'],
    zh: ['AI Agent Skills', 'AI 编程助手', '可安装技能', '智能体技能'],
  },
  mcp: {
    en: ['MCP tools', 'model context protocol', 'MCP integrations'],
    zh: ['MCP 工具', '模型上下文协议', 'MCP 集成'],
  },
  workflowAutomation: {
    en: ['workflow automation', 'AI workflow automation', 'agent workflow', 'multi-step automation'],
    zh: ['工作流自动化', 'AI 工作流', 'Agent 工作流', '多步骤自动化'],
  },
  processAutomation: {
    en: ['process automation', 'business process automation', 'SOP automation', 'operations workflow'],
    zh: ['流程自动化', '业务流程自动化', 'SOP 自动化', '运营流程'],
  },
  documentAutomation: {
    en: ['document automation', 'report automation', 'PDF automation', 'template workflow'],
    zh: ['文档自动化', '报告自动化', 'PDF 自动化', '模板流程'],
  },
  browserAutomation: {
    en: ['browser automation', 'web automation', 'web scraping workflow', 'site automation'],
    zh: ['浏览器自动化', '网页自动化', '网页采集流程', '站点自动化'],
  },
  dataWorkflow: {
    en: ['data extraction', 'data workflow', 'ETL automation', 'reporting pipeline'],
    zh: ['数据提取', '数据流程', 'ETL 自动化', '报表流程'],
  },
  installSetup: {
    en: ['install AI agent skills', 'skill installation guide', 'agent setup', 'killer-skills add'],
    zh: ['安装 AI Agent Skills', '技能安装指南', 'Agent 配置', 'killer-skills add'],
  },
  compatibility: {
    en: ['IDE compatibility', 'supported IDEs', 'tool compatibility', 'agent environment support'],
    zh: ['IDE 兼容性', '支持的 IDE', '工具兼容', 'Agent 环境支持'],
  },
  templates: {
    en: ['workflow templates', 'automation templates', 'skill templates', 'agent playbooks'],
    zh: ['工作流模板', '自动化模板', '技能模板', 'Agent 手册'],
  },
  ideCompat: {
    en: ['Claude Code skills', 'Cursor skills', 'Windsurf skills', 'VS Code AI skills'],
    zh: ['Claude Code 技能', 'Cursor 技能', 'Windsurf 技能', 'VS Code AI 技能'],
  },
  cli: {
    en: ['AI agent skills CLI', 'killer-skills add', 'skill installation CLI', 'CLI automation'],
    zh: ['AI Agent Skills CLI', 'killer-skills add', '技能安装 CLI', '命令行自动化'],
  },
  docs: {
    en: ['AI agent skills docs', 'installation guide', 'workflow guide', 'setup documentation'],
    zh: ['AI Agent Skills 文档', '安装指南', '工作流指南', '配置文档'],
  },
  developerExperience: {
    en: ['developer workflow', 'coding workflow', 'developer productivity', 'AI dev tools'],
    zh: ['开发者工作流', '编码流程', '开发效率', 'AI 开发工具'],
  },
  enterpriseWorkflows: {
    en: ['enterprise workflow', 'team automation', 'business automation', 'operations playbook'],
    zh: ['企业工作流', '团队自动化', '业务自动化', '运营手册'],
  },
  creativeWorkflows: {
    en: ['creative workflow', 'design automation', 'content workflow', 'creative tools'],
    zh: ['创意工作流', '设计自动化', '内容流程', '创意工具'],
  },
};

const normalizeKeyword = (keyword: string) => keyword.trim();

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

  return Array.from(new Set(keywords.map(normalizeKeyword).filter(Boolean))).join(', ');
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
