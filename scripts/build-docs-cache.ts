#!/usr/bin/env npx tsx
/**
 * Documentation Translation Build Script
 * Translates docs/source/*.json to all supported locales using AI
 *
 * Usage:
 *   npx tsx scripts/build-docs-cache.ts
 *
 * Requires one AI route:
 *   - NVIDIA_API_KEYS / NVIDIA_API_KEY
 *   - SILICONFLOW_API_KEY
 *   - OPENROUTER_API_KEYS / OPENROUTER_API_KEY
 *   - or Cloudflare Workers AI bindings guarded by free-only limits
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'; // Load env vars
import * as dotenv from 'dotenv';
import { AIService } from './lib/ai';

// Load .env.local if exists
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

// Supported locales (excluding 'en' as it's the source)
const TARGET_LOCALES = ['zh', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'ru', 'ar'];
const aiService = new AIService();

const langNames: Record<string, string> = {
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
};

interface DocPage {
  slug: string;
  title: string;
  section: string;
  content: string;
}

interface DocsSource {
  version: number;
  pages: DocPage[];
  sidebar: Record<string, { title: string; items: string[] }>;
}

interface TranslatedDoc {
  slug: string;
  title: Record<string, string>;
  section: string;
  content: Record<string, string>;
}

interface DocsCache {
  version: number;
  lastUpdated: string;
  pages: TranslatedDoc[];
  sidebar: Record<string, { title: Record<string, string>; items: string[] }>;
}

async function translateWithSharedAi(text: string, targetLang: string, isTitle = false): Promise<string> {
  const systemPrompt = isTitle
    ? `Translate this title to ${langNames[targetLang]}. Output ONLY the translated text, nothing else.`
    : `You are a professional technical documentation translator. Translate the following HTML content to ${langNames[targetLang]}.

CRITICAL SEO RULE:
For non-English locales, you MUST seamlessly integrate the most popular local search term for "AI Agents" or "AI Tools" (e.g., if Japanese, use "AIエージェント"; if Russian, use "ИИ Агенты") naturally into the translation at least once.

RULES:
1. Preserve ALL HTML tags exactly as they are (<h2>, <p>, <code>, <pre>, <ul>, <li>, etc.)
2. Only translate the text content between tags
3. **CRITICAL**: Keep code snippets, commands, and technical framework/library terms (like "React", "Python", "SKILL.md", "npx", file paths) in original English.
4. Maintain the same professional, technical tone
5. Output ONLY the translated HTML, no explanations`;
  const prompt = `${systemPrompt}\n\nSOURCE:\n${text}`;
  const response = await aiService.callAI(prompt, false);
  return response?.trim() || text;
}

/**
 * Translate text using available API
 */
async function translate(text: string, targetLang: string): Promise<string> {
  return translateWithSharedAi(text, targetLang, false);
}

/**
 * Translate a simple title string
 */
async function translateTitle(title: string, targetLang: string): Promise<string> {
  try {
    return await translateWithSharedAi(title, targetLang, true);
  } catch (error) {
    console.error(`Error translating title "${title}":`, error);
  }
  return title;
}

async function main() {
  console.log('📚 Building Docs Cache...\n');

  // Check API availability
  const hasAiProvider = Boolean(
    (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || '').trim() ||
    (process.env.SILICONFLOW_API_KEY || '').trim() ||
    (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '').trim() ||
    ((process.env.CLOUDFLARE_ACCOUNT_ID || '').trim() && (process.env.CLOUDFLARE_API_TOKEN || '').trim()),
  );
  if (!hasAiProvider) {
    console.error(
      '❌ No translation API available. Configure NVIDIA, SiliconFlow, OpenRouter, or guarded Cloudflare Workers AI env vars.',
    );
    process.exit(1);
  }

  console.log('🔑 Using shared AI routing contract (NVIDIA primary, guarded backups by policy)');

  // Read source file
  const sourcePath = path.join(process.cwd(), 'docs/source/index.json');
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const source: DocsSource = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
  console.log(`📖 Found ${source.pages.length} pages to translate\n`);

  // Initialize cache structure
  const cache: DocsCache = {
    version: source.version,
    lastUpdated: new Date().toISOString(),
    pages: [],
    sidebar: {},
  };

  // Translate each page
  for (const page of source.pages) {
    console.log(`📄 Processing: ${page.slug}`);

    const translatedPage: TranslatedDoc = {
      slug: page.slug,
      title: { en: page.title },
      section: page.section,
      content: { en: page.content },
    };

    // Translate to each target locale
    for (const lang of TARGET_LOCALES) {
      console.log(`   → ${lang}...`);
      try {
        translatedPage.title[lang] = await translateTitle(page.title, lang);
        translatedPage.content[lang] = await translate(page.content, lang);
        // Add small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(`   ❌ Error translating to ${lang}:`, error);
        translatedPage.title[lang] = page.title;
        translatedPage.content[lang] = page.content;
      }
    }

    cache.pages.push(translatedPage);
    console.log(`   ✅ Done\n`);
  }

  // Translate sidebar sections
  console.log('📑 Translating sidebar...');
  for (const [key, section] of Object.entries(source.sidebar)) {
    cache.sidebar[key] = {
      title: { en: section.title },
      items: section.items,
    };

    for (const lang of TARGET_LOCALES) {
      try {
        cache.sidebar[key].title[lang] = await translateTitle(section.title, lang);
      } catch {
        cache.sidebar[key].title[lang] = section.title;
      }
    }
  }

  // Write cache file
  const cachePath = path.join(process.cwd(), 'data/docs-cache.json');
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  console.log(`\n✅ Docs cache built: ${cachePath}`);
  console.log(`   ${cache.pages.length} pages × ${TARGET_LOCALES.length + 1} locales`);
}

main().catch(console.error);
