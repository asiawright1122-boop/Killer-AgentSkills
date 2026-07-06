import type { UnifiedSkill } from './skills';
import { normalizeCategoryId } from './category-taxonomy';
import { getMarketplaceSkills, sortSkillsLatest, sortSkillsPopular } from './marketplace-filters';

export type OccupationDef = {
  id: string;
  label: Record<string, string>;
  description: Record<string, string>;
  categories: string[];
  keywords: string[];
  taskClusters: Array<{
    id: string;
    label: Record<string, string>;
    keywords: string[];
  }>;
};

export type OccupationSummary = {
  id: string;
  label: string;
  description: string;
  href: string;
  skillCount: number;
  tasks: string[];
  skills: UnifiedSkill[];
};

export type OccupationDetail = OccupationSummary & {
  popularSkills: UnifiedSkill[];
  latestSkills: UnifiedSkill[];
  taskClusters: Array<{
    id: string;
    label: string;
    skills: UnifiedSkill[];
  }>;
  relatedCategories: string[];
};

const copy = (value: Record<string, string>, locale: string) => value[locale] || value.zh || value.en || '';

export const OCCUPATION_DEFS: OccupationDef[] = [
  {
    id: 'developer',
    label: { zh: '开发者', en: 'Developer' },
    description: {
      zh: '代码生成、重构、调试、评审和项目自动化。',
      en: 'Coding, refactoring, debugging, review, and project automation.',
    },
    categories: ['developer', 'ai'],
    keywords: ['code', 'coding', 'developer', 'react', 'typescript', 'refactor', 'review', 'github', 'claude-code'],
    taskClusters: [
      { id: 'code-review', label: { zh: '代码评审', en: 'Code review' }, keywords: ['review', 'pr', 'github'] },
      {
        id: 'implementation',
        label: { zh: '实现与重构', en: 'Implementation' },
        keywords: ['code', 'refactor', 'typescript'],
      },
    ],
  },
  {
    id: 'data-analyst',
    label: { zh: '数据分析', en: 'Data analyst' },
    description: {
      zh: 'SQL、报表、可视化、ETL 和数据解释。',
      en: 'SQL, reports, visualization, ETL, and data interpretation.',
    },
    categories: ['data', 'finance'],
    keywords: ['data', 'sql', 'analytics', 'chart', 'visualization', 'etl', 'report'],
    taskClusters: [
      { id: 'query', label: { zh: '查询与清洗', en: 'Query and clean' }, keywords: ['sql', 'database', 'etl'] },
      {
        id: 'reporting',
        label: { zh: '报表与可视化', en: 'Reports and charts' },
        keywords: ['report', 'chart', 'visualization'],
      },
    ],
  },
  {
    id: 'designer',
    label: { zh: '设计师', en: 'Designer' },
    description: {
      zh: '界面、品牌、视觉资产和前端设计流程。',
      en: 'UI, brand, visual assets, and frontend design workflows.',
    },
    categories: ['design'],
    keywords: ['design', 'ui', 'ux', 'figma', 'brand', 'visual', 'frontend', 'css'],
    taskClusters: [
      { id: 'ui', label: { zh: '界面设计', en: 'Interface design' }, keywords: ['ui', 'ux', 'frontend'] },
      { id: 'assets', label: { zh: '视觉资产', en: 'Visual assets' }, keywords: ['brand', 'image', 'visual'] },
    ],
  },
  {
    id: 'devops',
    label: { zh: 'DevOps 工程师', en: 'DevOps engineer' },
    description: {
      zh: '部署、容器、云服务、CI/CD 和监控。',
      en: 'Deployment, containers, cloud, CI/CD, and monitoring.',
    },
    categories: ['devops'],
    keywords: ['deploy', 'docker', 'kubernetes', 'cloud', 'ci', 'cd', 'monitoring', 'server'],
    taskClusters: [
      { id: 'deploy', label: { zh: '部署发布', en: 'Deployments' }, keywords: ['deploy', 'ci', 'cd'] },
      { id: 'ops', label: { zh: '运维排障', en: 'Operations' }, keywords: ['server', 'monitoring', 'docker'] },
    ],
  },
  {
    id: 'product-manager',
    label: { zh: '产品经理', en: 'Product manager' },
    description: {
      zh: '需求梳理、竞品分析、文档和发布协作。',
      en: 'Requirements, competitor analysis, documents, and release collaboration.',
    },
    categories: ['productivity', 'documentation', 'communication'],
    keywords: ['prd', 'product', 'requirements', 'roadmap', 'docs', 'notion', 'slack'],
    taskClusters: [
      {
        id: 'requirements',
        label: { zh: '需求与文档', en: 'Requirements' },
        keywords: ['prd', 'requirements', 'docs'],
      },
      { id: 'coordination', label: { zh: '协作推进', en: 'Coordination' }, keywords: ['slack', 'notion', 'roadmap'] },
    ],
  },
  {
    id: 'security-engineer',
    label: { zh: '安全工程师', en: 'Security engineer' },
    description: {
      zh: '审计、认证、隐私、漏洞检测和合规检查。',
      en: 'Audits, auth, privacy, vulnerability detection, and compliance.',
    },
    categories: ['security'],
    keywords: ['security', 'auth', 'privacy', 'audit', 'vulnerability', 'oauth', 'compliance'],
    taskClusters: [
      {
        id: 'audit',
        label: { zh: '安全审计', en: 'Security audit' },
        keywords: ['audit', 'vulnerability', 'security'],
      },
      { id: 'auth', label: { zh: '认证与隐私', en: 'Auth and privacy' }, keywords: ['auth', 'oauth', 'privacy'] },
    ],
  },
  {
    id: 'content-operator',
    label: { zh: '内容运营', en: 'Content operator' },
    description: {
      zh: '写作、发布、社媒、文档和多语言内容流程。',
      en: 'Writing, publishing, social, docs, and multilingual content.',
    },
    categories: ['documentation', 'communication', 'productivity'],
    keywords: ['content', 'writing', 'markdown', 'blog', 'social', 'translation', 'docs'],
    taskClusters: [
      { id: 'writing', label: { zh: '写作编辑', en: 'Writing' }, keywords: ['writing', 'markdown', 'blog'] },
      { id: 'publishing', label: { zh: '发布分发', en: 'Publishing' }, keywords: ['social', 'translation', 'content'] },
    ],
  },
  {
    id: 'researcher',
    label: { zh: '研究员', en: 'Researcher' },
    description: {
      zh: '资料收集、网页抓取、阅读总结和实验分析。',
      en: 'Research collection, scraping, reading, summaries, and analysis.',
    },
    categories: ['browser', 'data', 'documentation'],
    keywords: ['research', 'browser', 'scrape', 'paper', 'summary', 'analysis', 'pdf'],
    taskClusters: [
      { id: 'collect', label: { zh: '资料收集', en: 'Collect' }, keywords: ['browser', 'scrape', 'research'] },
      { id: 'summarize', label: { zh: '阅读总结', en: 'Summarize' }, keywords: ['summary', 'paper', 'pdf'] },
    ],
  },
  {
    id: 'qa',
    label: { zh: '测试工程师', en: 'QA engineer' },
    description: {
      zh: '测试生成、浏览器自动化、回归验证和质量检查。',
      en: 'Test generation, browser automation, regression, and quality checks.',
    },
    categories: ['browser'],
    keywords: ['test', 'testing', 'qa', 'playwright', 'selenium', 'regression', 'e2e'],
    taskClusters: [
      { id: 'automation', label: { zh: '自动化测试', en: 'Automation' }, keywords: ['playwright', 'selenium', 'e2e'] },
      { id: 'quality', label: { zh: '质量检查', en: 'Quality checks' }, keywords: ['test', 'qa', 'regression'] },
    ],
  },
  {
    id: 'business-ops',
    label: { zh: '业务运营', en: 'Business operations' },
    description: {
      zh: '流程自动化、表格、CRM、邮件和团队协作。',
      en: 'Process automation, spreadsheets, CRM, email, and team workflows.',
    },
    categories: ['productivity', 'finance', 'communication'],
    keywords: ['workflow', 'spreadsheet', 'crm', 'email', 'automation', 'finance', 'operation'],
    taskClusters: [
      {
        id: 'process',
        label: { zh: '流程自动化', en: 'Process automation' },
        keywords: ['workflow', 'automation', 'operation'],
      },
      { id: 'office', label: { zh: '表格与沟通', en: 'Office workflows' }, keywords: ['spreadsheet', 'email', 'crm'] },
    ],
  },
];

function publicText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => publicText(entry)).join(' ');
  if (!value || typeof value !== 'object') return '';
  return Object.values(value as Record<string, unknown>)
    .map((entry) => publicText(entry))
    .join(' ');
}

function searchableText(skill: UnifiedSkill): string {
  return [
    skill.name,
    skill.skillName,
    normalizeCategoryId(skill.category),
    ...(skill.topics || []),
    publicText(skill.description),
    publicText(skill.skillMd),
    publicText(skill.seo),
  ]
    .join(' ')
    .toLowerCase();
}

function skillMatchesOccupation(skill: UnifiedSkill, occupation: OccupationDef): boolean {
  const normalizedCategory = normalizeCategoryId(skill.category);
  if (normalizedCategory && occupation.categories.includes(normalizedCategory)) return true;

  const text = searchableText(skill);
  return occupation.keywords.some((keyword) => text.includes(keyword));
}

export function inferSkillOccupationIds(skill: UnifiedSkill): string[] {
  if (skill.occupationIds?.length) return skill.occupationIds;
  return OCCUPATION_DEFS.filter((occupation) => skillMatchesOccupation(skill, occupation)).map(
    (occupation) => occupation.id,
  );
}

function skillsForOccupation(skills: UnifiedSkill[], occupationId: string): UnifiedSkill[] {
  return getMarketplaceSkills(skills).filter((skill) => inferSkillOccupationIds(skill).includes(occupationId));
}

export function buildOccupationSummaries(skills: UnifiedSkill[], locale: string): OccupationSummary[] {
  return OCCUPATION_DEFS.map((occupation) => {
    const matched = sortSkillsPopular(skillsForOccupation(skills, occupation.id));
    return {
      id: occupation.id,
      label: copy(occupation.label, locale),
      description: copy(occupation.description, locale),
      href: `/${locale}/occupations/${occupation.id}`,
      skillCount: matched.length,
      tasks: occupation.taskClusters.map((task) => copy(task.label, locale)),
      skills: matched.slice(0, 3),
    };
  });
}

export function buildOccupationDetail(
  skills: UnifiedSkill[],
  occupationId: string,
  locale: string,
): OccupationDetail | null {
  const occupation = OCCUPATION_DEFS.find((item) => item.id === occupationId);
  if (!occupation) return null;

  const matched = skillsForOccupation(skills, occupation.id);
  const popularSkills = sortSkillsPopular(matched);
  const latestSkills = sortSkillsLatest(matched);
  const taskClusters = occupation.taskClusters.map((task) => {
    const taskSkills = popularSkills.filter((skill) => {
      const text = searchableText(skill);
      return task.keywords.some((keyword) => text.includes(keyword));
    });
    return { id: task.id, label: copy(task.label, locale), skills: taskSkills.slice(0, 8) };
  });

  return {
    id: occupation.id,
    label: copy(occupation.label, locale),
    description: copy(occupation.description, locale),
    href: `/${locale}/occupations/${occupation.id}`,
    skillCount: matched.length,
    tasks: occupation.taskClusters.map((task) => copy(task.label, locale)),
    skills: popularSkills.slice(0, 3),
    popularSkills: popularSkills.slice(0, 24),
    latestSkills: latestSkills.slice(0, 24),
    taskClusters,
    relatedCategories: occupation.categories,
  };
}
