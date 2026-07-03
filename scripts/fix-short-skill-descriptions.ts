#!/usr/bin/env npx tsx

/**
 * One-time fix for skills with dangerously short descriptions (<30 chars).
 * Uses SEO description, definition, or features as fallback to derive
 * a meaningful description.

 * Usage: npx tsx scripts/fix-short-skill-descriptions.ts [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const cachePath = resolve(process.cwd(), 'data/skills-cache.json');

if (!existsSync(cachePath)) {
  console.error('❌ skills-cache.json not found at', cachePath);
  process.exit(1);
}

type Skill = {
  id?: string;
  owner?: string;
  repo?: string;
  description?: Record<string, string> | string;
  definition?: Record<string, string> | string;
  seo?: {
    description?: Record<string, string> | string;
    features?: Record<string, string[]> | string[];
  };
  stars?: number;
};

type CacheData = {
  skills: Skill[];
};

function getText(field: Record<string, string> | string | undefined, locale = 'en'): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[locale] || field.en || '';
}

function deriveDescription(skill: Skill): string | null {
  // Prefer SEO description if it has substance
  const seoDesc = getText(skill.seo?.description);
  if (seoDesc.length > 50) return seoDesc;

  // Then definition
  const def = getText(skill.definition);
  if (def.length > 50) return def;

  // Then features combined
  const features = skill.seo?.features;
  if (features) {
    const featArray = typeof features === 'string' ? [features] : (features.en || features[''] || Object.values(features)[0] || []);
    if (Array.isArray(featArray) && featArray.length > 0) {
      const combined = featArray.join(', ');
      if (combined.length > 50) return combined;
    }
  }

  return null;
}

function fixShortDescriptions() {
  const raw = readFileSync(cachePath, 'utf-8');
  const data = JSON.parse(raw) as CacheData;

  let fixed = 0;
  let skipped = 0;

  for (const skill of data.skills) {
    const desc = getText(skill.description);
    if (desc.length >= 30) continue;

    const replacement = deriveDescription(skill);
    if (!replacement) {
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY] ${skill.id || skill.owner + '/' + skill.repo}: "${desc.slice(0,30)}" → "${replacement.slice(0,70)}"`);
    } else {
      // Update description
      if (typeof skill.description === 'object') {
        skill.description.en = replacement;
      } else {
        skill.description = { en: replacement };
      }
    }
    fixed++;
  }

  if (!isDryRun && fixed > 0) {
    writeFileSync(cachePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ Fixed ${fixed} skill descriptions in skills-cache.json`);
  } else if (isDryRun) {
    console.log(`\n[DRY] Would fix ${fixed} descriptions (${skipped} skipped — no replacement data)`);
  }

  console.log(`Total skills processed: ${data.skills.length}`);
  return fixed;
}

fixShortDescriptions();