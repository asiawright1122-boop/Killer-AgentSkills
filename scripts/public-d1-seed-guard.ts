#!/usr/bin/env npx tsx

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS } from '../src/lib/public-ai-output';

export type PublicD1SeedGuardIssue = {
  file: string;
  pattern: string;
  match: string;
  serializedView: boolean;
};

const DEFAULT_SEED_DIR = 'db/seeds';

function collectSqlFiles(target: string, cwd = process.cwd()): string[] {
  const root = resolve(cwd, target);
  if (!existsSync(root)) return [];

  const files: string[] = [];

  function visit(pathname: string) {
    const stat = statSync(pathname);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(pathname, { withFileTypes: true })) {
        visit(join(pathname, entry.name));
      }
      return;
    }

    if (stat.isFile() && extname(pathname).toLowerCase() === '.sql') {
      files.push(pathname);
    }
  }

  visit(root);
  return files.sort();
}

function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function normalizeSerializedSqlText(content: string): string {
  return content.replace(/\\r\\n|\\n|\\r/g, '\n');
}

function findMatches(content: string, file: string, serializedView: boolean): PublicD1SeedGuardIssue[] {
  const issues: PublicD1SeedGuardIssue[] = [];

  for (const entry of HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS) {
    const pattern = toGlobalRegex(entry.pattern);
    for (const match of content.matchAll(pattern)) {
      issues.push({
        file,
        pattern: entry.label,
        match: (match[0] || '').replace(/\s+/g, ' ').trim(),
        serializedView,
      });
    }
  }

  return issues;
}

function dedupeIssues(issues: PublicD1SeedGuardIssue[]): PublicD1SeedGuardIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.file}\0${issue.pattern}\0${issue.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findPublicD1SqlGuardIssues(content: string, file = 'inline-sql'): PublicD1SeedGuardIssue[] {
  return dedupeIssues([
    ...findMatches(content, file, false),
    ...findMatches(normalizeSerializedSqlText(content), file, true),
  ]);
}

export function scanPublicD1SeedFiles(target = DEFAULT_SEED_DIR, cwd = process.cwd()) {
  const files = collectSqlFiles(target, cwd);
  const issues = files.flatMap((file) => {
    const content = readFileSync(file, 'utf8');
    const relativeFile = relative(cwd, file);
    return findPublicD1SqlGuardIssues(content, relativeFile);
  });

  return {
    files,
    issues,
  };
}

function printReport(files: string[], issues: PublicD1SeedGuardIssue[]) {
  const lines: string[] = [];
  lines.push('# Public D1 Seed Guard');
  lines.push('');
  lines.push(`- SQL files scanned: ${files.length}`);
  lines.push(`- Issues found: ${issues.length}`);

  if (issues.length === 0) {
    lines.push('- Status: pass');
    console.log(lines.join('\n'));
    return;
  }

  lines.push('- Status: fail');
  lines.push('');
  lines.push('## Issues');

  for (const issue of issues) {
    const view = issue.serializedView ? 'serialized-newline view' : 'raw SQL';
    lines.push(`- ${issue.file} [${issue.pattern}, ${view}] ${JSON.stringify(issue.match).slice(0, 140)}`);
  }

  console.error(lines.join('\n'));
}

export function main(argv = process.argv.slice(2)) {
  const target = argv.find((arg) => !arg.startsWith('-')) || DEFAULT_SEED_DIR;
  const { files, issues } = scanPublicD1SeedFiles(target);

  printReport(files, issues);
  if (issues.length > 0) process.exit(1);
}

const isDirectRun = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
  main();
}
