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

const TITLE_CASE_TERMS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  aws: 'AWS',
  cli: 'CLI',
  css: 'CSS',
  gcp: 'GCP',
  gh: 'GH',
  github: 'GitHub',
  gog: 'GOG',
  html: 'HTML',
  http: 'HTTP',
  ide: 'IDE',
  ios: 'iOS',
  js: 'JS',
  json: 'JSON',
  llm: 'LLM',
  mcp: 'MCP',
  pdf: 'PDF',
  react: 'React',
  sdk: 'SDK',
  sql: 'SQL',
  tti: 'TTI',
  ui: 'UI',
  ux: 'UX',
  xml: 'XML',
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
  'available',
  'commands',
  'community',
  'convention',
  'conventions',
  'execute',
  'existing',
  'workflow',
  'workflows',
  'claude',
  'cursor',
  'windsurf',
  'developer',
  'library',
  'management',
  'mental',
  'project',
  'standard',
  'data',
  'design',
  'finance',
  'browser',
  'documentation',
  'security',
  'communication',
  'devops',
  'productivity',
  'ide',
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

const LOW_VALUE_KEYWORD_PATTERNS = [
  /[*{}]/,
  /[:=]/,
  /^[a-z]+(?:[A-Z][a-z0-9]+)+$/,
  /^[A-Z][A-Za-z0-9]+(?:-[A-Z][A-Za-z0-9]+)+$/,
  /^for\s+/i,
  /^clawdbot$/i,
  /^(?:official|for\s+claude\s+code)$/i,
  /^(?:agent[-\s]+skills?|ide\s+skills?)$/i,
  /^(?:overview|practices?|native|references?|readme|docs?|documentation|guide|guidelines?)$/i,
  /^(?:quick|deep|dive|pattern|command|config|reference)$/i,
  /^quick\s+(?:pattern|command|config|reference)$/i,
];

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
    if (LOW_VALUE_KEYWORD_PATTERNS.some((pattern) => pattern.test(keyword))) continue;
    if (LOW_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
    if (MCP_FIRST_COMBINED_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
    if (normalizedGenericTerms.has(normalized)) continue;

    const words = normalized.split(/[\s-]+/).filter(Boolean);
    const dedupeKey = normalizeText(keyword.replace(/[-_.]+/g, ' '));
    const tokenCount = words.length;
    const isPureGeneric = words.every((t) => normalizedGenericTerms.has(t));
    if (isPureGeneric) continue;

    if (isAsciiOnly(keyword)) {
      if (tokenCount === 1 && normalized.length < 6) continue;
      if (tokenCount > 6) continue;
    }
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    cleaned.push(keyword);
    if (cleaned.length >= max) break;
  }

  return cleaned;
}

export function formatSkillNameForSeo(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if ([...raw].some((char) => char.charCodeAt(0) > 0x7f)) return raw;

  const words = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) return raw;

  return words
    .map((word) => {
      const normalized = word.toLowerCase();
      if (TITLE_CASE_TERMS[normalized]) return TITLE_CASE_TERMS[normalized];
      if (/[A-Z]/.test(word.slice(1))) return word;
      return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    })
    .join(' ');
}

export function normalizeSkillSeoTitleCasing(title: string): string {
  return title.replace(/\b[a-z][a-z0-9]*\b/gi, (word) => TITLE_CASE_TERMS[word.toLowerCase()] || word);
}

export function isLowValueSkillSeoTitle(title: string | undefined, skillName: string): boolean {
  const normalizedTitle = normalizeText(String(title || '').replace(/[|:]\s*killer-skills.*$/i, ''));
  if (!normalizedTitle) return false;

  const normalizedSkillName = normalizeText(formatSkillNameForSeo(skillName));
  const genericSuffixPattern = /\s*(?:\||-)\s*(?:ai\s+agent\s+skills?|ide\s+skills?|developer\s+tools?)$/i;
  const withoutGenericSuffix = normalizeText(formatSkillNameForSeo(normalizedTitle.replace(genericSuffixPattern, '')));

  return Boolean(withoutGenericSuffix && normalizedSkillName && withoutGenericSuffix === normalizedSkillName);
}

export function isLowValueSkillSeoDescription(description: string | undefined, skillName: string): boolean {
  const rawDescription = String(description || '').trim();
  if (!rawDescription) return false;

  const normalizedDescription = normalizeText(rawDescription);
  const normalizedWords = normalizeText(rawDescription.replace(/[-_./]+/g, ' '));
  const normalizedSkillName = normalizeText(formatSkillNameForSeo(skillName));
  const normalizedSkillSlug = normalizeText(String(skillName || '').replace(/[-_./]+/g, ' '));
  const expectedName = normalizedSkillName || normalizedSkillSlug;
  if (!expectedName) return false;

  const firstSentence = normalizeText((rawDescription.split(/[.!?。！？]/u)[0] || '').replace(/[-_./]+/g, ' '));
  if (firstSentence === expectedName || firstSentence === normalizedSkillSlug) return true;

  const repeatedNameBoilerplate = `${expectedName} is an ai agent skill for ${expectedName}`;
  if (normalizedWords.includes(repeatedNameBoilerplate)) return true;

  const slugBoilerplate = `${normalizeText(String(skillName || ''))} is an ai agent skill for`;
  if (normalizedDescription.includes(slugBoilerplate)) return true;

  return false;
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
