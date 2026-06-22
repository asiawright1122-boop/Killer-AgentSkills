import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiTestFiles = [
  'tests/pages/api/skills/submit.test.ts',
  'tests/pages/api/skills/[owner]/[repo]/skills-api.test.ts',
];

describe('public API test network guards', () => {
  it.each(apiTestFiles)('does not fall through mocked fetch calls to real network in %s', (filePath) => {
    const source = readFileSync(join(process.cwd(), filePath), 'utf8');

    expect(source).not.toMatch(/return\s+original\s*\(/);
    expect(source).not.toMatch(/return\s+globalThis\.fetch\s*\(/);
  });
});
