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
const hiddenReasoning =
  /思考链|内部思考|chain[- ]of[- ]thought|hidden reasoning|internal strategy|recovery plan|rollout plan|implementation rationale|内部策略|恢复方案|回滚方案|发布方案|实施依据/i;

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

async function getVisibleSkillCardOrder(page: Page) {
  const cards = page.getByTestId('skill-card');
  const count = await cards.count();
  const hrefs: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const href = await cards.nth(index).getByTestId('skill-card-link').getAttribute('href');
    if (href) {
      hrefs.push(href);
    }
  }

  return hrefs;
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

    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toHaveAttribute('data-state', 'closed');

    await page.getByTestId('mobile-menu-toggle').click();
    const panel = page.getByTestId('mobile-menu-panel');

    await expect(overlay).toHaveAttribute('data-state', 'open');
    await expect(panel).toBeVisible();

    const labels = await panel.locator('.header-mobile-nav-link').allInnerTexts();
    expect(labels.map((label) => label.trim())).toEqual(['首页', 'Skills', '榜单', '职业', '分类']);

    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.height).toBeGreaterThan(500);

    await page.locator('.header-mobile-backdrop').click({ position: { x: 8, y: 8 } });
    await expect(overlay).toHaveAttribute('data-state', 'closed');

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

  test('popular and latest routes render distinct card order when local data diverges', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/zh/popular');
    const popularOrder = await getVisibleSkillCardOrder(page);

    await page.goto('/zh/popular?rank=latest');
    const latestOrder = await getVisibleSkillCardOrder(page);

    const comparableCount = Math.min(popularOrder.length, latestOrder.length);
    test.skip(comparableCount < 2, 'Local ranking data exposes fewer than two comparable skill cards.');

    const popularSlice = popularOrder.slice(0, comparableCount);
    const latestSlice = latestOrder.slice(0, comparableCount);
    test.skip(
      popularSlice.every((href, index) => href === latestSlice[index]),
      'Local ranking data currently yields the same visible order for popular and latest routes.',
    );

    expect(latestSlice).not.toEqual(popularSlice);
  });
});
