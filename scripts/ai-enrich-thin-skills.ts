/**
 * AI 薄弱内容扩写脚本 (AI Thin Content Enricher)
 * 运行: npx tsx scripts/ai-enrich-thin-skills.ts
 * 
 * Target: Fetch skills with bodies < 500 characters and use AI 
 * to generate a comprehensive markdown profile for SEO purposes.
 */

import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { AIService } from './lib/ai';
import type { CacheData } from './lib/types';

const aiService = new AIService();
const CACHE_FILE = path.join(process.cwd(), 'data/skills-cache.json');

async function enrichThinSkills() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`Cache file not found at ${CACHE_FILE}`);
    return;
  }

  const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
  const cacheData = JSON.parse(cacheContent) as CacheData;

  const thinSkills = cacheData.skills.filter(s => (s.body?.length || 0) < 500);
  console.log(`[Inspector] Found ${thinSkills.length} Thin Content skills out of ${cacheData.skills.length}.`);

  if (thinSkills.length === 0) {
    console.log('✅ All skills have healthy content length. No enrichment needed.');
    return;
  }

  // To prevent overspending local usage in one execution, process top 5 priority
  const batch = thinSkills.slice(0, 5); 
  console.log(`[AI Engine] Starting batch enrichment for top ${batch.length} skills...`);

  let modifiedCount = 0;

  for (const skill of batch) {
    console.log(`\n⏳ Enriching ${skill.owner}/${skill.repo}...`);
    
    // Extracted raw intent
    const rawDesc = typeof skill.description === 'string' ? skill.description : (skill.description?.en || '');
    
    const prompt = `
You are a top-tier Technical Evangelist and AI Tooling Expert.
We have an AI Agent tool/workflow repository that is lacking comprehensive documentation.
This results in poor SEO and usability.
Repository Name: ${skill.repo}
Owner: ${skill.owner}
Current Metadata Description: ${rawDesc || 'No description provided'}
Topics / Categories: ${(skill.topics || []).join(', ')}

Please generate a highly-professional, robust Markdown README/Article for this skill.
It must be designed for professional developers and include:
- A catchy H1 title
- An engaging introduction explaining what it is and its value proposition in the AI agent era.
- **Key Features** (bullet points)
- **Usage / Setup instructions** (Give a standard theoretical usage example utilizing \`npx ${skill.repo}\` or similar CLI if applicable)
- **Why use it? (Benefits)**

**CRITICAL RULES:**
1. Write ONLY the pure markdown content. Do not include introductory/outro conversational text.
2. DO NOT embed the markdown in top-level backticks (e.g. \`\`\`markdown ... \`\`\`), output raw markdown directly.
3. Be professional, detailed, and optimistic about its utility.
    `;

    try {
      const generatedMarkdown = await aiService.callAI(prompt.trim(), false);
      
      if (generatedMarkdown && generatedMarkdown.length > 200) {
        // Strip out possible markdown wrappers
        let cleanMd = generatedMarkdown.trim();
        if (cleanMd.startsWith('\`\`\`markdown')) {
          cleanMd = cleanMd.replace(/^\`\`\`markdown\n/i, '').replace(/\n\`\`\`$/i, '');
        } else if (cleanMd.startsWith('\`\`\`')) {
          cleanMd = cleanMd.replace(/^\`\`\`\n/i, '').replace(/\n\`\`\`$/i, '');
        }

        skill.body = cleanMd;
        skill.tags = [...new Set([...(skill.tags || []), 'ai-enriched'])];
        console.log(`✅ Successfully enriched ${skill.repo} (Output: ${cleanMd.length} bytes)`);
        modifiedCount++;
      } else {
        console.warn(`⚠️ Generated content too short or null for ${skill.repo}`);
      }
    } catch (e) {
      console.error(`❌ Failed to enrich ${skill.repo}:`, e);
    }
  }

  if (modifiedCount > 0) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log(`\n========================================`);
    console.log(`💾 Data saved! ${modifiedCount} thin skills were upgraded into robust SEO pillars.`);
  }
}

enrichThinSkills().catch(console.error);
