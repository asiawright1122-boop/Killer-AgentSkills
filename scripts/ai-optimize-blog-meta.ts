#!/usr/bin/env npx tsx
/**
 * AI 批量优化博客 meta description（使用统一 AI 路由）
 * 基于 meta-tags-optimizer 技能的最佳实践：120–158 字符、包含 CTA、Power Words
 *
 * 用法:
 *   npx tsx scripts/ai-optimize-blog-meta.ts              # 交互模式
 *   npx tsx scripts/ai-optimize-blog-meta.ts --dry-run   # 仅预览
 *   npx tsx scripts/ai-optimize-blog-meta.ts --lang=en   # 只处理英文
 *   npx tsx scripts/ai-optimize-blog-meta.ts --api-key=xxx # 临时覆盖 NVIDIA 主 key
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './lib/ai';
import { getDescriptionLengthRange, sanitizeMetaDescription, trimDescriptionToMax } from './lib/meta-description';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

function splitKeys(...sources: Array<string | undefined>): string[] {
  return sources
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCliApiKeyOverride(): string | null {
  const args = process.argv.slice(2);
  const apiKeyArg = args.find((arg) => arg.startsWith('--api-key='));
  if (!apiKeyArg) return null;
  return apiKeyArg.replace('--api-key=', '').trim() || null;
}

function getConfiguredNvidiaKeys(cliApiKey: string | null): string[] {
  return cliApiKey
    ? [cliApiKey]
    : splitKeys(
        process.env.NVIDIA_API_KEY,
        process.env.NVIDIA_API_KEYS,
        process.env.NVIDIA_API_KEYS_2,
        process.env.NVIDIA_API_KEYS_3,
        process.env.NVIDIA_API_KEYS_4,
        process.env.NVIDIA_API_KEYS_5,
      );
}

function getConfiguredOpenRouterKeys(): string[] {
  return splitKeys(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEYS);
}

function hasCloudflareWorkersAi(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

function buildOptimizationPrompt(
  title: string,
  oldDescription: string,
  locale: string,
  minLen: number,
  maxLen: number,
): string {
  return `You are an SEO expert specializing in meta description optimization.

CRITICAL RULES:
- Respect the target length requirement exactly
- Keep language natural for the target locale
- Do NOT append English CTA phrases to non-English descriptions
- Avoid snippet truncation markers like "..." or "…"
- Output ONLY the description, no quotes, no explanations

Blog Title: ${title}
Current Description: ${oldDescription}
Target Locale: ${locale}

Rewrite to ${minLen}-${maxLen} characters.

Requirements:
- Include primary keyword
- Keep language natural for ${locale}
- Do not use English CTA phrases in non-English descriptions
- Do not output truncation markers like "..." or "…"

Output ONLY the description.`;
}

async function optimizeMetaDescription(
  aiService: AIService,
  title: string,
  oldDescription: string,
  locale: string,
  minLen: number,
  maxLen: number,
): Promise<string> {
  const prompt = buildOptimizationPrompt(title, oldDescription, locale, minLen, maxLen);
  const result = await aiService.callAI(prompt, false, 'batch_generation');

  if (!result || !result.trim()) {
    throw new Error('All configured AI providers failed or returned empty output');
  }

  return result.trim();
}

function extractFrontmatter(filePath: string): { title: string; description: string; content: string } | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fm = match[1];
  const titleMatch = fm.match(/^title:\s*"([^"]+)"\s*$/m);
  const descMatch = fm.match(/^description:\s*"([^"]+)"\s*$/m);

  if (!titleMatch || !descMatch) return null;

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
  const updated = raw.replace(/^(\s*description:\s*)"[^"]*"/m, `$1"${newDesc}"`);
  fs.writeFileSync(filePath, updated);
}

function walk(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) files.push(full);
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dry');
  const langFilter = args.find((arg) => arg.startsWith('--lang='))?.replace('--lang=', '') || null;
  const cliApiKey = getCliApiKeyOverride();
  const nvidiaKeys = getConfiguredNvidiaKeys(cliApiKey);
  const siliconFlowConfigured = Boolean(process.env.SILICONFLOW_API_KEY);
  const openRouterKeys = getConfiguredOpenRouterKeys();
  const cloudflareConfigured = hasCloudflareWorkersAi();

  if (nvidiaKeys.length === 0 && !siliconFlowConfigured && openRouterKeys.length === 0 && !cloudflareConfigured) {
    console.error(
      '❌ 未检测到可用 AI Provider。请配置 NVIDIA、SiliconFlow、OpenRouter，或受限的 Cloudflare Workers AI 环境变量。',
    );
    process.exit(1);
  }

  const aiService = new AIService({
    nvidiaKeys,
    siliconFlowKey: process.env.SILICONFLOW_API_KEY || '',
    openRouterKeys,
    cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    cfApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    workloadProfile: 'batch_generation',
  });

  console.log(`\n🤖 使用统一 AI 路由优化博客 Meta Description\n`);
  console.log(
    `📡 Provider 配置: NVIDIA=${nvidiaKeys.length} key(s), SiliconFlow=${siliconFlowConfigured ? 'on' : 'off'}, OpenRouter=${openRouterKeys.length} key(s), WorkersAI=${cloudflareConfigured ? process.env.WORKERS_AI_MODE || 'free-only' : 'off'}\n`,
  );

  const all = walk(BLOG_DIR);
  const toOptimize: { path: string; rel: string; title: string; oldDesc: string; length: number }[] = [];

  for (const filePath of all) {
    const rel = path.relative(process.cwd(), filePath);
    if (langFilter && !rel.includes(`/blog/${langFilter}/`)) continue;

    const data = extractFrontmatter(filePath);
    if (!data) continue;

    const locale = rel.split(path.sep)[2] || 'en';
    const { min: minLen, max: maxLen } = getDescriptionLengthRange(locale);

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

  const isCI = args.includes('--ci') || process.env.CI === 'true';
  const batchSize = isCI ? 50 : 10;
  const batch = toOptimize.slice(0, batchSize);

  console.log(`📋 待优化: ${toOptimize.length} 篇 (本次处理 ${batch.length} 篇${isCI ? ' [CI模式]' : ''})\n`);
  console.log(`策略: 120-158 字符, 包含 CTA, 使用 Power Words\n`);

  for (const item of batch) {
    console.log(`\n🔄 处理: ${item.rel}`);
    console.log(`   标题: ${item.title.slice(0, 50)}...`);
    console.log(`   原描述 (${item.length}字符): ${item.oldDesc.slice(0, 60)}...`);

    const locale = item.rel.split(path.sep)[2] || 'en';
    const { min: minLen, max: maxLen } = getDescriptionLengthRange(locale);

    try {
      let newDesc = await optimizeMetaDescription(aiService, item.title, item.oldDesc, locale, minLen, maxLen);
      newDesc = sanitizeMetaDescription(newDesc, locale);
      newDesc = trimDescriptionToMax(newDesc, maxLen);

      if (newDesc.length < minLen) {
        console.log(`   ⚠️ 描述过短 (${newDesc.length}字符), 跳过`);
        continue;
      }

      console.log(`   ✅ 新描述 (${newDesc.length}字符): ${newDesc.slice(0, 60)}...`);

      if (!dryRun) {
        updateDescription(item.path, newDesc);
        console.log('   💾 已写入');
      } else {
        console.log('   (Dry run - 未写入)');
      }
    } catch (error) {
      console.error(`   ❌ AI 路由错误: ${error}`);
    }
  }

  console.log(`\n\n✅ 完成! 本次处理 ${batch.length} 篇`);

  if (toOptimize.length > batch.length) {
    console.log(`\n💡 提示: 还有 ${toOptimize.length - batch.length} 篇待处理，可再次运行脚本`);
  }

  if (dryRun) {
    console.log('\n(Dry run 模式 - 未写入任何文件)');
  }
}

main().catch(console.error);
