/**
 * Long Description Enrichment Script
 * 
 * Generates AI-powered 200-400 word industry analysis paragraphs for
 * each collection, in all 10 supported languages.
 * 
 * Run: npx tsx scripts/enrich-collections.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { AIService } from './lib/ai';
import { extractJSONCandidates, robustParseJSON } from './lib/utils';

const aiService = new AIService();

const _LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'] as const;

async function generateLongDescription(
    enTitle: string,
    enDescription: string,
    category: string,
    skillCount: number,
    targetLocales: string[]
): Promise<Record<string, string>> {
    const localeStr = targetLocales.join(', ');
    const localeExample = targetLocales.map(l => `"${l}": "..."`).join(', ');

    const prompt = `You are a Senior Technical Writer for "Killer-Skills", an AI Agent skills marketplace.

Write an engaging, SEO-optimized long-form paragraph (200-300 words) for a curated collection page.

## Collection Info:
- Title: "${enTitle}"
- Category: ${category}
- Number of tools: ${skillCount}
- Short intro: "${enDescription}"

## Requirements:
1. Write a comprehensive introduction that explains WHY developers need these ${category} tools
2. Mention real-world use cases and workflow improvements
3. Include natural keyword density for "${category} AI tools", "MCP servers", "AI agent"
4. Use an authoritative but approachable tone
5. Structure: Start with the industry context → explain the value proposition → highlight what makes this curated list special
6. Do NOT use markdown formatting, bullet points, or headers - pure flowing prose paragraphs
7. Keep technical terms (MCP, AI, CLI, API, SDK) in English across all locales
8. Translate the content naturally into each target language

## Target Languages: ${localeStr}

Output STRICT JSON only, no markdown fences:
{ ${localeExample} }`;

    const response = await aiService.callAI(prompt, false);
    if (!response) throw new Error(`AI returned empty for ${category}`);

    const candidates = extractJSONCandidates(response);
    for (const item of candidates) {
        const parsed = robustParseJSON(item);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            // Validate at least one locale has content
            const values = Object.values(parsed as Record<string, string>);
            if (values.some(v => typeof v === 'string' && v.length > 50)) {
                return parsed as Record<string, string>;
            }
        }
    }

    throw new Error(`Failed to parse longDescription for ${category}`);
}

async function run() {
    console.log('📝 Collection Content Enrichment Script\n');

    const collectionsDir = path.join(process.cwd(), 'src/content/collections');
    const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.json'));

    let enriched = 0;

    for (const file of files) {
        const filePath = path.join(collectionsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Skip if already has longDescription with en content
        if (data.longDescription?.en && data.longDescription.en.length > 100) {
            console.log(`⏩ ${file}: already has longDescription`);
            continue;
        }

        const enTitle = data.title?.en || '';
        const enDesc = data.description?.en || '';
        const category = data.category || 'general';
        const skillCount = data.skills?.length || 0;

        if (!enTitle || enTitle.length < 5) {
            console.log(`⏩ Skipping ${file}: no English title`);
            continue;
        }

        console.log(`✨ Enriching: ${file} (${category}, ${skillCount} skills)...`);

        try {
            // Batch 1: en, zh, ja, ko, es
            console.log('   → Batch 1: en, zh, ja, ko, es');
            const batch1 = await generateLongDescription(enTitle, enDesc, category, skillCount, ['en', 'zh', 'ja', 'ko', 'es']);
            await new Promise(r => setTimeout(r, 1200));

            // Batch 2: fr, de, pt, ru, ar
            console.log('   → Batch 2: fr, de, pt, ru, ar');
            const batch2 = await generateLongDescription(enTitle, enDesc, category, skillCount, ['fr', 'de', 'pt', 'ru', 'ar']);

            // Merge
            const longDescription: Record<string, string> = { ...batch1, ...batch2 };

            // Validate CJK fields
            for (const locale of ['zh', 'ja', 'ko'] as const) {
                const val = longDescription[locale];
                if (!val || val.replace(/[\d\s\[\]\(\)\.,:;!?]/g, '').length < 30) {
                    console.log(`   ⚠️ ${locale} longDescription too short, using en fallback`);
                    longDescription[locale] = longDescription.en || enDesc;
                }
            }

            data.longDescription = longDescription;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
            console.log(`   ✅ Saved ${file}`);
            enriched++;

            await new Promise(r => setTimeout(r, 1200));
        } catch (e: any) {
            console.error(`   ❌ Error: ${e.message}`);
        }
    }

    console.log(`\n🎉 Enriched ${enriched} collections with longDescription.`);
}

run().catch(console.error);
