import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n';
import {
  getBlogIntentLinks,
  getBlogKeywordClusters,
  getBlogLongTailKeywords,
  getBlogMetaOverride,
} from './blog-seo-intent';

const ALL_LOCALES: Locale[] = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

describe('blog-seo-intent', () => {
  it('expands document automation posts into document and template clusters', () => {
    expect(getBlogKeywordClusters('document-automation', 'mastering-pdf-automation-with-ai-skills')).toEqual(
      expect.arrayContaining(['documentAutomation', 'templates']),
    );
  });

  it('keeps MCP posts in developer workflow clusters while retaining MCP as a secondary signal', () => {
    expect(getBlogKeywordClusters('developer-experience', 'how-to-build-mcp-servers-with-agent-skills')).toEqual(
      expect.arrayContaining(['mcp', 'developerExperience', 'workflowAutomation']),
    );
  });

  it('returns long-tail keywords by slug theme', () => {
    expect(getBlogLongTailKeywords('mastering-excel-automation-with-xlsx-skills', 'en')).toContain('excel automation');
  });

  it('returns enterprise links for communication posts', () => {
    const links = getBlogIntentLinks(
      'en',
      'enterprise-solutions',
      'professional-internal-communications-with-ai-skills',
    );
    expect(links[0]?.href).toContain('/skills?q=process automation');
  });

  it('keeps mcp blog links developer-workflow-first instead of mcp-tool-first', () => {
    const links = getBlogIntentLinks('en', 'developer-experience', 'how-to-build-mcp-servers-with-agent-skills');
    expect(links[0]?.title).toContain('Skills for Developer Workflows');
    expect(links[0]?.href).toContain('/skills?q=skills for developer workflows');
    expect(links[0]?.title.toLowerCase()).not.toContain('mcp');
    expect(links[0]?.href.toLowerCase()).not.toContain('q=mcp');
  });

  it('keeps mcp blog long-tail keywords skills-first with mcp as a modifier', () => {
    const keywords = getBlogLongTailKeywords('how-to-build-mcp-servers-with-agent-skills', 'en');
    expect(keywords).toContain('ai agent skills for developer workflows');
    expect(keywords).toContain('developer workflow skills');
    expect(keywords).toContain('claude code integrations with mcp');
  });

  it('returns ctr-focused meta overrides for target english posts', () => {
    const meta = getBlogMetaOverride('en', 'how-to-install-ai-agent-skills');
    expect(meta?.title).toContain('Install AI Agent Skills');
    expect(meta?.description).toContain('npx killer-skills add');
  });

  it('keeps mcp meta override skills-first while retaining explicit mcp context', () => {
    const meta = getBlogMetaOverride('en', 'how-to-build-mcp-servers-with-agent-skills');
    expect(meta?.title).toContain('Skills for Developer Workflows');
    expect(meta?.title).toContain('MCP');
    expect(meta?.description).toContain('AI agent skill workflows');
    expect(meta?.description).toContain('MCP integrations');
  });

  it('returns comparison-focused overrides for high-intent guide posts', () => {
    const meta = getBlogMetaOverride('en', 'claude-code-vs-cursor-vs-windsurf');
    expect(meta?.title).toContain('Claude Code vs Cursor vs Windsurf');
    expect(meta?.description).toContain('setup tradeoffs');
  });

  it('keeps target meta descriptions within a ctr-friendly length', () => {
    const slugs = [
      'mastering-pdf-automation-with-ai-skills',
      'how-to-build-mcp-servers-with-agent-skills',
      'how-to-install-ai-agent-skills',
      'top-10-mcp-servers-2026',
      'official-ai-agent-skills-guide',
      'what-are-ai-agent-skills',
      'best-ai-agent-skills-2026',
      'claude-code-vs-cursor-vs-windsurf',
    ];

    for (const slug of slugs) {
      const meta = getBlogMetaOverride('en', slug);
      expect(meta?.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('returns localized overrides for non-english locales (zh)', () => {
    const meta = getBlogMetaOverride('zh', 'how-to-install-ai-agent-skills');
    expect(meta).not.toBeNull();
    expect(meta?.title).toContain('安装');
    expect(meta?.title).toContain('AI Agent Skills');
  });

  it('returns localized overrides for non-english locales (ja)', () => {
    const meta = getBlogMetaOverride('ja', 'what-are-ai-agent-skills');
    expect(meta).not.toBeNull();
    expect(meta?.title).toContain('AI Agent Skills');
  });

  it('falls back to english when locale has no translation', () => {
    const meta = getBlogMetaOverride('en', 'how-to-install-ai-agent-skills');
    expect(meta).not.toBeNull();
    expect(meta?.title).toContain('Install AI Agent Skills');
  });

  it('returns null for unknown slug across all locales', () => {
    for (const locale of ALL_LOCALES) {
      const meta = getBlogMetaOverride(locale, 'nonexistent-post-slug');
      expect(meta).toBeNull();
    }
  });

  it('provides localized overrides for all 10 supported locales', () => {
    const slugs = [
      'mastering-pdf-automation-with-ai-skills',
      'how-to-build-mcp-servers-with-agent-skills',
      'how-to-install-ai-agent-skills',
      'top-10-mcp-servers-2026',
      'official-ai-agent-skills-guide',
      'what-are-ai-agent-skills',
      'best-ai-agent-skills-2026',
      'claude-code-vs-cursor-vs-windsurf',
    ];

    for (const slug of slugs) {
      for (const locale of ALL_LOCALES) {
        const meta = getBlogMetaOverride(locale, slug);
        expect(meta).not.toBeNull();
        expect(meta?.title.length).toBeGreaterThan(0);
        expect(meta?.description.length).toBeGreaterThan(0);
      }
    }
  });
});
