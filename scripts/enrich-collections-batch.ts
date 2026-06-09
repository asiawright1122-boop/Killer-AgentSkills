#!/usr/bin/env npx tsx
/**
 * scripts/enrich-collections-batch.ts
 * Batch Content Enrichment Automation Script
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './lib/ai';
import { robustParseJSON, extractJSONCandidates } from './lib/utils';

// Load env files
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];
const FORBIDDEN_WORDS = [/review/i, /validation/i, /checklist/i, /checkpoint/i, /trusted next/i];

function splitKeys(...sources: Array<string | undefined>): string[] {
  return sources
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfiguredNvidiaKeys(): string[] {
  return splitKeys(
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

function getCollectionFileName(slug: string): string {
  const map: Record<string, string> = {
    'top-official-ai-skills-trusted-tools': 'top-official-mcp-servers.json',
    'top-agent-workflow-building-tools': 'top-workflow-mcp-servers.json',
    'top-cli-terminal-ai-agent-tools': 'top-cli-mcp-servers.json',
    'top-codex-workflow-skills-developer-integrations': 'top-codex-mcp-servers.json',
    'top-community-skills-ai-utilities': 'top-community-mcp-servers.json',
    'top-community-contributed-ai-agent-skills': 'top-community-skills.json',
    'top-github-copilot-companion-skills-dev-tools': 'top-copilot-mcp-servers.json',
    'top-cursor-compatible-skills-workflow-integrations': 'top-cursor-mcp-servers.json',
    'top-developer-tooling-ai-agent-work': 'top-developer-tools-mcp-servers.json',
    'top-devops-operations-automation-tools': 'top-devops-mcp-servers.json',
    'top-frameworks-sdk-foundations-agents': 'top-framework-mcp-servers.json',
    'top-gemini-cli-workflow-tools-terminal-automation-skills': 'top-gemini-cli-mcp-servers.json',
    'top-gemini-compatible-dev-tools-agent-workflow-skills': 'top-gemini-mcp-servers.json',
    'top-hacktoberfest-ai-skills-open-source-contributors': 'top-hacktoberfest-mcp-servers.json',
    'top-ai-agent-workflow-skills-integrations-utilities': 'top-mcp-mcp-servers.json',
    'top-ai-agent-integration-frameworks-bridges-infra-tooling': 'top-mcp-server-mcp-servers.json',
    'top-ai-agent-workflow-skills-integrations-2026': 'top-mcp-servers-2026.json',
    'top-nextjs-ai-tools-full-stack-developer-workflows': 'top-nextjs-mcp-servers.json',
    'top-openai-powered-ai-agent-tools': 'top-openai-mcp-servers.json',
    'top-opencode-workflow-tools-companion-integrations': 'top-opencode-mcp-servers.json',
    'top-orchestration-platforms-agent-execution': 'top-orchestration-mcp-servers.json',
    'top-productivity-tools-ai-enabled-developers': 'top-productivity-mcp-servers.json',
    'top-prompt-engineering-tools-agent-workflows': 'top-prompt-engineering-mcp-servers.json',
    'top-python-ai-agent-tools-developer-workflows': 'top-python-mcp-servers.json',
    'top-react-ai-tools-ui-workflows-component-development': 'top-react-mcp-servers.json',
    'top-rust-ai-tools-systems-workflows-reliability': 'top-rust-mcp-servers.json',
    'top-typescript-ai-tools-developer-workflows': 'top-typescript-mcp-servers.json',
  };
  return map[slug] || `${slug}.json`;
}

function isFieldThin(
  text: string | undefined,
  locale: string,
  fieldName: 'description' | 'longDescription' | 'selectionReason' | 'reviewSummary'
): boolean {
  if (!text || text.trim() === '') return true;
  const len = text.trim().length;
  if (fieldName === 'description') {
    if (locale === 'en') return len < 60;
    if (locale === 'zh' || locale === 'ja' || locale === 'ko') return len < 25;
    return len < 50;
  }
  if (fieldName === 'longDescription') {
    if (locale === 'en') return len < 150;
    if (locale === 'zh' || locale === 'ja' || locale === 'ko') return len < 80;
    return len < 120;
  }
  // selectionReason and reviewSummary
  if (locale === 'en') return len < 60;
  if (locale === 'zh' || locale === 'ja' || locale === 'ko') return len < 25;
  return len < 50;
}

function ensureTrailingPunctuation(text: string, locale: string): string {
  if (!text) return text;
  text = text.trim();
  const puncs = ['.', '!', '?', '。', '！', '？', '；', ';'];
  const lastChar = text.slice(-1);
  if (puncs.includes(lastChar)) {
    return text;
  }
  if (locale === 'zh' || locale === 'ja') {
    return text + '。';
  }
  return text + '.';
}

function containsForbiddenWords(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const checkValue = (val: any): boolean => {
        if (typeof val === 'string') {
          return FORBIDDEN_WORDS.some((pattern) => pattern.test(val));
        }
        if (Array.isArray(val)) {
          return val.some(checkValue);
        }
        if (typeof val === 'object' && val !== null) {
          return Object.values(val).some(checkValue);
        }
        return false;
      };
      return checkValue(parsed);
    }
  } catch {
    const cleanedText = text.replace(/"reviewSummary"\s*:/gi, '');
    return FORBIDDEN_WORDS.some((pattern) => pattern.test(cleanedText));
  }
  return FORBIDDEN_WORDS.some((pattern) => pattern.test(text));
}

async function callAIWithRetry(aiService: AIService, prompt: string, expectJson = true): Promise<string> {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const result = await aiService.callAI(prompt, expectJson, 'batch_generation');
      if (!result) {
        throw new Error('Empty response from AI service');
      }

      if (containsForbiddenWords(result)) {
        console.warn(`[WARN] AI response contains forbidden words, retrying... (Attempt ${attempts + 1}/3)`);
        attempts++;
        continue;
      }

      return result;
    } catch (e: any) {
      console.warn(`[WARN] AI Call failed: ${e.message || e}. Retrying... (Attempt ${attempts + 1}/3)`);
      attempts++;
      if (attempts >= 3) {
        throw e;
      }
      const delay = Math.pow(2, attempts) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries reached without success');
}

async function generateEnglishMetadata(
  aiService: AIService,
  title: string,
  skills: string[],
  currentData: any
): Promise<{ description: string; longDescription: string; selectionReason: string; reviewSummary: string }> {
  const prompt = `You are an expert technical content writer and SEO specialist. Your task is to generate rich, engaging, and highly accurate English metadata for a collection of AI Agent tools.

Collection Title: "${title}"
Skills included: ${skills.join(', ')}

Current English Metadata:
- Description: "${currentData.description?.en || ''}"
- Long Description: "${currentData.longDescription?.en || ''}"
- Selection Reason: "${currentData.editorial?.selectionReason?.en || ''}"
- Review Summary: "${currentData.editorial?.reviewSummary?.en || ''}"

Please generate rich English metadata for this collection.

CRITICAL RULES & COPY BOUNDARIES:
1. Do NOT use any of the following forbidden words in any form (including plurals or capitalizations):
   - "review"
   - "validation"
   - "checklist"
   - "checkpoint"
   - "trusted next"
2. Every sentence and field MUST end with proper trailing punctuation (e.g., ".").
3. Target practical workflow benefits and technical clarity. Avoid generic hype or empty marketing fluff. Explain exactly what these tools enable developers to do in their AI coding agents (like Claude Code, Cursor, Windsurf).
4. Do NOT use truncation markers like "..." or "…".

Length Requirements (in characters):
- "description": 60 to 150 characters.
- "longDescription": 150 to 300 characters.
- "selectionReason": 60 to 200 characters.
- "reviewSummary": 60 to 200 characters.

Output ONLY a valid JSON object in the following format (no markdown blocks, no prefix, no suffix, no explanation):
{
  "description": "...",
  "longDescription": "...",
  "selectionReason": "...",
  "reviewSummary": "..."
}
`;

  const responseText = await callAIWithRetry(aiService, prompt, true);

  const candidates = extractJSONCandidates(responseText);
  if (candidates.length === 0) {
    throw new Error(`Failed to extract JSON from AI response: ${responseText}`);
  }

  const parsed = robustParseJSON(candidates[0]);
  if (!parsed) {
    throw new Error(`Failed to robust parse JSON from candidates: ${candidates[0]}`);
  }

  return {
    description: ensureTrailingPunctuation(parsed.description || '', 'en'),
    longDescription: ensureTrailingPunctuation(parsed.longDescription || '', 'en'),
    selectionReason: ensureTrailingPunctuation(parsed.selectionReason || '', 'en'),
    reviewSummary: ensureTrailingPunctuation(parsed.reviewSummary || '', 'en'),
  };
}

async function translateMetadata(
  aiService: AIService,
  englishTexts: Record<string, string>,
  targetLocale: string
): Promise<Record<string, string>> {
  const prompt = `You are a professional technical translator. Your task is to translate the following English metadata for a technical developer audience into the target locale: "${targetLocale}".

English Source Texts to translate:
${Object.entries(englishTexts)
  .map(([key, text]) => `- ${key}: "${text}"`)
  .join('\n')}

CRITICAL RULES & COPY BOUNDARIES:
1. Do NOT translate or use any of the following forbidden words in any form in the translation (keep it natural for the locale, but avoid direct equivalents of these concepts):
   - "review" (e.g., in Chinese avoid 评审, 审核, 审查; in Spanish avoid revisión; in Japanese avoid レビュー/評価, etc.)
   - "validation" (e.g., avoid 验证)
   - "checklist" (e.g., avoid 清单)
   - "checkpoint" (e.g., avoid 检查点)
   - "trusted next" (e.g., avoid 受信任的下一步)
2. Every sentence and field in your translation MUST end with proper trailing punctuation suitable for the target locale (e.g., "。" for Chinese/Japanese, "." for European languages).
3. Preserve the technical clarity and tone. Keep technical term naming natural for local developers (e.g., API, IDE, Git can remain in English).
4. Do NOT use truncation markers like "..." or "…".

Output ONLY a valid JSON object matching the input keys, with the translated values (no markdown blocks, no prefix, no suffix, no explanation):
{
  ${Object.keys(englishTexts)
    .map((key) => `"${key}": "..."`)
    .join(',\n  ')}
}
`;

  const responseText = await callAIWithRetry(aiService, prompt, true);

  const candidates = extractJSONCandidates(responseText);
  if (candidates.length === 0) {
    throw new Error(`Failed to extract JSON from AI response: ${responseText}`);
  }

  const parsed = robustParseJSON(candidates[0]);
  if (!parsed) {
    throw new Error(`Failed to robust parse JSON from candidates: ${candidates[0]}`);
  }

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val === 'string') {
      result[key] = ensureTrailingPunctuation(val, targetLocale);
    }
  }
  return result;
}

async function main() {
  const workspaceRoot = process.cwd();
  const surfacesPath = path.resolve(workspaceRoot, 'data/authority-surfaces.json');
  const collectionsDir = path.resolve(workspaceRoot, 'src/content/collections');
  const draftsPath = path.resolve(workspaceRoot, 'data/enrichment-drafts.json');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dry');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const batchLimit = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : 3;
  const fileArg = args.find((arg) => arg.startsWith('--file='));
  const targetFile = fileArg ? fileArg.replace('--file=', '').trim() : null;

  if (!fs.existsSync(surfacesPath)) {
    console.error(`Error: authority-surfaces.json not found at ${surfacesPath}`);
    process.exit(1);
  }

  // Load existing drafts if they exist
  let drafts: Record<string, any> = {};
  if (fs.existsSync(draftsPath)) {
    try {
      drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
      console.log(`Loaded ${Object.keys(drafts).length} existing draft(s) from drafts.json.`);
    } catch (e) {
      console.warn(`[WARN] Failed to parse existing drafts: ${e}. Starting fresh.`);
    }
  }

  const surfacesData = JSON.parse(fs.readFileSync(surfacesPath, 'utf8'));
  const collections = surfacesData.surfaces.filter((s: any) => s.surfaceClass === 'collection');

  console.log(`Found ${collections.length} collection surfaces.`);

  const nvidiaKeys = getConfiguredNvidiaKeys();
  const siliconFlowConfigured = Boolean(process.env.SILICONFLOW_API_KEY);
  const openRouterKeys = getConfiguredOpenRouterKeys();
  const cloudflareConfigured = hasCloudflareWorkersAi();

  if (nvidiaKeys.length === 0 && !siliconFlowConfigured && openRouterKeys.length === 0 && !cloudflareConfigured) {
    console.error('❌ No AI providers configured.');
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

  let processedCount = 0;

  for (const s of collections) {
    if (processedCount >= batchLimit) {
      console.log(`Batch limit of ${batchLimit} reached. Stopping.`);
      break;
    }

    const slug = s.href.split('/').pop() || '';
    const filename = getCollectionFileName(slug);

    if (targetFile && filename !== targetFile) {
      continue;
    }

    const filePath = path.join(collectionsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] Collection file not found: ${filename}`);
      continue;
    }

    const colData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check what fields/locales are thin
    const thinMap: Record<string, string[]> = {
      description: [],
      longDescription: [],
      selectionReason: [],
      reviewSummary: [],
    };

    let needsEnrichment = false;

    // Check description
    for (const loc of LOCALES) {
      if (isFieldThin(colData.description?.[loc], loc, 'description')) {
        thinMap.description.push(loc);
        needsEnrichment = true;
      }
    }

    // Check longDescription
    for (const loc of LOCALES) {
      if (isFieldThin(colData.longDescription?.[loc], loc, 'longDescription')) {
        thinMap.longDescription.push(loc);
        needsEnrichment = true;
      }
    }

    // Check editorial selectionReason and reviewSummary
    for (const loc of LOCALES) {
      if (isFieldThin(colData.editorial?.selectionReason?.[loc], loc, 'selectionReason')) {
        thinMap.selectionReason.push(loc);
        needsEnrichment = true;
      }
      if (isFieldThin(colData.editorial?.reviewSummary?.[loc], loc, 'reviewSummary')) {
        thinMap.reviewSummary.push(loc);
        needsEnrichment = true;
      }
    }

    if (!needsEnrichment) {
      console.log(`✓ Collection ${filename} is already rich in all locales.`);
      continue;
    }

    console.log(`\n====================================================`);
    console.log(`🔄 Processing thin collection: ${filename}`);
    console.log(`   Title: ${colData.title?.en || slug}`);
    console.log(`   Thin fields/locales detected:`);
    if (thinMap.description.length > 0) console.log(`     * description: [${thinMap.description.join(', ')}]`);
    if (thinMap.longDescription.length > 0) console.log(`     * longDescription: [${thinMap.longDescription.join(', ')}]`);
    if (thinMap.selectionReason.length > 0) console.log(`     * selectionReason: [${thinMap.selectionReason.join(', ')}]`);
    if (thinMap.reviewSummary.length > 0) console.log(`     * reviewSummary: [${thinMap.reviewSummary.join(', ')}]`);

    if (dryRun) {
      console.log(`   [DRY RUN] Would enrich ${filename}`);
      processedCount++;
      continue;
    }

    try {
      // 1. Resolve English source metadata.
      // If English itself is thin in any of the fields, regenerate them.
      const enDescriptionThin = thinMap.description.includes('en');
      const enLongDescriptionThin = thinMap.longDescription.includes('en');
      const enSelectionReasonThin = thinMap.selectionReason.includes('en');
      const enReviewSummaryThin = thinMap.reviewSummary.includes('en');

      const englishSource: { description: string; longDescription: string; selectionReason: string; reviewSummary: string } = {
        description: colData.description?.en || '',
        longDescription: colData.longDescription?.en || '',
        selectionReason: colData.editorial?.selectionReason?.en || '',
        reviewSummary: colData.editorial?.reviewSummary?.en || '',
      };

      if (enDescriptionThin || enLongDescriptionThin || enSelectionReasonThin || enReviewSummaryThin) {
        console.log(`   Generating new English source metadata...`);
        const newEn = await generateEnglishMetadata(aiService, colData.title?.en || slug, colData.skills || [], colData);
        
        if (enDescriptionThin && newEn.description) {
          englishSource.description = newEn.description;
          console.log(`     + New EN description: "${newEn.description}"`);
        }
        if (enLongDescriptionThin && newEn.longDescription) {
          englishSource.longDescription = newEn.longDescription;
          console.log(`     + New EN longDescription: "${newEn.longDescription}"`);
        }
        if (enSelectionReasonThin && newEn.selectionReason) {
          englishSource.selectionReason = newEn.selectionReason;
          console.log(`     + New EN selectionReason: "${newEn.selectionReason}"`);
        }
        if (enReviewSummaryThin && newEn.reviewSummary) {
          englishSource.reviewSummary = newEn.reviewSummary;
          console.log(`     + New EN reviewSummary: "${newEn.reviewSummary}"`);
        }
      }

      // Initialize the draft object for this collection file
      const fileDraft = drafts[filename] || {
        description: { ...colData.description },
        longDescription: { ...colData.longDescription },
        editorial: {
          selectionReason: { ...colData.editorial?.selectionReason },
          reviewSummary: { ...colData.editorial?.reviewSummary },
        },
      };

      // Always write the resolved English source back to the draft (if updated)
      fileDraft.description.en = englishSource.description;
      fileDraft.longDescription.en = englishSource.longDescription;
      if (!fileDraft.editorial) fileDraft.editorial = {};
      if (!fileDraft.editorial.selectionReason) fileDraft.editorial.selectionReason = {};
      if (!fileDraft.editorial.reviewSummary) fileDraft.editorial.reviewSummary = {};
      fileDraft.editorial.selectionReason.en = englishSource.selectionReason;
      fileDraft.editorial.reviewSummary.en = englishSource.reviewSummary;

      // 2. Perform translation for other locales
      // We group translation tasks by target locale.
      for (const loc of LOCALES) {
        if (loc === 'en') continue;

        const needsDescriptionTrans = thinMap.description.includes(loc) || enDescriptionThin;
        const needsLongDescriptionTrans = thinMap.longDescription.includes(loc) || enLongDescriptionThin;
        const needsSelectionReasonTrans = thinMap.selectionReason.includes(loc) || enSelectionReasonThin;
        const needsReviewSummaryTrans = thinMap.reviewSummary.includes(loc) || enReviewSummaryThin;

        // If the locale already has a rich description and we didn't regenerate English, we skip.
        // We only translate if the locale's field is thin, OR if we updated the English source.
        const translationPayload: Record<string, string> = {};
        if (needsDescriptionTrans) translationPayload.description = englishSource.description;
        if (needsLongDescriptionTrans) translationPayload.longDescription = englishSource.longDescription;
        if (needsSelectionReasonTrans) translationPayload.selectionReason = englishSource.selectionReason;
        if (needsReviewSummaryTrans) translationPayload.reviewSummary = englishSource.reviewSummary;

        if (Object.keys(translationPayload).length > 0) {
          console.log(`   Translating to target locale: ${loc}...`);
          const translations = await translateMetadata(aiService, translationPayload, loc);
          
          if (translations.description) {
            fileDraft.description[loc] = translations.description;
          }
          if (translations.longDescription) {
            fileDraft.longDescription[loc] = translations.longDescription;
          }
          if (translations.selectionReason) {
            fileDraft.editorial.selectionReason[loc] = translations.selectionReason;
          }
          if (translations.reviewSummary) {
            fileDraft.editorial.reviewSummary[loc] = translations.reviewSummary;
          }
        }
      }

      // Save to drafts memory
      drafts[filename] = fileDraft;

      // Write drafts.json back immediately after each success to prevent data loss on intermediate failures
      fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2) + '\n', 'utf8');
      console.log(`   Saved drafts for ${filename} to drafts.json.`);
      processedCount++;

      // Throttle delay to respect rate limits
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e: any) {
      console.error(`❌ Failed to enrich collection ${filename}: ${e.message || e}`);
      // D-03: Log error and skip to next page without aborting
    }
  }

  console.log(`\n====================================================`);
  console.log(`Enrichment batch complete. Processed ${processedCount} collection(s).`);
}

main().catch(console.error);
