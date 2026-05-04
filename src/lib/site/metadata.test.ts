import { describe, expect, it } from 'vitest';
import { buildPageMetadata } from './metadata';

describe('buildPageMetadata', () => {
  it('normalizes canonical URLs and generates alternates from the served pathname', () => {
    const metadata = buildPageMetadata({
      pathname: '/es/collections/top-agentic-ai-platforms-orchestration-tools/',
      locale: 'es',
      title: 'Top Agentic AI Platforms',
      description: 'Short description',
      customCanonical: 'https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools/',
      availableLocales: ['en', 'es'],
      xDefaultLocale: 'en',
    });

    expect(metadata.canonicalUrl).toBe(
      'https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools',
    );
    expect(metadata.alternates).toEqual([
      {
        locale: 'en',
        href: 'https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools',
      },
      {
        locale: 'es',
        href: 'https://killer-skills.com/es/collections/top-agentic-ai-platforms-orchestration-tools',
      },
    ]);
    expect(metadata.xDefaultUrl).toBe(
      'https://killer-skills.com/en/collections/top-agentic-ai-platforms-orchestration-tools',
    );
  });

  it('normalizes title and description for document metadata', () => {
    const metadata = buildPageMetadata({
      pathname: '/en/collections',
      locale: 'en',
      title: 'Workflow Skill Bundles',
      description:
        'This is a deliberately long description that should be trimmed down so the metadata builder keeps it under the usual search snippet threshold for consistency.',
    });

    expect(metadata.documentTitle).toContain('Killer-Skills');
    expect(metadata.description.length).toBeLessThanOrEqual(155);
    expect(metadata.description.endsWith('...')).toBe(false);
    expect(metadata.socialTitle).toBe('Workflow Skill Bundles');
  });

  it('does not append the brand twice when a supplied title already contains it', () => {
    const metadata = buildPageMetadata({
      pathname: '/zh/collections/top-agent-workflow-building-tools',
      locale: 'zh',
      title: '优先安装的 Agent 工作流构建工具 | Killer-Skills',
      description: '比较优先安装的 Agent 工作流构建工具，查看安装路径、适用场景与工具。',
    });

    expect(metadata.documentTitle).toBe('优先安装的 Agent 工作流构建工具 | Killer-Skills');
  });

  it('aligns locale metadata with the served locale and available alternates', () => {
    const metadata = buildPageMetadata({
      pathname: '/zh/collections',
      locale: 'zh',
      title: '集合',
      availableLocales: ['en', 'zh', 'ja'],
      xDefaultLocale: 'en',
    });

    expect(metadata.ogLocale).toBe('zh_CN');
    expect(metadata.ogAlternateLocales).toEqual(['en_US', 'ja_JP']);
    expect(metadata.resolvedXDefaultLocale).toBe('en');
  });
});
