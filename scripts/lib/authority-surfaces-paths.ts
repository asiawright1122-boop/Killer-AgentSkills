/**
 * Authority surface path helpers.
 *
 * Derives P0 / P1 surface URL paths from the canonical
 * `data/authority-surfaces.json` manifest instead of retyping constants
 * in every IndexNow submitter. Keeps the surface list DRY across:
 *   - scripts/submit-indexnow.ts
 *   - scripts/submit-blocked-skills-indexnow.ts
 *   - scripts/submit-collection-indexnow.ts (Phase 1 v5.5)
 *
 * Paths are returned WITHOUT the locale prefix, matching the existing
 * convention in submit-indexnow.ts callers which prepend `/{locale}`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AuthoritySurface {
  id: string;
  tier?: string;
  surfaceClass?: string;
  href?: string;
}

export interface AuthoritySurfacesManifest {
  surfaces?: AuthoritySurface[];
}

/**
 * The homepage href `/{locale}` produces an empty path component.
 * Other P0 hub hrefs (e.g. `/{locale}/collections`) produce `/collections`.
 * Non-hub P0 surface hrefs (e.g. `/{locale}/collections/top-...`) produce
 * the full path after the locale segment.
 *
 * The hardcoded P0 list used by submit-indexnow.ts included the homepage,
 * collections hub, three P0 collections, install docs, and two P0 blog posts.
 * The blog hrefs exist on surfaces with tier:"P0" and surfaceClass:"guide"
 * or surfaceClass:"comparison" — we include those by tier.
 */
export function getSurfacePathsByTier(
  manifest: AuthoritySurfacesManifest,
  tier: 'P0' | 'P1',
): string[] {
  const surfaces = manifest.surfaces || [];
  const paths: string[] = [];
  for (const surface of surfaces) {
    if (surface.tier !== tier) continue;
    const path = extractPathFromHref(surface.href);
    if (path === null) continue;
    if (!paths.includes(path)) paths.push(path);
  }
  return paths;
}

/**
 * Extract the locale-stripped path from a `/{locale}/...` href.
 * Returns `''` for the homepage href `/{locale}`.
 * Returns `null` for hrefs that don't match the `/{locale}` pattern.
 */
export function extractPathFromHref(href: string | undefined): string | null {
  if (!href) return null;
  // href format: "/{locale}" or "/{locale}/path/..."
  // The {locale} is a literal template token, not a real locale.
  const match = href.match(/^\/\{locale\}(.*)$/);
  if (!match) return null;
  const rest = match[1];
  if (rest === '') return ''; // homepage
  // Strip leading slash so the caller prepends `/{locale}` themselves.
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/**
 * Convenience: get P0 surface paths from the manifest file.
 * Reads `data/authority-surfaces.json` relative to cwd.
 */
export function getP0SurfacePathsFromFile(
  manifestPath = resolve(process.cwd(), 'data/authority-surfaces.json'),
): string[] {
  const manifest: AuthoritySurfacesManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return getSurfacePathsByTier(manifest, 'P0');
}

/**
 * Convenience: get P1 surface paths from the manifest file.
 */
export function getP1SurfacePathsFromFile(
  manifestPath = resolve(process.cwd(), 'data/authority-surfaces.json'),
): string[] {
  const manifest: AuthoritySurfacesManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return getSurfacePathsByTier(manifest, 'P1');
}

/**
 * Convenience: get P1 collection surface paths from the manifest file.
 * Only surfaces with surfaceClass === 'collection' are returned.
 */
export function getP1CollectionSurfacePathsFromFile(
  manifestPath = resolve(process.cwd(), 'data/authority-surfaces.json'),
): string[] {
  const manifest: AuthoritySurfacesManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return getP1CollectionSurfacePaths(manifest);
}

/**
 * The canonical P0 surface path list, derived from the manifest.
 *
 * This MUST stay in sync with the original hardcoded list. The list below
 * is the expected output of `getP0SurfacePathsFromFile()` and is provided
 * so callers that import the module at module-load time can avoid async file
 * reads. Tests verify these two stay in sync.
 *
 * Order is preserved from the manifest's `surfaces[]` array.
 */
export function getP0SurfacePaths(manifest: AuthoritySurfacesManifest): string[] {
  return getSurfacePathsByTier(manifest, 'P0');
}

export function getP1CollectionSurfacePaths(manifest: AuthoritySurfacesManifest): string[] {
  const surfaces = manifest.surfaces || [];
  const paths: string[] = [];
  for (const surface of surfaces) {
    if (surface.tier !== 'P1') continue;
    if (surface.surfaceClass !== 'collection') continue;
    const path = extractPathFromHref(surface.href);
    if (path === null) continue;
    if (!paths.includes(path)) paths.push(path);
  }
  return paths;
}
