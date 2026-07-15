#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { AIService } from './lib/ai';
import { SUPPORTED_LOCALES } from './lib/constants';
import { getDescriptionLengthRange, sanitizeMetaDescription, trimDescriptionToMax } from './lib/meta-description';
import { robustParseJSON } from './lib/utils';

// CLI Args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_SLUG = args.find((arg) => arg.startsWith('--slug='))?.split('=')[1];

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const EN_DIR = path.join(BLOG_DIR, 'en');

const aiService = new AIService();

// Helper to reliably split frontmatter and body
function parseMarkdown(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: match[1], body: match[2] };
}

function getQuotedFrontmatterValue(frontmatter: string, field: string): string | undefined {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(['"])(.*?)\\1\\s*$`, 'm'));
  return match?.[2];
}

function escapeQuotedFrontmatterValue(value: string, quote: string): string {
  if (quote === "'") return value.replace(/'/g, "''");
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function replaceQuotedFrontmatterValue(frontmatter: string, field: string, value: string): string {
  const pattern = new RegExp(`(^${field}:\\s*)(['"])(.*?)\\2(?=\\s*$)`, 'm');
  return frontmatter.replace(pattern, (_match, prefix: string, quote: string) => {
    return `${prefix}${quote}${escapeQuotedFrontmatterValue(value, quote)}${quote}`;
  });
}

export function applyTranslatedBlogFrontmatter(
  frontmatter: string,
  targetLang: string,
  translated: { title: string; description: string },
): string {
  return replaceQuotedFrontmatterValue(
    replaceQuotedFrontmatterValue(
      replaceQuotedFrontmatterValue(frontmatter, 'title', translated.title),
      'description',
      translated.description,
    ),
    'lang',
    targetLang,
  );
}

async function translateBlogBody(body: string, targetLang: string): Promise<string> {
  // Strategy: Split by H2 headers to handle long articles without hitting response limits
  const chunks = body.split(/(?=\n## )/);

  if (chunks.length <= 1 && body.length < 4000) {
    // Short article, single pass
    return await translateChunk(body, targetLang);
  }

  console.log(`     📦 Article split into ${chunks.length} chunks for reliable translation...`);
  let translatedBody = '';
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.trim()) {
      process.stdout.write(`       [Chunk ${i + 1}/${chunks.length}] `);
      const translatedChunk = await translateChunk(chunk, targetLang);
      translatedBody += translatedChunk + '\n';
    }
  }
  return translatedBody.trim();
}

async function translateChunk(chunk: string, targetLang: string): Promise<string> {
  const prompt = `You are a professional technical translator and SEO expert. 
Translate the following Markdown content from English to ${targetLang}.

## Rules:
1. **Preserve Markdown**: Keep all headers, bullets, code blocks, links, and formatting exactly as is.
2. **Translate Text**: Only translate the human-readable text. Do NOT translate code blocks, file paths, or technical terms that should remain in English (e.g., "React", "API", "JSON").
3. **SEO Optimization**: Use natural, search-friendly phrasing in ${targetLang}.
4. **Internal Links**: Keep link paths identical for now (we will fix them programmatically).
5. **Images**: Keep image syntax \`![alt](url)\` but translate the alt text.
6. **No Fluff**: Do not add introductory text. Return ONLY the translated Markdown.

## Content to Translate:
${chunk}`;

  const result = await aiService.callAI(prompt, false);
  if (!result) {
    throw new Error(`AI Translation failed for chunk (no response from any provider)`);
  }
  return result;
}

async function translateFrontmatter(frontmatter: string, targetLang: string): Promise<string> {
  // Simple key-value translation for title and description
  const title = getQuotedFrontmatterValue(frontmatter, 'title');
  const desc = getQuotedFrontmatterValue(frontmatter, 'description');

  if (!title || !desc) return frontmatter;

  const { min: minLen, max: maxLen } = getDescriptionLengthRange(targetLang);

  const prompt = `Translate these blog metadata fields to ${targetLang} for SEO purposes.

IMPORTANT SEO REQUIREMENTS:
- Meta description MUST be between ${minLen}-${maxLen} characters
- Keep the tone natural and native for ${targetLang}
- Do NOT append English CTA phrases in non-English output
- Avoid snippet truncation markers like "..." or "…"

Return valid JSON only: { "title": "...", "description": "..." }

Original Title: "${title}"
Original Description: "${desc}" (currently ${desc.length} characters)`;

  const result = await aiService.callAI(prompt, true);
  let newTitle = title;
  let newDesc = desc;

  if (!result) {
    throw new Error(`AI Translation failed for metadata (no response from any provider)`);
  }

  if (result) {
    try {
      const parsed = robustParseJSON(result);
      if (parsed && typeof parsed === 'object') {
        if (parsed.title) newTitle = parsed.title;
        if (parsed.description) newDesc = parsed.description;
      }
    } catch (e) {
      console.error('⚠️ Failed to parse frontmatter translation JSON, using English fallback.', e);
    }
  }

  newDesc = sanitizeMetaDescription(newDesc, targetLang);
  newDesc = trimDescriptionToMax(newDesc, maxLen);

  if (newDesc.length < minLen) {
    console.log(
      `     ⚠️ Description short for ${targetLang} (${newDesc.length} chars, expected ${minLen}-${maxLen}); keeping localized output without English fallback`,
    );
  }

  // Reconstruct frontmatter
  return applyTranslatedBlogFrontmatter(frontmatter, targetLang, {
    title: newTitle,
    description: newDesc,
  });
}

async function main() {
  console.log('🚀 Starting Blog Translation Workflow...');
  if (DRY_RUN) console.log('👀 DRY RUN MODE: No files will be written.');
  if (SPECIFIC_SLUG) console.log(`Targeting single slug: ${SPECIFIC_SLUG}`);

  // 1. Get English posts
  const enFiles = fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.md'));

  for (const file of enFiles) {
    const slug = file.replace('.md', '');

    if (SPECIFIC_SLUG && slug !== SPECIFIC_SLUG) continue;

    console.log(`\n📄 Processing: ${slug}`);

    // Read English content
    const enPath = path.join(EN_DIR, file);
    const content = fs.readFileSync(enPath, 'utf-8');
    const { frontmatter, body } = parseMarkdown(content);

    // 2. Iterate locales
    for (const locale of SUPPORTED_LOCALES) {
      const targetDir = path.join(BLOG_DIR, locale);
      const targetPath = path.join(targetDir, file);

      // Create dir if missing
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      let shouldTranslate = false;
      if (process.env.FORCE_TRANSLATE === 'true') {
        shouldTranslate = true;
      } else if (!fs.existsSync(targetPath)) {
        shouldTranslate = true;
      } else {
        const locContent = fs.readFileSync(targetPath, 'utf-8');
        const locTitleMatch = locContent.match(/title:\s*["'](.+?)["']/);
        const enTitleMatch = content.match(/title:\s*["'](.+?)["']/);
        if (locTitleMatch && enTitleMatch && locTitleMatch[1] === enTitleMatch[1]) {
          // Title still matches English — needs translation
          shouldTranslate = true;
        }

        // [H5 fix] Detect corrupted translations: if a CJK locale file has a title
        // that is mostly ASCII (not properly translated), flag for re-translation
        if (!shouldTranslate && locTitleMatch) {
          const CJK_LOCALES = ['zh', 'ja', 'ko', 'ar', 'ru'];
          if (CJK_LOCALES.includes(locale)) {
            const title = locTitleMatch[1];
            const nonAscii = [...title].filter((c) => c.charCodeAt(0) > 127).length;
            const ratio = title.length > 0 ? nonAscii / title.length : 0;
            if (ratio < 0.15) {
              // Less than 15% non-ASCII in a CJK/Arabic/Russian title = likely broken
              console.log(
                `     ⚠️  Corrupted title detected (${(ratio * 100).toFixed(0)}% non-ASCII): "${title.slice(0, 50)}"`,
              );
              shouldTranslate = true;
            }
          }
        }

        // Also detect untranslated descriptions (description still in English for non-en locale)
        if (!shouldTranslate) {
          const locDescMatch = locContent.match(/description:\s*["'](.+?)["']/);
          const enDescMatch = content.match(/description:\s*["'](.+?)["']/);
          if (locDescMatch && enDescMatch && locDescMatch[1] === enDescMatch[1]) {
            console.log(`     ⚠️  Untranslated description detected for ${locale}`);
            shouldTranslate = true;
          }
        }
      }

      if (!shouldTranslate) {
        continue;
      }

      console.log(`  🌍 Translating to ${locale}...`);

      if (DRY_RUN) {
        console.log(`     [Dry Run] Would translate and write to ${targetPath}`);
        continue;
      }

      // 3. Translate
      try {
        // Frontmatter
        const newFrontmatter = await translateFrontmatter(frontmatter, locale);

        // Body
        const newBody = await translateBlogBody(body, locale);

        // 4. Post-processing: Internal Links
        // Replace /en/blog/ with /{locale}/blog/
        // Also handles relative links like (./other-post) if any, but usually we use absolute paths in Astro content
        const locBody = newBody
          .replace(/\/en\/blog\//g, `/${locale}/blog/`)
          .replace(/https:\/\/killer-skills\.com\/en\//g, `https://killer-skills.com/${locale}/`);

        // 5. Write file
        const newContent = `---\n${newFrontmatter}\n---\n${locBody}`;
        fs.writeFileSync(targetPath, newContent);
        console.log(`     ✅ Written to ${targetPath}`);
      } catch (error) {
        console.error(`     ❌ Failed to translate to ${locale}:`, error);
      }
    }
  }

  console.log('\n✨ Blog translation complete!');
  if (!DRY_RUN) {
    console.log('👉 Next: Run `npx tsx scripts/sync-blog-everything.ts` to sync metadata and images.');
  }
}

const isDirectRun = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
  main().catch(console.error);
}
