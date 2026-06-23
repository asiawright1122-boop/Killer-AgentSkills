import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('GSC Overrides Integration', () => {
  it('contains the hardcoded overrides for Yorick-Ryu/deep-share, akiojin/llmlb, agentjido/jido_signal, and takuto-tanaka-4digit/excel-unidiff-cli', () => {
    const fileContent = readFileSync(
      resolve(process.cwd(), 'src/pages/[locale]/skills/[owner]/[...repo].astro'),
      'utf8'
    );

    expect(fileContent).toContain('Yorick-Ryu/deep-share');
    expect(fileContent).toContain('akiojin/llmlb');
    expect(fileContent).toContain('agentjido/jido_signal');
    expect(fileContent).toContain('takuto-tanaka-4digit/excel-unidiff-cli');

    // Check titles presence
    expect(fileContent).toContain('deep-share: Convert Markdown to Word (DOCX)');
    expect(fileContent).toContain('llmlb: LLM Load Balancer & Routing Proxy');
    expect(fileContent).toContain('jido_signal: Event Signals & PubSub');
    expect(fileContent).toContain('excel-unidiff-cli: Compare Excel Sheets via Diff');
  });
});
