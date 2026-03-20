import { describe, expect, it } from 'vitest';
import { getCategoryLabel, getCategorySeoDescription, normalizeCategoryId } from './category-taxonomy';

describe('normalizeCategoryId', () => {
  it('maps legacy development buckets to developer', () => {
    expect(normalizeCategoryId('development')).toBe('developer');
    expect(normalizeCategoryId('testing')).toBe('developer');
    expect(normalizeCategoryId('code-review')).toBe('developer');
  });

  it('maps legacy database/search buckets to canonical categories', () => {
    expect(normalizeCategoryId('database')).toBe('data');
    expect(normalizeCategoryId('search')).toBe('browser');
    expect(normalizeCategoryId('social')).toBe('communication');
  });
});

describe('getCategorySeoDescription', () => {
  it('returns localized fallback descriptions', () => {
    expect(getCategorySeoDescription('developer', 'en')).toContain('developer tool skills');
    expect(getCategorySeoDescription('developer', 'zh')).toContain('开发工具技能');
  });
});

describe('getCategoryLabel', () => {
  it('prefers sidebar translation keys', () => {
    const t = (key: string) => (key === 'Sidebar.categories.developer' ? 'Developer' : key);
    expect(getCategoryLabel('development', t)).toBe('Developer');
  });
});
