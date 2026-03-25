import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AIService } from './lib/ai';

describe('seo generator guardrails', () => {
  it('keeps AIService category fallback keywords for browser skills', () => {
    const service = new AIService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    const keywords = (service as any).sanitizeSeoKeywordList('Playwright', [
      'how to use playwright',
      'best playwright tool',
      '???',
      'mcp',
    ], 'browser');

    expect(keywords).toEqual(
      expect.arrayContaining([
        'Playwright browser automation skill',
        'Playwright web scraping workflow',
        'Playwright for Claude Code browser tasks',
        'Playwright AI agent web automation',
      ]),
    );
  });

  it('keeps long-tail collection generator aligned with skills-first copy and canonical metadata', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/generate-longtail-collections.ts'), 'utf8');

    expect(source).toContain('canonicalSlug');
    expect(source).toContain('AI Agent Skills');
    expect(source).toContain('workflow tools');
    expect(source).not.toContain('MCP Tools & Workflow Integrations');
    expect(source).not.toContain('model context protocol');
  });

  it('filters out cross-category contamination keywords', () => {
    const service = new AIService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    // canvas-design (non-browser skill) should NOT get "browser automation"
    const canvasKeywords = (service as any).sanitizeSeoKeywordList(
      'canvas-design',
      ['AI agent skill', 'canvas design', 'browser automation', 'MCP server', 'skill installation', 'visual art creation'],
      'design',
    );
    expect(canvasKeywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/browser automation/i)]));
    expect(canvasKeywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/MCP server/i)]));
    expect(canvasKeywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/skill installation/i)]));
    expect(canvasKeywords).toEqual(expect.arrayContaining(['AI agent skill']));
    expect(canvasKeywords).toEqual(expect.arrayContaining(['visual art creation']));
  });

  it('allows domain-relevant keywords for matching categories', () => {
    const service = new AIService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    // Playwright (browser skill) SHOULD keep "browser automation"
    const playwrightKeywords = (service as any).sanitizeSeoKeywordList(
      'Playwright',
      ['AI agent skill', 'Playwright browser automation', 'web scraping workflow'],
      'browser',
    );
    expect(playwrightKeywords).toEqual(expect.arrayContaining(['Playwright browser automation']));

    // mcp-proxy (server skill) SHOULD keep "MCP server"
    const mcpKeywords = (service as any).sanitizeSeoKeywordList(
      'mcp-proxy',
      ['AI agent skill', 'MCP server proxy', 'agent workflow'],
      'mcp',
    );
    expect(mcpKeywords).toEqual(expect.arrayContaining(['MCP server proxy']));
  });

  it('default fallback returns only 2 theme anchors, no generic fillers', () => {
    const service = new AIService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    // Trigger fallback by passing all-invalid keywords
    const keywords = (service as any).sanitizeSeoKeywordList('TestSkill', [
      'how to use testskill',
      'best testskill tool',
      '???',
    ]);
    expect(keywords).toHaveLength(2);
    expect(keywords).toEqual(expect.arrayContaining([expect.stringMatching(/AI agent skill/i)]));
    expect(keywords).toEqual(expect.arrayContaining([expect.stringMatching(/Claude Code/i)]));
  });

  it('filters generic filler keywords that apply to all skills', () => {
    const service = new AIService({
      nvidiaKeys: [],
      siliconFlowKey: '',
      openRouterKeys: [],
      cfAccountId: '',
      cfApiToken: '',
    });

    const keywords = (service as any).sanitizeSeoKeywordList(
      'algorithmic-art',
      [
        'AI agent skill',
        'p5.js generative art',
        'agentic workflow automation',
        'cursor workflow automation',
        'ai coding agent workflow',
        'interactive parameter exploration',
        'claude code skills',
        'seeded randomness visualization',
      ],
      'official',
    );
    // Generic fillers must be removed
    expect(keywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/agentic workflow/i)]));
    expect(keywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/cursor workflow automation/i)]));
    expect(keywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/ai coding agent workflow/i)]));
    expect(keywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/^claude code skills$/i)]));
    // Capability-specific keywords must survive
    expect(keywords).toEqual(expect.arrayContaining(['p5.js generative art']));
    expect(keywords).toEqual(expect.arrayContaining(['interactive parameter exploration']));
    expect(keywords).toEqual(expect.arrayContaining(['seeded randomness visualization']));
  });

  it('makes collection drift audit consume the canonical map artifact', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seo-collection-drift.ts'), 'utf8');

    expect(source).toContain('seo-collection-canonical-map.json');
    expect(source).toContain('canonical_map_mismatch');
    expect(source).toContain('mappedCanonical');
  });
});
