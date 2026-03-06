import * as fs from 'fs/promises';
import * as path from 'path';
import { AIService } from './lib/ai';
import { robustParseJSON } from './lib/utils';
import type { UnifiedSkill } from '../src/lib/skills'; // Adjusted path to src

const CACHE_FILE = path.resolve('./data/skills-cache.json');
const OUT_DIR = path.resolve('./src/content/collections');

// The structure we want the LLM to return
interface CollectionSEO {
    title: { en: string, zh: string };
    description: { en: string, zh: string };
    seoTitle: { en: string, zh: string };
    seoDescription: { en: string, zh: string };
    keywords: { en: string[], zh: string[] };
}

async function start() {
    console.log('[Collections Generator] Starting Programmatic SEO factory...');

    // 1. Ensure output directory exists
    await fs.mkdir(OUT_DIR, { recursive: true });

    // 2. Load the skills database
    const fileContent = await fs.readFile(CACHE_FILE, 'utf-8');
    let data;
    try {
        data = JSON.parse(fileContent);
    } catch {
        console.error('Failed to parse skills cache');
        return;
    }

    let skills: UnifiedSkill[] = [];
    if (Array.isArray(data)) skills = data;
    else if (data && Array.isArray(data.skills)) skills = data.skills;

    console.log(`[Collections Generator] Loaded ${skills.length} skills from cache.`);

    // 3. Group by TOPICS (fine-grained) instead of coarse `category`
    const EXCLUDED_TOPICS = new Set(['claude-code', 'claude', 'anthropic', 'ai', 'llm', 'tag-production', 'skills', 'agent-skills', 'agent']);
    const groups: Record<string, UnifiedSkill[]> = {};
    for (const skill of skills) {
        if (!skill.topics || skill.topics.length === 0) continue;
        for (const topic of skill.topics) {
            const t = topic.toLowerCase().trim();
            if (EXCLUDED_TOPICS.has(t)) continue;
            if (!groups[t]) groups[t] = [];
            groups[t].push(skill);
        }
    }

    // 4. Filter topics that have enough depth for a "Top X" list (at least 8 unique skills)
    const validCategories = Object.keys(groups).filter(k => {
        const uniqueRepos = new Set(groups[k].map(s => `${s.owner}/${s.repo}`));
        return uniqueRepos.size >= 5;
    });
    console.log(`[Collections Generator] Found ${validCategories.length} rich topics for SEO Collections.`);

    // 5. Initialize AI Service
    const aiService = new AIService();

    // Process up to 15 collections in one run
    const runLimit = 30;
    let count = 0;

    for (const category of validCategories) {
        if (count >= runLimit) {
            console.log(`[Collections Generator] Reached test limit of ${runLimit}. Stopping.`);
            break;
        }

        const outFilePath = path.join(OUT_DIR, `top-${category.replace(/[^a-z0-9]/g, '-')}-mcp-servers.json`);

        // Skip if already generated
        try {
            await fs.access(outFilePath);
            console.log(`[Collections Generator] Skipping ${category}, collection already exists.`);
            continue;
        } catch {
            // File doesn't exist, proceed
        }

        // Get Top unique skills in this category by QualityScore or Stars
        const uniqueSkillsMap = new Map<string, UnifiedSkill>();
        for (const s of groups[category]) {
            const key = `${s.owner}/${s.repo}`;
            if (!uniqueSkillsMap.has(key)) {
                uniqueSkillsMap.set(key, s);
            }
        }

        const topSkills = Array.from(uniqueSkillsMap.values())
            .sort((a, b) => (b.qualityScore || b.stars || 0) - (a.qualityScore || a.stars || 0))
            .slice(0, 12);

        const skillIds = topSkills.map(s => `${s.owner}/${s.repo}`);
        const skillNames = topSkills.map(s => s.name || s.repo).join(', ');

        console.log(`[Collections Generator] Processing category: [${category}] with ${skillIds.length} top skills...`);

        const prompt = `
You are an expert SEO Content Strategist for "Killer-Skills", a directory for AI Agent Skills, MCP Servers, and Claude Extensions.
I am building a Programmatic SEO aggregation page (a "Top X" list) for the category: "${category}".

The top tools featured in this collection will be: ${skillNames}.

Generate the SEO metadata for this specific collection page in JSON format.
Make it sound highly professional, curated, and optimized for search intent like "Best ${category} AI tools", "Top MCP servers for ${category}".

Return ONLY valid JSON matching this exact structure:
{
    "title": { "en": "Top X ...", "zh": "..." },
    "description": { "en": "Engaging intro paragraph about why this category matters for AI agents...", "zh": "..." },
    "seoTitle": { "en": "Optimized meta title < 60 chars", "zh": "..." },
    "seoDescription": { "en": "Optimized meta description < 160 chars", "zh": "..." },
    "keywords": { "en": ["keyword1", "keyword2"], "zh": ["关键词1", "关键词2"] }
}
`;

        try {
            // using the unified RACE architecture from aiService
            const responseText = await aiService.callAI(prompt, true);
            if (!responseText) throw new Error("AI returned null");

            const seoData = robustParseJSON(responseText) as CollectionSEO;

            if (!seoData.title || !seoData.description || !seoData.keywords) {
                throw new Error("Missing required SEO fields from AI generation");
            }

            const finalCollectionPayload = {
                ...seoData,
                featured: false,
                category: category,
                author: "Killer-Skills AI",
                skills: skillIds
            };

            await fs.writeFile(outFilePath, JSON.stringify(finalCollectionPayload, null, 2), 'utf-8');
            console.log(`✅ Collection Generated: ${outFilePath}`);
            count++;

            // Rate limit sleep
            await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
            console.error(`❌ Failed to generate collection for [${category}]:`, e.message);
        }
    }

    console.log('\n[Collections Generator] Done!');
}

start().catch(e => {
    console.error(e);
    process.exit(1);
});
