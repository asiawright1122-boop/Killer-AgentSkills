#!/usr/bin/env npx tsx
/**
 * scripts/pre-flight-enrichment-check.ts
 * Pre-flight Verification Script for Metadata & Keywords
 */

import * as fs from 'fs';
import * as path from 'path';
import { OFFICIAL_REPOS } from '../src/lib/skills-config';

const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];

function checkCollections(collectionsDir: string): boolean {
  console.log('🔍 Auditing collection metadata & keywords...');
  let hasError = false;

  if (!fs.existsSync(collectionsDir)) {
    console.error(`❌ Error: Collections directory not found at ${collectionsDir}`);
    return true;
  }

  const files = fs.readdirSync(collectionsDir).filter((f) => f.endsWith('.json'));
  console.log(`Found ${files.length} collections to verify.`);

  for (const file of files) {
    const filePath = path.join(collectionsDir, file);
    try {
      const colData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const errors: string[] = [];

      // 1. Check description in all locales
      if (!colData.description) {
        errors.push(`Missing 'description' object`);
      } else {
        for (const loc of LOCALES) {
          const desc = colData.description[loc];
          if (!desc || typeof desc !== 'string' || desc.trim() === '') {
            errors.push(`Missing description for locale '${loc}'`);
          } else if (loc === 'en' && desc.length < 30) {
            errors.push(`English description is too short (${desc.length} chars, expected >= 30)`);
          } else if ((loc === 'zh' || loc === 'ja') && desc.length < 10) {
            errors.push(`CJK description is too short (${desc.length} chars, expected >= 10)`);
          }
        }
      }

      // 2. Check keywords in all locales
      if (!colData.keywords) {
        errors.push(`Missing 'keywords' object`);
      } else {
        for (const loc of LOCALES) {
          const kw = colData.keywords[loc];
          if (!kw || !Array.isArray(kw) || kw.length < 3) {
            errors.push(`Keywords array for locale '${loc}' must contain at least 3 items`);
          }
        }
      }

      if (errors.length > 0) {
        console.error(`❌ Collection Error [${file}]:`);
        errors.forEach((err) => console.error(`   - ${err}`));
        hasError = true;
      }
    } catch (e: any) {
      console.error(`❌ Failed to parse collection file ${file}: ${e.message || e}`);
      hasError = true;
    }
  }

  if (!hasError) {
    console.log('✅ All collections passed verification.');
  }
  return hasError;
}

function checkSkills(cachePath: string): boolean {
  console.log('\n🔍 Auditing skills-cache metadata & keywords...');
  let hasError = false;

  if (!fs.existsSync(cachePath)) {
    console.error(`❌ Error: Skills cache file not found at ${cachePath}`);
    return true;
  }

  const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const skills = cacheData.skills || [];
  console.log(`Found ${skills.length} skills to verify.`);

  let officialCount = 0;
  let warnCount = 0;

  skills.forEach((skill: any, index: number) => {
    const owner = String(skill.owner || '').toLowerCase();
    const repo = String(skill.repo || '').toLowerCase();
    const skillName = skill.name || skill.skillName || `skill[${index}]`;

    // Determine if it is an official/featured repository
    const isOfficial = Object.values(OFFICIAL_REPOS).some(
      (cfg) => cfg.owner.toLowerCase() === owner && cfg.repo.toLowerCase() === repo
    );

    if (isOfficial) {
      officialCount++;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check description
    const desc = skill.description;
    if (!desc) {
      const msg = `Missing description`;
      if (isOfficial) errors.push(msg);
      else warnings.push(msg);
    } else if (typeof desc === 'string') {
      if (desc.trim() === '') {
        const msg = `Empty description string`;
        if (isOfficial) errors.push(msg);
        else warnings.push(msg);
      }
    } else {
      // Record type description
      const enDesc = desc.en;
      const zhDesc = desc.zh;
      if (!enDesc || enDesc.trim() === '') {
        const msg = `Missing English description`;
        if (isOfficial) errors.push(msg);
        else warnings.push(msg);
      }
      if (!zhDesc || zhDesc.trim() === '') {
        const msg = `Missing Chinese description`;
        if (isOfficial) errors.push(msg);
        else warnings.push(msg);
      }
    }

    // 2. Check keywords / topics
    const hasTopics = Array.isArray(skill.topics) && skill.topics.length >= 1;
    const hasSeoKeywords = skill.seo?.keywords && Object.keys(skill.seo.keywords).length >= 1;

    if (!hasTopics && !hasSeoKeywords) {
      const msg = `Missing keywords (both topics and seo.keywords are empty/undefined)`;
      if (isOfficial) errors.push(msg);
      else warnings.push(msg);
    }

    if (errors.length > 0) {
      console.error(`❌ Official Skill Error [${owner}/${repo} -> ${skillName}]:`);
      errors.forEach((err) => console.error(`   - ${err}`));
      hasError = true;
    }

    if (warnings.length > 0) {
      warnCount += warnings.length;
      // Option: to keep CI logs clean, we only print top 20 warnings or aggregate count.
      if (warnCount <= 20) {
        console.warn(`⚠️ Community Skill Warning [${owner}/${repo} -> ${skillName}]:`);
        warnings.forEach((warn) => console.warn(`   - ${warn}`));
      }
    }
  });

  if (warnCount > 20) {
    console.warn(`⚠️ ... and ${warnCount - 20} more community skill warnings suppressed.`);
  }

  console.log(`Audited ${officialCount} official skills and ${skills.length - officialCount} community skills.`);

  if (!hasError) {
    console.log('✅ All official skills passed verification.');
  }
  return hasError;
}

function main() {
  const workspaceRoot = process.cwd();
  const collectionsDir = path.resolve(workspaceRoot, 'src/content/collections');
  const cachePath = path.resolve(workspaceRoot, 'data/skills-cache.json');

  const colFailed = checkCollections(collectionsDir);
  const skillFailed = checkSkills(cachePath);

  if (colFailed || skillFailed) {
    console.error('\n❌ Pre-flight Enrichment Audit FAILED due to critical errors.');
    process.exit(1);
  } else {
    console.log('\n✅ Pre-flight Enrichment Audit PASSED successfully.');
    process.exit(0);
  }
}

main();
