#!/usr/bin/env npx tsx

import { execFileSync } from 'node:child_process';
import { fetchWithTimeout } from './lib/utils';
import { getSkillRoutePath, buildLocalizedSkillPath } from '../src/lib/skill-route-paths';
import { SUPPORTED_LOCALES } from '../src/i18n';

const INDEXNOW_KEY = '89cc8ad09dc64e58b25ccb5632573e78';
const INDEXNOW_KEY_LOCATION = `https://killer-skills.com/${INDEXNOW_KEY}.txt`;
const HOST = 'killer-skills.com';

interface SkillRow {
  id: string;
  owner: string;
  repo: string;
  updated_at: string;
}

function getRecentSkills(): SkillRow[] {
  try {
    const output = execFileSync('npx', [
      'wrangler', 'd1', 'execute', 'killer-skills-db', '--remote',
      '--command', 'SELECT id, owner, repo, updated_at FROM skills ORDER BY updated_at DESC LIMIT 100;',
      '--json'
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const parsed = JSON.parse(output);
    return parsed?.[0]?.results || [];
  } catch (err) {
    console.error('❌ Failed to query D1 database for skills:', err);
    return [];
  }
}

async function submitIndexNow() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('🔍 Querying D1 for recently updated skills...');
  const skills = getRecentSkills();
  if (skills.length === 0) {
    console.log('⚠️ No skills retrieved from D1 database. Aborting.');
    return;
  }

  // Filter: last 24h, fallback to top 20
  const last24hMs = Date.now() - 24 * 60 * 60 * 1000;
  let targetSkills = skills.filter(s => {
    const parsed = Date.parse(s.updated_at);
    return !isNaN(parsed) && parsed >= last24hMs;
  });

  if (targetSkills.length === 0) {
    console.log('ℹ️ No skills updated in the last 24h. Falling back to the 20 most recently updated skills.');
    targetSkills = skills.slice(0, 20);
  }

  console.log(`📋 Found ${targetSkills.length} target skills to submit.`);

  const urlList: string[] = [];
  for (const skill of targetSkills) {
    const routePath = getSkillRoutePath({
      id: skill.id,
      owner: skill.owner,
      repo: skill.repo
    });

    if (!routePath) continue;

    for (const locale of SUPPORTED_LOCALES) {
      const path = buildLocalizedSkillPath(locale, skill.owner, routePath);
      urlList.push(`https://${HOST}${path}`);
    }
  }

  if (urlList.length === 0) {
    console.log('⚠️ No valid localized skill URLs generated. Aborting.');
    return;
  }

  console.log(`🚀 Formatted ${urlList.length} URLs for IndexNow submission.`);

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: urlList
  };

  if (isDryRun) {
    console.log('🧪 DRY-RUN ENABLED. IndexNow submission payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('🧪 Dry-run finished successfully.');
    return;
  }

  console.log('📡 Submitting to IndexNow API (api.indexnow.org)...');
  const url = 'https://api.indexnow.org/indexnow';
  
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    }, 10000);

    if (response.ok) {
      console.log(`🎉 IndexNow submission succeeded! Status: ${response.status} ${response.statusText}`);
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

submitIndexNow().catch(console.error);
