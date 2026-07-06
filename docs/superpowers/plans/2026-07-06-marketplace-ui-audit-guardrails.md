# Marketplace UI Audit Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated guardrails that preserve the new marketplace IA, source/ranking/admission logic, skill-detail install decision surface, and desktop/mobile browser behavior.

**Architecture:** Keep product logic centralized in `src/lib/site-ia.ts` and `src/lib/marketplace-filters.ts`; test route wiring with existing source-level Vitest checks; test visual route behavior with Playwright against the local Astro dev server. Do not redesign pages in this slice unless a guardrail exposes a concrete bug.

**Tech Stack:** Astro 6, Tailwind v4 CSS tokens, Vitest 4, Playwright 1.58, TypeScript, existing source-inspection helpers in `tests/pages/public-links.test.ts`.

## Global Constraints

- Primary public IA stays: Home, Skills, Rankings, Occupations, Categories.
- Legacy routes may remain only as bridges back into this IA.
- Popular sorting is `rankScore`, then `qualityScore`, then stars, then name.
- Latest sorting is `updatedAt`, then Popular as tie-break.
- Public marketplace listings exclude `securityLevel === "D"` and `isTrustedRankingEligible === false`.
- Official/community is source evidence, not a top-level category.
- Safety is a review policy and admission layer; it should not become generic caution copy.
- Do not reintroduce Topics, Hot, Explore, or Docs into the primary header.
- No public UI may expose internal strategy, chain-of-thought, recovery, rollout, or implementation rationale copy.
- Radius stays at 8px except chips and icon buttons; letter spacing stays at 0.

---

## File Structure

- Modify `src/lib/site-ia.ts`: export route ID constants so UI and tests can share the primary marketplace IA contract.
- Modify `src/components/Header.astro`: add stable test IDs to the header and desktop nav without changing visual output.
- Modify `src/components/HeaderActionsNative.astro`: add stable test IDs and `data-state` to mobile drawer controls; keep body-hoisted overlay behavior.
- Modify `src/pages/[locale]/skills/[owner]/[...repo].astro`: add stable test IDs to skill-detail decision and evidence sections.
- Modify `tests/pages/public-links.test.ts`: add static public-surface guardrails for IA, listing route wiring, safety route framing, and detail decision exposure.
- Modify `tests/e2e/navigation.spec.ts`: remove stale collections-primary-nav assumptions and update route expectations to the new marketplace IA.
- Create `tests/e2e/marketplace-ui.spec.ts`: desktop/mobile browser audit for core routes and one representative skill detail route.

---

### Task 1: Primary IA And Header Contract

**Files:**

- Modify: `src/lib/site-ia.ts`
- Modify: `src/components/Header.astro`
- Modify: `src/components/HeaderActionsNative.astro`
- Modify: `tests/pages/public-links.test.ts`

**Interfaces:**

- Produces: `PRIMARY_MARKETPLACE_NAV_IDS: readonly SiteNavItem['id'][]`
- Produces: `PRIMARY_MARKETPLACE_NAV_HREFS(locale: string): string[]`
- Produces DOM contracts: `data-testid="site-header"`, `data-testid="desktop-primary-nav"`, `data-testid="header-actions"`, `data-testid="mobile-menu-toggle"`, `data-testid="mobile-menu-overlay"`, `data-testid="mobile-menu-panel"`
- Consumes: existing `getPrimaryNavItems(locale: string): SiteNavItem[]`

- [ ] **Step 1: Write the failing IA/header source test**

Add this test near the existing marketplace navigation tests in `tests/pages/public-links.test.ts`:

```ts
it('keeps the primary marketplace IA centralized and free of old header taxonomies', async () => {
  const { getPrimaryNavItems, PRIMARY_MARKETPLACE_NAV_IDS, PRIMARY_MARKETPLACE_NAV_HREFS } =
    await import('../../src/lib/site-ia');
  const headerSource = readPageSource('../components/Header.astro');
  const headerActionsSource = readPageSource('../components/HeaderActionsNative.astro');

  expect(PRIMARY_MARKETPLACE_NAV_IDS).toEqual(['home', 'skills', 'rankings', 'occupations', 'categories']);
  expect(PRIMARY_MARKETPLACE_NAV_HREFS('zh')).toEqual([
    '/zh',
    '/zh/skills',
    '/zh/popular',
    '/zh/occupations',
    '/zh/categories',
  ]);
  expect(getPrimaryNavItems('zh').map((item) => item.label)).toEqual(['首页', 'Skills', '榜单', '职业', '分类']);
  expect(getPrimaryNavItems('en').map((item) => item.label)).toEqual([
    'Home',
    'Skills',
    'Rankings',
    'Occupations',
    'Categories',
  ]);

  expect(headerSource).toContain('data-testid="site-header"');
  expect(headerSource).toContain('data-testid="desktop-primary-nav"');
  expect(headerSource).toContain('getPrimaryNavItems(locale)');
  expect(headerActionsSource).toContain('data-testid="header-actions"');
  expect(headerActionsSource).toContain('data-testid="mobile-menu-toggle"');
  expect(headerActionsSource).toContain('data-testid="mobile-menu-overlay"');
  expect(headerActionsSource).toContain('data-testid="mobile-menu-panel"');
  expect(headerActionsSource).toContain('document.body.appendChild(overlay)');
  expect(headerActionsSource).toContain("overlay?.dataset.state = 'open';");
  expect(headerActionsSource).toContain("overlay?.dataset.state = 'closed';");

  const primaryHeaderSource = `${headerSource}\n${headerActionsSource}`;
  expect(primaryHeaderSource).not.toMatch(/专题|热门|探索|文档|Topics|Hot|Explore|Docs/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run tests/pages/public-links.test.ts --reporter=verbose
```

Expected: FAIL because `PRIMARY_MARKETPLACE_NAV_IDS`, `PRIMARY_MARKETPLACE_NAV_HREFS`, and the new `data-testid` / `data-state` contracts do not exist yet.

- [ ] **Step 3: Centralize IA constants**

Update `src/lib/site-ia.ts` to export route IDs and hrefs:

```ts
export type SiteNavIcon = 'home' | 'sparkles' | 'grid' | 'users' | 'layers';

export type SiteNavItem = {
  id: 'home' | 'skills' | 'rankings' | 'occupations' | 'categories';
  href: string;
  label: string;
  icon: SiteNavIcon;
  description: string;
};

export const PRIMARY_MARKETPLACE_NAV_IDS = [
  'home',
  'skills',
  'rankings',
  'occupations',
  'categories',
] as const satisfies readonly SiteNavItem['id'][];

export const PRIMARY_MARKETPLACE_NAV_HREFS = (locale: string): string[] =>
  PRIMARY_MARKETPLACE_NAV_IDS.map((id) => {
    if (id === 'home') return `/${locale}`;
    if (id === 'rankings') return `/${locale}/popular`;
    return `/${locale}/${id}`;
  });
```

Then make `getPrimaryNavItems(locale)` build from a `Record<SiteNavItem['id'], Omit<SiteNavItem, 'id' | 'href'>>` and `PRIMARY_MARKETPLACE_NAV_IDS.map(...)` so the ordering is single-source.

- [ ] **Step 4: Add stable header test IDs**

Update `src/components/Header.astro`:

```astro
<header
  data-testid="site-header"
  class="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--background)]/88 backdrop-blur-xl transition-all safe-area-px"
>
</header>
```

Update the desktop nav opening tag:

```astro
<nav
  data-testid="desktop-primary-nav"
  aria-label="Main navigation"
  class="hidden lg:flex items-center gap-1 xl:gap-4 text-sm font-bold text-[var(--foreground)] whitespace-nowrap shrink-0"
>
</nav>
```

Update the root actions wrapper in `src/components/HeaderActionsNative.astro`:

```astro
<div
  data-testid="header-actions"
  class="header-actions flex items-center gap-2 md:gap-4"
  data-locale={locale}
  data-dark-label={labels.darkMode || 'Dark Mode'}
  data-light-label={labels.lightMode || 'Light Mode'}
>
</div>
```

Add test IDs to the mobile controls:

```astro
<button data-testid="mobile-menu-toggle" class="header-mobile-toggle md:hidden inline-flex h-11 w-11 items-center
justify-center rounded-md border border-[var(--border)] hover:bg-[var(--card)] text-[var(--foreground)]
transition-colors"
```

```astro
<div
  data-testid="mobile-menu-overlay"
  data-state="closed"
  class="header-mobile-overlay hidden fixed inset-0 z-[60] md:hidden overflow-hidden transition-all duration-150 ease-out invisible opacity-0 pointer-events-none"
  aria-hidden="true"
>
</div>
```

```astro
<div
  data-testid="mobile-menu-panel"
  class="header-mobile-panel absolute inset-y-4 right-4 left-4 sm:left-auto sm:w-[420px] rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col transition-transform duration-200 ease-out translate-x-full translate-y-4 overflow-hidden"
>
</div>
```

- [ ] **Step 5: Wire mobile menu state**

In `openMobileMenu()` inside `src/components/HeaderActionsNative.astro`, add:

```ts
if (overlay) overlay.dataset.state = 'open';
```

In `closeMobileMenu()`, add:

```ts
if (overlay) overlay.dataset.state = 'closed';
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```bash
npx vitest run tests/pages/public-links.test.ts --reporter=verbose
```

Expected: PASS, including the new IA/header test.

- [ ] **Step 7: Commit**

```bash
git add src/lib/site-ia.ts src/components/Header.astro src/components/HeaderActionsNative.astro tests/pages/public-links.test.ts
git commit -m "test: guard marketplace primary navigation"
```

---

### Task 2: Listing Routes And Review Policy Guardrails

**Files:**

- Modify: `tests/pages/public-links.test.ts`
- Modify only when the new test exposes a mismatch: `src/pages/[locale]/index.astro`, `src/pages/[locale]/skills/index.astro`, `src/pages/[locale]/popular/index.astro`, `src/pages/[locale]/occupations/index.astro`, `src/pages/[locale]/categories/index.astro`, `src/pages/[locale]/safe/index.astro`

**Interfaces:**

- Consumes: `getMarketplaceSkills(skillsFetched)` as the admission gate.
- Consumes: `sortSkillsPopular`, `sortSkillsLatest`, `getSkillSourceKind`, `filterByCategory`, `inferSkillOccupationIds`.
- Produces: source-level regression tests proving public listing routes use the shared filters and the Review Policy page exposes admission metrics/rules.

- [ ] **Step 1: Write the failing or characterization route-wiring test**

Add this test to `tests/pages/public-links.test.ts` near `keeps skills listing wired to the canonical marketplace filters`:

```ts
it('keeps all marketplace browse routes behind the shared admission and ranking contracts', () => {
  const homeSource = readPageSource('../pages/[locale]/index.astro');
  const skillsSource = readPageSource('../pages/[locale]/skills/index.astro');
  const popularSource = readPageSource('../pages/[locale]/popular/index.astro');
  const occupationsSource = readPageSource('../pages/[locale]/occupations/index.astro');
  const occupationDetailSource = readPageSource('../pages/[locale]/occupations/[slug].astro');
  const categoriesSource = readPageSource('../pages/[locale]/categories/index.astro');
  const categoryDetailSource = readPageSource('../pages/[locale]/categories/[slug].astro');

  for (const source of [
    homeSource,
    skillsSource,
    popularSource,
    occupationsSource,
    occupationDetailSource,
    categoriesSource,
    categoryDetailSource,
  ]) {
    expect(source).toContain('getMarketplaceSkills(');
  }

  expect(homeSource).toContain('sortSkillsPopular(marketplaceSkills).slice(0, 8)');
  expect(homeSource).toContain('sortSkillsLatest(marketplaceSkills).slice(0, 8)');
  expect(skillsSource).toContain('getSkillSourceKind(skill)');
  expect(skillsSource).toContain('inferSkillOccupationIds(skill).includes(occupation)');
  expect(popularSource).toContain(
    "activeRank === 'latest' ? sortSkillsLatest(rankedSkills) : sortSkillsPopular(rankedSkills)",
  );
  expect(popularSource).toContain("const listTitle = categoryLabel || (isZhCopy ? 'Skills 榜单' : 'Skills Ranking');");
  expect(occupationDetailSource).toContain('occupation.popularSkills');
  expect(occupationDetailSource).toContain('occupation.latestSkills');
  expect(categoryDetailSource).toContain('sortSkillsPopular(categorySkills)');
  expect(categoryDetailSource).toContain('sortSkillsLatest(categorySkills)');
});
```

Expected status before implementation: this may PASS on the current branch because most route wiring already exists. Treat it as a characterization test; if it fails, implement the specific missing shared filter call instead of duplicating logic.

- [ ] **Step 2: Add the Review Policy framing test**

Add this test in `tests/pages/public-links.test.ts`:

```ts
it('keeps review policy as admission evidence instead of a generic safety tutorial', () => {
  const safeSource = readPageSource('../pages/[locale]/safe/index.astro');

  expect(safeSource).toContain('getMarketplaceSkills(skills)');
  expect(safeSource).toContain('const blockedCount = skills.length - admittedSkills.length;');
  expect(safeSource).toContain('const reviewedCount = skills.filter');
  expect(safeSource).toContain('D 级或被判定不适合公开展示的 Skills 不进入目录、榜单、职业页和分类页。');
  expect(safeSource).toContain('Official/community is a source attribute, not a category');
  expect(safeSource).toContain('Token、联网、写文件等信号会在卡片和详情页用短标签展示。');
  expect(safeSource).toContain('MarketplaceSimplePage');
  expect(safeSource).not.toMatch(/先安装|小心|谨慎|教程|guide|tutorial|how to stay safe/i);
});
```

Expected status before implementation: PASS if the Review Policy page already matches the design baseline; FAIL if generic safety/tutorial copy has crept in.

- [ ] **Step 3: Implement only failing route fixes**

If the route-wiring test fails for a route, update that route to use the shared filters. For example, if `src/pages/[locale]/popular/index.astro` were missing admission filtering, use:

```ts
let rankedSkills = getMarketplaceSkills(skillsFetched);
if (category) {
  rankedSkills = filterByCategory(rankedSkills, category);
}
rankedSkills = activeRank === 'latest' ? sortSkillsLatest(rankedSkills) : sortSkillsPopular(rankedSkills);
```

If the Review Policy test fails because copy drifted toward generic instruction, restore the rule-centered `rules` entries:

```ts
const rules = isZhCopy
  ? [
      ['准入', 'D 级或被判定不适合公开展示的 Skills 不进入目录、榜单、职业页和分类页。'],
      ['来源', '官方/社区是来源属性，不是分类；官方来源会显示为证据标签。'],
      ['风险', 'Token、联网、写文件等信号会在卡片和详情页用短标签展示。'],
    ]
  : [
      ['Admission', 'D-level or ineligible skills are excluded from directory, rankings, occupations, and categories.'],
      [
        'Source',
        'Official/community is a source attribute, not a category; official sources appear as evidence labels.',
      ],
      ['Signals', 'Token, network, and file-write signals are shown as concise evidence labels.'],
    ];
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npx vitest run tests/pages/public-links.test.ts src/lib/marketplace-filters.test.ts --reporter=verbose
```

Expected: PASS. `src/lib/marketplace-filters.test.ts` should still show admission, official/community source, Popular, and Latest behavior passing.

- [ ] **Step 5: Commit**

```bash
git add tests/pages/public-links.test.ts 'src/pages/[locale]/index.astro' 'src/pages/[locale]/skills/index.astro' 'src/pages/[locale]/popular/index.astro' 'src/pages/[locale]/occupations/index.astro' 'src/pages/[locale]/occupations/[slug].astro' 'src/pages/[locale]/categories/index.astro' 'src/pages/[locale]/categories/[slug].astro' 'src/pages/[locale]/safe/index.astro'
git commit -m "test: guard marketplace route logic"
```

If only tests changed, stage only `tests/pages/public-links.test.ts` and use the same commit message.

---

### Task 3: Skill Detail Install Decision Guardrails

**Files:**

- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Modify: `tests/pages/public-links.test.ts`
- Modify: `src/lib/skill-detail-view.test.ts`

**Interfaces:**

- Produces DOM contracts: `data-testid="skill-install-decision"`, `data-testid="skill-fit-tasks"`, `data-testid="skill-review-permissions"`, `data-testid="skill-source-material"`.
- Consumes: `buildDetailRiskChips`, `getDetailSourceKind`, `pickDetailTaskChips`.
- Produces tests proving install and review evidence are not hover-only.

- [ ] **Step 1: Write the failing source test for detail page contracts**

Add this test to `tests/pages/public-links.test.ts` near the other skill detail tests:

```ts
it('keeps skill detail pages centered on visible install decisions and review evidence', () => {
  const skillDetailSource = readPageSource('../pages/[locale]/skills/[owner]/[...repo].astro');
  const decisionPanelStart = skillDetailSource.indexOf('data-testid="skill-install-decision"');
  const decisionPanelEnd = skillDetailSource.indexOf('</aside>', decisionPanelStart);
  const decisionPanelSource = skillDetailSource.slice(decisionPanelStart, decisionPanelEnd);

  expect(skillDetailSource).toContain('data-testid="skill-install-decision"');
  expect(skillDetailSource).toContain('aria-label={isZhLocale ? \\'安装决策\\' : \\'Install decision\\'}');
  expect(skillDetailSource).toContain('SkillInstall');
  expect(skillDetailSource).toContain('installCommand={installCommand}');
  expect(skillDetailSource).toContain('href={`/${locale}/safe`}');
  expect(skillDetailSource).toContain('GitHub');
  expect(skillDetailSource).toContain('SkillActionsNative');
  expect(skillDetailSource).toContain('data-testid="skill-fit-tasks"');
  expect(skillDetailSource).toContain('data-testid="skill-review-permissions"');
  expect(skillDetailSource).toContain('data-testid="skill-source-material"');
  expect(skillDetailSource).toContain('sourceEvidenceDescription');
  expect(skillDetailSource).toContain('README 和文件仅作为上游证据。');
  expect(skillDetailSource).toContain('SkillRelated');
  expect(decisionPanelSource).not.toContain('group-hover');
  expect(decisionPanelSource).not.toContain('opacity-0');
  expect(decisionPanelSource).not.toContain('max-h-0');
});
```

Expected: FAIL because the `data-testid` attributes are not present yet.

- [ ] **Step 2: Add detail page test IDs**

In `src/pages/[locale]/skills/[owner]/[...repo].astro`, update the install decision aside:

```astro
<aside
  data-testid="skill-install-decision"
  class="skill-decision-panel p-4 lg:sticky lg:top-24"
  aria-label={isZhLocale ? '安装决策' : 'Install decision'}
>
</aside>
```

Update the Fit and Tasks section:

```astro
<section data-testid="skill-fit-tasks" class="skill-detail-surface p-5 md:p-6"></section>
```

Update the Review and Permissions section:

```astro
<section data-testid="skill-review-permissions" class="skill-detail-surface p-5 md:p-6"></section>
```

Update the Source Material section:

```astro
<section data-testid="skill-source-material" class="skill-detail-surface p-5 md:p-6"></section>
```

If the Source Material section currently has a different opening tag, preserve its existing classes and add only the `data-testid`.

- [ ] **Step 3: Strengthen helper tests for source and risk evidence**

Append this test to `src/lib/skill-detail-view.test.ts`:

```ts
it('keeps detail risk chips concise for visible decision panels', () => {
  expect(
    buildDetailRiskChips({
      visibleRiskLabels: ['Token', 'Network', 'File write', 'Thin source'],
      riskFlags: [{ label: 'Network' }, { label: 'Stale source' }],
    }).slice(0, 4),
  ).toEqual(['Token', 'Network', 'File write', 'Thin source']);
});
```

If this fails because `buildDetailRiskChips` returns more than the UI should show, update the UI call site to slice rendered chips instead of changing the helper globally:

```ts
const detailRiskChips = buildDetailRiskChips({ visibleRiskLabels, riskFlags: skillRiskFlags }).slice(0, 4);
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npx vitest run tests/pages/public-links.test.ts src/lib/skill-detail-view.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'src/pages/[locale]/skills/[owner]/[...repo].astro' tests/pages/public-links.test.ts src/lib/skill-detail-view.test.ts
git commit -m "test: guard skill detail install decision"
```

---

### Task 4: Desktop And Mobile Marketplace Browser Audit

**Files:**

- Modify: `tests/e2e/navigation.spec.ts`
- Create: `tests/e2e/marketplace-ui.spec.ts`

**Interfaces:**

- Consumes: `data-testid` contracts from Task 1 and Task 3.
- Produces: Playwright browser checks for core marketplace routes at desktop and mobile sizes.
- Produces: updated e2e navigation expectations aligned with the new IA.

- [ ] **Step 1: Update stale navigation e2e expectations**

In `tests/e2e/navigation.spec.ts`, replace the old collections-primary-nav test:

```ts
test('desktop navigation should click through to the collections page', async ({ page }) => {
  await page.goto('/en');
  await page.locator('nav[aria-label="Main navigation"] a[href="/en/collections"]').click();
  await expect(page).toHaveURL(/\/en\/collections$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

with:

```ts
test('desktop navigation should click through the marketplace primary routes', async ({ page }) => {
  await page.goto('/en');
  const nav = page.getByTestId('desktop-primary-nav');
  await expect(nav).toBeVisible();

  await nav.locator('a[href="/en/skills"]').click();
  await expect(page).toHaveURL(/\/en\/skills$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Skills Directory' })).toBeVisible();

  await nav.locator('a[href="/en/popular"]').click();
  await expect(page).toHaveURL(/\/en\/popular$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Popular Skills' })).toBeVisible();

  await nav.locator('a[href="/en/occupations"]').click();
  await expect(page).toHaveURL(/\/en\/occupations$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Occupations' })).toBeVisible();

  await nav.locator('a[href="/en/categories"]').click();
  await expect(page).toHaveURL(/\/en\/categories$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
});
```

Replace mobile menu clicks that target `/en/collections` with `/en/categories`:

```ts
await page.getByTestId('mobile-menu-panel').locator('a[href="/en/categories"]').click();
await expect(page).toHaveURL(/\/en\/categories$/);
```

Replace collection-card click assertions in that mobile menu test with a simple categories route assertion:

```ts
await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
```

- [ ] **Step 2: Write the marketplace audit e2e test**

Create `tests/e2e/marketplace-ui.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const coreRoutes = [
  { path: '/zh', h1: 'Killer-Skills' },
  { path: '/zh/skills', h1: 'Skills 目录' },
  { path: '/zh/popular', h1: '热门 Skills' },
  { path: '/zh/popular?rank=latest', h1: '最新 Skills' },
  { path: '/zh/occupations', h1: '职业' },
  { path: '/zh/categories', h1: '分类' },
  { path: '/zh/search', h1: '搜索 Skills' },
  { path: '/zh/safe', h1: '审核政策' },
];

const oldHeaderLabels = /专题|热门(?! Skills)|探索|文档|Topics|Hot|Explore|Docs/;
const hiddenReasoning = /思考链|内部思考|chain[- ]of[- ]thought|hidden reasoning/i;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

async function expectCleanPublicCopy(page: Page) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(hiddenReasoning);
}

test.describe('Marketplace UI audit', () => {
  test('desktop core routes keep one primary header and distinct route identity', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const route of coreRoutes) {
      await page.goto(route.path);
      await expect(page.getByTestId('site-header')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: route.h1 })).toBeVisible();
      await expect(page.getByTestId('desktop-primary-nav')).toBeVisible();
      await expect(page.getByTestId('mobile-menu-toggle')).toBeHidden();

      const headerText = await page.getByTestId('site-header').innerText();
      expect(headerText).toContain('Skills');
      expect(headerText).toContain('榜单');
      expect(headerText).toContain('职业');
      expect(headerText).toContain('分类');
      expect(headerText).not.toMatch(oldHeaderLabels);

      await expectNoHorizontalOverflow(page);
      await expectCleanPublicCopy(page);
    }
  });

  test('mobile drawer opens fully and preserves primary route order', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/zh');

    await page.getByTestId('mobile-menu-toggle').click();
    const overlay = page.getByTestId('mobile-menu-overlay');
    const panel = page.getByTestId('mobile-menu-panel');

    await expect(overlay).toHaveAttribute('data-state', 'open');
    await expect(panel).toBeVisible();

    const labels = await panel.locator('.header-mobile-nav-link').allInnerTexts();
    expect(labels.map((label) => label.trim())).toEqual(['首页', 'Skills', '榜单', '职业', '分类']);

    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.height).toBeGreaterThan(500);

    await expectNoHorizontalOverflow(page);
  });

  test('skill detail exposes install decision and review evidence without hover', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/zh/skills');

    const firstSkillCard = page.getByTestId('skill-card').first();
    const count = await page.getByTestId('skill-card').count();
    test.skip(count === 0, 'Local skill listing data is unavailable in this environment.');

    const href = await firstSkillCard.locator('a[href*="/zh/skills/"]').first().getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);
    await expect(page.getByTestId('skill-install-decision')).toBeVisible();
    await expect(page.getByTestId('skill-fit-tasks')).toBeVisible();
    await expect(page.getByTestId('skill-review-permissions')).toBeVisible();
    await expect(page.getByTestId('skill-source-material')).toBeVisible();
    await expect(page.getByText('审核政策').first()).toBeVisible();
    await expect(page.getByText(/npx killer-skills add/).first()).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectCleanPublicCopy(page);
  });
});
```

- [ ] **Step 3: Run e2e tests to verify failures**

Run:

```bash
PLAYWRIGHT_PORT=4322 npx playwright test tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts --project=chromium
```

Expected before Tasks 1 and 3 are implemented: FAIL on missing test IDs. Expected after Tasks 1 and 3: PASS or skip only the skill detail card case when local listing data is unavailable.

- [ ] **Step 4: Fix only real browser audit failures**

If the mobile drawer is clipped, confirm Task 1 kept:

```ts
if (overlay && overlay.parentElement !== document.body) {
  document.body.appendChild(overlay);
}
```

If a route has horizontal overflow, inspect the failing route's widest element and fix the specific control by adding `min-width: 0`, `flex-wrap`, or a one-column mobile breakpoint. Do not reduce the whole site typography without identifying the overflowing element.

If old header labels appear, remove them from primary header surfaces and keep any legacy links in footer or lightweight bridge pages only.

- [ ] **Step 5: Run e2e tests to verify pass**

Run:

```bash
PLAYWRIGHT_PORT=4322 npx playwright test tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts --project=chromium
```

Expected: PASS, with the skill detail test skipped only if local listing data is unavailable.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts src/components/Header.astro src/components/HeaderActionsNative.astro 'src/pages/[locale]/skills/[owner]/[...repo].astro'
git commit -m "test: add marketplace browser audit"
```

---

### Task 5: Final Verification And Handoff

**Files:**

- No planned source changes unless verification exposes a concrete failure.

**Interfaces:**

- Consumes: all guardrails from Tasks 1-4.
- Produces: a clean branch with tests and browser audit passing.

- [ ] **Step 1: Run whitespace and static checks**

```bash
git diff --check
npx prettier --check src/lib/site-ia.ts src/components/Header.astro src/components/HeaderActionsNative.astro 'src/pages/[locale]/skills/[owner]/[...repo].astro' tests/pages/public-links.test.ts src/lib/skill-detail-view.test.ts tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Run targeted Vitest suite**

```bash
npx vitest run tests/pages/public-links.test.ts src/lib/marketplace-filters.test.ts src/lib/skill-detail-view.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 3: Run browser audit**

```bash
PLAYWRIGHT_PORT=4322 npx playwright test tests/e2e/navigation.spec.ts tests/e2e/marketplace-ui.spec.ts --project=chromium
```

Expected: PASS, with documented skip only if local skill listing data is unavailable.

- [ ] **Step 4: Run full verification**

```bash
npm test
npx tsc --noEmit --project tsconfig.json
npm run check:astro
npm run build
```

Expected:

- `npm test`: all test files pass, any existing skipped tests remain intentional.
- `tsc`: exits 0.
- `check:astro`: 0 errors. Existing hints may remain if unrelated.
- `build`: exits 0. Existing Cloudflare local binding warnings are acceptable if unchanged.

- [ ] **Step 5: Commit final verification fix if needed**

If Step 4 required small fixes, commit them:

```bash
git add .
git commit -m "fix: stabilize marketplace ui guardrails"
```

If Step 4 required no fixes, do not create an empty commit.

- [ ] **Step 6: Report final evidence**

In the handoff message, include:

- latest commit hashes
- exact commands run
- pass/fail/skip counts
- any skipped e2e reason
- whether the local dev server is still running
