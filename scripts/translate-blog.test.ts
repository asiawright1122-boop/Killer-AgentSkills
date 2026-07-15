import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyTranslatedBlogFrontmatter } from './translate-blog';

describe('blog translation frontmatter', () => {
  it('applies localized metadata to single-quoted frontmatter', () => {
    const frontmatter = [
      "title: 'English title'",
      "description: 'English description'",
      'pubDate: 2026-06-25',
      "lang: 'en'",
      "category: 'editorial'",
    ].join('\n');

    expect(
      applyTranslatedBlogFrontmatter(frontmatter, 'ko', {
        title: '한국어 제목',
        description: '한국어 설명',
      }),
    ).toBe(
      [
        "title: '한국어 제목'",
        "description: '한국어 설명'",
        'pubDate: 2026-06-25',
        "lang: 'ko'",
        "category: 'editorial'",
      ].join('\n'),
    );
  });
});

describe('auto-translation workflow', () => {
  it('guards public output after rebasing and before staging translated content', () => {
    const workflow = readFileSync(resolve('.github/workflows/i18n-update.yml'), 'utf8');
    const pullIndex = workflow.indexOf('git pull --rebase --autostash origin main');
    const guardIndex = workflow.indexOf('npm run guard:public-ai-output', pullIndex);
    const addIndex = workflow.indexOf('git add src/content/blog/*/*.md', pullIndex);

    expect(pullIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(pullIndex);
    expect(addIndex).toBeGreaterThan(guardIndex);
  });
});
