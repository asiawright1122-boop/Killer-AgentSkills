import { describe, expect, it } from 'vitest';
import { buildBreadcrumbJsonLd, buildBreadcrumbTrail } from './breadcrumbs';

describe('buildBreadcrumbJsonLd', () => {
  it('keeps visible labels and JSON-LD labels aligned with ordered positions', () => {
    const items = [
      { label: 'Home', href: '/en' },
      { label: 'Collections', href: '/en/collections' },
      { label: 'Top Skills' },
    ];

    const jsonLd = buildBreadcrumbJsonLd(items, {
      currentUrl: 'https://killer-skills.com/en/collections/top-skills',
    });

    expect(jsonLd.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://killer-skills.com/en',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Collections',
        item: 'https://killer-skills.com/en/collections',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Top Skills',
        item: 'https://killer-skills.com/en/collections/top-skills',
      },
    ]);
  });

  it('normalizes trailing slashes in breadcrumb URLs', () => {
    const jsonLd = buildBreadcrumbJsonLd(
      [
        { label: 'Home', href: 'https://killer-skills.com/en/' },
        { label: 'Collections', href: '/en/collections/' },
      ],
      { currentUrl: 'https://killer-skills.com/en/collections/' },
    );

    expect(jsonLd.itemListElement[0].item).toBe('https://killer-skills.com/en');
    expect(jsonLd.itemListElement[1].item).toBe('https://killer-skills.com/en/collections');
  });
});

describe('buildBreadcrumbTrail', () => {
  it('returns the original items alongside JSON-LD generated from the same source', () => {
    const items = [{ label: 'Home', href: '/en' }, { label: 'Collections' }];

    const breadcrumb = buildBreadcrumbTrail(items, {
      currentUrl: 'https://killer-skills.com/en/collections',
    });

    expect(breadcrumb.items).toEqual(items);
    expect(breadcrumb.jsonLd.itemListElement.map((item) => item.name)).toEqual(items.map((item) => item.label));
  });
});
