#!/usr/bin/env npx tsx
/**
 * Fully Stateless Pre-Translation Pipeline for SSR
 * Reads existing translation keys from Cloudflare KV 'TRANSLATIONS' namespace.
 * Diff them against the calculated strings from skills-cache.json.
 * Batches and runs LLM translations for any missing hash, then bulk uploads.
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

import * as dotenv from 'dotenv';

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) process.env[k] = envConfig[k];
}

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const KV_NAMESPACE_ID = process.env.CLOUDFLARE_TRANSLATIONS_NAMESPACE_ID || 'd5ab5c6705774d779d9b1342eda5f9ac';

const LOCALES = ['zh', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'ru', 'ar'];

// Exactly mirrors the dynamic hashing logic in src/lib/i18n-dynamic.ts
function generateTranslationKey(text: string, lang: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const shortPreview = text.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');
  const finalHash = Math.abs(hash).toString(36);
  return `i18n:ssr:${lang}:${finalHash}-${text.length}-${shortPreview}`;
}

async function fetchAllKVKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    console.warn('⚠️ Missing CF API tokens for bulk script. Proceeding offline.');
    return keys;
  }
  let cursor = '';
  let hasMore = true;
  console.log('🔍 Fetching existing translation keys from Cloudflare KV...');
  while (hasMore) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?limit=1000${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      console.warn('⚠️ KV namespace unreadable (404/Err). Proceeding with empty set.', await res.text());
      return keys;
    }
    const data = await res.json();
    if (data.success) {
      data.result.forEach((item: any) => keys.add(item.name));
      cursor = data.result_info?.cursor || '';
      hasMore = !!cursor;
      process.stdout.write('.');
    } else {
      break;
    }
  }
  console.log(`\n📦 Total existing translation keys: ${keys.size}`);
  return keys;
}

async function writeToKVBulk(items: Array<{ key: string; value: string }>): Promise<boolean> {
  if (items.length === 0 || !CF_API_TOKEN) return false;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
    if (res.ok) return true;
    const body = await res.text();
    // Payload too large abort immediately
    if (res.status === 413) {
      console.error('Payload Too Large in KV Bulk Write');
      return false;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const NVIDIA_API_KEYS = process.env.NVIDIA_API_KEYS?.split(',').filter(Boolean) || [];

async function callLLM(text: string, targetLang: string): Promise<string> {
  const langNameMap: Record<string, string> = {
    zh: 'Simplified Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
  };
  const langName = langNameMap[targetLang] || targetLang;
  const prompt = `Translate the following Markdown or text context into ${langName}. Keep all Markdown syntax and codeblocks intact. Output ONLY the raw translated text.\n\n${text}`;

  if (NVIDIA_API_KEYS.length > 0) {
    try {
      const apiKey = NVIDIA_API_KEYS[Math.floor(Math.random() * NVIDIA_API_KEYS.length)].trim();
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices[0]?.message?.content || text;
        return content;
      }
    } catch {}
  }

  if (SILICONFLOW_API_KEY) {
    try {
      const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SILICONFLOW_API_KEY}` },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-72B-Instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content || text;
      }
    } catch {}
  }
  return text;
}

async function main() {
  const existingKeys = await fetchAllKVKeys();
  const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
  if (!fs.existsSync(cachePath)) {
    console.error('⚠️ skills-cache.json not found. Make sure this runs after harvest build.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const skills = Array.isArray(data) ? data : data.skills || [];

  const uniqueStrings = new Set<string>();
  const textEncoder = new TextEncoder();

  for (const skill of skills) {
    if (skill.name) uniqueStrings.add(skill.name);
    if (skill.description) uniqueStrings.add(skill.description);
    if (skill.topics && Array.isArray(skill.topics)) {
      skill.topics.forEach((t: string) => uniqueStrings.add(t));
    }

    const rawReadmeContent = skill.skillMd?.body || skill.skillMd?.bodyPreview || '';
    const rawReadmeSize = textEncoder.encode(rawReadmeContent).length;
    const fallbackReadmeContent = `# ${skill.name || skill.repo}\n\n${skill.description}`;
    const readmeContentSource =
      rawReadmeContent && rawReadmeSize >= 250
        ? rawReadmeContent
        : [rawReadmeContent, fallbackReadmeContent].filter((part) => part && part.trim().length > 0).join('\n\n');
    if (readmeContentSource) uniqueStrings.add(readmeContentSource);
  }

  const missingTasks: Array<{ text: string; lang: string; key: string }> = [];

  for (const text of Array.from(uniqueStrings)) {
    if (typeof text !== 'string' || !text || text.trim().length === 0) continue;
    for (const lang of LOCALES) {
      const key = generateTranslationKey(text, lang);
      if (!existingKeys.has(key)) {
        missingTasks.push({ text, lang, key });
      }
    }
  }

  console.log(
    `🎯 Found ${missingTasks.length} missing translation keys out of ${uniqueStrings.size * LOCALES.length} total keys.`,
  );

  if (missingTasks.length === 0) {
    console.log('✅ All translations are fully seeded. No updates required.');
    return;
  }

  let translatedBuffer: Array<{ key: string; value: string }> = [];
  // Heavy concurrency requires stable APIs. Nvidia/SiliconFlow can take ~10
  const CONCURRENCY = 10;
  let completed = 0;

  // Cut jobs if exceeding 2 hours in extreme cases, Action will continue on next scheduled run
  const maxTasksOverride = process.env.MAX_TRANSLATE_JOBS
    ? parseInt(process.env.MAX_TRANSLATE_JOBS)
    : missingTasks.length;
  const targetTasks = missingTasks.slice(0, maxTasksOverride);
  if (targetTasks.length < missingTasks.length) {
    console.log(`⏱️ Capping run to ${targetTasks.length} jobs to fit inside pipeline limits.`);
  }

  for (let i = 0; i < targetTasks.length; i += CONCURRENCY) {
    const chunk = targetTasks.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (task) => {
        try {
          const translated = await callLLM(task.text, task.lang);
          if (translated && translated.trim().length > 0 && translated !== task.text) {
            translatedBuffer.push({ key: task.key, value: translated });
          }
        } catch (e) {}
      }),
    );

    completed += chunk.length;
    process.stdout.write(`\r✅ Translated ${completed}/${targetTasks.length}`);

    if (translatedBuffer.length >= 50) {
      await writeToKVBulk(translatedBuffer);
      translatedBuffer = [];
    }
  }

  if (translatedBuffer.length > 0) {
    await writeToKVBulk(translatedBuffer);
  }

  console.log(`\n🎉 SSR Translations Preheat Complete!`);
}

main().catch(console.error);
