/**
 * Build-time data loader for prerendered pages.
 *
 * Uses dynamic `import('node:fs')` to read local JSON files at build time.
 * This avoids Vite inlining the JSON files into the SSR worker bundle.
 * The `node:fs` import is dynamic so Vite doesn't statically analyze and
 * bundle it.
 */

export async function loadJsonDataAtBuildTime(relativePath: string): Promise<unknown> {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn(`[build-time-loader] Failed to load ${relativePath}:`, e);
  }
  return null;
}
