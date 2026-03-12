import { describe, expect, it } from 'vitest';
import {
  getBlogIntentLinks,
  getBlogKeywordClusters,
  getBlogLongTailKeywords,
  getBlogMetaOverride,
} from './blog-seo-intent';

describe('blog-seo-intent', () => {
  it('expands document automation posts into document and template clusters', () => {
    expect(getBlogKeywordClusters('document-automation', 'mastering-pdf-automation-with-ai-skills')).toEqual(
      expect.arrayContaining(['documentAutomation', 'templates']),
    );
  });

  it('expands MCP posts into developer, ide, and mcp clusters', () => {
    expect(getBlogKeywordClusters('developer-experience', 'how-to-build-mcp-servers-with-agent-skills')).toEqual(
      expect.arrayContaining(['mcp', 'ideCompat', 'developerExperience']),
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

  it('returns ctr-focused meta overrides for target english posts', () => {
    const meta = getBlogMetaOverride('en', 'how-to-install-ai-agent-skills');
    expect(meta?.title).toContain('Install AI Agent Skills');
    expect(meta?.description).toContain('npx killer-skills add');
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
});
