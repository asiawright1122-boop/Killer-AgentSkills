
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, '../data/skills-cache.json');

if (!fs.existsSync(CACHE_FILE)) {
    console.error('Cache file not found');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
const skills = data.skills;

console.log(`Checking ${skills.length} skills...`);

const missingZh = skills.filter(skill => {
    if (typeof skill.description === 'string') return true; // Legacy string format
    if (!skill.description || !skill.description.zh || skill.description.zh.trim() === '') return true;
    return false;
});

console.log(`\nFound ${missingZh.length} skills missing Chinese description:`);
console.log('---------------------------------------------------');
missingZh.forEach(s => {
    console.log(`- [${s.id}] ${s.owner}/${s.repo}`);
});
