import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../i18n';
import type { KeywordClusterId } from './seo-keywords';
import { filterByCategory } from './search';
import { getLocalizedDescription, type UnifiedSkill } from './public-skill-catalog';

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

type LocalizedTextArray = {
  en: string[];
  zh: string[];
  [locale: string]: string[];
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
  // Concrete, scenario-specific use cases this solution page addresses.
  // Adds editorial value beyond the skill-matching template.
  useCases: LocalizedTextArray;
  // Honest limitations of what skills in this scenario can and cannot do.
  // Surfaces trust signals instead of over-promising automation coverage.
  limitations: LocalizedTextArray;
};

type LocalizedSolutionIntent = Omit<
  SolutionIntentConfig,
  'label' | 'cardDescription' | 'pageTitle' | 'pageDescription' | 'useCases' | 'limitations'
> & {
  label: string;
  cardDescription: string;
  pageTitle: string;
  pageDescription: string;
  useCases: string[];
  limitations: string[];
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
    useCases: {
      en: [
        'Chaining multi-step coding tasks that a single prompt cannot complete in one pass.',
        'Orchestrating review, test, and deploy steps so a team can repeat them without manual handoffs.',
        'Running recurring batch jobs (lint, dependency audits, doc generation) on a schedule.',
      ],
      zh: [
        '串联单次提示无法一次完成的多步骤编码任务。',
        '编排评审、测试与部署步骤，让团队无需手动交接即可重复执行。',
        '按计划运行周期性批处理任务（lint、依赖审计、文档生成）。',
      ],
    },
    limitations: {
      en: [
        'Most workflow skills assume a stable repo state; large in-flight branches can break chained steps.',
        'Orchestration skills do not replace CI — they complement it and still need a real pipeline for production gates.',
      ],
      zh: [
        '多数工作流技能假设仓库处于稳定状态；进行中的大分支可能打断链式步骤。',
        '编排技能并不能取代 CI——它是补充，生产环境门禁仍需真正的流水线。',
      ],
    },
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
    useCases: {
      en: [
        'Turning a written SOP into a repeatable agent-driven checklist a new teammate can follow.',
        'Automating handoffs between roles (e.g. dev → review → ops) with explicit approval points.',
        'Standardizing onboarding or release processes so steps are not reinvented per project.',
      ],
      zh: [
        '把书面 SOP 转化为新成员可跟随的、Agent 驱动的可复用检查清单。',
        '在角色之间（如开发→评审→运维）自动化交接，并设置明确审批节点。',
        '标准化入职或发布流程，避免每个项目重新发明步骤。',
      ],
    },
    limitations: {
      en: [
        'Process skills encode team conventions; they need editing to match your actual SOP, not just install-and-run.',
        'They cannot enforce governance on their own — a human or CI gate must still approve sensitive steps.',
      ],
      zh: [
        '流程技能承载的是团队约定；需要根据你的真实 SOP 调整，而非安装即用。',
        '它们无法独自完成治理——敏感步骤仍需人工或 CI 门禁审批。',
      ],
    },
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
    useCases: {
      en: [
        'Generating PDF or DOCX reports from structured data on a recurring schedule.',
        'Filling template-driven documents (invoices, specs, release notes) from a single source of truth.',
        'Producing localized content variants from one master template.',
      ],
      zh: [
        '按计划从结构化数据生成 PDF 或 DOCX 报告。',
        '基于单一数据源填充模板文档（发票、规格说明、发布说明）。',
        '从一个主模板生成本地化内容变体。',
      ],
    },
    limitations: {
      en: [
        'Document skills depend on consistent input schemas; messy or ad-hoc data breaks template output.',
        'Complex layouts (multi-column, embedded charts) often need post-processing the skill cannot do alone.',
      ],
      zh: [
        '文档技能依赖一致的输入 schema；杂乱或临时数据会破坏模板输出。',
        '复杂版式（多栏、嵌入图表）通常需要技能无法独立完成的后处理。',
      ],
    },
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
    useCases: {
      en: [
        'Scraping structured data from paginated listings into a clean JSON or CSV output.',
        'Driving repeatable web actions (login flows, form submission, content checks) across environments.',
        'Running smoke tests against a staging site before each release.',
      ],
      zh: [
        '从分页列表抓取结构化数据，输出干净的 JSON 或 CSV。',
        '跨环境驱动可复用的网页操作（登录流程、表单提交、内容检查）。',
        '在每次发布前对预发布站点运行冒烟测试。',
      ],
    },
    limitations: {
      en: [
        'Browser skills break when target sites change their markup or add bot detection; expect maintenance overhead.',
        'They run with real session credentials — access scope and rate limits must be governed explicitly.',
      ],
      zh: [
        '当目标站点更改标记或加入反爬检测时，浏览器技能会失效；需预留维护成本。',
        '它们以真实会话凭据运行——访问范围与频率限制必须显式管控。',
      ],
    },
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
    useCases: {
      en: [
        'Extracting fields from heterogeneous sources (APIs, logs, PDFs) into one structured schema.',
        'Building a reporting pipeline that refreshes dashboards on a schedule.',
        'Transforming raw exports into validated, typed records before they enter a database.',
      ],
      zh: [
        '从异构来源（API、日志、PDF）提取字段，汇入统一结构化 schema。',
        '搭建按计划刷新仪表盘的报表管线。',
        '在原始导出进入数据库前，转化为已校验的带类型记录。',
      ],
    },
    limitations: {
      en: [
        'Extraction quality depends on source consistency; schema drift silently produces missing or wrong fields.',
        'Heavy ETL workloads belong in a real data pipeline, not an in-IDE agent skill.',
      ],
      zh: [
        '提取质量依赖来源一致性；schema 漂移会悄无声息地产生缺失或错误字段。',
        '重型 ETL 负载应放在真正的数据管线中，而非 IDE 内 Agent 技能。',
      ],
    },
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
    useCases: {
      en: [
        'Composing a Claude Code, Cursor, or Windsurf skill stack for a specific team workflow.',
        'Adding spec-driven or review-gated execution so agents follow team standards before merging.',
        'Sharing a reusable, installable agent configuration across a repo or org.',
      ],
      zh: [
        '为特定团队工作流组合 Claude Code、Cursor 或 Windsurf 技能栈。',
        '加入规格驱动或评审门控执行，让 Agent 在合并前遵循团队标准。',
        '在仓库或组织内共享可复用、可安装的 Agent 配置。',
      ],
    },
    limitations: {
      en: [
        'Agent workflow skills are IDE-bound; a stack tuned for Claude Code does not auto-port to Cursor.',
        'They accelerate execution but do not decide architecture — poor specs still produce poor output.',
      ],
      zh: [
        'Agent 工作流技能与 IDE 绑定；为 Claude Code 调校的栈不会自动迁移到 Cursor。',
        '它们加速执行但不决定架构——糟糕的规格仍会产生糟糕的产出。',
      ],
    },
  },
];

function resolveText(text: LocalizedText, locale: Locale): string {
  return text[locale] || text.en;
}

function resolveTextArray(text: LocalizedTextArray, locale: Locale): string[] {
  const value = text[locale] || text.en;
  return Array.isArray(value) ? value : [];
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
    useCases: resolveTextArray(item.useCases, locale),
    limitations: resolveTextArray(item.limitations, locale),
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
    useCases: resolveTextArray(found.useCases, locale),
    limitations: resolveTextArray(found.limitations, locale),
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
