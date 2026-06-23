import { describe, expect, it } from 'vitest';
import { resolveSkillDetailLocale, selectSkillDetailLocale } from './skill-locale-link';

describe('skill locale link governance', () => {
  it('keeps the requested locale when it is eligible', () => {
    expect(
      selectSkillDetailLocale('ja', {
        eligibleLocales: ['en', 'ja'],
        canonicalLocale: 'en',
      }),
    ).toBe('ja');
  });

  it('falls back to the canonical locale when the requested locale is not eligible', () => {
    expect(
      selectSkillDetailLocale('ja', {
        eligibleLocales: ['en'],
        canonicalLocale: 'en',
      }),
    ).toBe('en');
  });

  it('uses live governance data for known suppressed locale variants', () => {
    expect(resolveSkillDetailLocale('00susu00', 'wiki-idea-llm-harness/wikillm', 'ja')).toBe('en');
  });
});
