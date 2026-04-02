/**
 * sync-translations.ts
 * 
 * Auto-syncs all locale UI dictionaries based on a baseline (en.json).
 * Any missing keys in other locales will be populated with the English equivalent, 
 * marking a baseline structure for all 10 supported languages, eliminating UI crashes.
 */

import fs from 'fs/promises';
import path from 'path';

const LOCALES = ['en', 'zh', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru'];
const MESSAGES_DIR = path.join(process.cwd(), 'src/messages');

async function main() {
  console.log('🔄 Starting Translation Synchronization...');
  
  // 1. Read EN and ZH because zh currently holds lots of super keys not even in EN
  const enRaw = await fs.readFile(path.join(MESSAGES_DIR, 'en.json'), 'utf-8');
  const zhRaw = await fs.readFile(path.join(MESSAGES_DIR, 'zh.json'), 'utf-8');

  let enDict = JSON.parse(enRaw);
  const zhDict = JSON.parse(zhRaw);

  // 2. Discover missing superkeys in EN from ZH
  // Because the previous author added features strictly to zh.json first
  console.log('📦 Merging missing baselines from ZH -> EN...');
  let enUpdated = false;
  for (const ns of Object.keys(zhDict)) {
    if (!enDict[ns]) {
      enDict[ns] = {};
      enUpdated = true;
    }
    for (const key of Object.keys(zhDict[ns] || {})) {
      if (!enDict[ns].hasOwnProperty(key)) {
        enDict[ns][key] = zhDict[ns][key]; // Temporarily fall back to ZH string if strictly no English counterpart exists
        enUpdated = true;
      }
    }
  }

  // Rewrite EN if it was updated
  if (enUpdated) {
    await fs.writeFile(path.join(MESSAGES_DIR, 'en.json'), JSON.stringify(enDict, null, 2) + '\n', 'utf-8');
    console.log('✅ Updated en.json with new structural nodes.');
  }

  // 3. Mirror the baseline EN structurally to all other locales
  for (const code of LOCALES) {
    if (code === 'en') continue;

    const locPath = path.join(MESSAGES_DIR, `${code}.json`);
    let locDict: Record<string, Record<string, string>> = {};
    
    try {
      const raw = await fs.readFile(locPath, 'utf-8');
      locDict = JSON.parse(raw);
    } catch {
      console.log(`⚠️  ${code}.json not found or corrupted. Building from scratch...`);
    }

    let modified = false;
    for (const ns of Object.keys(enDict)) {
      if (!locDict[ns]) {
        locDict[ns] = {};
        modified = true;
      }
      for (const key of Object.keys(enDict[ns])) {
        if (!locDict[ns].hasOwnProperty(key)) {
          // Fill missing key with the English default to prevent component crashes
          locDict[ns][key] = enDict[ns][key];
          modified = true;
        }
      }
    }

    // Advanced: sorting keys alphabetically to preserve Git cleanliness
    const orderedDict: typeof locDict = {};
    Object.keys(enDict).sort().forEach(ns => {
      orderedDict[ns] = {};
      Object.keys(enDict[ns]).sort().forEach(key => {
        orderedDict[ns][key] = locDict[ns]?.[key] || enDict[ns][key];
      });
    });

    if (modified || Object.keys(locDict).length !== Object.keys(orderedDict).length) {
      await fs.writeFile(locPath, JSON.stringify(orderedDict, null, 2) + '\n', 'utf-8');
      console.log(`✅ Synchronized UI Dictionary for [ ${code.toUpperCase()} ] -- Missing keys injected!`);
    } else {
      console.log(`👍 [ ${code.toUpperCase()} ] is structurally sound.`);
    }
  }
  
  console.log('🚀 Synchronization Sequence Completed.');
}

main().catch(e => {
  console.error('Fatal Sync Error:', e);
  process.exit(1);
});
