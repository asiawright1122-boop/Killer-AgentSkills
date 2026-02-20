// @ts-nocheck
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = data.skills || [];

console.log(`Total skills: ${skills.length}`);

// Count by owner
const byOwner = {};
skills.forEach(s => {
    byOwner[s.owner] = (byOwner[s.owner] || 0) + 1;
});
console.log('\nTop 10 Owners:');
Object.entries(byOwner)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([k, v]) => console.log(`${k}: ${v}`));

// Count by category
const byCat = {};
skills.forEach(s => {
    byCat[s.category] = (byCat[s.category] || 0) + 1;
});
console.log('\nCategories:');
Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`${k}: ${v}`));
