/**
 * CJK Translation Fix Script
 * 
 * Scans all collection JSON files and re-translates missing/broken
 * zh, ja, ko fields using the AI service.
 * 
 * Run: npx tsx scripts/fix-collections-cjk.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { AIService } from './lib/ai';
import { extractJSONCandidates, robustParseJSON } from './lib/utils';

const aiService = new AIService();

const CJK_LOCALES = ['zh', 'ja', 'ko'] as const;
const TEXT_FIELDS = ['title', 'description', 'seoTitle', 'seoDescription'] as const;
const MIN_CHAR_THRESHOLD: Record<string, number> = {
    title: 5,
    description: 20,
    seoTitle: 5,
    seoDescription: 10,
};

interface CollectionData {
    title: Record<string, string>;
    description: Record<string, string>;
    seoTitle: Record<string, string>;
    seoDescription: Record<string, string>;
    keywords: Record<string, string[]>;
    skills: string[];
    author: string;
    featured: boolean;
    _category: string;
}

function isBroken(value: string | undefined, field: string): boolean {
    if (!value || value.trim() === '') return true;
    if (value === '...') return true;
    const minLen = MIN_CHAR_THRESHOLD[field] || 5;
    // Check if value is just numbers/punctuation (garbled CJK output)
    const stripped = value.replace(/[\d\s\[\]\(\)\.,:;!?·\-–—]/g, '');
    if (stripped.length < minLen) return true;
    return false;
}

async function translateFields(
    enValues: Record<string, string>,
    targetLocale: string,
    _category: string
): Promise<Record<string, string>> {
    const prompt = `You are a professional translator for "Killer-Skills", an AI Agent tools directory website.

Translate the following English text fields into ${targetLocale === 'zh' ? 'Simplified Chinese (简体中文)' : targetLocale === 'ja' ? 'Japanese (日本語)' : 'Korean (한국어)'}.

CRITICAL RULES:
1. Keep technical terms (MCP, AI, CLI, Agent, API, SDK) in English
2. Translate naturally, not word-by-word. Use native expressions.
3. "seoTitle" must be ≤60 characters, catchy and SEO-friendly
4. "seoDescription" must be ≤160 characters, drives clicks
5. Return ONLY valid JSON, no markdown fences

Source (English):
${JSON.stringify(enValues, null, 2)}

Output JSON format:
{
  "title": "translated title",
  "description": "translated description",
  "seoTitle": "translated seoTitle",
  "seoDescription": "translated seoDescription"
}`;

    const response = await aiService.callAI(prompt, false);
    if (!response) throw new Error(`AI returned empty for ${category}/${targetLocale}`);

    const candidates = extractJSONCandidates(response);
    for (const item of candidates) {
        const parsed = robustParseJSON(item);
        if (parsed && typeof parsed === 'object' && parsed.title) {
            return parsed as Record<string, string>;
        }
    }

    throw new Error(`Failed to parse AI response for ${category}/${targetLocale}`);
}

async function translateKeywords(
    enKeywords: string[],
    targetLocale: string,
    _category: string
): Promise<string[]> {
    const langName = targetLocale === 'zh' ? 'Simplified Chinese' : targetLocale === 'ja' ? 'Japanese' : 'Korean';
    const prompt = `Translate these SEO keywords into ${langName}. Keep technical terms (MCP, AI, CLI, Python, TypeScript) in English. Return a JSON array only.

English keywords: ${JSON.stringify(enKeywords)}

Output: ["keyword1", "keyword2", ...]`;

    const response = await aiService.callAI(prompt, false);
    if (!response) return enKeywords;

    const candidates = extractJSONCandidates(response);
    for (const item of candidates) {
        const parsed = robustParseJSON(item);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    }
    return enKeywords;
}

async function run() {
    console.log('🔧 CJK Translation Fix Script\n');

    const collectionsDir = path.join(process.cwd(), 'src/content/collections');
    const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.json'));

    let totalFixed = 0;
    let totalFields = 0;

    for (const file of files) {
        const filePath = path.join(collectionsDir, file);
        const data: CollectionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let modified = false;

        // Get English source values
        const enValues: Record<string, string> = {};
        for (const field of TEXT_FIELDS) {
            enValues[field] = data[field]?.en || '';
        }

        if (!enValues.title || enValues.title.length < 3) {
            console.log(`⏩ Skipping ${file}: English source is also empty`);
            continue;
        }

        for (const locale of CJK_LOCALES) {
            // Check which fields are broken for this locale
            const brokenFields: string[] = [];
            for (const field of TEXT_FIELDS) {
                if (isBroken(data[field]?.[locale], field)) {
                    brokenFields.push(field);
                }
            }

            // Check keywords
            const kwBroken = !data.keywords?.[locale] ||
                data.keywords[locale].length === 0 ||
                data.keywords[locale].every((k: string) => k.replace(/[\d\s]/g, '').length < 3);

            if (brokenFields.length === 0 && !kwBroken) continue;

            console.log(`🔄 ${file} [${locale}]: fixing ${brokenFields.length} text fields${kwBroken ? ' + keywords' : ''}`);

            try {
                // Translate broken text fields
                if (brokenFields.length > 0) {
                    const translated = await translateFields(enValues, locale, data.category || file);

                    for (const field of brokenFields) {
                        const newVal = (translated as any)[field];
                        if (newVal && typeof newVal === 'string' && newVal.length >= (MIN_CHAR_THRESHOLD[field] || 3)) {
                            if (!data[field as keyof CollectionData]) {
                                (data as any)[field] = {};
                            }
                            (data[field as keyof CollectionData] as Record<string, string>)[locale] = newVal;
                            totalFields++;
                            modified = true;
                        }
                    }
                }

                // Translate keywords if broken
                if (kwBroken && data.keywords?.en?.length > 0) {
                    const newKw = await translateKeywords(data.keywords.en, locale, data.category || file);
                    if (newKw.length > 0) {
                        data.keywords[locale] = newKw;
                        modified = true;
                    }
                }

                // Rate limit between API calls
                await new Promise(r => setTimeout(r, 1000));

            } catch (e: any) {
                console.error(`   ❌ Failed for ${file}/${locale}: ${e.message}`);
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
            console.log(`   ✅ Saved ${file}`);
            totalFixed++;
        }
    }

    console.log(`\n🎉 Fixed ${totalFixed} files, repaired ${totalFields} text fields.`);
}

run().catch(console.error);
