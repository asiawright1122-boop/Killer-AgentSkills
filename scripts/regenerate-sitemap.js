import fs from 'fs';

const MIN_INDEXABLE_SKILL_README_BYTES = 200;

const cache = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = cache.skills;
const textEncoder = new TextEncoder();

const getReadmeContent = (skill) => skill?.skillMd?.body || skill?.skillMd?.bodyPreview || '';
const pickPreferredText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';
  const preferred = [value.en, value.zh, ...Object.values(value)];
  for (const candidate of preferred) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return '';
};
const getFallbackDescription = (skill) => {
  return (
    pickPreferredText(skill?.description) ||
    pickPreferredText(skill?.seo?.definition) ||
    pickPreferredText(skill?.seo?.description) ||
    ''
  );
};
const isIndexableByReadme = (skill) => {
  const content = getReadmeContent(skill);
  if (content && textEncoder.encode(content).length >= MIN_INDEXABLE_SKILL_README_BYTES) return true;

  const fallbackDescription = getFallbackDescription(skill);
  if (!fallbackDescription) return false;
  const fallbackContent = [content, `# ${skill?.name || skill?.repo || 'Skill'}\n\n${fallbackDescription}`]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join('\n\n');
  return textEncoder.encode(fallbackContent).length >= MIN_INDEXABLE_SKILL_README_BYTES;
};

const sitemapData = skills
  .filter((skill) => skill.owner && skill.repo && isIndexableByReadme(skill))
  .map((skill) => ({
    owner: skill.owner,
    repo: skill.repo,
    updatedAt: skill.updatedAt || new Date().toISOString(),
  }));

fs.writeFileSync('data/sitemap-skills.json', JSON.stringify(sitemapData, null, 2));
console.log(
  `Regenerated sitemap-skills.json with ${sitemapData.length} indexable items (filtered from ${skills.length} total)`,
);
