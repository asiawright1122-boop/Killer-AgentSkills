#!/usr/bin/env npx tsx

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS } from '../src/lib/public-ai-output';

export type PublicAIOutputGuardIssue = {
  file: string;
  line: number;
  column: number;
  pattern: string;
  match: string;
};

const DEFAULT_TARGETS = [
  'src/content',
  'src/messages',
  'data/authority-surfaces.json',
  'data/docs-cache.json',
  'data/seo-collection-canonical-map.json',
  'data/seo-collection-locale-gaps.json',
  'data/seo-skill-locale-governance.json',
  'public',
] as const;

const TEXT_EXTENSIONS = new Set(['', '.css', '.html', '.json', '.md', '.svg', '.txt', '.xml']);
const BINARY_EXTENSIONS = new Set(['.ico', '.jpg', '.jpeg', '.png', '.webp']);

function isTextCandidate(file: string): boolean {
  const ext = extname(file).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return TEXT_EXTENSIONS.has(ext);
}

export function collectPublicTextFiles(targets = DEFAULT_TARGETS.map(String), cwd = process.cwd()): string[] {
  const files: string[] = [];

  function visit(pathname: string) {
    if (!existsSync(pathname)) return;
    const stat = statSync(pathname);

    if (stat.isDirectory()) {
      for (const entry of readdirSync(pathname, { withFileTypes: true })) {
        visit(join(pathname, entry.name));
      }
      return;
    }

    if (stat.isFile() && isTextCandidate(pathname)) {
      files.push(pathname);
    }
  }

  for (const target of targets) {
    visit(resolve(cwd, target));
  }

  return files.sort();
}

function getLineColumn(content: string, index: number): { line: number; column: number } {
  let line = 1;
  let column = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content[cursor] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function toGlobalRegex(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function getMarkerIndex(match: RegExpMatchArray): number | undefined {
  if (match.index === undefined) return undefined;
  const leadingBoundary = match[0]?.match(/^\n?[^\S\r\n]*/)?.[0] ?? '';
  return match.index + leadingBoundary.length;
}

export function findPublicAIOutputGuardIssuesInContent(content: string, file: string): PublicAIOutputGuardIssue[] {
  const issues: PublicAIOutputGuardIssue[] = [];

  for (const entry of HIDDEN_REASONING_PUBLIC_OUTPUT_PATTERNS) {
    const pattern = toGlobalRegex(entry.pattern);

    for (const match of content.matchAll(pattern)) {
      const markerIndex = getMarkerIndex(match);
      if (markerIndex === undefined) continue;
      const location = getLineColumn(content, markerIndex);
      issues.push({
        file,
        line: location.line,
        column: location.column,
        pattern: entry.label,
        match: (match[0] || '').replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return issues;
}

export function scanPublicAIOutputTargets(targets = DEFAULT_TARGETS.map(String), cwd = process.cwd()) {
  const files = collectPublicTextFiles(targets, cwd);
  const issues = files.flatMap((file) => {
    const content = readFileSync(file, 'utf8');
    const relativeFile = relative(cwd, file);
    return findPublicAIOutputGuardIssuesInContent(content, relativeFile);
  });

  return { files, issues };
}

function printReport(files: string[], issues: PublicAIOutputGuardIssue[]) {
  const lines: string[] = [];
  lines.push('# Public AI Output Guard');
  lines.push('');
  lines.push(`- Files scanned: ${files.length}`);
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
    lines.push(
      `- ${issue.file}:${issue.line}:${issue.column} [${issue.pattern}] ${JSON.stringify(issue.match).slice(0, 140)}`,
    );
  }

  console.error(lines.join('\n'));
}

export function main(argv = process.argv.slice(2)) {
  const targets = argv.filter((arg) => !arg.startsWith('-'));
  const scanTargets = targets.length > 0 ? targets : DEFAULT_TARGETS.map(String);
  const { files, issues } = scanPublicAIOutputTargets(scanTargets);

  printReport(files, issues);
  if (issues.length > 0) process.exit(1);
}

const isDirectRun = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
  main();
}
