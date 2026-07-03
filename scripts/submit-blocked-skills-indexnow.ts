#!/usr/bin/env npx tsx

/**
 * Submit blocked (sitemap-excluded) Tier 1 skills to IndexNow.
 *
 * Many high-quality skills are excluded from the sitemap (repo-level or
 * exact-match blocklist entries) but are still indexable via direct URL
 * submission. This script finds those skills and submits their canonical
 * URLs directly to IndexNow for Bing/Yandex discovery.
 *
 * Usage: npx tsx scripts/submit-blocked-skills-indexnow.ts [--dry-run] [--limit N]
 */

import { fetchWithTimeout } from './lib/utils';
import { getSkillRoutePath, buildLocalizedSkillPath } from '../src/lib/skill-route-paths';
import { SUPPORTED_LOCALES } from '../src/i18n';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INDEXNOW_KEY = '89cc8ad09dc64e58b25ccb5632573e78';
const INDEXNOW_KEY_LOCATION = `https://killer-skills.com/${INDEXNOW_KEY}.txt`;
const HOST = 'killer-skills.com';

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;
  return { dryRun, limit: Math.min(limit, 200) };
}

async function main() {
  const { dryRun, limit } = parseArgs();

  // Load blocklist
  const blocklistPath = resolve(process.cwd(), 'data/seo-sitemap-blocklist.json');
  const blocklist = JSON.parse(readFileSync(blocklistPath, 'utf8'));
  const blockedExact = new Set(blocklist.rules.excludeExact);
  const blockedRepo = new Set(blocklist.rules.excludeRepo);

  // Load skills cache
  const cachePath = resolve(process.cwd(), 'data/skills-cache.json');
  const cache = JSON.parse(readFileSync(cachePath, 'utf8'));

  // Find Tier 1 (indexable) skills that are blocked from sitemap
  // We use the skills cache which has routePath and locale governance data
  const blockedSkills: { id: string; owner: string; repo: string; routePath: string; stars: number; quality: number }[] = [];

  for (const skill of cache.skills) {
    const owner = skill.owner || '';
    const repo = skill.repo || '';
    const routePath = skill.routePath || '';
    const stars = skill.stars || 0;
    const quality = skill.qualityScore || 0;

    if (quality < 50) continue; // Only high-quality skills

    const skillOwnerRepo = `${owner}/${repo}`;
    const skillFull = `${owner}/${routePath}`;

    const isBlocked =
      blockedExact.has(skillFull) ||
      blockedRepo.has(skillOwnerRepo) ||
      blockedExact.has(owner);

    if (isBlocked) {
      blockedSkills.push({ id: skill.id, owner, repo, routePath, stars, quality });
    }
  }

  // Sort by stars descending, take top N
  blockedSkills.sort((a, b) => b.stars - a.stars);
  const selected = blockedSkills.slice(0, limit);

  console.log(`📋 Found ${blockedSkills.length} blocked Tier 1 skills (quality≥50).`);
  console.log(`🎯 Targeting top ${selected.length} by star count.`);
  console.log();

  // Generate URLs
  const urlList: string[] = [];
  for (const skill of selected) {
    const routePath = getSkillRoutePath({ id: skill.id, owner: skill.owner, repo: skill.repo, routePath: skill.routePath });
    if (!routePath) continue;

    // Submit canonical (en) locale only — most impactful for Google
    const canonicalPath = buildLocalizedSkillPath('en', skill.owner, routePath);
    urlList.push(`https://${HOST}${canonicalPath}`);
  }

  // Also add P0 surface URLs (same as main submit-indexnow.ts)
  const P0_SURFACE_PATHS = [
    '', '/collections', '/collections/top-official-ai-skills-trusted-tools',
    '/collections/top-agent-workflow-building-tools',
    '/collections/top-cursor-compatible-skills-workflow-integrations',
    '/docs/installation', '/blog/official-ai-agent-skills-guide',
    '/blog/claude-code-vs-cursor-vs-windsurf',
  ];
  for (const p0Path of P0_SURFACE_PATHS) {
    urlList.push(`https://${HOST}/en${p0Path}`);
  }

  console.log(`📊 Submitting ${urlList.length} URLs to IndexNow`);
  console.log(`   (${selected.length} blocked Tier 1 skills + ${P0_SURFACE_PATHS.length} P0 surfaces)`);
  console.log();

  if (dryRun) {
    console.log('🧪 DRY-RUN ENABLED. URLs that would be submitted:');
    console.log();
    console.log('Blocked skills (sample):');
    for (const skill of selected.slice(0, 10)) {
      const routePath = getSkillRoutePath({ id: skill.id, owner: skill.owner, repo: skill.repo, routePath: skill.routePath });
      const path = routePath ? buildLocalizedSkillPath('en', skill.owner, routePath) : '?';
      console.log(`  ⭐${skill.stars} q=${skill.quality} | https://${HOST}${path}`);
    }
    console.log(`  ... and ${selected.length - 10} more`);
    console.log();
    console.log('P0 surfaces:');
    for (const url of urlList.slice(-P0_SURFACE_PATHS.length)) {
      console.log(`  ${url}`);
    }
    console.log();
    console.log('🧪 Dry-run finished.');
    return;
  }

  // Submit to IndexNow
  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };

  console.log('📡 Submitting to IndexNow API...');
  try {
    const response = await fetchWithTimeout('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    }, 10000);

    if (response.ok) {
      console.log(`🎉 IndexNow submission succeeded! Status: ${response.status}`);
      console.log(`✅ ${urlList.length} URLs submitted (${selected.length} blocked skills + ${P0_SURFACE_PATHS.length} P0)`);
    } else {
      const body = await response.text();
      console.error(`❌ Failed: ${response.status} ${body}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Network error:', err);
    process.exit(1);
  }
}

main();