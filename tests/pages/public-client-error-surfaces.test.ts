import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const publicClientSurfaces = [
  'src/islands/ErrorBoundary.tsx',
  'src/islands/WebTerminal.tsx',
  'src/components/SubmitSkillModalNative.astro',
];

describe('public client error surfaces', () => {
  it.each(publicClientSurfaces)('does not render caught exception messages in %s', (filePath) => {
    const source = readFileSync(filePath, 'utf8');

    expect(source).not.toMatch(/setError\([^)]*err\.message/i);
    expect(source).not.toMatch(/term\.writeln\([^)]*(e|err|error)\.message/i);
    expect(source).not.toMatch(/this\.state\.error\?\.message/i);
  });
});
