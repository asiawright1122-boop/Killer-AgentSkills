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
const CLIENT_DIR = path.join(DIST_DIR, 'client');
const WORKER_DIR = path.join(DIST_DIR, 'server');
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
  it('dist/server directory should exist after build', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * After running `npm run build`, the Cloudflare Workers output
     * directory `dist/server` should exist.
     */
    expect(fs.existsSync(WORKER_DIR)).toBe(true);
  });

  it('Worker bundle total size should stay under the deployment limit', () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * The Worker bundle total size must stay under 15MB.
     */
    const totalSize = getDirSize(WORKER_DIR);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`Worker bundle size: ${sizeMB} MB (${totalSize} bytes)`);
    expect(totalSize).toBeLessThan(MAX_BUNDLE_SIZE_BYTES);
  });

  it('dist/server should contain an entry.mjs entry point', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * The worker output should contain an entry.mjs entry point file.
     */
    const indexPath = path.join(WORKER_DIR, 'entry.mjs');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('dist should contain prerendered sitemap entrypoints for crawlers', () => {
    expect(fs.existsSync(path.join(CLIENT_DIR, 'sitemap.xml'))).toBe(true);
    expect(fs.existsSync(path.join(CLIENT_DIR, 'sitemap-skills.xml'))).toBe(true);
  });

  it('generated Wrangler config should not contain duplicate binding names', () => {
    const configPath = path.join(WORKER_DIR, 'wrangler.json');
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      kv_namespaces?: Array<{ binding?: string }>;
    };
    const bindingNames = (rawConfig.kv_namespaces || []).map((binding) => binding.binding).filter(Boolean);
    expect(new Set(bindingNames).size).toBe(bindingNames.length);
  });
});
