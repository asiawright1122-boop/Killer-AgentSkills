
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, '../data/skills-cache.json');
const LOCALES = ['zh', 'ja', 'ko'];

if (!fs.existsSync(CACHE_FILE)) {
    console.error('Cache file not found:', CACHE_FILE);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
const skills = data.skills;

console.log(`Analyzing ${skills.length} skills for missing CJK translations...`);

const missing = {
    description: 0,
    definition: 0,
    features: 0,
    keywords: 0
};

skills.forEach(skill => {
    // 1. Description
    if (typeof skill.description === 'object') {
        LOCALES.forEach(loc => {
            if (!skill.description[loc] || skill.description[loc].trim() === '') {
                missing.description++;
                // return to avoid double counting per skill? No, count instances or skills? 
                // Let's count *skills* that have at least one missing locale
            }
        });
    } else {
        missing.description += 3; // String description means missing all 3
    }

    // 2. SEO Definition
    if (skill.seo && skill.seo.definition) {
        LOCALES.forEach(loc => {
            if (!skill.seo.definition[loc] || skill.seo.definition[loc].trim() === '') {
                missing.definition++;
            }
        });
    } else {
        missing.definition += 3;
    }

    // 3. Features
    if (skill.seo && skill.seo.features) {
        LOCALES.forEach(loc => {
            if (!skill.seo.features[loc] || skill.seo.features[loc].length === 0 ||
                (Array.isArray(skill.seo.features[loc]) && skill.seo.features[loc].every(s => !s || s.trim() === ''))) {
                missing.features++;
            }
        });
    } else {
        missing.features += 3;
    }

    // 4. Keywords
    if (skill.seo && skill.seo.keywords) {
        LOCALES.forEach(loc => {
            if (!skill.seo.keywords[loc] || skill.seo.keywords[loc].length === 0 ||
                (Array.isArray(skill.seo.keywords[loc]) && skill.seo.keywords[loc].every(s => !s || s.trim() === ''))) {
                missing.keywords++;
            }
        });
    } else {
        missing.keywords += 3;
    }
});

const totalPoints = skills.length * 3; // 3 locales per skill

console.log('\n--- Missing Translation Stats (Lower is Better) ---');
console.log(`Description Missing: ${((missing.description / totalPoints) * 100).toFixed(1)}% (${missing.description}/${totalPoints})`);
console.log(`Definition Missing:  ${((missing.definition / totalPoints) * 100).toFixed(1)}% (${missing.definition}/${totalPoints})`);
console.log(`Features Missing:    ${((missing.features / totalPoints) * 100).toFixed(1)}% (${missing.features}/${totalPoints})`);
console.log(`Keywords Missing:    ${((missing.keywords / totalPoints) * 100).toFixed(1)}% (${missing.keywords}/${totalPoints})`);
