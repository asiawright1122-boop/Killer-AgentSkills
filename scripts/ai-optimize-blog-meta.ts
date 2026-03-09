#!/usr/bin/env npx tsx
/**
 * AI 批量优化博客 meta description（使用 NVIDIA API）
 * 基于 meta-tags-optimizer 技能的最佳实践：120–158 字符、包含 CTA、Power Words
 *
 * 用法: 
 *   npx tsx scripts/ai-optimize-blog-meta.ts              # 交互模式
 *   npx tsx scripts/ai-optimize-blog-meta.ts --dry-run   # 仅预览
 *   npx tsx scripts/ai-optimize-blog-meta.ts --lang=en   # 只处理英文
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// 加载 .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const MIN_LEN = 120;
const MAX_LEN = 158;

// 从环境变量或命令行参数获取 NVIDIA API Keys
function getNvidiaKeys(): string[] {
  // 首先检查命令行参数
  const args = process.argv.slice(2);
  const apiKeyArg = args.find((a) => a.startsWith('--api-key='));
  if (apiKeyArg) {
    return [apiKeyArg.replace('--api-key=', '')];
  }

  const keys = [
    process.env.NVIDIA_API_KEY,
    process.env.NVIDIA_API_KEYS,
    process.env.NVIDIA_API_KEYS_2,
    process.env.NVIDIA_API_KEYS_3,
    process.env.NVIDIA_API_KEYS_4,
    process.env.NVIDIA_API_KEYS_5,
  ]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return keys;
}

let keyIndex = 0;
function getNextKey(keys: string[]): string {
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

// 调用 NVIDIA API
async function callNvidia(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [
        {
          role: 'system',
          content: `You are an SEO expert specializing in meta description optimization. 

CRITICAL LENGTH RULE: Your output MUST be EXACTLY 120-158 characters. This is non-negotiable for SERP display.
- Count characters carefully before outputting
- If too long, trim unnecessary words
- Include primary keyword naturally
- Add a clear CTA at the end (e.g., "Learn now", "Read more", "Get started")
- Use power words: proven, essential, complete, master, discover, learn, etc.
- Output ONLY the description, no quotes, no explanations`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 80,
      top_p: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA API Error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

function extractFrontmatter(filePath: string): { title: string; description: string; content: string } | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fm = match[1];
  const titleMatch = fm.match(/^title:\s*"([^"]+)"\s*$/m);
  const descMatch = fm.match(/^description:\s*"([^"]+)"\s*$/m);

  if (!titleMatch || !descMatch) return null;

  // 提取正文（前 1000 字符作为上下文）
  const bodyStart = raw.indexOf('---', 4);
  const body = bodyStart > 0 ? raw.slice(bodyStart + 3, bodyStart + 1200).trim() : '';

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
  const langFilter = args.find((a) => a.startsWith('--lang='))?.replace('--lang=', '') || null;

  const keys = getNvidiaKeys();
  if (keys.length === 0) {
    console.error('❌ 未配置 NVIDIA_API_KEY，请在 .env 中设置');
    process.exit(1);
  }
  console.log(`\n🤖 使用 NVIDIA API 优化博客 Meta Description\n`);
  console.log(`📡 检测到 ${keys.length} 个 API Keys\n`);

  const all = walk(BLOG_DIR);
  const toOptimize: { path: string; rel: string; title: string; oldDesc: string; length: number }[] = [];

  // 收集需要优化的博客
  for (const filePath of all) {
    const rel = path.relative(process.cwd(), filePath);
    
    // 语言过滤
    if (langFilter && !rel.includes(`/blog/${langFilter}/`)) continue;

    const data = extractFrontmatter(filePath);
    if (!data) continue;

    // 检测是否为 CJK 语言
    const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff]/.test(data.title);
    const minLen = isCJK ? 40 : MIN_LEN;
    const maxLen = isCJK ? 200 : MAX_LEN; // CJK 可以稍长

    const len = data.description.length;
    if (len < minLen || len > maxLen) {
      toOptimize.push({
        path: filePath,
        rel,
        title: data.title,
        oldDesc: data.description,
        length: len,
      });
    }
  }

  // 限制数量以避免 API 限额（每次处理 10 篇）
  const BATCH_SIZE = 10;
  const batch = toOptimize.slice(0, BATCH_SIZE);
  
  console.log(`📋 待优化: ${toOptimize.length} 篇 (本次处理 ${batch.length} 篇)\n`);
  console.log(`策略: 120-158 字符, 包含 CTA, 使用 Power Words\n`);

  // 逐个调用 AI 优化
  for (const item of batch) {
    console.log(`\n🔄 处理: ${item.rel}`);
    console.log(`   标题: ${item.title.slice(0, 50)}...`);
    console.log(`   原描述 (${item.length}字符): ${item.oldDesc.slice(0, 60)}...`);

    const prompt = `
Blog Title: ${item.title}
Current Description: ${item.oldDesc}

Rewrite to 130-155 characters MAX. Count and trim if needed!

Requirements:
- Include primary keyword
- Add CTA: "Learn now", "Read more", "Get started"
- Keep it short

Output ONLY the description (no quotes).`;

    try {
      const apiKey = getNextKey(keys);
      let newDesc = await callNvidia(apiKey, prompt);
      
      // 对 CJK 语言降低最小长度要求到 40 字符
      const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff]/.test(item.title);
      const minLen = isCJK ? 40 : 120;
      const maxLen = isCJK ? 200 : 158;
      
      // 自动截断到对应语言的最大字符数
      if (newDesc.length > maxLen) {
        newDesc = newDesc.slice(0, maxLen - 3).trim() + '...';
      }
      
      if (newDesc.length < minLen) {
        console.log(`   ⚠️ 描述过短 (${newDesc.length}字符), 跳过`);
        continue;
      }
      
      const newLen = newDesc.length;

      console.log(`   ✅ 新描述 (${newLen}字符): ${newDesc.slice(0, 60)}...`);

      if (!dryRun) {
        updateDescription(item.path, newDesc);
        console.log(`   💾 已写入`);
      } else {
        console.log(`   (Dry run - 未写入)`);
      }
    } catch (error) {
      console.error(`   ❌ API 错误: ${error}`);
    }
  }

  console.log(`\n\n✅ 完成! 本次处理 ${batch.length} 篇`);
  
  if (toOptimize.length > batch.length) {
    console.log(`\n💡 提示: 还有 ${toOptimize.length - batch.length} 篇待处理，可再次运行脚本`);
  }
  
  if (dryRun) {
    console.log(`\n(Dry run 模式 - 未写入任何文件)`);
  }
}

main().catch(console.error);
