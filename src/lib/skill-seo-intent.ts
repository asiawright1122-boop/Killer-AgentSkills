import type { Locale } from '../i18n';
import { normalizeCategoryId } from './category-taxonomy';

type LocalizedText = {
  en: string;
  zh: string;
};

type IntentConfig = {
  titleLabel: LocalizedText;
  useCaseLabel: LocalizedText;
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
    titleLabel: {
      en: 'Browser Automation Skill',
      zh: '浏览器自动化 Skill',
    },
    useCaseLabel: {
      en: 'web browsing, scraping, and browser automation',
      zh: '网页浏览、抓取与浏览器自动化',
    },
    keywords: ['browser automation', 'web scraping', 'browser skill'],
  },
  finance: {
    titleLabel: {
      en: 'Finance Automation Skill',
      zh: '金融支付 Skill',
    },
    useCaseLabel: {
      en: 'payments, billing, and finance automation',
      zh: '支付、账单与金融自动化',
    },
    keywords: ['finance automation', 'payments automation', 'billing tools'],
  },
  productivity: {
    titleLabel: {
      en: 'Productivity Workflow Skill',
      zh: '效率工作流 Skill',
    },
    useCaseLabel: {
      en: 'productivity workflows, task execution, and automation',
      zh: '效率提升、任务执行与工作流自动化',
    },
    keywords: ['productivity skill', 'workflow automation', 'task automation'],
  },
  developer: {
    titleLabel: {
      en: 'Developer Tool Skill',
      zh: '开发工具 Skill',
    },
    useCaseLabel: {
      en: 'coding, debugging, and developer automation',
      zh: '编码、调试与开发自动化',
    },
    keywords: ['developer tool skill', 'code automation', 'developer tools'],
  },
  data: {
    titleLabel: {
      en: 'Data Workflow Skill',
      zh: '数据处理 Skill',
    },
    useCaseLabel: {
      en: 'data access, analysis, and ETL workflows',
      zh: '数据访问、分析与 ETL 工作流',
    },
    keywords: ['data workflow skill', 'data automation', 'etl workflows'],
  },
  ai: {
    titleLabel: {
      en: 'AI Workflow Skill',
      zh: 'AI 工作流 Skill',
    },
    useCaseLabel: {
      en: 'LLM workflows, evaluation, and AI automation',
      zh: 'LLM 工作流、评估与 AI 自动化',
    },
    keywords: ['ai workflow skill', 'llm automation', 'agentic workflows'],
  },
  design: {
    titleLabel: {
      en: 'Design Automation Skill',
      zh: '设计创作 Skill',
    },
    useCaseLabel: {
      en: 'UI generation, design systems, and visual workflows',
      zh: 'UI 生成、设计系统与视觉工作流',
    },
    keywords: ['design automation', 'ui generation', 'design systems'],
  },
  documentation: {
    titleLabel: {
      en: 'Documentation Skill',
      zh: '文档自动化 Skill',
    },
    useCaseLabel: {
      en: 'documentation, knowledge base, and content workflows',
      zh: '文档生成、知识库与内容工作流',
    },
    keywords: ['documentation skill', 'knowledge base automation', 'content workflows'],
  },
  devops: {
    titleLabel: {
      en: 'DevOps Automation Skill',
      zh: 'DevOps 自动化 Skill',
    },
    useCaseLabel: {
      en: 'deployment, infrastructure, and ops automation',
      zh: '部署、基础设施与运维自动化',
    },
    keywords: ['devops automation', 'infrastructure automation', 'deployment workflows'],
  },
  security: {
    titleLabel: {
      en: 'Security Audit Skill',
      zh: '安全审计 Skill',
    },
    useCaseLabel: {
      en: 'security reviews, vulnerability checks, and compliance',
      zh: '安全审查、漏洞检测与合规',
    },
    keywords: ['security audit skill', 'vulnerability scanning', 'security automation'],
  },
  communication: {
    titleLabel: {
      en: 'Communication Skill',
      zh: '沟通协作 Skill',
    },
    useCaseLabel: {
      en: 'messaging, handoffs, and team collaboration',
      zh: '消息沟通、交接与团队协作',
    },
    keywords: ['communication skill', 'team collaboration', 'messaging automation'],
  },
  default: {
    titleLabel: {
      en: 'AI Agent Skill',
      zh: 'AI Agent Skill',
    },
    useCaseLabel: {
      en: 'AI agent workflows and automation',
      zh: 'AI Agent 工作流与自动化',
    },
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
    if (isAsciiOnly(keyword)) {
      const tokenCount = normalized.split(' ').filter(Boolean).length;
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
  locale: Locale,
): SkillSeoIntent {
  const normalizedCategory = normalizeCategoryId(category);
  const intentId = normalizedCategory && CATEGORY_INTENTS[normalizedCategory] ? normalizedCategory : 'default';
  const config = CATEGORY_INTENTS[intentId];
  const isZh = locale === 'zh';
  const localizedKeywords = config.keywords;
  const supportTerm = pickSupportTerm(rawKeywords, localizedKeywords);

  return {
    id: intentId,
    titleLabel: isZh ? config.titleLabel.zh : config.titleLabel.en,
    useCaseLabel: isZh ? config.useCaseLabel.zh : config.useCaseLabel.en,
    keywords: localizedKeywords,
    supportTerm,
  };
}
