/**
 * Build output validation tests.
 *
 * These tests verify the Astro build output meets deployment requirements.
 * They expect `npm run build` to have been run before executing.
 *
 * Feature: nextjs-to-astro-migration, Property 8: Worker Bundle 体积约束
 * Validates: Requirements 1.4, 1.5
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist');
const SERVER_DIR = path.join(DIST_DIR, 'server');
const CLIENT_DIR = path.join(DIST_DIR, 'client');
const GENERATED_WRANGLER_CONFIG = path.join(SERVER_DIR, 'wrangler.json');
const PROJECT_WRANGLER_CONFIG = path.resolve(import.meta.dirname, '..', 'wrangler.toml');
const MAX_BUNDLE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB (CF Workers limit is higher or compressed)

/**
 * Recursively calculate total size of a directory in bytes.
 */
function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  const stat = fs.statSync(dirPath);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;

  let total = 0;
  for (const entry of fs.readdirSync(dirPath)) {
    total += getDirSize(path.join(dirPath, entry));
  }
  return total;
}

describe('Feature: nextjs-to-astro-migration, Property 8: Worker Bundle 体积约束', () => {
  it('Cloudflare Workers server directory should exist after build', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * After running `npm run build`, the Cloudflare Workers output
     * directory `dist/server` should exist (@astrojs/cloudflare v13+).
     */
    expect(fs.existsSync(SERVER_DIR)).toBe(true);
  });

  it('Worker bundle total size should stay under the deployment limit', () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * The Worker bundle total size must stay under 15MB.
     */
    const totalSize = getDirSize(SERVER_DIR);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`Worker bundle size: ${sizeMB} MB (${totalSize} bytes)`);
    expect(totalSize).toBeLessThan(MAX_BUNDLE_SIZE_BYTES);
  });

  it('Cloudflare Workers server should contain an entry.mjs entry point', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * The server output should contain an entry.mjs entry point file
     * (@astrojs/cloudflare v13+ uses ESM entry).
     */
    const entryPath = path.join(SERVER_DIR, 'entry.mjs');
    expect(fs.existsSync(entryPath)).toBe(true);
  });

  it('dist should contain prerendered sitemap entrypoints for crawlers', () => {
    expect(fs.existsSync(path.join(CLIENT_DIR, 'sitemap.xml'))).toBe(true);
    expect(fs.existsSync(path.join(CLIENT_DIR, 'sitemap-skills.xml'))).toBe(true);
  });

  it('generated Wrangler config should not contain duplicate binding names', () => {
    const configPath = fs.existsSync(GENERATED_WRANGLER_CONFIG) ? GENERATED_WRANGLER_CONFIG : PROJECT_WRANGLER_CONFIG;
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    const bindingNames = Array.from(rawConfig.matchAll(/binding\s*=\s*"([^"]+)"/g)).map((match) => match[1]);
    expect(new Set(bindingNames).size).toBe(bindingNames.length);
  });
});
