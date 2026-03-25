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
    ]);

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

  it('makes collection drift audit consume the canonical map artifact', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seo-collection-drift.ts'), 'utf8');

    expect(source).toContain('seo-collection-canonical-map.json');
    expect(source).toContain('canonical_map_mismatch');
    expect(source).toContain('mappedCanonical');
  });
});
