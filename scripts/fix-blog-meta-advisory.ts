#!/usr/bin/env npx tsx

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  ENGLISH_CTA_PATTERN,
  TRUNCATION_MARKER_PATTERN,
  getDescriptionLengthRange,
  sanitizeMetaDescription,
  trimDescriptionToMax,
} from './lib/meta-description';

const BLOG_ROOT = resolve(process.cwd(), 'src/content/blog');

type ChangeSummary = {
  updated: number;
  truncationRemoved: number;
  englishCtaRemoved: number;
  clamped: number;
};

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

function getLocaleFromPath(filePath: string): string {
  const rel = relative(BLOG_ROOT, filePath);
  const [locale] = rel.split(/[\\/]/);
  return (locale || 'en').toLowerCase();
}

function escapeFrontmatterString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function main() {
  const files = collectMarkdownFiles(BLOG_ROOT);
  const summary: ChangeSummary = {
    updated: 0,
    truncationRemoved: 0,
    englishCtaRemoved: 0,
    clamped: 0,
  };

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      continue;
    }

    const frontmatter = frontmatterMatch[1] ?? '';
    const descriptionMatch = frontmatter.match(/^(\s*description:\s*)"((?:\\"|[^"])*)"\s*$/m);
    if (!descriptionMatch) {
      continue;
    }

    const locale = getLocaleFromPath(file);
    const originalDescription = descriptionMatch[2]?.replace(/\\"/g, '"') ?? '';
    const hadTruncationMarker = TRUNCATION_MARKER_PATTERN.test(originalDescription);
    const hadEnglishCta = locale !== 'en' && ENGLISH_CTA_PATTERN.test(originalDescription);
    const { max } = getDescriptionLengthRange(locale);

    let cleanedDescription = sanitizeMetaDescription(originalDescription, locale);
    const preClampDescription = cleanedDescription;
    cleanedDescription = trimDescriptionToMax(cleanedDescription, max);

    if (!cleanedDescription || cleanedDescription === originalDescription) {
      continue;
    }

    const escapedDescription = escapeFrontmatterString(cleanedDescription);
    const updatedFrontmatter = frontmatter.replace(
      /^(\s*description:\s*)"((?:\\"|[^"])*)"\s*$/m,
      `$1"${escapedDescription}"`,
    );
    const updatedRaw = raw.replace(frontmatterMatch[0], `---\n${updatedFrontmatter}\n---`);

    writeFileSync(file, updatedRaw);
    summary.updated += 1;
    if (hadTruncationMarker) summary.truncationRemoved += 1;
    if (hadEnglishCta) summary.englishCtaRemoved += 1;
    if (preClampDescription.length > max) summary.clamped += 1;
  }

  console.log('Blog meta advisory cleanup complete.');
  console.log(`- Files scanned: ${files.length}`);
  console.log(`- Files updated: ${summary.updated}`);
  console.log(`- Truncation markers removed: ${summary.truncationRemoved}`);
  console.log(`- English CTA removed in non-EN locales: ${summary.englishCtaRemoved}`);
  console.log(`- Overlong descriptions clamped: ${summary.clamped}`);
}

main();
