#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED — DO NOT USE
 * 
 * This script is deprecated and has been replaced by `npm run sync:kv` (sync-to-kv.ts).
 * It previously wrote raw SKILL.md content to KV, which overwrites structured data.
 * 
 * Use `npm run sync:kv` instead for full KV synchronization.
 */

console.error('❌ warmup-cache.ts is DEPRECATED.');
console.error('   Use "npm run sync:kv" instead for full KV synchronization.');
process.exit(1);
