# Marketplace Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public frontend around Home, Skills, Rankings, Occupations, and Categories while making safety a baseline admission rule and official status a source attribute.

**Architecture:** Add a small marketplace domain layer for occupations, public listing filters, and source/trust badges. Rebuild primary marketplace routes as task-oriented pages, then bring all secondary public routes onto the same restrained visual system so no old navigation or tutorial-heavy layout remains.

**Tech Stack:** Astro 6, TypeScript, Tailwind v4 utilities, existing `UnifiedSkill` data layer, Vitest, Astro check, Playwright/curl smoke checks.

## Global Constraints

- Primary navigation: Home, Skills, Rankings, Occupations, Categories.
- Chinese labels: 首页, Skills, 榜单, 职业, 分类.
- Creators are not a primary navigation item.
- Safety is not a primary navigation item.
- Public marketplace lists only baseline-approved skills.
- Rankings expose only Popular and Latest.
- Official is a source attribute, not a category.
- Skill cards and detail pages still show concise safety/source evidence.
- Preserve dark/light theme support.
- Do not copy competitor visual style or exact category names.
- Do not add verbose instructional blocks to primary routes.
- Do not nest cards inside cards.

---

## File Structure

### New files

- `src/lib/occupations.ts`
  - Owns occupation definitions, task clusters, rule-based skill mapping, occupation summaries, and occupation detail models.
- `src/lib/occupations.test.ts`
  - Tests occupation inference, summary counts, and detail grouping.
- `src/lib/marketplace-filters.ts`
  - Owns public marketplace filtering, source kind detection, popular/latest sorting, and shared listing helpers.
- `src/lib/marketplace-filters.test.ts`
  - Tests baseline approval filtering, official/community source mapping, and ranking sort behavior.
- `src/components/MarketplaceHero.astro`
  - Shared compact hero/search block for marketplace routes.
- `src/components/MarketplaceSection.astro`
  - Shared unframed section wrapper.
- `src/components/MarketplaceSkillList.astro`
  - Shared skill grid/list wrapper around `SkillCard`.
- `src/components/MarketplaceSimplePage.astro`
  - Shared shell for support/legal/legacy pages so secondary routes share the new IA and visual language.
- `src/pages/[locale]/occupations/index.astro`
  - Occupation index.
- `src/pages/[locale]/occupations/[slug].astro`
  - Occupation detail.
- `src/pages/[locale]/categories/[slug].astro`
  - Category detail.

### Modified files

- `src/lib/skills.ts`
  - Add optional `occupationIds`, `taskClusterIds`, and `sourceKind` to `UnifiedSkill`.
- `src/lib/site-ia.ts`
  - Replace current navigation with approved IA.
- `src/lib/marketplace-overview.ts`
  - Make category hrefs point to `/categories/[slug]`; expose featured routes from approved IA.
- `src/components/Header.astro`
  - Use approved IA labels and active-state treatment.
- `src/components/HeaderActionsNative.astro`
  - Ensure mobile menu icon map supports Home/Skills/Rankings/Occupations/Categories.
- `src/components/Footer.astro`
  - Product links mirror approved IA; safety policy moves to footer if retained.
- `src/components/SkillCard.astro`
  - Convert trust chips to concise source/safety evidence: Reviewed, Official/Community, Token, File Write, Network.
- `src/pages/[locale]/index.astro`
  - Rebuild home as marketplace landing hub.
- `src/pages/[locale]/skills/index.astro`
  - Replace redirect with full skill directory.
- `src/pages/[locale]/popular/index.astro`
  - Reduce ranking tabs to Popular and Latest.
- `src/pages/[locale]/categories/index.astro`
  - Replace redirect with category index.
- `src/pages/[locale]/search/index.astro`
  - Keep as functional search/results route, visually aligned with Skills.
- `src/pages/[locale]/safe/index.astro`
  - Remove from primary journey; convert to a compact trust policy page or redirect to `/trust` later.
- Secondary public pages:
  - `src/pages/[locale]/article/index.astro`
  - `src/pages/[locale]/article/[...slug].astro`
  - `src/pages/[locale]/blog/index.astro`
  - `src/pages/[locale]/blog/[...slug].astro`
  - `src/pages/[locale]/blog/category/[category].astro`
  - `src/pages/[locale]/collections/index.astro`
  - `src/pages/[locale]/collections/[...slug].astro`
  - `src/pages/[locale]/cli/index.astro`
  - `src/pages/[locale]/docs/[...slug].astro`
  - `src/pages/[locale]/solutions/index.astro`
  - `src/pages/[locale]/solutions/[topic].astro`
  - `src/pages/[locale]/integrations/index.astro`
  - `src/pages/[locale]/community/index.astro`
  - `src/pages/[locale]/labs/skill-try.astro`
  - `src/pages/[locale]/favorites/index.astro`
  - `src/pages/[locale]/history/index.astro`
  - `src/pages/[locale]/privacy/index.astro`
  - `src/pages/[locale]/terms/index.astro`
  - `src/pages/[locale]/cookies/index.astro`
  - `src/pages/[locale]/sandbox/[owner]/[repo].astro`
  - `src/pages/404.astro`
- `src/messages/zh.json`
  - Add labels for occupation/category/source/safety snippets.
- `src/messages/en.json`
  - Add English labels for the same.
- `src/pages/llms-full.txt.ts`
  - Reflect new route map.
- `src/pages/llms.txt.ts`
  - Reflect new route map.

---

### Task 1: Marketplace Filtering And Occupation Model

**Files:**

- Create: `src/lib/marketplace-filters.ts`
- Create: `src/lib/marketplace-filters.test.ts`
- Create: `src/lib/occupations.ts`
- Create: `src/lib/occupations.test.ts`
- Modify: `src/lib/skills.ts`

**Interfaces:**

- Consumes: `UnifiedSkill` from `src/lib/skills.ts`, `OFFICIAL_REPOS` from `src/lib/skills-config.ts`.
- Produces:
  - `type SourceKind = 'official' | 'community'`
  - `getSkillSourceKind(skill: UnifiedSkill): SourceKind`
  - `isMarketplaceApprovedSkill(skill: UnifiedSkill): boolean`
  - `getMarketplaceSkills(skills: UnifiedSkill[]): UnifiedSkill[]`
  - `sortSkillsPopular(skills: UnifiedSkill[]): UnifiedSkill[]`
  - `sortSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[]`
  - `OCCUPATION_DEFS`
  - `inferSkillOccupationIds(skill: UnifiedSkill): string[]`
  - `buildOccupationSummaries(skills: UnifiedSkill[], locale: string)`
  - `buildOccupationDetail(skills: UnifiedSkill[], occupationId: string, locale: string)`

- [ ] **Step 1: Write marketplace filter tests**

Create `src/lib/marketplace-filters.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import type { UnifiedSkill } from './skills';
import {
  getMarketplaceSkills,
  getSkillSourceKind,
  isMarketplaceApprovedSkill,
  sortSkillsLatest,
  sortSkillsPopular,
} from './marketplace-filters';

const skill = (overrides: Partial<UnifiedSkill>): UnifiedSkill =>
  ({
    id: overrides.id || `${overrides.owner || 'owner'}/${overrides.repo || 'repo'}`,
    name: overrides.name || 'skill',
    skillName: overrides.skillName || overrides.name || 'skill',
    owner: overrides.owner || 'owner',
    repo: overrides.repo || 'repo',
    description: overrides.description || 'Useful agent skill',
    category: overrides.category || 'developer',
    topics: overrides.topics || [],
    stars: overrides.stars ?? 0,
    source: overrides.source || 'cache',
    updatedAt: overrides.updatedAt || '2026-07-01T00:00:00.000Z',
    ...overrides,
  }) as UnifiedSkill;

describe('marketplace filters', () => {
  it('excludes baseline safety failures from public marketplace lists', () => {
    const approved = skill({ name: 'approved', securityLevel: 'A', isTrustedRankingEligible: true });
    const failed = skill({ name: 'failed', securityLevel: 'D', isTrustedRankingEligible: false });

    expect(isMarketplaceApprovedSkill(approved)).toBe(true);
    expect(isMarketplaceApprovedSkill(failed)).toBe(false);
    expect(getMarketplaceSkills([failed, approved]).map((item) => item.name)).toEqual(['approved']);
  });

  it('treats verified official repos as source kind official', () => {
    expect(getSkillSourceKind(skill({ owner: 'anthropics', repo: 'skills' }))).toBe('official');
    expect(getSkillSourceKind(skill({ owner: 'community', repo: 'toolkit' }))).toBe('community');
  });

  it('sorts popular by rank score before stars', () => {
    const trusted = skill({ name: 'trusted', rankScore: 91, stars: 5 });
    const starred = skill({ name: 'starred', rankScore: 40, stars: 5000 });

    expect(sortSkillsPopular([starred, trusted]).map((item) => item.name)).toEqual(['trusted', 'starred']);
  });

  it('sorts latest by updatedAt descending', () => {
    const older = skill({ name: 'older', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = skill({ name: 'newer', updatedAt: '2026-07-01T00:00:00.000Z' });

    expect(sortSkillsLatest([older, newer]).map((item) => item.name)).toEqual(['newer', 'older']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/marketplace-filters.test.ts`

Expected: fail because `src/lib/marketplace-filters.ts` does not exist.

- [ ] **Step 3: Implement marketplace filters**

Create `src/lib/marketplace-filters.ts`:

```ts
import type { UnifiedSkill } from './skills';
import { OFFICIAL_REPOS } from './skills-config';

export type SourceKind = 'official' | 'community';

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));
const OFFICIAL_OWNERS = new Set(
  Object.values(OFFICIAL_REPOS)
    .filter((repo) => repo.verified)
    .map((repo) => repo.owner),
);

export function getSkillSourceKind(skill: UnifiedSkill): SourceKind {
  const key = `${skill.owner}/${skill.repo}`;
  if (skill.source === 'verified' || OFFICIAL_REPO_KEYS.has(key) || OFFICIAL_OWNERS.has(skill.owner)) {
    return 'official';
  }
  return 'community';
}

export function isMarketplaceApprovedSkill(skill: UnifiedSkill): boolean {
  if (skill.securityLevel === 'D') return false;
  if (skill.isTrustedRankingEligible === false) return false;
  return true;
}

export function getMarketplaceSkills(skills: UnifiedSkill[]): UnifiedSkill[] {
  return skills.filter(isMarketplaceApprovedSkill).map((skill) => ({
    ...skill,
    sourceKind: skill.sourceKind || getSkillSourceKind(skill),
  }));
}

export function sortSkillsPopular(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort(
    (a, b) =>
      (b.rankScore || b.qualityScore || 0) - (a.rankScore || a.qualityScore || 0) || (b.stars || 0) - (a.stars || 0),
  );
}

export function sortSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort((a, b) => {
    const byDate = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    if (byDate !== 0) return byDate;
    return sortSkillsPopular([a, b])[0] === a ? -1 : 1;
  });
}
```

- [ ] **Step 4: Add optional fields to `UnifiedSkill`**

Modify `src/lib/skills.ts` interface:

```ts
  occupationIds?: string[];
  taskClusterIds?: string[];
  sourceKind?: 'official' | 'community';
```

- [ ] **Step 5: Write occupation tests**

Create `src/lib/occupations.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import type { UnifiedSkill } from './skills';
import { buildOccupationDetail, buildOccupationSummaries, inferSkillOccupationIds } from './occupations';

const skill = (overrides: Partial<UnifiedSkill>): UnifiedSkill =>
  ({
    id: overrides.id || `${overrides.owner || 'owner'}/${overrides.repo || 'repo'}`,
    name: overrides.name || 'skill',
    skillName: overrides.skillName || overrides.name || 'skill',
    owner: overrides.owner || 'owner',
    repo: overrides.repo || 'repo',
    description: overrides.description || 'Useful agent skill',
    category: overrides.category || 'developer',
    topics: overrides.topics || [],
    stars: overrides.stars ?? 0,
    source: overrides.source || 'cache',
    updatedAt: overrides.updatedAt || '2026-07-01T00:00:00.000Z',
    securityLevel: overrides.securityLevel || 'A',
    isTrustedRankingEligible: overrides.isTrustedRankingEligible ?? true,
    ...overrides,
  }) as UnifiedSkill;

describe('occupations', () => {
  it('infers developer and devops occupations from category and topics', () => {
    expect(inferSkillOccupationIds(skill({ category: 'developer', topics: ['react', 'code-review'] }))).toContain(
      'developer',
    );
    expect(inferSkillOccupationIds(skill({ category: 'devops', topics: ['docker', 'deploy'] }))).toContain('devops');
  });

  it('builds summaries with skill counts and representative skills', () => {
    const summaries = buildOccupationSummaries(
      [
        skill({ name: 'reviewer', category: 'developer', rankScore: 80 }),
        skill({ name: 'deploy', category: 'devops', rankScore: 75 }),
      ],
      'zh',
    );

    expect(summaries.find((item) => item.id === 'developer')?.skillCount).toBeGreaterThan(0);
    expect(summaries.find((item) => item.id === 'developer')?.skills[0].name).toBe('reviewer');
  });

  it('builds occupation detail task clusters', () => {
    const detail = buildOccupationDetail(
      [skill({ name: 'browser-test', category: 'developer', topics: ['testing', 'playwright'] })],
      'qa',
      'en',
    );

    expect(detail?.id).toBe('qa');
    expect(detail?.taskClusters.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Implement occupations**

Create `src/lib/occupations.ts` with an initial occupation set and deterministic keyword rules:

```ts
import type { UnifiedSkill } from './skills';
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
    categories: ['devops', 'security'],
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
    categories: ['security', 'developer'],
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
    categories: ['developer', 'browser'],
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

function searchableText(skill: UnifiedSkill): string {
  const description =
    typeof skill.description === 'string' ? skill.description : Object.values(skill.description || {}).join(' ');
  return [skill.name, skill.skillName, skill.category, ...(skill.topics || []), description].join(' ').toLowerCase();
}

export function inferSkillOccupationIds(skill: UnifiedSkill): string[] {
  if (skill.occupationIds?.length) return skill.occupationIds;
  const text = searchableText(skill);
  return OCCUPATION_DEFS.filter((occupation) => {
    if (occupation.categories.includes(skill.category)) return true;
    return occupation.keywords.some((keyword) => text.includes(keyword));
  }).map((occupation) => occupation.id);
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
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts`

Expected: all tests pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/lib/marketplace-filters.ts src/lib/marketplace-filters.test.ts src/lib/occupations.ts src/lib/occupations.test.ts src/lib/skills.ts
git commit -m "feat: add marketplace occupation model"
```

### Task 2: Navigation And Shared Marketplace Components

**Files:**

- Modify: `src/lib/site-ia.ts`
- Modify: `src/components/Header.astro`
- Modify: `src/components/HeaderActionsNative.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/components/SkillCard.astro`
- Create: `src/components/MarketplaceHero.astro`
- Create: `src/components/MarketplaceSection.astro`
- Create: `src/components/MarketplaceSkillList.astro`
- Create: `src/components/MarketplaceSimplePage.astro`

**Interfaces:**

- Consumes: `SiteNavItem` and current `SkillCard`.
- Produces shared visual primitives used by all route rebuilds.

- [ ] **Step 1: Update navigation IA**

Replace `getPrimaryNavItems()` return values in `src/lib/site-ia.ts` with:

```ts
return [
  {
    id: 'home',
    href: `/${locale}`,
    label: isZh ? '首页' : 'Home',
    icon: 'home',
    description: isZh ? '市场首页、搜索和精选入口。' : 'Marketplace home, search, and featured entry points.',
  },
  {
    id: 'skills',
    href: `/${locale}/skills`,
    label: 'Skills',
    icon: 'sparkles',
    description: isZh ? '完整技能目录与筛选。' : 'Complete skill directory and filters.',
  },
  {
    id: 'rankings',
    href: `/${locale}/popular`,
    label: isZh ? '榜单' : 'Rankings',
    icon: 'grid',
    description: isZh ? '热门与最新 Skills。' : 'Popular and latest skills.',
  },
  {
    id: 'occupations',
    href: `/${locale}/occupations`,
    label: isZh ? '职业' : 'Occupations',
    icon: 'users',
    description: isZh ? '按职业和任务浏览 Skills。' : 'Browse skills by occupation and task.',
  },
  {
    id: 'categories',
    href: `/${locale}/categories`,
    label: isZh ? '分类' : 'Categories',
    icon: 'layers',
    description: isZh ? '按能力类型浏览 Skills。' : 'Browse skills by capability type.',
  },
];
```

Also update type unions:

```ts
export type SiteNavIcon = 'home' | 'sparkles' | 'grid' | 'users' | 'layers';
export type SiteNavItem = {
  id: 'home' | 'skills' | 'rankings' | 'occupations' | 'categories';
  href: string;
  label: string;
  icon: SiteNavIcon;
  description: string;
};
```

- [ ] **Step 2: Update mobile nav icon map**

Add `home` and `sparkles` to `navSvg` in `src/components/HeaderActionsNative.astro`.

- [ ] **Step 3: Create shared hero component**

Create `src/components/MarketplaceHero.astro`:

```astro
---
interface Action {
  href: string;
  label: string;
}

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  locale: string;
  searchPlaceholder?: string;
  searchAction?: string;
  actions?: Action[];
  countLabel?: string;
}

const {
  eyebrow,
  title,
  description,
  locale,
  searchPlaceholder,
  searchAction = `/${locale}/search`,
  actions = [],
  countLabel,
} = Astro.props;
---

<section class="marketplace-hero" aria-labelledby="marketplace-hero-title">
  <div class="marketplace-shell marketplace-hero-grid">
    <div class="marketplace-hero-copy">
      {eyebrow && <p class="marketplace-route-label">{eyebrow}</p>}
      <h1 id="marketplace-hero-title">{title}</h1>
      {description && <p>{description}</p>}
    </div>
    <div class="marketplace-hero-panel">
      {countLabel && <strong>{countLabel}</strong>}
      <form action={searchAction} method="get" role="search">
        <label class="sr-only" for="marketplace-hero-search">{searchPlaceholder || 'Search skills'}</label>
        <input id="marketplace-hero-search" name="q" type="search" placeholder={searchPlaceholder || 'Search skills'} />
        <button type="submit">{locale.startsWith('zh') ? '搜索' : 'Search'}</button>
      </form>
      {
        actions.length > 0 && (
          <div class="marketplace-hero-actions">
            {actions.map((action) => (
              <a href={action.href}>{action.label}</a>
            ))}
          </div>
        )
      }
    </div>
  </div>
</section>
```

- [ ] **Step 4: Create shared section component**

Create `src/components/MarketplaceSection.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  class?: string;
}

const { title, description, actionHref, actionLabel, class: className = '' } = Astro.props;
---

<section class={`marketplace-section ${className}`}>
  <div class="marketplace-shell">
    <div class="marketplace-section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actionHref && actionLabel && <a href={actionHref}>{actionLabel}</a>}
    </div>
    <slot />
  </div>
</section>
```

- [ ] **Step 5: Create shared skill list component**

Create `src/components/MarketplaceSkillList.astro`:

```astro
---
import SkillCard from './SkillCard.astro';
import type { UnifiedSkill } from '../lib/public-skill-catalog';

interface Props {
  skills: UnifiedSkill[];
  locale: string;
  messages?: Record<string, any>;
  emptyTitle?: string;
  emptyText?: string;
}

const { skills, locale, messages, emptyTitle, emptyText } = Astro.props;
---

{
  skills.length > 0 ? (
    <div class="marketplace-skill-grid">
      {skills.map((skill) => (
        <SkillCard skill={skill} locale={locale} messages={messages} />
      ))}
    </div>
  ) : (
    <div class="marketplace-empty">
      <strong>{emptyTitle || (locale.startsWith('zh') ? '暂无结果' : 'No results')}</strong>
      {emptyText && <span>{emptyText}</span>}
    </div>
  )
}
```

- [ ] **Step 6: Create simple page shell component**

Create `src/components/MarketplaceSimplePage.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<main class="marketplace-simple">
  <div class="marketplace-shell">
    <header>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
    <div class="marketplace-simple-body">
      <slot />
    </div>
  </div>
</main>
```

- [ ] **Step 7: Add global marketplace CSS**

Append focused classes to `src/styles/global.css`:

```css
.marketplace-shell {
  width: min(1180px, calc(100% - 2rem));
  margin-inline: auto;
}

.marketplace-hero {
  padding: 3.5rem 0 2.5rem;
  border-bottom: 1px solid var(--border);
}

.marketplace-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  gap: 2rem;
  align-items: end;
}

.marketplace-route-label {
  margin: 0 0 0.75rem;
  color: var(--muted-foreground);
  font-weight: 750;
}

.marketplace-hero h1,
.marketplace-simple h1 {
  font-size: clamp(2.25rem, 6vw, 5rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  max-width: 11ch;
}

.marketplace-hero p,
.marketplace-simple header p {
  max-width: 64ch;
  color: var(--muted-foreground);
  font-size: 1.125rem;
  line-height: 1.6;
}

.marketplace-hero-panel,
.marketplace-simple-body {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--card) 86%, var(--background));
  padding: 1rem;
}

.marketplace-hero-panel form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.marketplace-hero-panel input,
.marketplace-filterbar input,
.marketplace-filterbar select {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  padding: 0.75rem 0.875rem;
  font-weight: 650;
}

.marketplace-hero-panel button,
.marketplace-hero-actions a,
.marketplace-section-head a,
.marketplace-filterbar button {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--foreground);
  color: var(--background);
  padding: 0.75rem 0.95rem;
  font-weight: 800;
}

.marketplace-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.marketplace-section {
  padding: 2.75rem 0;
}

.marketplace-section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.marketplace-section-head h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
}

.marketplace-section-head p {
  margin: 0.35rem 0 0;
  color: var(--muted-foreground);
  max-width: 68ch;
}

.marketplace-skill-grid,
.marketplace-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.marketplace-card-link {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--card) 88%, var(--background));
  padding: 1rem;
  color: var(--foreground);
  text-decoration: none;
}

.marketplace-card-link:hover {
  border-color: color-mix(in oklch, var(--accent) 58%, var(--border));
}

.marketplace-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.marketplace-filterbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(140px, auto));
  gap: 0.75rem;
  margin-top: 1rem;
}

.marketplace-empty {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  color: var(--muted-foreground);
}

@media (max-width: 800px) {
  .marketplace-hero-grid,
  .marketplace-filterbar {
    grid-template-columns: 1fr;
  }

  .marketplace-section-head {
    align-items: start;
    flex-direction: column;
  }
}
```

- [ ] **Step 8: Update SkillCard badges**

In `src/components/SkillCard.astro`, replace visible chip labels with user-facing evidence:

- Official/community source.
- Reviewed when `securityLevel` is not `D`.
- Token/File/Network chips based on `riskFlags`.
- Keep rank score in title or hidden title text, not as a primary chip.

- [ ] **Step 9: Verify build primitives**

Run:

```bash
npx tsc --noEmit --project tsconfig.json
npx prettier --write src/lib/site-ia.ts src/components/Header.astro src/components/HeaderActionsNative.astro src/components/Footer.astro src/components/SkillCard.astro src/components/MarketplaceHero.astro src/components/MarketplaceSection.astro src/components/MarketplaceSkillList.astro src/components/MarketplaceSimplePage.astro src/styles/global.css
```

Expected: TypeScript passes; Prettier completes.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/lib/site-ia.ts src/components/Header.astro src/components/HeaderActionsNative.astro src/components/Footer.astro src/components/SkillCard.astro src/components/MarketplaceHero.astro src/components/MarketplaceSection.astro src/components/MarketplaceSkillList.astro src/components/MarketplaceSimplePage.astro src/styles/global.css
git commit -m "feat: add marketplace frontend primitives"
```

### Task 3: Rebuild Home, Skills, Search, And Rankings

**Files:**

- Modify: `src/pages/[locale]/index.astro`
- Modify: `src/pages/[locale]/skills/index.astro`
- Modify: `src/pages/[locale]/search/index.astro`
- Modify: `src/pages/[locale]/popular/index.astro`

**Interfaces:**

- Consumes: marketplace filters, occupation summaries, marketplace components.
- Produces: complete primary routes for landing, directory, search, and rankings.

- [ ] **Step 1: Rebuild home**

Update `src/pages/[locale]/index.astro` to:

- Fetch `getLightweightSkillsTop(env, 360)`.
- Apply `getMarketplaceSkills()`.
- Build popular and latest slices.
- Build occupation summaries.
- Build marketplace overview categories.
- Render `MarketplaceHero`, sections for popular, occupations, latest, categories, and a compact trust statement.

- [ ] **Step 2: Rebuild `/skills`**

Replace redirect in `src/pages/[locale]/skills/index.astro` with a full directory page using:

- `getLightweightSkillsTop(env, 480)`.
- Query params: `q`, `category`, `occupation`, `source`, `sort`.
- Source options: all, official, community.
- Sort options: popular, latest.
- Results through `MarketplaceSkillList`.

- [ ] **Step 3: Align `/search`**

Keep `/search` functional but make it visually identical to `/skills` search/results behavior. The route can remain noindex when query/filter params are present.

- [ ] **Step 4: Simplify rankings**

Modify `src/pages/[locale]/popular/index.astro`:

- Use only `rank=popular` and `rank=latest`.
- Default rank is `popular`.
- Remove user-facing trusted/security tabs.
- Keep baseline safety filtering via `getMarketplaceSkills()`.

- [ ] **Step 5: Smoke test route HTML**

Run:

```bash
python3 - <<'PY'
import urllib.request
for path in ['/zh', '/zh/skills', '/zh/search', '/zh/popular']:
    html = urllib.request.urlopen('http://127.0.0.1:4321' + path, timeout=30).read().decode('utf-8', 'ignore')
    print(path, {'bytes': len(html), 'cards': html.count('data-testid="skill-card"'), 'oldSafetyTabs': '安全榜' in html or '可信榜' in html})
PY
```

Expected: all routes return HTML; `/zh/skills`, `/zh/search`, `/zh/popular` show skill cards; no trusted/safety ranking tabs.

- [ ] **Step 6: Commit**

Run:

```bash
git add 'src/pages/[locale]/index.astro' 'src/pages/[locale]/skills/index.astro' 'src/pages/[locale]/search/index.astro' 'src/pages/[locale]/popular/index.astro'
git commit -m "feat: rebuild marketplace core routes"
```

### Task 4: Build Occupation Routes

**Files:**

- Create: `src/pages/[locale]/occupations/index.astro`
- Create: `src/pages/[locale]/occupations/[slug].astro`
- Modify: `src/pages/llms-full.txt.ts`
- Modify: `src/pages/llms.txt.ts`

**Interfaces:**

- Consumes: `buildOccupationSummaries()` and `buildOccupationDetail()`.
- Produces: occupation index and detail pages.

- [ ] **Step 1: Implement `/occupations` index**

Create `src/pages/[locale]/occupations/index.astro`:

- Fetch marketplace skills.
- Build summaries.
- Render occupation cards with tasks, count, and representative skills.
- Include search hero.

- [ ] **Step 2: Implement occupation detail route**

Create `src/pages/[locale]/occupations/[slug].astro`:

- Validate locale and slug.
- Fetch marketplace skills.
- Build detail.
- Return 404 for unknown slug.
- Render overview, task clusters, popular skills, latest skills, and related categories.

- [ ] **Step 3: Update LLM route docs**

Update `src/pages/llms-full.txt.ts` and `src/pages/llms.txt.ts` to include Occupations and remove Safety from primary route descriptions.

- [ ] **Step 4: Smoke test occupations**

Run:

```bash
python3 - <<'PY'
import urllib.request
for path in ['/zh/occupations', '/zh/occupations/developer', '/zh/occupations/data-analyst']:
    html = urllib.request.urlopen('http://127.0.0.1:4321' + path, timeout=30).read().decode('utf-8', 'ignore')
    print(path, {'bytes': len(html), 'occupation': '职业' in html or 'Occupation' in html, 'cards': html.count('data-testid="skill-card"')})
PY
```

Expected: all routes return non-empty HTML; detail pages show skill cards.

- [ ] **Step 5: Commit**

Run:

```bash
git add 'src/pages/[locale]/occupations/index.astro' 'src/pages/[locale]/occupations/[slug].astro' src/pages/llms-full.txt.ts src/pages/llms.txt.ts
git commit -m "feat: add occupation marketplace routes"
```

### Task 5: Build Category Index And Detail Routes

**Files:**

- Modify: `src/pages/[locale]/categories/index.astro`
- Create: `src/pages/[locale]/categories/[slug].astro`
- Modify: `src/lib/marketplace-overview.ts`
- Modify: `tests/pages/api/categories.test.ts` only if route expectations need updated API labels.

**Interfaces:**

- Consumes: `CATEGORY_DEFS`, `getMarketplaceOverview()`, `filterByCategory()`, occupation summaries.
- Produces: real category browse pages.

- [ ] **Step 1: Update category hrefs**

In `src/lib/marketplace-overview.ts`, change category hrefs from:

```ts
href: `/${locale}/search?category=${definition.id}`,
```

to:

```ts
href: `/${locale}/categories/${definition.id}`,
```

- [ ] **Step 2: Implement category index**

Replace redirect in `src/pages/[locale]/categories/index.astro` with a real index:

- Fetch overview and marketplace skills.
- Render category cards with count, description, top skills, and related occupations.
- Use shared hero and section components.

- [ ] **Step 3: Implement category detail**

Create `src/pages/[locale]/categories/[slug].astro`:

- Validate category slug against `CATEGORY_DEFS`.
- Fetch marketplace skills and filter by category.
- Render overview, popular skills, latest skills, and related occupations.

- [ ] **Step 4: Smoke test categories**

Run:

```bash
python3 - <<'PY'
import urllib.request
for path in ['/zh/categories', '/zh/categories/developer', '/zh/categories/data']:
    html = urllib.request.urlopen('http://127.0.0.1:4321' + path, timeout=30).read().decode('utf-8', 'ignore')
    print(path, {'bytes': len(html), 'cards': html.count('data-testid="skill-card"'), 'redirectLike': 'Astro.redirect' in html})
PY
```

Expected: all routes return non-empty HTML; no redirect behavior.

- [ ] **Step 5: Commit**

Run:

```bash
git add 'src/pages/[locale]/categories/index.astro' 'src/pages/[locale]/categories/[slug].astro' src/lib/marketplace-overview.ts tests/pages/api/categories.test.ts
git commit -m "feat: add marketplace category routes"
```

### Task 6: Align Secondary Routes To The New Frontend System

**Files:**

- Modify all secondary route files listed in File Structure.
- Use: `src/components/MarketplaceSimplePage.astro`.

**Interfaces:**

- Consumes: shared simple page shell.
- Produces: route pages that share the new nav, spacing, typography, and do not expose stale primary IA.

- [ ] **Step 1: Replace legacy route hero shells**

For every secondary page, keep existing data fetching/content where needed, but replace top-level bespoke hero/layout scaffolding with:

```astro
<MarketplaceSimplePage title={pageTitle} description={pageDescription}>
  <!-- existing core content, simplified cards/lists only -->
</MarketplaceSimplePage>
```

- [ ] **Step 2: Remove stale primary IA words**

Search and remove old visible primary IA labels:

```bash
rg "探索|专题|可信榜|安全榜|Explore|Topics|Trusted ranking|Security ranking" src/pages src/components src/messages
```

Allowed exceptions:

- Article content under `src/content`.
- Technical variable names that are not visible UI.
- Footer policy links.

- [ ] **Step 3: Smoke test secondary routes**

Run:

```bash
python3 - <<'PY'
import urllib.request
paths = [
  '/zh/article',
  '/zh/blog',
  '/zh/collections',
  '/zh/cli',
  '/zh/community',
  '/zh/docs/getting-started',
  '/zh/integrations',
  '/zh/solutions',
  '/zh/favorites',
  '/zh/history',
  '/zh/privacy',
  '/zh/terms',
  '/zh/cookies',
]
for path in paths:
    try:
        html = urllib.request.urlopen('http://127.0.0.1:4321' + path, timeout=30).read().decode('utf-8', 'ignore')
        print(path, {'bytes': len(html), 'oldNav': any(x in html[:20000] for x in ['探索', '专题', '可信榜', '安全榜'])})
    except Exception as exc:
        print(path, {'error': str(exc)})
PY
```

Expected: routes return HTML or intentional 404; visible old primary IA does not appear in the first 20KB.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/pages src/components/MarketplaceSimplePage.astro src/messages/zh.json src/messages/en.json
git commit -m "feat: align secondary routes with marketplace IA"
```

### Task 7: Full Verification And Visual Checks

**Files:**

- No planned edits unless verification finds defects.

**Interfaces:**

- Consumes: all previous tasks.
- Produces: verified, running local frontend.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npx vitest run src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts src/lib/marketplace-overview.test.ts src/lib/kv.test.ts src/lib/search.test.ts src/lib/skill-trust.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run type and Astro checks**

Run:

```bash
npx tsc --noEmit --project tsconfig.json
npm run check:astro
```

Expected: no errors. Existing warnings are acceptable only if they predate this plan and do not touch new files.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: build completes.

- [ ] **Step 4: Restart dev server**

If an old server is running, stop it and start:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: local URL is `http://127.0.0.1:4321/`.

- [ ] **Step 5: HTML smoke check all primary routes**

Run:

```bash
python3 - <<'PY'
import urllib.request
paths = ['/zh', '/zh/skills', '/zh/popular', '/zh/occupations', '/zh/occupations/developer', '/zh/categories', '/zh/categories/developer', '/zh/search']
for path in paths:
    html = urllib.request.urlopen('http://127.0.0.1:4321' + path, timeout=30).read().decode('utf-8', 'ignore')
    header = html[html.find('<header'):html.find('</header>') + 9]
    print(path, {
        'bytes': len(html),
        'cards': html.count('data-testid="skill-card"'),
        'nav': [x for x in ['首页', 'Skills', '榜单', '职业', '分类'] if x in header],
        'oldTabs': any(x in html for x in ['可信榜', '安全榜']),
        'invalidHookHtml': 'Invalid hook call' in html or 'useContext' in html,
    })
PY
```

Expected: all primary routes return HTML, nav has approved labels, no trusted/safety ranking tabs.

- [ ] **Step 6: Playwright screenshot check**

Run a Playwright script over desktop and mobile:

```bash
node - <<'NODE'
const { chromium } = require('playwright');
const routes = ['/zh', '/zh/skills', '/zh/popular', '/zh/occupations', '/zh/categories'];
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    for (const route of routes) {
      await page.goto('http://127.0.0.1:4321' + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const bad = await page.evaluate(() => {
        const all = [...document.querySelectorAll('body *')];
        return all.some((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return style.visibility !== 'hidden' && rect.width > window.innerWidth + 8;
        });
      });
      console.log(route, viewport.width, { horizontalOverflow: bad, title: await page.title() });
    }
    await page.close();
  }
  await browser.close();
})();
NODE
```

Expected: no horizontal overflow on primary routes.

- [ ] **Step 7: Final commit**

If verification required fixes:

```bash
git add src docs tests
git commit -m "fix: verify marketplace frontend redesign"
```

If no fixes were needed, do not create an empty commit.
