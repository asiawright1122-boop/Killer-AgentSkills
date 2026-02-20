import fs from 'fs';

const cachePath = './data/skills-cache.json';
const expandedPath = './data/expanded-github-skills.json';

const LEAKED_SKILL_ID = 'StudioJinsei-Official/line-pj/nanobanana';
const LEAKED_REPO = 'StudioJinsei-Official/line-pj';

console.log('Scrubbing leaked skill...');

// 1. Scrub skills-cache.json
if (fs.existsSync(cachePath)) {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const initialLen = data.skills.length;
    data.skills = data.skills.filter(s => s.id !== LEAKED_SKILL_ID && s.repoPath !== LEAKED_REPO);
    data.totalCount = data.skills.length;

    if (initialLen !== data.skills.length) {
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
        console.log(`Removed ${initialLen - data.skills.length} leaked skill(s) from skills-cache.json`);
    } else {
        console.log('No matched skill found in skills-cache.json');
    }
}

// 2. Scrub expanded-github-skills.json
if (fs.existsSync(expandedPath)) {
    const data = JSON.parse(fs.readFileSync(expandedPath, 'utf8'));
    const initialLen = data.length;
    const filteredData = data.filter(s => {
        const repoPath = `${s.owner}/${s.repo}`;
        return repoPath !== LEAKED_REPO;
    });

    if (initialLen !== filteredData.length) {
        fs.writeFileSync(expandedPath, JSON.stringify(filteredData, null, 2));
        console.log(`Removed ${initialLen - filteredData.length} leaked skill(s) from expanded-github-skills.json`);
    } else {
        console.log('No matched skill found in expanded-github-skills.json');
    }
}

console.log('Scrubbing complete.');
