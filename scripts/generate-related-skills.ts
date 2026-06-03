import * as fs from 'node:fs';
import * as path from 'node:path';
import { getNonTargetSkillReason } from '../src/lib/shared/validation';
import type { CacheData, SkillCache } from './lib/types';

function isPublicSkill(skill: SkillCache): boolean {
  const description = typeof skill.description === 'string' ? skill.description : skill.description?.en || '';
  return !getNonTargetSkillReason({
    name: skill.name,
    owner: skill.owner,
    repo: skill.repo,
    body: skill.skillMd?.body || skill.skillMd?.bodyPreview || '',
    description,
    topics: skill.topics || [],
    category: skill.category,
    filePath: skill.repoPath,
  });
}

function generate() {
  const cachePath = path.join(process.cwd(), 'data/skills-cache.json');
  if (!fs.existsSync(cachePath)) {
    console.error('❌ Cache file not found. Please run build-skills-cache first.');
    process.exit(1);
  }
  console.log('📖 Reading data/skills-cache.json...');
  const cacheContent = fs.readFileSync(cachePath, 'utf8');
  const cacheData = JSON.parse(cacheContent) as CacheData;

  const allSkills = cacheData.skills;
  console.log(`📋 Total skills in cache: ${allSkills.length}`);

  // Filter public skills
  const publicSkills = allSkills.filter(isPublicSkill);
  console.log(`✅ Eligible public skills: ${publicSkills.length}`);

  // Map each public skill to its compact representation for the final array
  const compactSkills = publicSkills.map(s => {
    const description: Record<string, string> = {};
    if (s.description) {
      if (typeof s.description === 'string') {
        description.en = s.description;
      } else {
        if (s.description.en) description.en = s.description.en;
        if (s.description.zh) description.zh = s.description.zh;
      }
    }

    const seoDefinition: Record<string, string> = {};
    if (s.seo?.definition) {
      if (s.seo.definition.en) seoDefinition.en = s.seo.definition.en;
      if (s.seo.definition.zh) seoDefinition.zh = s.seo.definition.zh;
    }

    return {
      id: s.id,
      name: s.name,
      skillName: s.skillMd?.name || s.name || s.repo,
      owner: s.owner,
      repo: s.repo,
      category: s.category || '',
      stars: s.stars || 0,
      forks: s.forks || 0,
      description,
      seo: Object.keys(seoDefinition).length > 0 ? { definition: seoDefinition } : undefined
    };
  });

  // Create a map from skill ID to its index in publicSkills/compactSkills
  const skillIdToIndex = new Map<string, number>();
  publicSkills.forEach((s, idx) => {
    skillIdToIndex.set(s.id, idx);
  });

  const lookup: Record<string, number[]> = {};

  for (const currentSkill of publicSkills) {
    const scored = publicSkills
      .filter(s => s.id !== currentSkill.id && (s.owner !== currentSkill.owner || s.repo !== currentSkill.repo))
      .map(skill => {
        let score = 0;

        // Same category (primary match)
        if (skill.category && currentSkill.category && skill.category === currentSkill.category) {
          score += 1000;
        }

        // Shared topics/tags (secondary weight)
        const currentTags = new Set(currentSkill.topics || []);
        const skillTags = skill.topics || [];
        const overlap = skillTags.filter(tag => currentTags.has(tag)).length;
        score += overlap * 10;

        // Score based on quality score and stars
        score += (skill.qualityScore || 0) * 0.1;
        score += Math.min(skill.stars || 0, 10000) * 0.001;

        return { id: skill.id, score, stars: skill.stars || 0, qualityScore: skill.qualityScore || 0 };
      });

    // Sort by score desc, then stars desc, then qualityScore desc
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stars !== a.stars) return b.stars - a.stars;
      return b.qualityScore - a.qualityScore;
    });

    // Take top 4 and map to their indices in the array
    const top4Indices = scored
      .slice(0, 4)
      .map(item => skillIdToIndex.get(item.id))
      .filter((idx): idx is number => idx !== undefined);

    lookup[currentSkill.id] = top4Indices;
  }

  const outputPath = path.join(process.cwd(), 'data/related-skills-lookup.json');
  console.log(`💾 Writing indexed related skills lookup to ${outputPath}...`);
  
  const finalPayload = {
    skills: compactSkills,
    lookup: lookup
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalPayload, null, 2), 'utf8');
  console.log('🎉 Related skills lookup generation complete!');
}

generate();
