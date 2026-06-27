#!/usr/bin/env npx tsx
/**
 * Build Skill-to-Collection Lookup
 *
 * Reads all collection content files and builds a reverse lookup:
 * skill owner/repo → array of collection canonical slugs.
 * This is used by the skill detail page to populate relatedCollections.
 *
 * Usage:
 *   npx tsx scripts/build-skill-collection-lookup.ts
 *
 * Output:
 *   data/skill-collection-lookup.json
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const CONTENT_DIR = resolve(process.cwd(), 'src/content/collections');
const OUTPUT_PATH = resolve(process.cwd(), 'data/skill-collection-lookup.json');

function main(): void {
  if (!existsSync(CONTENT_DIR)) {
    console.error(`Collections directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const lookup: Record<string, string[]> = {};

  const files = readdirSync(CONTENT_DIR).filter(
    (f) => f.endsWith('.json') && !f.startsWith('_'),
  );

  for (const file of files) {
    const filePath = resolve(CONTENT_DIR, file);
    let data: Record<string, any>;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      console.warn(`Skipping invalid JSON: ${file}`);
      continue;
    }

    const slug = data.canonicalSlug || file.replace(/\.json$/, '');
    const skills: string[] = Array.isArray(data.skills) ? data.skills : [];

    for (const skillRef of skills) {
      // Skills are referenced as "owner/repo" or "owner/repo/skill-path"
      // We want to map both the repo-level and the skill-level refs
      const existing = lookup[skillRef] || [];
      if (!existing.includes(slug)) {
        existing.push(slug);
      }
      lookup[skillRef] = existing;

      // Also map the owner-level prefix (e.g., "cloudflare/skills" from "cloudflare/skills/building-mcp-server-on-cloudflare")
      const parts = skillRef.split('/');
      if (parts.length >= 2) {
        const ownerRepo = `${parts[0]}/${parts[1]}`;
        const repoExisting = lookup[ownerRepo] || [];
        if (!repoExisting.includes(slug)) {
          repoExisting.push(slug);
        }
        lookup[ownerRepo] = repoExisting;
      }
    }
  }

  mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(lookup, null, 2)}\n`, 'utf-8');

  const totalSkills = Object.keys(lookup).length;
  const totalCollections = files.length;
  console.log(`Skill-collection lookup built:`);
  console.log(`  Collections: ${totalCollections}`);
  console.log(`  Skill refs mapped: ${totalSkills}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
}

main();
