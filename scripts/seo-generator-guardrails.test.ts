import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AIService } from './lib/ai';

describe('seo generator guardrails', () => {
  it('keeps AIService fallback keywords skills-first', () => {
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

  it('default fallback keywords do not contain MCP server or skill installation', () => {
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
    expect(keywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/MCP server/i)]));
    expect(keywords).not.toEqual(expect.arrayContaining([expect.stringMatching(/skill installation/i)]));
    expect(keywords).toEqual(expect.arrayContaining([expect.stringMatching(/AI agent skill/i)]));
  });

  it('makes collection drift audit consume the canonical map artifact', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seo-collection-drift.ts'), 'utf8');

    expect(source).toContain('seo-collection-canonical-map.json');
    expect(source).toContain('canonical_map_mismatch');
    expect(source).toContain('mappedCanonical');
  });
});
