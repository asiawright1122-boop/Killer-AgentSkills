import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../i18n';
import type { KeywordClusterId } from './seo-keywords';
import { filterByCategory } from './search';
import { getLocalizedDescription, type UnifiedSkill } from './skills';

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
  [locale: string]: string;
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

const INTENT_TOKEN_STOP_WORDS = new Set([
  'for',
  'and',
  'the',
  'with',
  'into',
  'from',
  'your',
  'that',
  'this',
  'agent',
  'agents',
  'ai',
  'skills',
  'skill',
  'server',
  'servers',
  'workflow',
  'automation',
]);

const MIN_PRIMARY_INTENT_SCORE = 10;
const MIN_FALLBACK_INTENT_SCORE = 5;

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
      en: 'Workflow Automation AI Agent Skills',
      zh: '工作流自动化 AI Agent Skills',
    },
    pageDescription: {
      en: 'Discover installable AI agent skills for workflow automation, repeatable task chains, and multi-step execution.',
      zh: '发现适合工作流自动化的 AI Agent Skills，用于重复任务链路和多步骤执行。',
    },
    keywordClusters: ['workflowAutomation', 'templates', 'core'],
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
    keywordClusters: ['processAutomation', 'enterpriseWorkflows', 'core', 'ideCompat'],
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
    keywordClusters: ['browserAutomation', 'workflowAutomation', 'core', 'ideCompat'],
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
    keywordClusters: ['dataWorkflow', 'workflowAutomation', 'core', 'ideCompat'],
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
  return text[locale] || text.en;
}

function hasDirectLocalizedText(text: LocalizedText, locale: Locale): boolean {
  return typeof text[locale] === 'string' && text[locale].trim().length > 0;
}

export function getSolutionSeoEligibleLocales(
  slug?: SolutionSlug,
  locales: readonly Locale[] = SUPPORTED_LOCALES,
): Locale[] {
  const sourceIntents = slug ? SOLUTION_INTENTS.filter((item) => item.slug === slug) : SOLUTION_INTENTS;

  if (sourceIntents.length === 0) {
    return [DEFAULT_LOCALE];
  }

  const eligibleLocales = locales.filter((locale) =>
    sourceIntents.every(
      (item) =>
        hasDirectLocalizedText(item.label, locale) &&
        hasDirectLocalizedText(item.cardDescription, locale) &&
        hasDirectLocalizedText(item.pageTitle, locale) &&
        hasDirectLocalizedText(item.pageDescription, locale),
    ),
  );

  return eligibleLocales.length > 0 ? eligibleLocales : [DEFAULT_LOCALE];
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

function tokenizeIntent(intent: LocalizedSolutionIntent): string[] {
  const raw = [intent.query, ...intent.queries].join(' ');
  return Array.from(
    new Set(
      raw
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !INTENT_TOKEN_STOP_WORDS.has(token)),
    ),
  );
}

function buildSkillSearchText(
  skill: UnifiedSkill,
  locale: Locale,
): {
  fullText: string;
  category: string;
  topics: string;
  description: string;
  name: string;
} {
  const name = `${skill.name || ''} ${skill.skillName || ''}`.toLowerCase();
  const repo = `${skill.owner || ''} ${skill.repo || ''}`.toLowerCase();
  const category = (skill.category || '').toLowerCase();
  const topics = (skill.topics || []).join(' ').toLowerCase();
  const description = getLocalizedDescription(skill.description, locale).toLowerCase();
  return {
    fullText: `${name} ${repo} ${category} ${topics} ${description}`,
    category,
    topics,
    description,
    name,
  };
}

function countTokenHits(fullText: string, tokens: string[]): number {
  let hits = 0;
  for (const token of tokens) {
    if (fullText.includes(token)) hits += 1;
  }
  return hits;
}

function countPhraseHits(
  searchText: ReturnType<typeof buildSkillSearchText>,
  intent: LocalizedSolutionIntent,
): { phraseHits: number; primaryHits: number } {
  const primaryQuery = intent.query.toLowerCase();
  const primaryHits =
    Number(searchText.name.includes(primaryQuery)) +
    Number(searchText.topics.includes(primaryQuery)) +
    Number(searchText.description.includes(primaryQuery)) +
    Number(searchText.category.includes(primaryQuery));

  let phraseHits = 0;
  for (const phrase of intent.queries) {
    const normalized = phrase.toLowerCase();
    if (
      searchText.name.includes(normalized) ||
      searchText.topics.includes(normalized) ||
      searchText.description.includes(normalized) ||
      searchText.category.includes(normalized)
    ) {
      phraseHits += 1;
    }
  }

  return { phraseHits, primaryHits };
}

function hasCategoryAlignment(category: string, intent: LocalizedSolutionIntent): boolean {
  return intent.fallbackCategories.some((target) => category === target || category.includes(target));
}

function calculateIntentScore(
  skill: UnifiedSkill,
  intent: LocalizedSolutionIntent,
  locale: Locale,
  tokens: string[],
): number {
  const searchText = buildSkillSearchText(skill, locale);
  const tokenHits = countTokenHits(searchText.fullText, tokens);
  const { phraseHits, primaryHits } = countPhraseHits(searchText, intent);
  const categoryAligned = hasCategoryAlignment(searchText.category, intent);

  // Guardrail: avoid broad token-only matches that cause low-intent query drift.
  // Stricter requirements: need either phrase/primary hits OR more tokens + category alignment
  if (primaryHits === 0 && phraseHits === 0) {
    // No phrase match: require either category alignment + 4+ tokens, or 6+ tokens alone
    if (!(categoryAligned && tokenHits >= 4) && tokenHits < 6) {
      return 0;
    }
  } else if (primaryHits === 0 && phraseHits < 2 && tokenHits < 3) {
    // Weak phrase match: require more tokens
    return 0;
  }

  let score = 0;
  score += primaryHits * 10; // Increased weight for primary query match
  score += phraseHits * 6; // Increased weight for phrase match
  score += tokenHits * 0.5; // Reduced weight for token-only matches
  if (categoryAligned) score += 3;

  if (skill.source === 'verified') score += 4;
  if (skill.source === 'featured') score += 3;

  score += Math.min(skill.stars || 0, 10000) / 2000;
  return score;
}

export function matchSkillsForIntent(
  skills: UnifiedSkill[],
  intent: LocalizedSolutionIntent,
  locale: Locale,
  limit = 60,
): UnifiedSkill[] {
  const tokens = tokenizeIntent(intent);
  const scoredEntries = skills
    .map((skill) => ({
      skill,
      score: calculateIntentScore(skill, intent, locale, tokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.skill.stars || 0) - (a.skill.stars || 0);
    });

  const scoreById = new Map(scoredEntries.map((item) => [item.skill.id, item.score]));

  const picked: UnifiedSkill[] = [];
  const seen = new Set<string>();

  const getScore = (skill: UnifiedSkill): number => {
    if (!skill?.id) return 0;
    const cached = scoreById.get(skill.id);
    if (typeof cached === 'number') return cached;
    const calculated = calculateIntentScore(skill, intent, locale, tokens);
    scoreById.set(skill.id, calculated);
    return calculated;
  };

  const addSkills = (items: UnifiedSkill[], minScore: number) => {
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      if (getScore(item) < minScore) continue;
      seen.add(item.id);
      picked.push(item);
      if (picked.length >= limit) return;
    }
  };

  addSkills(
    scoredEntries.filter((item) => item.score >= MIN_PRIMARY_INTENT_SCORE).map((item) => item.skill),
    MIN_PRIMARY_INTENT_SCORE,
  );

  if (picked.length < Math.min(36, limit)) {
    for (const category of intent.fallbackCategories) {
      const categoryMatched = filterByCategory(skills, category).sort((a, b) => {
        const scoreDiff = getScore(b) - getScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.stars || 0) - (a.stars || 0);
      });
      addSkills(categoryMatched, MIN_FALLBACK_INTENT_SCORE);
      if (picked.length >= Math.min(48, limit)) break;
    }
  }

  return picked.slice(0, limit);
}
