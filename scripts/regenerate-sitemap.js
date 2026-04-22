import fs from 'fs';
import { execSync } from 'child_process';
import { getReadmeContent, isPublicSkillForSitemap, pickPreferredText } from './lib/sitemap-skill-filter.js';

const MIN_INDEXABLE_SKILL_README_BYTES = 200;
const FILE_LIKE_SEGMENT_REGEX = /\.(md|ts|js|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt)$/i;
const INVALID_ROUTE_SEGMENT_REGEX = /[?#]/;

const cache = JSON.parse(fs.readFileSync('data/skills-cache.json', 'utf8'));
const skills = cache.skills;
const textEncoder = new TextEncoder();

const getFallbackDescription = (skill) => {
  return (
    pickPreferredText(skill?.description) ||
    pickPreferredText(skill?.seo?.definition) ||
    pickPreferredText(skill?.seo?.description) ||
    ''
  );
};
const getValidationDescription = (skill) => {
  return pickPreferredText(skill?.description);
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

const isValidPublicSkillRouteSegment = (segment) => {
  if (!segment || typeof segment !== 'string') return false;
  const normalized = segment.trim();
  if (!normalized) return false;
  if (normalized.includes('/')) return false;
  if (normalized === '.' || normalized === '..') return false;
  if (INVALID_ROUTE_SEGMENT_REGEX.test(normalized)) return false;
  return !FILE_LIKE_SEGMENT_REGEX.test(normalized);
};

const isValidPublicSkillRepoSegment = (segment) => {
  if (!segment || typeof segment !== 'string') return false;
  const normalized = segment.trim();
  if (!normalized) return false;
  if (normalized.includes('/')) return false;
  if (normalized === '.' || normalized === '..') return false;
  return !INVALID_ROUTE_SEGMENT_REGEX.test(normalized);
};

const getSkillRoutePath = (skill) => {
  const owner = String(skill?.owner || '').trim();
  const repo = String(skill?.repo || '').trim();
  const id = String(skill?.id || '').trim();

  if (!owner || !repo) return null;

  if (!id) {
    return isValidPublicSkillRepoSegment(repo) ? repo : null;
  }

  const segments = id.split('/').filter(Boolean);
  if (segments.length < 2 || segments.length > 3) return null;
  if (segments[0].toLowerCase() !== owner.toLowerCase()) return null;
  if (segments[1].toLowerCase() !== repo.toLowerCase()) return null;
  if (segments.length === 3 && segments[2].toLowerCase() === 'readme.md') {
    return isValidPublicSkillRepoSegment(repo) ? repo : null;
  }

  const routeSegments = segments.length === 3 ? [repo, segments[2]] : [repo];
  if (!isValidPublicSkillRepoSegment(routeSegments[0])) return null;
  if (routeSegments[1] && !isValidPublicSkillRouteSegment(routeSegments[1])) return null;
  return routeSegments.join('/');
};

const deduped = new Map();
for (const skill of skills) {
  if (!skill.owner || !skill.repo || !isIndexableByReadme(skill) || !isPublicSkillForSitemap(skill)) continue;
  const routePath = getSkillRoutePath(skill);
  if (!routePath) continue;
  const key = `${String(skill.owner).toLowerCase()}/${routePath.toLowerCase()}`;
  const current = deduped.get(key);
  if (!current || Date.parse(skill.updatedAt || '') > Date.parse(current.updatedAt || '')) {
    deduped.set(key, {
      owner: skill.owner,
      repo: skill.repo,
      routePath,
      updatedAt: skill.updatedAt || new Date().toISOString(),
    });
  }
}

const sitemapData = Array.from(deduped.values());

fs.writeFileSync('data/sitemap-skills.json', JSON.stringify(sitemapData, null, 2));
console.log(
  `Regenerated sitemap-skills.json with ${sitemapData.length} indexable items (filtered from ${skills.length} total)`,
);

try {
  execSync('npx tsx scripts/seo-skill-locale-governance.ts', { stdio: 'inherit' });
} catch (error) {
  console.warn('⚠️ Failed to refresh seo-skill-locale-governance.json:', error);
}

try {
  execSync('npx tsx scripts/seo-skill-indexability-report.ts', { stdio: 'inherit' });
} catch (error) {
  console.warn('⚠️ Failed to refresh latest-skill-indexability.json:', error);
}

try {
  execSync('npx tsx scripts/seo-corpus-governance.ts', { stdio: 'inherit' });
} catch (error) {
  console.warn('⚠️ Failed to refresh governed sitemap corpus:', error);
}
