import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { findPublicD1SqlGuardIssues, scanPublicD1SeedFiles } from './public-d1-seed-guard';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'public-d1-seed-guard-'));
  tempDirs.push(dir);
  return dir;
}

describe('public D1 seed guard', () => {
  it('passes when the seed directory is absent', () => {
    const cwd = makeTempDir();

    expect(scanPublicD1SeedFiles('db/seeds', cwd)).toEqual({
      files: [],
      issues: [],
    });
  });

  it('detects hidden reasoning tags in generated SQL files', () => {
    const cwd = makeTempDir();
    const seedDir = join(cwd, 'db/seeds');
    mkdirSync(seedDir, { recursive: true });
    writeFileSync(join(seedDir, 'initial_0.sql'), "INSERT INTO skills VALUES ('<analysis>private</analysis>');");

    const result = scanPublicD1SeedFiles('db/seeds', cwd);
    expect(result.issues.map((issue) => issue.pattern)).toEqual(['analysis tag', 'analysis tag']);
    expect(result.issues.every((issue) => issue.file === 'db/seeds/initial_0.sql')).toBe(true);
  });

  it('detects serialized hidden-reasoning section labels inside JSON SQL strings', () => {
    const cwd = makeTempDir();
    const seedDir = join(cwd, 'db/seeds');
    mkdirSync(seedDir, { recursive: true });
    writeFileSync(
      join(seedDir, 'initial_0.sql'),
      String.raw`INSERT INTO skills VALUES ('{"body":"Intro\nChain-of-thought:\nprivate"}');`,
    );

    const result = scanPublicD1SeedFiles('db/seeds', cwd);
    expect(result.issues).toEqual([
      {
        file: 'db/seeds/initial_0.sql',
        pattern: 'chain-of-thought section',
        match: 'Chain-of-thought:',
        serializedView: true,
      },
    ]);
  });

  it('can validate inline SQL before direct D1 API writes', () => {
    const issues = findPublicD1SqlGuardIssues(
      String.raw`INSERT INTO skills VALUES ('{"body":"Intro\nScratchpad:\nprivate"}');`,
    );

    expect(issues).toEqual([
      {
        file: 'inline-sql',
        pattern: 'scratchpad section',
        match: 'Scratchpad:',
        serializedView: true,
      },
    ]);
  });
});
