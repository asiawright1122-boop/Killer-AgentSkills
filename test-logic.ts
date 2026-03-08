import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf-8'));
let skills = data.skills;

const owner = 'anthropics';
console.log('Initial total:', skills.length);

if (owner) {
  skills = skills.filter((s: { owner: string }) => s.owner === owner);
}
console.log('After filter:', skills.length);

const officialOwners = ['anthropics', 'vercel-labs', 'remotion-dev', 'getsentry', 'expo', 'stripe', 'huggingface', 'google-labs-code', 'supabase', 'neondatabase', 'tadata-org', 'cloudflare'];

const view = 'official';
if (view === 'official') {
    skills = skills.filter((s: { owner: string }) => officialOwners.includes(s.owner));
}
console.log('After view filter:', skills.length);

let skillsByOwner: Record<string, number> = {};
if (view === 'official' && !owner) {
    skillsByOwner = skills.reduce((acc: Record<string, number>, skill: { owner: string }) => {
        const skillOwner = skill.owner;
        acc[skillOwner] = (acc[skillOwner] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
}
console.log('skillsByOwner length:', Object.keys(skillsByOwner).length);
