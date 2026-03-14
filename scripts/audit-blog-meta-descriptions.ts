#!/usr/bin/env npx tsx
/**
 * 审计博客文章的 meta description 长度
 * 建议：120–158 字符（过短会降低 CTR，过长会被截断）
 *
 * 用法: npx tsx scripts/audit-blog-meta-descriptions.ts [--fix]
 * --fix: 仅报告，不修改（预留；实际扩展需人工或 AI 批量生成）
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDescriptionLengthRange } from './lib/meta-description';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

function getLocaleFromFile(filePath: string): string {
  const rel = path.relative(BLOG_DIR, filePath);
  const [locale] = rel.split(path.sep);
  return (locale || 'en').toLowerCase();
}

function extractDescriptionFromFrontmatter(filePath: string): { description: string; length: number } | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const descMatch = match[1].match(/^description:\s*["']([\s\S]*?)["']\s*$/m);
  if (!descMatch) return null;
  const description = descMatch[1].replace(/\\"/g, '"').trim();
  return { description, length: description.length };
}

function walk(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, files);
    else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) files.push(full);
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');

  const all = walk(BLOG_DIR);
  const results: {
    path: string;
    rel: string;
    locale: string;
    length: number;
    description: string;
    min: number;
    max: number;
    status: 'ok' | 'short' | 'long';
  }[] = [];

  for (const filePath of all) {
    const rel = path.relative(process.cwd(), filePath);
    const data = extractDescriptionFromFrontmatter(filePath);
    if (!data) {
      console.warn(`⚠️ 无 description: ${rel}`);
      continue;
    }
    const locale = getLocaleFromFile(filePath);
    const { min, max } = getDescriptionLengthRange(locale);
    const status = data.length < min ? 'short' : data.length > max ? 'long' : 'ok';
    results.push({
      path: filePath,
      rel,
      locale,
      length: data.length,
      description: data.description,
      min,
      max,
      status,
    });
  }

  const short = results.filter((r) => r.status === 'short');
  const long = results.filter((r) => r.status === 'long');
  const ok = results.filter((r) => r.status === 'ok');

  console.log('\n📋 博客 Meta Description 审计\n');
  console.log(`总文章数: ${results.length}`);
  console.log('✅ 长度合适: 按语言阈值（Latin 120–158, CJK/Arabic 40–200）');
  console.log(`✅ 长度合适: ${ok.length}`);
  console.log(`⚠️ 过短: ${short.length}`);
  console.log(`⚠️ 过长: ${long.length}\n`);

  if (short.length > 0) {
    console.log('--- 过短的 description（按语言阈值）---\n');
    short
      .sort((a, b) => a.length - b.length)
      .forEach((r) => {
        console.log(`${r.rel}`);
        console.log(`  语言: ${r.locale}, 长度: ${r.length} 字符, 期望 >= ${r.min}`);
        console.log(`  内容: ${r.description.slice(0, 80)}${r.description.length > 80 ? '...' : ''}\n`);
      });
  }

  if (long.length > 0) {
    console.log('--- 过长的 description（按语言阈值）---\n');
    long.forEach((r) => {
      console.log(`${r.rel} (${r.length} 字符, 期望 <= ${r.max})\n`);
    });
  }

  if (fix && short.length > 0) {
    console.log('提示: 当前未实现自动扩展。请根据上文列表在 frontmatter 中按语言阈值扩充 description。');
  }

  process.exit(short.length > 0 ? 1 : 0);
}

main();
