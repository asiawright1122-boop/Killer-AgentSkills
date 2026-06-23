import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const enMessages = JSON.parse(readFileSync(resolve(__dirname, '../messages/en.json'), 'utf8'));

type TitleDescCheck = {
  key: string;
  titleKey: string;
  descKey?: string;
  titleMin?: number;
  titleMax?: number;
  descMin?: number;
  descMax?: number;
};

const SEO_PAGE_CHECKS: TitleDescCheck[] = [
  {
    key: 'Skills page (Marketplace)',
    titleKey: 'Marketplace.seoTitle',
    descKey: 'Marketplace.seoDescription',
  },
  {
    key: 'Solutions page',
    titleKey: 'Solutions.pageTitle',
    descKey: 'Solutions.pageDescription',
    descMin: 100,
  },
  {
    key: 'CLI page',
    titleKey: 'CLI.pageTitle',
    descKey: 'CLI.pageDescription',
  },
  {
    key: 'Integrations page',
    titleKey: 'Integrations.seoTitle',
    descKey: 'Integrations.seoDescription',
  },
  {
    key: 'Community page',
    titleKey: 'Community.seoTitle',
    descKey: 'Community.seoDescription',
  },
  {
    key: 'Categories page',
    titleKey: 'Categories.pageTitle',
    descKey: 'Categories.pageDescription',
    descMin: 100,
  },
  {
    key: 'Home page',
    titleKey: 'Home.seoTitle',
    descKey: 'Home.seoDescription',
  },
  {
    key: 'Blog Index',
    titleKey: 'BlogIndex.seoTitle',
    descKey: 'BlogIndex.seoDescription',
  },
  {
    key: 'Collections hub',
    titleKey: 'Collections.seoTitle',
    descKey: 'Collections.seoDescription',
  },
];

const TITLE_MIN = 40;
const TITLE_MAX = 65;
const DESC_MIN = 120;
const DESC_MAX = 165;

function getNestedValue(obj: Record<string, any>, dotPath: string): string | undefined {
  const parts = dotPath.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

describe('SEO title and description lengths (en)', () => {
  for (const check of SEO_PAGE_CHECKS) {
    describe(check.key, () => {
      const title = getNestedValue(enMessages, check.titleKey);

      it(`${check.titleKey} exists`, () => {
        expect(title).toBeDefined();
      });

      if (title) {
        const min = check.titleMin ?? TITLE_MIN;
        const max = check.titleMax ?? TITLE_MAX;
        it(`title length ${title.length} is within ${min}-${max}`, () => {
          expect(title.length).toBeGreaterThanOrEqual(min);
          expect(title.length).toBeLessThanOrEqual(max);
        });
      }

      if (check.descKey) {
        const desc = getNestedValue(enMessages, check.descKey);

        it(`${check.descKey} exists`, () => {
          expect(desc).toBeDefined();
        });

        if (desc) {
          const min = check.descMin ?? DESC_MIN;
          const max = check.descMax ?? DESC_MAX;
          it(`description length ${desc.length} is within ${min}-${max}`, () => {
            expect(desc.length).toBeGreaterThanOrEqual(min);
            expect(desc.length).toBeLessThanOrEqual(max);
          });
        }
      }
    });
  }
});

describe('FAQ6 MCP exists in all locales', () => {
  const localeFiles = ['en', 'zh', 'ja', 'ko', 'ar', 'de', 'es', 'fr', 'pt', 'ru'];
  for (const locale of localeFiles) {
    it(`${locale}.json has Home.faq6Q and Home.faq6A`, () => {
      const messages = JSON.parse(readFileSync(resolve(__dirname, `../messages/${locale}.json`), 'utf8'));
      expect(messages.Home?.faq6Q).toBeDefined();
      expect(messages.Home?.faq6A).toBeDefined();
      expect(messages.Home.faq6Q.length).toBeGreaterThan(5);
      expect(messages.Home.faq6A.length).toBeGreaterThan(20);
    });
  }
});
