import { describe, expect, it } from 'vitest';
import { lintCollectionFrontmatter } from '../seo-collection-frontmatter-guard';

describe('lintCollectionFrontmatter', () => {
  it('passes a well-formed collection', () => {
    const enTitle = 'A'.repeat(40);
    const zhTitle = '齐'.repeat(20);
    const enDescription = 'B'.repeat(120);
    const zhDescription = '内'.repeat(60);
    const enSeoTitle = 'C'.repeat(50);
    const enSeoDescription = 'D'.repeat(120);
    const result = lintCollectionFrontmatter(
      {
        title: { en: enTitle, zh: zhTitle },
        description: { en: enDescription, zh: zhDescription },
        seoTitle: { en: enSeoTitle },
        seoDescription: { en: enSeoDescription },
        keywords: { en: ['agent workflow', 'skills'] },
      },
      'good-slug',
    );
    expect(result.violations).toEqual([]);
  });

  it('flags missing title', () => {
    const result = lintCollectionFrontmatter({ title: {} }, 's');
    expect(result.violations).toContainEqual(
      expect.objectContaining({ field: 'title', code: 'missing' }),
    );
  });

  it('flags seoTitle over 60 chars', () => {
    const result = lintCollectionFrontmatter(
      { title: { en: 'ok' }, seoTitle: { en: 'X'.repeat(65) } },
      's',
    );
    expect(result.violations).toContainEqual(
      expect.objectContaining({ field: 'seoTitle', code: 'too_long' }),
    );
  });

  it('flags seoDescription over 155 chars', () => {
    const result = lintCollectionFrontmatter(
      { title: { en: 'ok' }, seoDescription: { en: 'X'.repeat(160) } },
      's',
    );
    expect(result.violations).toContainEqual(
      expect.objectContaining({ field: 'seoDescription', code: 'too_long' }),
    );
  });

  it('flags seoDescription under 40 chars', () => {
    const result = lintCollectionFrontmatter(
      { title: { en: 'ok' }, seoDescription: { en: 'X'.repeat(30) } },
      's',
    );
    expect(result.violations).toContainEqual(
      expect.objectContaining({ field: 'seoDescription', code: 'too_short' }),
    );
  });

  it('flags low-intent keywords', () => {
    const result = lintCollectionFrontmatter(
      { title: { en: 'ok' }, keywords: { en: ['best skills', 'top tools'] } },
      's',
    );
    expect(
      result.violations.some((v) => v.field === 'keywords' && v.code === 'low_intent'),
    ).toBe(true);
  });

  it('does not flag slug prefix top-* in keywords check (slug is not keywords)', () => {
    const result = lintCollectionFrontmatter(
      {
        title: { en: 'adequate collection title' },
        description: { en: 'A'.repeat(60) },
        keywords: { en: ['agent workflow'] },
      },
      'top-claude-code-skills',
    );
    expect(result.violations).toEqual([]);
  });
});
