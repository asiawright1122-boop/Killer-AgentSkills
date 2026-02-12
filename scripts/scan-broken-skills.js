
import fs from 'fs';

const cache = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = cache.skills;

console.log(`Total skills: ${skills.length}`);

const brokenSkills = [];
const unlockSkills = [];

skills.forEach(skill => {
    if (!skill.skillMd) {
        brokenSkills.push({ id: skill.id, name: skill.name, issue: 'Missing skillMd' });
    } else if (!skill.skillMd.body || skill.skillMd.body.trim().length < 50) {
        if (skill.skillMd.body && skill.skillMd.body.includes('Unlock')) {
            unlockSkills.push({ id: skill.id, name: skill.name, body: skill.skillMd.body });
        } else {
            brokenSkills.push({ id: skill.id, name: skill.name, issue: 'Empty/Short body', body: skill.skillMd.body });
        }
    } else if (skill.skillMd.body.startsWith('Unlock') && skill.skillMd.body.length < 300) {
        unlockSkills.push({ id: skill.id, name: skill.name, body: skill.skillMd.body });
    }
});

console.log(`Broken Skills (Missing skillMd or empty body): ${brokenSkills.length}`);
brokenSkills.forEach(s => console.log(`- ${s.id}: ${s.issue}`));

console.log(`Unlock Skills (Short description as body): ${unlockSkills.length}`);
unlockSkills.forEach(s => console.log(`- ${s.id}`));
