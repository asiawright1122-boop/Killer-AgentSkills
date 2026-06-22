import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDir = join(process.cwd(), 'public');
const pagesDir = join(process.cwd(), 'src', 'pages');
const pageSourceExtPattern = /\.(astro|md|mdx|ts|tsx|js|jsx)$/;

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeRelativePath(filePath: string, root: string): string {
  return relative(root, filePath).split(sep).join('/');
}

function pageFileToStaticPublicPath(filePath: string): string | null {
  const relativePath = normalizeRelativePath(filePath, pagesDir);
  if (relativePath.includes('[')) return null;

  const routePath = relativePath.replace(pageSourceExtPattern, '');
  if (basename(routePath) === 'index') return null;
  if (!basename(routePath).includes('.')) return null;

  return routePath;
}

describe('public static route conflicts', () => {
  it('does not duplicate public files with file-like src/pages routes', () => {
    const publicFiles = new Set(walkFiles(publicDir).map((file) => normalizeRelativePath(file, publicDir)));
    const conflicts = walkFiles(pagesDir)
      .map(pageFileToStaticPublicPath)
      .filter((routePath): routePath is string => routePath !== null)
      .filter((routePath) => publicFiles.has(routePath));

    expect(conflicts).toEqual([]);
  });
});
