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

type VisibleSkillCard = {
  href: string;
  name: string;
  rankScore: number;
  qualityScore: number;
  stars: number;
  updatedAt: string;
};

function parseCardNumber(value: string | null): number {
  const parsed = Number(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function comparePopularCards(a: VisibleSkillCard, b: VisibleSkillCard): number {
  return (
    b.rankScore - a.rankScore || b.qualityScore - a.qualityScore || b.stars - a.stars || a.name.localeCompare(b.name)
  );
}

function compareLatestCards(a: VisibleSkillCard, b: VisibleSkillCard): number {
  const byDate = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  if (byDate !== 0) return byDate;
  return comparePopularCards(a, b);
}

async function getVisibleSkillCards(page: Page): Promise<VisibleSkillCard[]> {
  const cards = page.getByTestId('skill-card');
  const count = await cards.count();
  const visibleCards: VisibleSkillCard[] = [];

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    if (!(await card.isVisible())) continue;

    const href = await card.getByTestId('skill-card-link').getAttribute('href');
    if (!href) continue;

    visibleCards.push({
      href,
      name: (await card.getAttribute('data-skill-name')) || '',
      rankScore: parseCardNumber(await card.getAttribute('data-rank-score')),
      qualityScore: parseCardNumber(await card.getAttribute('data-quality-score')),
      stars: parseCardNumber(await card.getAttribute('data-stars')),
      updatedAt: (await card.getAttribute('data-updated-at')) || '',
    });
  }

  return visibleCards;
}

async function expectVisibleCardSort(
  page: Page,
  path: string,
  sortName: string,
  compareCards: (a: VisibleSkillCard, b: VisibleSkillCard) => number,
) {
  await page.goto(path);
  const visibleCards = await getVisibleSkillCards(page);
  test.skip(
    visibleCards.length < 2,
    `${sortName} sort semantics need at least two visible skill cards on ${path}. Found ${visibleCards.length}.`,
  );

  const actualOrder = visibleCards.map((card) => card.href);
  const expectedOrder = [...visibleCards].sort(compareCards).map((card) => card.href);

  expect(actualOrder).toEqual(expectedOrder);
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

  test('popular route visible cards match rank, quality, stars, then name ordering', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expectVisibleCardSort(page, '/zh/popular', 'Popular', comparePopularCards);
  });

  test('latest route visible cards match updatedAt then popular tie-break ordering', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expectVisibleCardSort(page, '/zh/popular?rank=latest', 'Latest', compareLatestCards);
  });
});
