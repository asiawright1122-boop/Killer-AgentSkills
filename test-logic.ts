import * as fs from 'fs';
import * as path from 'path';
import { SUPPORTED_LOCALES } from './scripts/lib/constants.js';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const EN_DIR = path.join(BLOG_DIR, 'en');
const enFiles = fs.readdirSync(EN_DIR).filter(f => f.endsWith('.md'));

for (const file of enFiles) {
    const enPath = path.join(EN_DIR, file);
    const content = fs.readFileSync(enPath, 'utf-8');
    const slug = file.replace('.md', '');

    if (slug !== 'automated-ui-testing-with-webapp-testing-skills') continue;

    for (const locale of SUPPORTED_LOCALES) {
        const targetDir = path.join(BLOG_DIR, locale);
        const targetPath = path.join(targetDir, file);

        let shouldTranslate = false;
        if (!fs.existsSync(targetPath)) {
            shouldTranslate = true;
        } else {
            const locContent = fs.readFileSync(targetPath, 'utf-8');
            const locTitleMatch = locContent.match(/title:\s*"(.*?)"/);
            const enTitleMatch = content.match(/title:\s*"(.*?)"/);

            console.log(`[${locale}] Match:`, locTitleMatch?.[1] === enTitleMatch?.[1]);
            if (locale === 'ar') {
                console.log(`EN:`, enTitleMatch?.[1]);
                console.log(`AR:`, locTitleMatch?.[1]);
            }
            if (locTitleMatch && enTitleMatch && locTitleMatch[1] === enTitleMatch[1]) {
                shouldTranslate = true;
            }
        }
        console.log(`[${locale}] shouldTranslate: ${shouldTranslate}`);
    }
}
