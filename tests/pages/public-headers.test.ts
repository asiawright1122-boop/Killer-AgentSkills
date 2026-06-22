import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const headersSource = readFileSync(join(process.cwd(), 'public', '_headers'), 'utf8');

function findRulesWithoutHeaders(source: string): string[] {
  const invalidRules: string[] = [];
  let currentRule: string | null = null;
  let currentHeaderCount = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!rawLine.startsWith(' ') && !rawLine.startsWith('\t')) {
      if (currentRule && currentHeaderCount === 0) invalidRules.push(currentRule);
      currentRule = trimmed;
      currentHeaderCount = 0;
      continue;
    }

    if (currentRule && trimmed.includes(':')) currentHeaderCount++;
  }

  if (currentRule && currentHeaderCount === 0) invalidRules.push(currentRule);
  return invalidRules;
}

describe('public headers config', () => {
  it('does not contain empty _headers rules', () => {
    expect(findRulesWithoutHeaders(headersSource)).toEqual([]);
  });

  it('keeps legacy PNG and current WebP OG images cacheable', () => {
    expect(headersSource).toMatch(/\/og-image\.webp\n\s+Cache-Control: public, max-age=604800/);
    expect(headersSource).toMatch(/\/og-image\.png\n\s+Cache-Control: public, max-age=604800/);
  });
});
