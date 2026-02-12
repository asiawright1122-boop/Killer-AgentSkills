
import fs from 'fs';

const cache = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = cache.skills;
const total = skills.length;

console.log(`Total skills: ${total}`);


// Remove broken skills
const cleanSkills = skills.filter(skill => {
    if (!skill.skillMd) return false;
    // Optional: filter out very short bodies if deemed invalid
    // if (!skill.skillMd.body || skill.skillMd.body.trim().length < 50) return false;
    return true;
});

console.log(`Removed ${skills.length - cleanSkills.length} broken skills.`);

cache.skills = cleanSkills;
cache.totalCount = cleanSkills.length;
cache.lastUpdated = new Date().toISOString();

fs.writeFileSync('data/skills-cache.json', JSON.stringify(cache, null, 2));
console.log('Saved cleaned cache to data/skills-cache.json');

let missingDesc = 0;
let missingFeatures = 0;
let missingKeywords = 0;
let missingDefinition = 0;

const locales = ['zh', 'ja', 'ko'];

skills.forEach(skill => {
    // Check description
    const desc = skill.description || {};
    if (locales.some(l => !desc[l] || desc[l].trim() === '')) {
        missingDesc++;
    }

    // Check SEO
    const seo = skill.seo || {};

    // Definition
    const def = seo.definition || {};
    if (locales.some(l => !def[l] || def[l].trim() === '')) {
        missingDefinition++;
    }

    // Features
    const features = seo.features || {};
    if (locales.some(l => !features[l] || features[l].length === 0 || features[l].some(f => f.trim() === ''))) {
        missingFeatures++;
    }

    // Keywords
    const keywords = seo.keywords || {};
    if (locales.some(l => !keywords[l] || keywords[l].length === 0 || keywords[l].some(k => k.trim() === ''))) {
        missingKeywords++;
    }
});

console.log(`Missing Description: ${missingDesc} (${(missingDesc / total * 100).toFixed(1)}%)`);
console.log(`Missing Definition: ${missingDefinition} (${(missingDefinition / total * 100).toFixed(1)}%)`);
console.log(`Missing Features (empty array or empty strings): ${missingFeatures} (${(missingFeatures / total * 100).toFixed(1)}%)`);
console.log(`Missing Keywords (empty array or empty strings): ${missingKeywords} (${(missingKeywords / total * 100).toFixed(1)}%)`);
