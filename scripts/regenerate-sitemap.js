
import fs from 'fs';

const cache = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = cache.skills;

const sitemapData = skills
    .filter(skill => skill.owner && skill.repo) // Filter out entries with missing owner/repo
    .map(skill => ({
        owner: skill.owner,
        repo: skill.repo,
        updatedAt: skill.updatedAt || new Date().toISOString()
    }));

fs.writeFileSync('data/sitemap-skills.json', JSON.stringify(sitemapData, null, 2));
console.log(`Regenerated sitemap-skills.json with ${sitemapData.length} items (filtered from ${skills.length} total)`);
