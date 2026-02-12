import fs from 'fs';

const cachePath = 'data/skills-cache.json';
const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
const initialCount = data.skills.length;

// Remove algorithmic-art completely
data.skills = data.skills.filter((s: any) => s.name !== 'algorithmic-art');

console.log(`removed ${initialCount - data.skills.length} skills`);
fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
