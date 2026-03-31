/**
 * sync-translations.ts
 *
 * Ensures every locale message file has the same key structure as en.json.
 * Missing keys are filled with the English default value.
 * Extra keys (locale-specific overrides like zh-only text) are preserved.
 *
 * Usage:
 *   npx tsx scripts/sync-translations.ts          # dry-run (report only)
 *   npx tsx scripts/sync-translations.ts --write   # write changes to disk
 *   npx tsx scripts/sync-translations.ts --check   # CI mode: exit 1 if gaps found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MESSAGES_DIR = path.resolve(__dirname, '../src/messages');
const EN_FILE = path.join(MESSAGES_DIR, 'en.json');

// ─── Helpers ────────────────────────────────────────────────────

type NestedRecord = { [key: string]: string | NestedRecord };

/** Recursively collect all dot-path keys from a nested object */
function collectKeys(obj: NestedRecord, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      for (const sub of collectKeys(v as NestedRecord, full)) {
        keys.add(sub);
      }
    } else {
      keys.add(full);
    }
  }
  return keys;
}

/** Get a nested value by dot-path */
function getNestedValue(obj: NestedRecord, dotPath: string): string | NestedRecord | undefined {
  const parts = dotPath.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/** Set a nested value by dot-path, creating intermediate objects as needed */
function setNestedValue(obj: NestedRecord, dotPath: string, value: string | NestedRecord): void {
  const parts = dotPath.split('.');
  let current: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const checkMode = args.includes('--check');

  // Load English baseline
  const en: NestedRecord = JSON.parse(fs.readFileSync(EN_FILE, 'utf8'));
  const enKeys = collectKeys(en);

  console.log(`📋 English baseline: ${enKeys.size} keys\n`);

  const localeFiles = fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'en.json')
    .sort();

  let totalGaps = 0;
  const report: { locale: string; missing: number; extra: number; filled: string[] }[] = [];

  for (const file of localeFiles) {
    const locale = file.replace('.json', '');
    const filePath = path.join(MESSAGES_DIR, file);
    const data: NestedRecord = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const localeKeys = collectKeys(data);

    const missing = [...enKeys].filter(k => !localeKeys.has(k));
    const extra = [...localeKeys].filter(k => !enKeys.has(k));

    if (missing.length > 0) {
      totalGaps += missing.length;

      if (writeMode) {
        // Fill missing keys with English defaults
        for (const key of missing) {
          const enValue = getNestedValue(en, key);
          if (enValue !== undefined) {
            setNestedValue(data, key, enValue as string);
          }
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      }
    }

    report.push({ locale, missing: missing.length, extra: extra.length, filled: missing });

    const status = missing.length === 0 ? '✅' : writeMode ? '🔧' : '❌';
    console.log(`${status} ${locale}: ${localeKeys.size} keys | missing: ${missing.length} | extra: ${extra.length}${writeMode && missing.length > 0 ? ' → filled' : ''}`);
  }

  console.log(`\n📊 Total gaps: ${totalGaps}`);

  if (writeMode && totalGaps > 0) {
    console.log(`✅ All gaps filled with English defaults. Run 'npm run build' to verify.`);
  } else if (checkMode && totalGaps > 0) {
    console.log(`\n❌ CI check failed: ${totalGaps} missing translation keys found.`);
    console.log(`Run 'npx tsx scripts/sync-translations.ts --write' to fix.`);
    process.exit(1);
  } else if (!writeMode && totalGaps > 0) {
    console.log(`\n💡 Run with --write to fill missing keys with English defaults.`);
  } else if (totalGaps === 0) {
    console.log(`\n✅ All locale files are in sync with en.json.`);
  }
}

main();
