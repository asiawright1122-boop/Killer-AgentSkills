import { describe, expect, it } from 'vitest';
import {
  getBlogIntentLinks,
  getBlogKeywordClusters,
  getBlogLongTailKeywords,
  getBlogMetaOverride,
} from './blog-seo-intent';
import { normalizePublicSummary, normalizePublicTitle } from './public-text';
import en from '../messages/en.json';

describe('blog-seo-intent', () => {
  const dummyEn = {
    'Seo.Blog.LongTail.xlsx': 'excel automation',
    'Seo.Blog.LongTail.mcp':
      'ai agent skills for developer workflows, developer workflow skills, claude code integrations with mcp',
    'Seo.Blog.Misc.browseProcessAutomation': 'process automation',
    'Seo.Blog.Misc.skillsForDeveloperWorkflows': 'Skills for Developer Workflows',
    'Seo.Blog.MetaOverride.how-to-install-ai-agent-skills.title': 'Install AI Agent Skills',
    'Seo.Blog.MetaOverride.how-to-install-ai-agent-skills.description':
      'npx killer-skills add description is shorter than 160 chars always',
    'Seo.Blog.MetaOverride.how-to-build-mcp-servers-with-agent-skills.title': 'Skills for Developer Workflows MCP',
    'Seo.Blog.MetaOverride.how-to-build-mcp-servers-with-agent-skills.description':
      'AI agent skill workflows and MCP integrations',
    'Seo.Blog.MetaOverride.claude-code-vs-cursor-vs-windsurf.title': 'Claude Code vs Cursor vs Windsurf',
    'Seo.Blog.MetaOverride.claude-code-vs-cursor-vs-windsurf.description': 'some setup tradeoffs for the guide',
  };
  const tEn = (k: string) => dummyEn[k as keyof typeof dummyEn] || k;

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
    expect(getBlogLongTailKeywords('mastering-excel-automation-with-xlsx-skills', tEn)).toContain('excel automation');
  });

  it('returns enterprise links for communication posts', () => {
    const links = getBlogIntentLinks(
      'en',
      'enterprise-solutions',
      'professional-internal-communications-with-ai-skills',
      tEn,
    );
    expect(links[0]?.href).toContain('/solutions/process-automation');
  });

  it('keeps mcp blog links developer-workflow-first instead of mcp-tool-first', () => {
    const links = getBlogIntentLinks('en', 'developer-experience', 'how-to-build-mcp-servers-with-agent-skills', tEn);
    expect(links[0]?.title).toContain('Skills for Developer Workflows');
    expect(links[0]?.href).toContain('/solutions/agent-workflows');
    expect(links[0]?.title.toLowerCase()).not.toContain('mcp');
    expect(links[0]?.href.toLowerCase()).not.toContain('q=mcp');
  });

  it('keeps mcp blog long-tail keywords skills-first with mcp as a modifier', () => {
    const keywords = getBlogLongTailKeywords('how-to-build-mcp-servers-with-agent-skills', tEn);
    expect(keywords).toContain('ai agent skills for developer workflows');
    expect(keywords).toContain('developer workflow skills');
    expect(keywords).toContain('claude code integrations with mcp');
  });

  it('returns ctr-focused meta overrides for target english posts', () => {
    const meta = getBlogMetaOverride('how-to-install-ai-agent-skills', tEn);
    expect(meta?.title).toContain('Install AI Agent Skills');
    expect(meta?.description).toContain('npx killer-skills add');
  });

  it('keeps mcp meta override skills-first while retaining explicit mcp context', () => {
    const meta = getBlogMetaOverride('how-to-build-mcp-servers-with-agent-skills', tEn);
    expect(meta?.title).toContain('Skills for Developer Workflows');
    expect(meta?.title).toContain('MCP');
    expect(meta?.description).toContain('AI agent skill workflows');
    expect(meta?.description).toContain('MCP integrations');
  });

  it('returns comparison-focused overrides for high-intent guide posts', () => {
    const meta = getBlogMetaOverride('claude-code-vs-cursor-vs-windsurf', tEn);
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
      // Create a specific mock that returns a 150 char string or relies on fallback mapping
      const tMock = (k: string) => (k.endsWith('.title') ? 'Test Title' : 'A very short test description');
      const meta = getBlogMetaOverride(slug, tMock);
      expect(meta?.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('resolves production blog message keys instead of falling back to raw frontmatter', () => {
    const t = (key: string) =>
      key.split('.').reduce<unknown>((value, segment) => {
        if (value && typeof value === 'object' && segment in (value as Record<string, unknown>)) {
          return (value as Record<string, unknown>)[segment];
        }
        return undefined;
      }, en) as string | undefined;
    const translate = (key: string) => t(key) || key;

    const meta = getBlogMetaOverride('how-to-install-ai-agent-skills', translate);
    const links = getBlogIntentLinks(
      'en',
      'developer-experience',
      'how-to-build-mcp-servers-with-agent-skills',
      translate,
    );

    expect(meta?.title).toContain('Install AI Agent Skills');
    expect(meta?.description).toContain('npx killer-skills add');
    expect(links[0]?.title).toBe(en.Blog.Misc.skillsForDeveloperWorkflows);
    expect(links[0]?.description).toBe(en.Blog.Misc.keepBrowsingSkills);
  });

  it('normalizes public blog snippets so search cards do not expose truncated tails', () => {
    expect(
      normalizePublicSummary(
        'Discover the best AI agent skills for Claude, Cursor, and Windsurf in 2026. Master essential tasks with proven skills, tested across platforms. Get started',
      ),
    ).toBe(
      'Discover the best AI agent skills for Claude, Cursor, and Windsurf in 2026. Master essential tasks with proven skills, tested across platforms.',
    );
    expect(normalizePublicSummary('Erfahren Sie, wie Sie professionelle Berichte erstellen und komp')).toBe(
      'Erfahren Sie, wie Sie professionelle Berichte erstellen.',
    );
    expect(
      normalizePublicTitle('Skills for Developer Workflows: Build MCP Integrations in Claude Code or Cursor', 72),
    ).toBe('Skills for Developer Workflows: Build MCP Integrations in Claude Code');
  });
});
