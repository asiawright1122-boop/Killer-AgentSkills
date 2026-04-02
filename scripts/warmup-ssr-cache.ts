import fs from 'fs';
import path from 'path';

// Load the list of valid locales, ignoring 'en' because english is natively supported in data
// We assume SUPPORTED_LOCALES exists
import { SUPPORTED_LOCALES } from '../src/lib/seo-locales';
const locales = SUPPORTED_LOCALES.filter(l => l !== 'en');

const CACHE_FILE = path.join(process.cwd(), 'data/skills-cache.json');
const DOMAIN = process.env.PUBLIC_SITE_URL || 'https://killer-skills.com';
const LIMIT = parseInt(process.env.WARMUP_LIMIT || '100', 10);
const CONCURRENCY = parseInt(process.env.WARMUP_CONCURRENCY || '5', 10);

async function runWarmup() {
  console.log(`🔥 Starting SSR Cache Warmup...`);
  if (!fs.existsSync(CACHE_FILE)) {
    console.error(`❌ Cache file not found: ${CACHE_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  const skills = Array.isArray(data) ? data : data.skills || [];
  skills.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  const topSkills = skills.slice(0, LIMIT);
  const urls: string[] = [];

  for (const skill of topSkills) {
    for (const locale of locales) {
      urls.push(`${DOMAIN}/${locale}/skills/${skill.owner}/${skill.repo}`);
    }
  }

  console.log(`📍 Prepared ${urls.length} target URLs (${topSkills.length} skills x ${locales.length} languages)`);
  console.log(`🚀 Concurrency Level: ${CONCURRENCY}`);
  console.log(`🌐 Target Domain: ${DOMAIN}\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (url) => {
      const start = Date.now();
      try {
        const res = await fetch(url, { 
          method: 'GET', 
          headers: { 'User-Agent': 'Killer-Skills-Warmup-Bot/1.0' } 
        });
        const ms = Date.now() - start;
        if (res.ok) {
          successCount++;
          const label = ms > 550 ? '🐌 [TRIGGERED LLM]' : '⚡️ [KV HIT]';
          console.log(`[HTTP 200] ${ms}ms ${label} -> ${url}`);
        } else {
          failCount++;
          console.error(`[HTTP ${res.status}] Failed -> ${url}`);
        }
      } catch (err: any) {
        failCount++;
        console.error(`[FETCH ERROR] ${err.message} -> ${url}`);
      }
    });

    await Promise.all(promises);
  }

  console.log(`\n🎉 Warmup Complete!`);
  console.log(`======================`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  
  if (failCount > Math.max(10, urls.length * 0.1)) {
    console.error(`Too many failures (${failCount}). Exiting with code 1.`);
    process.exit(1);
  }
}

runWarmup().catch(console.error);
