import { normalizeCategoryId } from './category-taxonomy';

type IntentConfig = {
  titleLabel: string;
  useCaseLabel: string;
  keywords: string[];
};

export type SkillSeoIntent = {
  id: string;
  titleLabel: string;
  useCaseLabel: string;
  keywords: string[];
  supportTerm: string;
};

const CATEGORY_INTENTS: Record<string, IntentConfig> = {
  browser: {
    titleLabel: 'Browser Automation Skill',
    useCaseLabel: 'web browsing, scraping, and browser automation',
    keywords: ['browser automation', 'web scraping', 'browser skill'],
  },
  finance: {
    titleLabel: 'Finance Automation Skill',
    useCaseLabel: 'payments, billing, and finance automation',
    keywords: ['finance automation', 'payments automation', 'billing tools'],
  },
  productivity: {
    titleLabel: 'Productivity Workflow Skill',
    useCaseLabel: 'productivity workflows, task execution, and automation',
    keywords: ['productivity skill', 'workflow automation', 'task automation'],
  },
  developer: {
    titleLabel: 'Developer Tool Skill',
    useCaseLabel: 'coding, debugging, and developer automation',
    keywords: ['developer tool skill', 'code automation', 'developer tools'],
  },
  data: {
    titleLabel: 'Data Workflow Skill',
    useCaseLabel: 'data access, analysis, and ETL workflows',
    keywords: ['data workflow skill', 'data automation', 'etl workflows'],
  },
  ai: {
    titleLabel: 'AI Workflow Skill',
    useCaseLabel: 'LLM workflows, evaluation, and AI automation',
    keywords: ['ai workflow skill', 'llm automation', 'agentic workflows'],
  },
  design: {
    titleLabel: 'Design Automation Skill',
    useCaseLabel: 'UI generation, design systems, and visual workflows',
    keywords: ['design automation', 'ui generation', 'design systems'],
  },
  documentation: {
    titleLabel: 'Documentation Skill',
    useCaseLabel: 'documentation, knowledge base, and content workflows',
    keywords: ['documentation skill', 'knowledge base automation', 'content workflows'],
  },
  devops: {
    titleLabel: 'DevOps Automation Skill',
    useCaseLabel: 'deployment, infrastructure, and ops automation',
    keywords: ['devops automation', 'infrastructure automation', 'deployment workflows'],
  },
  security: {
    titleLabel: 'Security Audit Skill',
    useCaseLabel: 'security reviews, vulnerability checks, and compliance',
    keywords: ['security audit skill', 'vulnerability scanning', 'security automation'],
  },
  communication: {
    titleLabel: 'Communication Skill',
    useCaseLabel: 'messaging, handoffs, and team collaboration',
    keywords: ['communication skill', 'team collaboration', 'messaging automation'],
  },
  default: {
    titleLabel: 'AI Agent Skill',
    useCaseLabel: 'AI agent workflows and automation',
    keywords: ['ai agent skill', 'ide skills', 'agent automation'],
  },
};

const GENERIC_TERMS = [
  'ai',
  'agent',
  'agents',
  'skill',
  'skills',
  'mcp',
  'server',
  'servers',
  'tool',
  'tools',
  'automation',
  'workflow',
  'workflows',
  'claude',
  'cursor',
  'windsurf',
  'developer',
  'data',
  'design',
  'finance',
  'browser',
  'documentation',
  'security',
  'communication',
  'devops',
  'productivity',
  '开发',
  '数据',
  '设计',
  '金融',
  '浏览器',
  '文档',
  '安全',
  '协作',
  '效率',
  '工作流',
  '自动化',
  '技能',
];

const LOW_INTENT_PATTERNS = [
  /(^|\b)(how to|what is|why|guide|tutorial|vs|versus|alternative|alternatives|best|top\s*\d*|comparison|compare|free|download)\b/i,
  /(是什么|怎么用|如何|教程|指南|对比|替代|最佳|免费)/,
  /(とは|使い方|チュートリアル|ガイド|比較|代替|おすすめ|無料)/,
  /(무엇|사용법|튜토리얼|가이드|비교|대안|추천|무료)/,
];

const INVALID_KEYWORD_PATTERNS = [/\.\.\./, /\[[^\]]+\]/, /[?？]/];

const MCP_FIRST_COMBINED_PATTERNS = [
  /\bmodel context protocol\b/i,
  /\bmcp\b[\s-]*\b(servers?|tools?)\b/i,
  /\b(servers?|tools?)\b[\s-]*\bmcp\b/i,
  /\bmodel context protocol\b[\s-]*\b(servers?|tools?)\b/i,
  /\b(servers?|tools?)\b[\s-]*\bmodel context protocol\b/i,
];

const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const sanitizeKeywordText = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:|/\\\-\s]+|[,.;:|/\\\-\s]+$/g, '')
    .trim();

const isAsciiOnly = (text: string) => [...text].every((char) => char.charCodeAt(0) <= 0x7f);

export function sanitizeSkillKeywords(rawKeywords: string[], options?: { max?: number }): string[] {
  const max = options?.max ?? 8;
  const seen = new Set<string>();
  const normalizedGenericTerms = new Set(GENERIC_TERMS.map((term) => normalizeText(term)));
  const cleaned: string[] = [];

  for (const rawKeyword of rawKeywords) {
    if (!rawKeyword) continue;
    const keyword = sanitizeKeywordText(String(rawKeyword));
    const normalized = normalizeText(keyword);
    if (!normalized) continue;
    if (normalized.length < 3 || normalized.length > 48) continue;
    if (keyword.includes('/')) continue;
    if (INVALID_KEYWORD_PATTERNS.some((pattern) => pattern.test(keyword))) continue;
    if (LOW_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
    if (MCP_FIRST_COMBINED_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
    if (normalizedGenericTerms.has(normalized)) continue;

    const words = normalized.split(' ').filter(Boolean);
    const tokenCount = words.length;
    const isPureGeneric = words.every((t) => normalizedGenericTerms.has(t));
    if (isPureGeneric) continue;

    if (isAsciiOnly(keyword)) {
      if (tokenCount === 1 && normalized.length < 6) continue;
      if (tokenCount > 6) continue;
    }
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    cleaned.push(keyword);
    if (cleaned.length >= max) break;
  }

  return cleaned;
}

function pickSupportTerm(rawKeywords: string[], intentKeywords: string[]): string {
  const blocked = new Set([
    ...GENERIC_TERMS.map((term) => normalizeText(term)),
    ...intentKeywords.map((keyword) => normalizeText(keyword)),
  ]);

  for (const keyword of sanitizeSkillKeywords(rawKeywords, { max: 12 })) {
    const normalized = normalizeText(keyword);
    if (blocked.has(normalized)) continue;
    return keyword;
  }

  return '';
}

export function resolveSkillSeoIntent(
  category: string | undefined,
  rawKeywords: string[],
  t: (key: string, fb?: string) => string,
): SkillSeoIntent {
  const normalizedCategory = normalizeCategoryId(category);
  const intentId = normalizedCategory && CATEGORY_INTENTS[normalizedCategory] ? normalizedCategory : 'default';
  const config = CATEGORY_INTENTS[intentId];
  const localizedKeywords = config.keywords;
  const supportTerm = pickSupportTerm(rawKeywords, localizedKeywords);

  const titleKey = `Seo.Category.${intentId}.titleLabel`;
  const useCaseKey = `Seo.Category.${intentId}.useCaseLabel`;
  const localizedTitleLabel = t(titleKey, config.titleLabel);
  const localizedUseCaseLabel = t(useCaseKey, config.useCaseLabel);

  return {
    id: intentId,
    titleLabel: localizedTitleLabel && localizedTitleLabel !== titleKey ? localizedTitleLabel : config.titleLabel,
    useCaseLabel:
      localizedUseCaseLabel && localizedUseCaseLabel !== useCaseKey ? localizedUseCaseLabel : config.useCaseLabel,
    keywords: localizedKeywords,
    supportTerm,
  };
}
