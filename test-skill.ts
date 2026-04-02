import fs from 'node:fs';
import path from 'node:path';
import { isPublicSkill } from './src/lib/skills.js';

const mainCachePath = path.resolve(process.cwd(), 'data/skills-cache.json');
const content = fs.readFileSync(mainCachePath, 'utf-8');
const data = JSON.parse(content);
const skills = Array.isArray(data) ? data : data.skills || [];

console.log('Total skills loaded:', skills.length);

const useDom = skills.find((s: any) => s.id === 'expo/skills/use-dom');
console.log('useDom found:', useDom ? useDom.id : 'NO');
if (useDom) {
    console.log('useDom isPublic:', isPublicSkill(useDom));
}

const algoArt = skills.find((s: any) => s.id === 'anthropics/skills/algorithmic-art');
console.log('algoArt found:', algoArt ? algoArt.id : 'NO');
if (algoArt) {
    console.log('algoArt isPublic:', isPublicSkill(algoArt));
}
