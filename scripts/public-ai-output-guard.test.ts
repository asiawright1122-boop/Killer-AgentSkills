import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectPublicTextFiles,
  findPublicAIOutputGuardIssuesInContent,
  scanPublicAIOutputTargets,
} from './public-ai-output-guard';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'public-ai-output-guard-'));
  tempDirs.push(dir);
  return dir;
}

describe('public AI output guard', () => {
  it('detects explicit hidden reasoning markers with line and column details', () => {
    const issues = findPublicAIOutputGuardIssuesInContent('Public intro\nChain-of-thought:\nprivate\n', 'page.md');

    expect(issues).toEqual([
      {
        file: 'page.md',
        line: 2,
        column: 1,
        pattern: 'chain-of-thought section',
        match: 'Chain-of-thought:',
      },
    ]);
  });

  it('does not flag normal public copy about reasoning or scratchpad paths', () => {
    const issues = findPublicAIOutputGuardIssuesInContent(
      'Use chain-of-thought prompting as a public technique. Write drafts to .scratchpad/reports/.',
      'page.md',
    );

    expect(issues).toEqual([]);
  });

  it('scans only text-like public files under configured targets', () => {
    const cwd = makeTempDir();
    writeFileSync(join(cwd, 'safe.json'), '{"title":"Public"}');
    writeFileSync(join(cwd, 'unsafe.md'), '<thinking>private</thinking>\nFinal');
    writeFileSync(join(cwd, 'image.png'), '<thinking>binary-ish</thinking>');

    expect(collectPublicTextFiles(['.'], cwd).map((file) => file.replace(`${cwd}/`, ''))).toEqual([
      'safe.json',
      'unsafe.md',
    ]);

    const result = scanPublicAIOutputTargets(['.'], cwd);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map((issue) => issue.pattern)).toEqual(['thinking tag', 'thinking tag']);
  });
});
