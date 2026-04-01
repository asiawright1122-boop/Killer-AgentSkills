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

const VALID_CLUSTERS = new Set<KeywordClusterId>([
  'core',
  'mcp',
  'workflowAutomation',
  'processAutomation',
  'documentAutomation',
  'browserAutomation',
  'dataWorkflow',
  'installSetup',
  'compatibility',
  'templates',
  'ideCompat',
  'cli',
  'docs',
  'developerExperience',
  'enterpriseWorkflows',
  'creativeWorkflows',
]);

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

export function getKeywordCluster(id: KeywordClusterId, t: (k: string, fb?: string) => string): string[] {
  return t(`Seo.Keywords.${id}`, '').split(', ');
}

export function buildKeywordString(
  t: (k: string, fb?: string) => string,
  ...parts: Array<KeywordClusterId | string | string[] | undefined>
): string {
  const keywords = parts.flatMap((part) => {
    if (!part) return [];
    if (Array.isArray(part)) return part;
    if (VALID_CLUSTERS.has(part as KeywordClusterId)) return getKeywordCluster(part as KeywordClusterId, t);
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
