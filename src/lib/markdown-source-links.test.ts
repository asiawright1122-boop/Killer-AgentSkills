import { describe, expect, it } from 'vitest';
import { resolveRepositoryMarkdownImage, resolveRepositoryMarkdownLink } from './markdown-source-links';

describe('resolveRepositoryMarkdownLink', () => {
  it('rewrites relative markdown links to GitHub blob URLs', () => {
    const result = resolveRepositoryMarkdownLink('./references/waterfall.md', {
      owner: 'antvis',
      repo: 'GPT-Vis',
      sourceFilePath: 'README.md',
    });

    expect(result.href).toBe('https://github.com/antvis/GPT-Vis/blob/HEAD/references/waterfall.md');
    expect(result.isExternal).toBe(true);
    expect(result.fromRepositoryRelative).toBe(true);
  });

  it('resolves dot segments relative to the source file location', () => {
    const result = resolveRepositoryMarkdownLink('../docs/setup.md#install', {
      owner: 'opentabs-dev',
      repo: 'opentabs',
      sourceFilePath: 'skills/build-plugin/SKILL.md',
    });

    expect(result.href).toBe('https://github.com/opentabs-dev/opentabs/blob/HEAD/skills/docs/setup.md#install');
  });

  it('preserves absolute site links', () => {
    const result = resolveRepositoryMarkdownLink('https://killer-skills.com/en/skills/vercel/next.js/flags', {
      owner: 'vercel',
      repo: 'next.js',
      sourceFilePath: 'README.md',
    });

    expect(result.href).toBe('https://killer-skills.com/en/skills/vercel/next.js/flags');
    expect(result.isExternal).toBe(true);
    expect(result.fromRepositoryRelative).toBe(false);
  });

  it('neutralizes unsafe protocols', () => {
    const result = resolveRepositoryMarkdownLink('javascript:alert(1)', {
      owner: 'demo',
      repo: 'repo',
      sourceFilePath: 'README.md',
    });

    expect(result.href).toBe('#');
  });
});

describe('resolveRepositoryMarkdownImage', () => {
  it('rewrites relative image sources to raw GitHub URLs', () => {
    const result = resolveRepositoryMarkdownImage('/assets/diagram.png', {
      owner: 'demo',
      repo: 'repo',
      sourceFilePath: 'docs/SKILL.md',
    });

    expect(result.href).toBe('https://raw.githubusercontent.com/demo/repo/HEAD/assets/diagram.png');
    expect(result.isExternal).toBe(true);
    expect(result.fromRepositoryRelative).toBe(true);
  });
});
