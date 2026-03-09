/**
 * Collection Generator Script
 * 
 * Auto-generates SEO-optimized curated collections from the skills cache.
 * Run: npm run generate:collections
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { AIService } from './lib/ai';
import { SUPPORTED_LOCALES } from './lib/constants';
import { extractJSONCandidates, robustParseJSON, cleanAndTruncate } from './lib/utils';
import type { CacheData, SkillCache } from './lib/types';

const aiService = new AIService();

async function generateLocalizedCollection(
    category: string,
    skills: SkillCache[],
    targetLocales: string[]
): Promise<any> {
    const listCount = skills.length;

    // Provide AI with the actual context of these tools to generate accurate summaries
    const toolContexts = skills.slice(0, 10).map((s, i) => `
${i + 1}. [${s.name}]
Description: ${typeof s.description === 'string' ? s.description : s.description?.en || ''}
Tags: ${(s.topics || []).join(', ')}`).join('\n');

    const localeStr = targetLocales.join(', ');
    const localeExample = targetLocales.map(l => `"${l}": "..."`).join(', ');
    const localeArrayExample = targetLocales.map(l => `"${l}": ["..."]`).join(', ');

    const prompt = `You are a Senior Technical SEO Editor for "Killer-Skills", an AI Agent Tools directory.
Task: Generate a highly-optimized "Top ${listCount} Best ${category} Tools" collection landing page.

## Tools in this Collection:
${toolContexts}

## Target Languages: ${localeStr}

CRITICAL RULES:
1. "seoTitle" MUST be catchy and include a value proposition (e.g., "Top ${listCount} ${category} Tools for AI Agents [2026]"). MAX 60 chars.
2. "seoDescription" is for the meta tag. MAX 160 chars. Should drive clicks.
3. "title" is the H1 on the page. e.g. "Top ${listCount} ${category} Frameworks & Tools".
4. "description" MUST be an engaging introductory paragraph summarizing WHY developers need these ${category} tools. 
5. "keywords" should target long-tail dev searches mixing navigational and informational queries.
6. Keep technical terms (CLI, MCP, Agent, Python, API) in English, but translate the selling points to the native locales perfectly.

Output STRICT JSON only:
{
  "title": { ${localeExample} },
  "description": { ${localeExample} },
  "seoTitle": { ${localeExample} },
  "seoDescription": { ${localeExample} },
  "keywords": { ${localeArrayExample} }
}`;

    // Use jsonMode=false because some LLMs fail strict JSON mode with large prompts
    const response = await aiService.callAI(prompt, false);
    if (!response) {
        console.error(`[DEBUG] Raw AI returned empty for ${category}`);
        throw new Error(`No AI response for collection ${category} batch ${localeStr}`);
    }
    if (!response) throw new Error(`No AI response for collection ${category} batch ${localeStr}`);

    const candidates = extractJSONCandidates(response);
    for (const item of candidates) {
        const parsed = robustParseJSON(item);
        if (parsed && typeof parsed === 'object' && parsed.title) {
            return parsed;
        }
    }

    console.error(`\n[DEBUG RAW AI RESPONSE BEGIN]\n${response}\n[DEBUG RAW AI RESPONSE END]\n`);
    throw new Error(`Invalid JSON generated for ${category} batch ${localeStr}`);
}

async function run() {
    console.log('🚀 Starting Programmatic SEO Collection Generator...');

    const force = process.argv.includes('--force');

    // 1. Load data
    const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
    if (!fs.existsSync(cachePath)) {
        console.error('❌ Cache file not found. Please run build-skills-cache first.');
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheData;

    // 2. Group by category
    const categoryMap = new Map<string, SkillCache[]>();
    for (const skill of data.skills) {
        if (!skill.category || skill.category === 'uncategorized' || skill.category === 'developer' || skill.category === 'ai' || skill.category === 'official') continue;
        const list = categoryMap.get(skill.category) || [];
        list.push(skill);
        categoryMap.set(skill.category, list);
    }

    const outputDir = path.join(process.cwd(), 'src/content/collections');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 3. Process categories with >= 5 skills
    const MIN_SKILLS = 7;
    let newGeneratedCount = 0;

    for (const [category, allSkills] of categoryMap.entries()) {
        const sortedSkills = allSkills
            .sort((a, b) => (b.qualityScore || 0) + (b.stars || 0) - ((a.qualityScore || 0) + (a.stars || 0)))
            .slice(0, 15); // Max 15 for a curated list

        if (sortedSkills.length < MIN_SKILLS) continue;

        const slug = `top-${category}-skills`;
        const filePath = path.join(outputDir, `${slug}.json`);

        if (fs.existsSync(filePath) && !force) {
            console.log(`⏩ Skipping ${category}: Collection already exists (${slug}.json)`);
            continue;
        }

        console.log(`\n✨ Generating SEO Collection for: ${category} (${sortedSkills.length} skills)...`);

        try {
            // Split supported locales into batches of 3-4 to avoid hitting token/timeout limits
            const results: any[] = [];
            const BATCH_SIZE = 4;
            const allLocales = ['en', ...SUPPORTED_LOCALES]; // Ensure English is included

            for (let i = 0; i < allLocales.length; i += BATCH_SIZE) {
                const batch = allLocales.slice(i, i + BATCH_SIZE);
                console.log(`   → Calling AI for batch: ${batch.join(', ')}`);
                const parsed = await generateLocalizedCollection(category, sortedSkills, batch);
                results.push(parsed);
                // Sleep brief to avoid rate limits
                await new Promise(r => setTimeout(r, 1500));
            }

            // Merge batched results into final shape
            const merged = {
                title: {} as Record<string, string>,
                description: {} as Record<string, string>,
                seoTitle: {} as Record<string, string>,
                seoDescription: {} as Record<string, string>,
                keywords: {} as Record<string, string[]>,
                skills: sortedSkills.map(s => `${s.owner}/${s.repo}`),
                author: 'Killer-Skills AI',
                featured: sortedSkills.length >= 10,
                category: category
            };

            for (const r of results) {
                if (r.title) Object.assign(merged.title, r.title);
                if (r.description) Object.assign(merged.description, r.description);
                if (r.seoTitle) Object.assign(merged.seoTitle, r.seoTitle);
                if (r.seoDescription) Object.assign(merged.seoDescription, r.seoDescription);
                if (r.keywords) Object.assign(merged.keywords, r.keywords);
            }

            // Format check / fallback for critical en string
            if (!merged.seoTitle.en) merged.seoTitle.en = Object.values(merged.seoTitle)[0] || `Top ${sortedSkills.length} ${category} Skills`;
            if (!merged.seoDescription.en) merged.seoDescription.en = Object.values(merged.seoDescription)[0] || `Explore the best ${category} AI tools.`;

            // Enforce character limits
            merged.seoTitle = cleanAndTruncate(merged.seoTitle, 60);
            merged.seoDescription = cleanAndTruncate(merged.seoDescription, 160);

            fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
            console.log(`   ✅ Saved to: src/content/collections/${slug}.json`);
            newGeneratedCount++;

        } catch (e) {
            console.error(`   ❌ Error generating ${category}:`, e);
        }
    }

    console.log(`\n🎉 Processed ${categoryMap.size} categories. Generated ${newGeneratedCount} NEW collections.`);
}

run().catch(console.error);
