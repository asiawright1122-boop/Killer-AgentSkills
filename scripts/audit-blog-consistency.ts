import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = './src/content/blog';
const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

async function auditConsistency() {
    const allData: Record<string, Record<string, any>> = {};

    for (const locale of LOCALES) {
        const localeDir = path.join(BLOG_DIR, locale);
        const files = await fs.readdir(localeDir);

        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            const content = await fs.readFile(path.join(localeDir, file), 'utf-8');
            const frontmatterMatch = content.match(/---([\s\S]*?)---/);
            const frontmatterRaw = frontmatterMatch ? frontmatterMatch[1] : '';

            const featured = frontmatterRaw.match(/featured:\s*(true|false)/)?.[1] === 'true';
            const category = frontmatterRaw.match(/category:\s*"(.*?)"/)?.[1] || '';
            const heroImage = frontmatterRaw.match(/heroImage:\s*"(.*?)"/)?.[1] || '';
            const lineCount = content.split('\n').length;

            if (!allData[file]) allData[file] = {};
            allData[file][locale] = { featured, category, heroImage, lineCount };
        }
    }

    console.log('--- Consistency Audit Report ---');
    for (const [file, locales] of Object.entries(allData)) {
        console.log(`\nArticle: ${file}`);
        const baseline = locales['en'];
        if (!baseline) {
            console.log('  [ERROR] English baseline missing!');
            continue;
        }

        for (const locale of LOCALES) {
            if (!locales[locale]) {
                console.log(`  [MISSING] ${locale}`);
                continue;
            }

            const data = locales[locale];
            const diffs = [];
            if (data.featured !== baseline.featured) diffs.push(`featured (${data.featured} vs ${baseline.featured})`);
            if (data.category !== baseline.category) diffs.push(`category (${data.category} vs ${baseline.category})`);
            if (data.heroImage !== baseline.heroImage) diffs.push(`heroImage (mismatch)`);
            if (Math.abs(data.lineCount - baseline.lineCount) > 10) diffs.push(`content length (${data.lineCount} vs ${baseline.lineCount} lines)`);

            if (diffs.length > 0) {
                console.log(`  [DIFF] ${locale}: ${diffs.join(', ')}`);
            } else {
                // console.log(`  [OK] ${locale}`);
            }
        }
    }
}

auditConsistency().catch(console.error);
