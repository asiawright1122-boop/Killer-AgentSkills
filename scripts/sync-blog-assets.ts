import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = './src/content/blog';
const LOCALES = ['zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

interface BlogAssetMap {
    heroImage: string;
    links: string[]; // List of unique slugs linked to in this article
}

async function syncBlogAssets() {
    const enDir = path.join(BLOG_DIR, 'en');
    const enFiles = await fs.readdir(enDir);

    const assetMap: Record<string, { heroImage: string }> = {};

    console.log('--- Phase 1: Reading English Source of Truth ---');
    for (const file of enFiles) {
        if (!file.endsWith('.md')) continue;

        const content = await fs.readFile(path.join(enDir, file), 'utf-8');
        const heroImageMatch = content.match(/heroImage: "(.*?)"/);

        if (heroImageMatch) {
            assetMap[file] = { heroImage: heroImageMatch[1] };
            console.log(`Audited ${file}: ${heroImageMatch[1]}`);
        }
    }

    console.log('\n--- Phase 2: Synchronizing Locales ---');
    for (const locale of LOCALES) {
        console.log(`\nProcessing locale: [${locale}]`);
        const localeDir = path.join(BLOG_DIR, locale);

        try {
            const files = await fs.readdir(localeDir);
            for (const file of files) {
                if (!file.endsWith('.md')) continue;
                if (!assetMap[file]) {
                    console.warn(`  [WARN] No English baseline for ${file} in locale ${locale}`);
                    continue;
                }

                let content = await fs.readFile(path.join(localeDir, file), 'utf-8');
                let updated = false;

                // 1. Sync heroImage
                const currentHeroMatch = content.match(/heroImage: "(.*?)"/);
                if (currentHeroMatch && currentHeroMatch[1] !== assetMap[file].heroImage) {
                    content = content.replace(/heroImage: ".*?"/, `heroImage: "${assetMap[file].heroImage}"`);
                    updated = true;
                    console.log(`  - Updated heroImage for ${file}`);
                }

                // 2. Localize internal links
                // We match https://killer-skills.com/en/blog/[slug] and replace with /[locale]/blog/[slug]
                // Note: We use relative links for better portability if the site moves, 
                // but here we follow the pattern in the files.
                const linkRegex = /https:\/\/killer-skills\.com\/en\/blog\/([a-zA-Z0-9\-_]+)/g;
                if (content.match(linkRegex)) {
                    const newLink = `https://killer-skills.com/${locale}/blog/$1`;
                    content = content.replace(linkRegex, newLink);
                    updated = true;
                    console.log(`  - Localized internal links for ${file}`);
                }

                if (updated) {
                    await fs.writeFile(path.join(localeDir, file), content, 'utf-8');
                }
            }
        } catch (err) {
            console.error(`  [ERROR] Failed to process locale ${locale}:`, err);
        }
    }

    console.log('\n--- Synchronization Complete ---');
}

syncBlogAssets().catch(console.error);
