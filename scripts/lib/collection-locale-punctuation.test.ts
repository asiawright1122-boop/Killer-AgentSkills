import { describe, expect, it } from 'vitest';
import { renderCollectionLocalePunctuationReport, validateCollectionRecord, fixCollectionRecord } from './collection-locale-punctuation';

const locales = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

function localizedText(text: string) {
  return Object.fromEntries(locales.map((locale) => [locale, text]));
}

function localizedKeywords() {
  return Object.fromEntries(locales.map((locale) => [locale, ['AI agent skills', `${locale} workflow tools`]]));
}

function validCollection() {
  return {
    title: localizedText('Installable Workflow Tools'),
    description: localizedText('Compare installable workflow tools.'),
    seoTitle: localizedText('Installable Workflow Tools'),
    seoDescription: localizedText('Compare installable workflow tools for developer teams.'),
    longDescription: localizedText('Use this collection to compare installable workflow tools before setup.'),
    keywords: localizedKeywords(),
    editorial: {
      reviewSummary: localizedText('Updated to keep setup information and practical use cases accurate.'),
      selectionReason: localizedText('Use this shorter list when you need to compare and install tools quickly.'),
      executionExamples: [
        {
          title: { en: 'Install one path', zh: '先安装一条路径' },
          summary: { en: 'This intentionally remains en/zh scoped.', zh: '这里按 en/zh 设计。' },
        },
      ],
    },
  };
}

describe('collection locale punctuation guard', () => {
  it('accepts full-locale collection metadata and ignores en/zh-only execution examples', () => {
    expect(validateCollectionRecord('valid.json', validCollection(), { locales })).toEqual([]);
  });

  it('flags missing locales on enriched editorial fields', () => {
    const record = validCollection();
    delete (record.editorial.reviewSummary as Record<string, string>).ja;

    expect(validateCollectionRecord('missing.json', record, { locales })).toContainEqual(
      expect.objectContaining({
        file: 'missing.json',
        path: 'editorial.reviewSummary',
        locale: 'ja',
        code: 'missing_locale',
      }),
    );
  });

  it('flags missing punctuation on description-like fields', () => {
    const record = validCollection();
    record.seoDescription.en = 'Compare installable workflow tools without punctuation';

    expect(validateCollectionRecord('punctuation.json', record, { locales })).toContainEqual(
      expect.objectContaining({
        file: 'punctuation.json',
        path: 'seoDescription',
        locale: 'en',
        code: 'missing_terminal_punctuation',
      }),
    );
  });

  it('flags missing keyword locale arrays', () => {
    const record = validCollection();
    delete (record.keywords as Record<string, string[]>).ko;

    expect(validateCollectionRecord('keywords.json', record, { locales })).toContainEqual(
      expect.objectContaining({
        file: 'keywords.json',
        path: 'keywords',
        locale: 'ko',
        code: 'missing_locale',
      }),
    );
  });

  it('renders a concise failing report', () => {
    const report = renderCollectionLocalePunctuationReport({
      totalCollections: 1,
      issues: validateCollectionRecord(
        'punctuation.json',
        {
          ...validCollection(),
          seoDescription: { ...localizedText('Missing punctuation.'), en: 'Missing punctuation' },
        },
        { locales },
      ),
    });

    expect(report).toContain('Issues found: 1');
    expect(report).toContain('punctuation.json seoDescription:en');
    expect(report).toContain('Status: fail');
  });

  describe('fixCollectionRecord', () => {
    it('corrects CJK punctuation, spacing, and ensures terminal punctuation in collections', () => {
      const record = validCollection();
      
      record.description.zh = '这是一个没有标点的中文描述';
      record.seoDescription.zh = '测试AI Agent Skill性能，防误伤3.5版本.';
      record.longDescription.ja = '日本語の記述,句読点がない';
      
      const { record: fixedRecord, changed } = fixCollectionRecord(record, { locales });
      
      expect(changed).toBe(true);
      expect(fixedRecord.description.zh).toBe('这是一个没有标点的中文描述。');
      expect(fixedRecord.seoDescription.zh).toBe('测试 AI 智能体技能性能，防误伤 3.5 版本。');
      expect(fixedRecord.longDescription.ja).toBe('日本語の記述、句読点がない。');
    });
  });
});
