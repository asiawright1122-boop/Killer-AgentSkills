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
import { extractJSONCandidates, robustParseJSON, cleanAndClamp } from './lib/utils';
import type { CacheData, SkillCache } from './lib/types';
import { getNonTargetSkillReason } from '../src/lib/shared/validation';

const aiService = new AIService();

function isCollectionEligibleSkill(skill: SkillCache): boolean {
  const description = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';
  return !getNonTargetSkillReason({
    name: skill.name,
    owner: skill.owner,
    repo: skill.repo,
    body: skill.skillMd?.body || skill.skillMd?.bodyPreview || '',
    description,
    topics: skill.topics || [],
    category: skill.category,
    filePath: skill.repoPath,
  });
}

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

  const prompt = `You are a Senior Technical SEO Editor for "Killer-Skills", an installable AI Agent Skills directory for developer workflows.
Task: Generate a highly-optimized collection landing page for installable ${category} AI agent skills.

## Tools in this Collection:
${toolContexts}

## Target Languages: ${localeStr}

CRITICAL RULES:
1. Everything must stay skills-first and developer-workflow-first. Do not frame the page as interview prep, product management, MVP building, startup tooling, or generic AI platforms.
2. "seoTitle" MUST clearly signal installable skills or developer workflows. MAX 60 chars.
3. "seoDescription" is for the meta tag. MAX 160 chars. It should mention installable AI agent skills, developer workflows, or Claude Code/Cursor/Windsurf compatibility where natural.
4. "title" is the H1 on the page and should describe a collection of installable skills, not a generic tools comparison or "Top N best tools" page.
5. "description" MUST explain why developers would install these skills in real coding, workflow, or automation setups.
6. "keywords" should focus on high-intent developer searches and avoid low-intent phrases like interview, what is, tutorial, best, top, comparison, free, product manager, or MVP.
7. Keep technical terms (CLI, MCP, Agent, Python, API) in English, but translate the selling points naturally for each locale.

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
    // Duplicate null check removed (dead code)

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
        if (!isCollectionEligibleSkill(skill)) continue;
        if (!skill.category || skill.category === 'uncategorized' || skill.category === 'official') continue;
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
            if (!merged.seoTitle.en) merged.seoTitle.en = Object.values(merged.seoTitle)[0] || `${category} AI Agent Skills for Developer Workflows`;
            if (!merged.seoDescription.en) merged.seoDescription.en = Object.values(merged.seoDescription)[0] || `Explore installable ${category} AI agent skills for developer workflows and practical automation.`;

            // Enforce character limits
            merged.seoTitle = cleanAndClamp(merged.seoTitle, 60);
            merged.seoDescription = cleanAndClamp(merged.seoDescription, 160);

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
