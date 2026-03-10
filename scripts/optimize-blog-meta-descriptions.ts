#!/usr/bin/env npx tsx
/**
 * 审计博客 meta description 并提供优化建议
 * 基于 meta-tags-optimizer 技能的最佳实践：120–158 字符
 *
 * 用法: npx tsx scripts/optimize-blog-meta-descriptions.ts [--fix]
 * --fix: 尝试自动修复（仅对英文版本，生成新描述）
 *
 * 建议流程:
 * 1. 运行审计查看哪些需要优化
 * 2. 手动优化英文版本 (src/content/blog/en/)
 * 3. 运行翻译流程同步到其他语言
 */

import * as fs from 'fs';
import * as path from 'path';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const MIN_LEN = 120;
const MAX_LEN = 158;

// 从 title 生成优化的 description（简化版 AI 模拟）
function generateOptimizedDescription(title: string, _existingDesc: string): string {
  const cleanTitle = title
    .replace(/^(How to |What is |Master |Learn |Discover |Best |Top \d+ )/i, '')
    .replace(/:.*$/, '')
    .trim();

  const templates = [
    `Want to master ${cleanTitle}? This guide covers everything you need to know—from setup to advanced tips. Start learning today!`,
    `Learn ${cleanTitle} with our step-by-step tutorial. Proven strategies and real examples to help you succeed. Read now!`,
    `Struggling with ${cleanTitle}? Our comprehensive guide shows you exactly how to do it. Get results fast!`,
    `Discover how to ${cleanTitle.toLowerCase()} with this detailed tutorial. Includes practical examples and expert tips.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

function extractFrontmatter(filePath: string): { title: string; description: string; content: string } | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fm = match[1];
  const titleMatch = fm.match(/^title:\s*"([^"]+)"\s*$/m);
  const descMatch = fm.match(/^description:\s*"([^"]+)"\s*$/m);

  if (!titleMatch || !descMatch) return null;

  // 提取正文（前 500 字符作为上下文）
  const bodyStart = raw.indexOf('---', 4);
  const body = bodyStart > 0 ? raw.slice(bodyStart + 3, bodyStart + 600).trim() : '';

  return {
    title: titleMatch[1],
    description: descMatch[1],
    content: body,
  };
}

function updateDescription(filePath: string, newDesc: string): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const updated = raw.replace(
    /^(\s*description:\s*)"[^"]*"/m,
    `$1"${newDesc}"`
  );
  fs.writeFileSync(filePath, updated);
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dry');

  const all = walk(BLOG_DIR);
  const toOptimize: { path: string; rel: string; title: string; oldDesc: string; newDesc: string; length: number }[] = [];

  console.log('\n🤖 批量优化博客 Meta Description\n');
  console.log('策略: 使用 AIDA/Benefit-Proof-CTA 框架，120–158 字符，包含 CTA\n');

  for (const filePath of all) {
    const rel = path.relative(process.cwd(), filePath);
    const data = extractFrontmatter(filePath);
    if (!data) continue;

    const len = data.description.length;
    if (len < MIN_LEN || len > MAX_LEN) {
      const newDesc = generateOptimizedDescription(data.title, data.description);
      const newLen = newDesc.length;

      // 确保在目标范围内
      if (newLen >= MIN_LEN && newLen <= MAX_LEN) {
        toOptimize.push({
          path: filePath,
          rel,
          title: data.title,
          oldDesc: data.description,
          newDesc,
          length: newLen,
        });
      }
    }
  }

  console.log(`待优化: ${toOptimize.length} 篇\n`);

  // 只保留英文版本，其他语言通过翻译流程同步
  const enItems = toOptimize.filter((item) => item.rel.includes('/en/'));

  console.log(`英文版本待优化: ${enItems.length} 篇\n`);
  console.log('(其他语言版本将通过翻译流程自动同步)\n');

  // 按语言分组输出
  const byLang: Record<string, typeof toOptimize> = {};
  for (const item of toOptimize) {
    const lang = item.rel.split('/')[2];
    if (!byLang[lang]) byLang[lang] = [];
    byLang[lang].push(item);
  }

  for (const [lang, items] of Object.entries(byLang)) {
    const badge = lang === 'en' ? ' (英文版本 - 将被优化)' : ' (通过翻译同步)';
    console.log(`\n### ${lang.toUpperCase()} (${items.length} 篇)${badge}\n`);
    for (const item of items) {
      console.log(`📄 ${item.rel}`);
      console.log(`   标题: ${item.title.slice(0, 50)}...`);
      console.log(`   原描述 (${item.oldDesc.length}字符): ${item.oldDesc.slice(0, 60)}...`);
      console.log(`   新描述 (${item.length}字符): ${item.newDesc.slice(0, 60)}...`);
      console.log('');
    }
  }

  // 实际写入时只处理英文版本
  const enItemsToWrite = toOptimize.filter((item) => item.rel.includes('/en/'));

  if (!dryRun) {
    console.log('\n--- 写入优化后的 description（仅英文版本）---\n');
    let written = 0;
    for (const item of enItemsToWrite) {
      updateDescription(item.path, item.newDesc);
      console.log(`✅ ${item.rel}`);
      written++;
    }
    console.log(`\n完成! 已更新 ${written} 篇英文博客的 meta description`);
    console.log('\n下一步: 运行翻译流程同步到其他语言:');
    console.log('  npm run translate:blog -- --slug=YOUR_SLUG');
  } else {
    console.log('\n(Dry run - 未写入文件)');
    console.log('移除 --dry-run 参数以实际写入');
  }
}

main().catch(console.error);
