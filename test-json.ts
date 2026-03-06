import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf-8'));
const anthropic = data.skills.filter((s: any) => s.owner === 'anthropics');
console.log('Anthropic skills count:', anthropic.length);
console.log(anthropic.map((s: any) => `${s.owner}/${s.repo}/${s.skillName || s.name}`).join('\n'));
