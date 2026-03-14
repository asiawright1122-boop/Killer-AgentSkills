#!/usr/bin/env npx tsx

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

type FieldName = 'title' | 'description';

type FieldValue = {
  value: string;
  line: number;
};

type Issue = {
  file: string;
  field: FieldName;
  line: number;
  message: string;
};

const BLOG_ROOT = resolve(process.cwd(), 'src/content/blog');

function collectMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function isMostlyAscii(text: string): boolean {
  if (!text) return true;
  let asciiChars = 0;
  for (const char of text) {
    if (char.charCodeAt(0) <= 127) asciiChars += 1;
  }
  return asciiChars / text.length >= 0.8;
}

function findField(frontmatter: string, key: FieldName, baseLine: number): FieldValue | null {
  const lines = frontmatter.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const match = line.match(new RegExp(`^${key}:\\s*"(.*)"\\s*$`));
    if (match) {
      return {
        value: match[1] ?? '',
        line: baseLine + index,
      };
    }
  }

  return null;
}

function validateTitle(file: string, field: FieldValue): Issue[] {
  const issues: Issue[] = [];
  const raw = field.value;
  const normalized = raw.trim();

  if (raw !== normalized) {
    issues.push({
      file,
      field: 'title',
      line: field.line,
      message: 'title has leading or trailing spaces',
    });
  }

  if (!normalized) {
    issues.push({
      file,
      field: 'title',
      line: field.line,
      message: 'title is empty after trimming',
    });
    return issues;
  }

  const asciiTitle = isMostlyAscii(normalized);
  const minLength = asciiTitle ? 12 : 6;

  if (normalized.length < minLength) {
    issues.push({
      file,
      field: 'title',
      line: field.line,
      message: `title is too short (${normalized.length}), expected >= ${minLength}`,
    });
  }

  if (/(?:[&:|]|[-–—])$/.test(normalized)) {
    issues.push({
      file,
      field: 'title',
      line: field.line,
      message: 'title ends with a delimiter and looks truncated',
    });
  }

  if (/^[A-Z]{2,6}[:&\\-]*$/.test(normalized)) {
    issues.push({
      file,
      field: 'title',
      line: field.line,
      message: 'title looks like an acronym placeholder',
    });
  }

  return issues;
}

function validateDescription(file: string, field: FieldValue): Issue[] {
  const issues: Issue[] = [];
  const raw = field.value;
  const normalized = raw.trim();

  if (raw !== normalized) {
    issues.push({
      file,
      field: 'description',
      line: field.line,
      message: 'description has leading or trailing spaces',
    });
  }

  if (!normalized) {
    issues.push({
      file,
      field: 'description',
      line: field.line,
      message: 'description is empty after trimming',
    });
    return issues;
  }

  const asciiDescription = isMostlyAscii(normalized);
  const minLength = asciiDescription ? 60 : 30;

  if (normalized.length < minLength) {
    issues.push({
      file,
      field: 'description',
      line: field.line,
      message: `description is too short (${normalized.length}), expected >= ${minLength}`,
    });
  }

  return issues;
}

function main() {
  const files = collectMarkdownFiles(BLOG_ROOT);
  const issues: Issue[] = [];

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) continue;

    const frontmatter = frontmatterMatch[1] ?? '';
    const frontmatterStartLine = 2; // line numbers are 1-based and frontmatter starts after first ---
    const title = findField(frontmatter, 'title', frontmatterStartLine);
    const description = findField(frontmatter, 'description', frontmatterStartLine);

    if (!title) {
      issues.push({
        file,
        field: 'title',
        line: 1,
        message: 'missing title in frontmatter',
      });
    } else {
      issues.push(...validateTitle(file, title));
    }

    if (!description) {
      issues.push({
        file,
        field: 'description',
        line: 1,
        message: 'missing description in frontmatter',
      });
    } else {
      issues.push(...validateDescription(file, description));
    }
  }

  if (issues.length === 0) {
    console.log(`SEO frontmatter guard passed: ${files.length} blog files checked`);
    return;
  }

  console.error(`SEO frontmatter guard failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    const rel = relative(process.cwd(), issue.file);
    console.error(`- ${rel}:${issue.line} [${issue.field}] ${issue.message}`);
  }
  process.exit(1);
}

main();
