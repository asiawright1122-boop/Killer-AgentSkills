import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = data.skills;

const art = skills.find((s: any) => s.name === 'algorithmic-art');
if (art) {
    console.log('=== algorithmic-art description ===');
    console.log(JSON.stringify(art.description, null, 2));
    console.log('\n=== algorithmic-art seo.definition ===');
    console.log(JSON.stringify(art.seo?.definition, null, 2));
    console.log('\n=== algorithmic-art seo.features ===');
    console.log(JSON.stringify(art.seo?.features, null, 2));
} else {
    console.log('algorithmic-art NOT FOUND in cache!');
}
