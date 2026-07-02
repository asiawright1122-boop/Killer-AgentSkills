#!/usr/bin/env npx tsx

/**
 * Targeted IndexNow submission for a specific skill.
 * Usage: npx tsx scripts/submit-skill-indexnow.ts <owner>/<repo>/<skill-name>
 *        npx tsx scripts/submit-skill-indexnow.ts majiayu000/claude-skill-registry/search-operations
 *        Add --dry-run to preview without sending.
 */

import { fetchWithTimeout } from './lib/utils';
import { getSkillRoutePath, buildLocalizedSkillPath } from '../src/lib/skill-route-paths';
import { SUPPORTED_LOCALES } from '../src/i18n';

const INDEXNOW_KEY = '89cc8ad09dc64e58b25ccb5632573e78';
const INDEXNOW_KEY_LOCATION = `https://killer-skills.com/${INDEXNOW_KEY}.txt`;
const HOST = 'killer-skills.com';

function parseSkillRef(raw: string): { owner: string; repo: string; skillName: string } | null {
  const parts = raw.split('/');
  if (parts.length < 3) {
    console.error('❌ Invalid skill reference. Expected format: owner/repo/skill-name');
    return null;
  }
  const [owner, repo, ...skillParts] = parts;
  return { owner, repo, skillName: skillParts.join('/') };
}

async function submitSkillToIndexNow() {
  const args = process.argv.slice(2).filter(a => a !== '--dry-run');
  const isDryRun = process.argv.includes('--dry-run');

  if (args.length === 0) {
    console.error('❌ Usage: npx tsx scripts/submit-skill-indexnow.ts <owner>/<repo>/<skill-name> [--dry-run]');
    process.exit(1);
  }

  const skillRef = parseSkillRef(args[0]);
  if (!skillRef) process.exit(1);

  console.log(`🎯 Targeting skill: ${skillRef.owner}/${skillRef.repo}/${skillRef.skillName}`);

  // Build the route path (this mimics what the main submit-indexnow.ts does)
  const routePath = getSkillRoutePath({
    id: `${skillRef.owner}/${skillRef.repo}/${skillRef.skillName}`,
    owner: skillRef.owner,
    repo: skillRef.repo,
  });

  if (!routePath) {
    console.error('❌ Failed to generate route path for this skill.');
    process.exit(1);
  }

  console.log(`📐 Route path: ${routePath}`);

  // Generate localized URLs for all supported locales
  const urlList: string[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    const path = buildLocalizedSkillPath(locale, skillRef.owner, routePath);
    urlList.push(`https://${HOST}${path}`);
  }

  console.log(`🌐 Generated ${urlList.length} localized URLs:`);
  urlList.forEach(url => console.log(`   ${url}`));

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };

  if (isDryRun) {
    console.log('\n🧪 DRY-RUN ENABLED. IndexNow submission payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('🧪 Dry-run finished successfully.');
    return;
  }

  console.log('\n📡 Submitting to IndexNow API (api.indexnow.org)...');
  const url = 'https://api.indexnow.org/indexnow';

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    }, 10000);

    if (response.ok) {
      console.log(`🎉 IndexNow submission succeeded! Status: ${response.status} ${response.statusText}`);
      console.log(`✅ Submitted ${urlList.length} URLs for ${skillRef.owner}/${skillRef.repo}/${skillRef.skillName}`);
    } else {
      const body = await response.text();
      console.error(`❌ IndexNow submission failed. Status: ${response.status} ${response.statusText}`);
      console.error(`Body: ${body}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ IndexNow network error:', err);
    process.exit(1);
  }
}

submitSkillToIndexNow().catch(console.error);