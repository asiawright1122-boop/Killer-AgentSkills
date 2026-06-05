import * as fs from 'fs';
import * as path from 'path';

interface SkillCache {
  id: string;
  repo: string;
}

interface CacheData {
  skills: SkillCache[];
}

interface CollectionData {
  title?: Record<string, string>;
  description?: Record<string, string>;
  longDescription?: Record<string, string>;
  skills?: string[];
  canonicalSlug?: string;
}

function calculateJaccard(skillsA: string[], skillsB: string[]): number {
  const setA = new Set(skillsA.map(s => s.toLowerCase()));
  const setB = new Set(skillsB.map(s => s.toLowerCase()));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function main() {
  const workspaceRoot = process.cwd();
  const cachePath = path.resolve(workspaceRoot, 'data/skills-cache.json');
  const collectionsDir = path.resolve(workspaceRoot, 'src/content/collections');

  if (!fs.existsSync(cachePath)) {
    console.error(`Error: Cache file not found at ${cachePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(collectionsDir)) {
    console.error(`Error: Collections directory not found at ${collectionsDir}`);
    process.exit(1);
  }

  // Load skills cache
  const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CacheData;
  const cacheSkills = cacheData.skills || [];

  // Read all collection files
  const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.json'));
  const collections: { file: string; data: CollectionData }[] = [];

  for (const file of files) {
    const filePath = path.join(collectionsDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CollectionData;
      collections.push({ file, data });
    } catch (e) {
      console.error(`Error parsing JSON file ${file}:`, e);
      process.exit(1);
    }
  }

  let hasCriticalError = false;

  console.log(`Starting Collection Quality Audit for ${collections.length} files...\n`);

  for (const col of collections) {
    const { file, data } = col;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check title, description, longDescription existence
    if (!data.title || !data.title.en || !data.title.zh) {
      errors.push(`Missing title (en or zh)`);
    }

    if (!data.description || !data.description.en || !data.description.zh) {
      errors.push(`Missing description (en or zh)`);
    } else {
      // Check description length (30 to 300 chars)
      const descEnLen = data.description.en.length;
      if (descEnLen < 30 || descEnLen > 300) {
        warnings.push(`English description length (${descEnLen}) is outside [30, 300] range`);
      }
      const descZhLen = data.description.zh.length;
      if (descZhLen < 15 || descZhLen > 150) {
        warnings.push(`Chinese description length (${descZhLen}) is outside [15, 150] range`);
      }
    }

    if (!data.longDescription || !data.longDescription.en || !data.longDescription.zh) {
      errors.push(`Missing longDescription (en or zh)`);
    } else {
      const longDescEnLen = data.longDescription.en.length;
      if (longDescEnLen < 50) {
        warnings.push(`English longDescription is very short (${longDescEnLen} chars)`);
      }
    }

    // 2. Check skills uniqueness & existence in cache
    const skills = data.skills || [];
    if (skills.length === 0) {
      warnings.push(`Skills list is empty`);
    } else {
      // Uniqueness check
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const skill of skills) {
        const lower = skill.toLowerCase();
        if (seen.has(lower)) {
          duplicates.push(skill);
        } else {
          seen.add(lower);
        }
      }
      if (duplicates.length > 0) {
        errors.push(`Duplicate skills found: ${[...new Set(duplicates)].join(', ')}`);
      }

      // Existence check in cache
      const missingSkills: string[] = [];
      for (const colSkill of skills) {
        const colSkillLower = colSkill.toLowerCase();
        // Check if there's any cache entry matching colSkill
        const exists = cacheSkills.some(cs => {
          const csRepoLower = (cs.repo || '').toLowerCase();
          const csIdLower = (cs.id || '').toLowerCase();
          return (
            csRepoLower === colSkillLower ||
            csIdLower === colSkillLower ||
            csIdLower.startsWith(colSkillLower + '/')
          );
        });

        if (!exists) {
          missingSkills.push(colSkill);
        }
      }

      if (missingSkills.length > 0) {
        errors.push(`Skills missing from cache (dead repo references): ${missingSkills.join(', ')}`);
      }
    }

    // Print results for this collection
    if (errors.length > 0 || warnings.length > 0) {
      console.log(`[${file}]`);
      errors.forEach(err => {
        console.error(`  - ERROR: ${err}`);
        hasCriticalError = true;
      });
      warnings.forEach(warn => {
        console.warn(`  - WARNING: ${warn}`);
      });
      console.log('');
    }
  }

  // 3. Jaccard Overlap Audit
  console.log('=== Checking for high Jaccard overlap between collections ===');
  for (let i = 0; i < collections.length; i++) {
    for (let j = i + 1; j < collections.length; j++) {
      const colA = collections[i];
      const colB = collections[j];
      const skillsA = colA.data.skills || [];
      const skillsB = colB.data.skills || [];

      // Skip overlap calculation if one of them is empty
      if (skillsA.length === 0 || skillsB.length === 0) continue;

      const jaccard = calculateJaccard(skillsA, skillsB);
      if (jaccard >= 0.8) {
        // Exclude allowed pair: top-claude-code-skills.json <-> top-windsurf-skills.json
        const isAllowedOverlap =
          (colA.file === 'top-claude-code-skills.json' && colB.file === 'top-windsurf-skills.json') ||
          (colA.file === 'top-windsurf-skills.json' && colB.file === 'top-claude-code-skills.json');

        if (isAllowedOverlap) {
          console.log(`  - Info: Allowed overlap (${(jaccard * 100).toFixed(0)}%) between ${colA.file} and ${colB.file}`);
        } else {
          console.error(
            `  - ERROR: Unacceptable high overlap (${(jaccard * 100).toFixed(0)}%) between ${colA.file} and ${colB.file}`
          );
          hasCriticalError = true;
        }
      }
    }
  }

  console.log('\nAudit complete.');
  if (hasCriticalError) {
    console.error('Audit FAILED due to critical errors.');
    process.exit(1);
  } else {
    console.log('Audit PASSED successfully.');
    process.exit(0);
  }
}

main();
