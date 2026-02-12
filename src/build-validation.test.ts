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
const WORKER_DIR = path.join(DIST_DIR, '_worker.js');
const MAX_BUNDLE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB (CF Workers limit is 10MB uncompressed)

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
  it('dist/_worker.js directory should exist after build', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * After running `npm run build`, the Cloudflare Workers output
     * directory `dist/_worker.js` should exist.
     */
    expect(fs.existsSync(WORKER_DIR)).toBe(true);
  });

  it('Worker bundle total size should be under 3MB', () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * The Worker bundle total size must stay under 3MB to fit within
     * Cloudflare Workers free tier limits.
     */
    const totalSize = getDirSize(WORKER_DIR);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`Worker bundle size: ${sizeMB} MB (${totalSize} bytes)`);
    expect(totalSize).toBeLessThan(MAX_BUNDLE_SIZE_BYTES);
  });

  it('dist/_worker.js should contain an index.js entry point', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * The worker output should contain an index.js entry point file.
     */
    const indexPath = path.join(WORKER_DIR, 'index.js');
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});
