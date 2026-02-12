#!/usr/bin/env npx tsx
/**
 * Documentation Translation Build Script
 * Translates docs/source/*.json to all supported locales using AI
 * 
 * Usage:
 *   npx tsx scripts/build-docs-cache.ts
 * 
 * Requires:
 *   - NVIDIA_API_KEYS or NVIDIA_API_KEY or (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'; // Load env vars
import * as dotenv from 'dotenv';

// Load .env.local if exists
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

// Supported locales (excluding 'en' as it's the source)
const TARGET_LOCALES = ['zh', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'ru', 'ar'];

// API Keys - same pattern as build-skills-cache.ts
const nvidiaApiKeys = (process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY || "").split(',').map(k => k.trim()).filter(Boolean);
let currentNvidiaKeyIndex = 0;

const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const cfApiToken = process.env.CLOUDFLARE_API_TOKEN || '';

// Get next NVIDIA API key (rotation)
function getNvidiaApiKey(): string | null {
    if (nvidiaApiKeys.length === 0) return null;
    const key = nvidiaApiKeys[currentNvidiaKeyIndex];
    currentNvidiaKeyIndex = (currentNvidiaKeyIndex + 1) % nvidiaApiKeys.length;
    return key;
}

const langNames: Record<string, string> = {
    zh: 'Chinese (Simplified)',
    ja: 'Japanese',
    ko: 'Korean',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic'
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

/**
 * Translate text using NVIDIA API (native fetch)
 */
async function translateWithNvidia(text: string, targetLang: string, isTitle = false): Promise<string> {
    const apiKey = getNvidiaApiKey();
    if (!apiKey) throw new Error('No NVIDIA API keys available');

    const systemPrompt = isTitle
        ? `Translate this title to ${langNames[targetLang]}. Output ONLY the translated text, nothing else.`
        : `You are a professional technical documentation translator. Translate the following HTML content to ${langNames[targetLang]}.

RULES:
1. Preserve ALL HTML tags exactly as they are (<h2>, <p>, <code>, <pre>, <ul>, <li>, etc.)
2. Only translate the text content between tags
3. Keep code snippets, commands, and technical terms (like "SKILL.md", "npx", file paths) unchanged
4. Maintain the same professional, technical tone
5. Output ONLY the translated HTML, no explanations`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'meta/llama-3.1-70b-instruct',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: isTitle ? 0.2 : 0.3,
            max_tokens: isTitle ? 100 : 4000
        })
    });

    if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || text;
}

/**
 * Translate text using Cloudflare Workers AI
 */
async function translateWithCloudflare(text: string, targetLang: string): Promise<string> {
    if (!cfAccountId || !cfApiToken) throw new Error('Cloudflare credentials not set');

    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`;

    const langNames: Record<string, string> = {
        zh: 'Chinese (Simplified)',
        ja: 'Japanese',
        ko: 'Korean',
        de: 'German',
        es: 'Spanish',
        fr: 'French',
        pt: 'Portuguese',
        ru: 'Russian',
        ar: 'Arabic'
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [
                {
                    role: 'system',
                    content: `You are a professional technical documentation translator. Translate the following HTML content to ${langNames[targetLang]}. Preserve all HTML tags. Only translate text content. Keep code and commands unchanged. Output only the translated HTML.`
                },
                {
                    role: 'user',
                    content: text
                }
            ]
        })
    });

    const data = await response.json() as any;
    return data.result?.response || text;
}

/**
 * Translate text using available API
 */
async function translate(text: string, targetLang: string): Promise<string> {
    // Try NVIDIA first, then Cloudflare
    if (nvidiaApiKeys.length > 0) {
        return translateWithNvidia(text, targetLang, false);
    } else if (cfAccountId && cfApiToken) {
        return translateWithCloudflare(text, targetLang);
    } else {
        console.warn(`⚠️ No API available, using original text for ${targetLang}`);
        return text;
    }
}

/**
 * Translate a simple title string
 */
async function translateTitle(title: string, targetLang: string): Promise<string> {
    if (nvidiaApiKeys.length === 0 && !(cfAccountId && cfApiToken)) return title;

    try {
        if (nvidiaApiKeys.length > 0) {
            return await translateWithNvidia(title, targetLang, true);
        } else if (cfAccountId && cfApiToken) {
            // Use Cloudflare for title translation
            const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cfApiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: `Translate this title to ${langNames[targetLang]}. Output ONLY the translated text, nothing else.` },
                        { role: 'user', content: title }
                    ]
                })
            });
            const data = await response.json() as any;
            return data.result?.response?.trim() || title;
        }
    } catch (error) {
        console.error(`Error translating title "${title}":`, error);
    }
    return title;
}

async function main() {
    console.log('📚 Building Docs Cache...\n');

    // Check API availability
    if (nvidiaApiKeys.length === 0 && !(cfAccountId && cfApiToken)) {
        console.error('❌ No translation API available. Set NVIDIA_API_KEYS or CLOUDFLARE_* env vars.');
        process.exit(1);
    }

    console.log(`🔑 Using ${nvidiaApiKeys.length > 0 ? `NVIDIA API (${nvidiaApiKeys.length} keys)` : 'Cloudflare Workers AI'}`);


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
        sidebar: {}
    };

    // Translate each page
    for (const page of source.pages) {
        console.log(`📄 Processing: ${page.slug}`);

        const translatedPage: TranslatedDoc = {
            slug: page.slug,
            title: { en: page.title },
            section: page.section,
            content: { en: page.content }
        };

        // Translate to each target locale
        for (const lang of TARGET_LOCALES) {
            console.log(`   → ${lang}...`);
            try {
                translatedPage.title[lang] = await translateTitle(page.title, lang);
                translatedPage.content[lang] = await translate(page.content, lang);
                // Add small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));
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
            items: section.items
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
