import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type LocalizedText = Record<string, string>;
type LocalizedKeywords = Record<string, string[]>;

type CollectionEntry = {
  title?: LocalizedText;
  description?: LocalizedText;
  seoTitle?: LocalizedText;
  seoDescription?: LocalizedText;
  keywords?: LocalizedKeywords;
  longDescription?: LocalizedText;
  canonicalSlug?: string;
  legacySlugs?: string[];
};

export type SeoCollectionDriftIssue = {
  file: string;
  slug: string;
  severity: 'warning';
  code:
    | 'duplicate_mcp_slug_token'
    | 'duplicate_server_slug_token'
    | 'legacy_mcp_slug_copy_mismatch'
    | 'legacy_mcp_servers_slug_copy_mismatch'
    | 'canonical_map_mismatch';
  message: string;
};

type CanonicalMapEntry = {
  sourceSlug: string;
  canonicalSlug: string;
  decision: 'keep' | 'merge' | 'retire';
  redirectPhase?: string;
  notes?: string;
};

type CanonicalMapArtifact = {
  generatedAt: string;
  collections: CanonicalMapEntry[];
};

export type SeoCollectionDriftReport = {
  generatedAt: string;
  totalCollections: number;
  totalIssues: number;
  issuesByCode: Record<string, number>;
  items: SeoCollectionDriftIssue[];
};

const MCP_PATTERN = /\bmcp\b|model context protocol/i;
const SERVER_PATTERN = /\bserver(?:s)?\b/i;
const MODERN_ENTITY_PATTERN = /\bskills?\b|\btools?\b|\bintegrations?\b|\bplatforms?\b|\bframeworks?\b/i;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function toSlug(fileName: string): string {
  return fileName.replace(/\.json$/i, '');
}

function getEnglishText(value: LocalizedText | undefined): string {
  return value?.en?.trim() || '';
}

function getEnglishKeywords(value: LocalizedKeywords | undefined): string {
  return Array.isArray(value?.en) ? value!.en.join(' ').trim() : '';
}

function buildVisibleEnglishCopy(entry: CollectionEntry): string {
  return [
    getEnglishText(entry.title),
    getEnglishText(entry.description),
    getEnglishText(entry.seoTitle),
    getEnglishText(entry.seoDescription),
  ]
    .filter(Boolean)
    .join(' ');
}

function buildFullEnglishCopy(entry: CollectionEntry): string {
  return [buildVisibleEnglishCopy(entry), getEnglishKeywords(entry.keywords), getEnglishText(entry.longDescription)]
    .filter(Boolean)
    .join(' ');
}

function countSlugToken(slug: string, token: 'mcp' | 'server'): number {
  return slug
    .split('-')
    .filter((part) => (token === 'mcp' ? part === 'mcp' : part === 'server' || part === 'servers')).length;
}

function readCanonicalMap(workspaceRoot: string): Map<string, CanonicalMapEntry> {
  const canonicalMapPath = resolve(workspaceRoot, 'data/seo-collection-canonical-map.json');
  if (!existsSync(canonicalMapPath)) {
    return new Map();
  }

  const artifact = readJson<CanonicalMapArtifact>(canonicalMapPath);
  return new Map((artifact.collections || []).map((item) => [item.sourceSlug, item]));
}

function collectIssues(file: string, entry: CollectionEntry, canonicalMap: Map<string, CanonicalMapEntry>): SeoCollectionDriftIssue[] {
  const fileSlug = toSlug(file);
  const slug = entry.canonicalSlug?.trim() || fileSlug;
  const visibleEnglishCopy = buildVisibleEnglishCopy(entry);
  const fullEnglishCopy = buildFullEnglishCopy(entry);
  const issues: SeoCollectionDriftIssue[] = [];

  const mappedCanonical = canonicalMap.get(fileSlug)?.canonicalSlug?.trim();
  const mcpTokenCount = countSlugToken(slug, 'mcp');
  const serverTokenCount = countSlugToken(slug, 'server');

  if (mcpTokenCount > 1) {
    issues.push({
      file,
      slug,
      severity: 'warning',
      code: 'duplicate_mcp_slug_token',
      message: `slug repeats MCP token ${mcpTokenCount} times`,
    });
  }

  if (serverTokenCount > 1) {
    issues.push({
      file,
      slug,
      severity: 'warning',
      code: 'duplicate_server_slug_token',
      message: `slug repeats server token ${serverTokenCount} times`,
    });
  }

  if (slug.includes('mcp') && !MCP_PATTERN.test(visibleEnglishCopy) && MCP_PATTERN.test(fullEnglishCopy)) {
    issues.push({
      file,
      slug,
      severity: 'warning',
      code: 'legacy_mcp_slug_copy_mismatch',
      message: 'slug still says MCP, but visible English copy no longer surfaces MCP intent',
    });
  }

  if (slug.includes('mcp-servers') && !SERVER_PATTERN.test(visibleEnglishCopy) && MODERN_ENTITY_PATTERN.test(visibleEnglishCopy)) {
    issues.push({
      file,
      slug,
      severity: 'warning',
      code: 'legacy_mcp_servers_slug_copy_mismatch',
      message: 'slug still says MCP servers, but visible English copy now frames the page as skills/tools/platforms',
    });
  }

  if (mappedCanonical && mappedCanonical !== slug) {
    issues.push({
      file,
      slug,
      severity: 'warning',
      code: 'canonical_map_mismatch',
      message: `canonical map expects ${mappedCanonical} but collection resolves to ${slug}`,
    });
  }

  return issues;
}

export function buildSeoCollectionDriftReport(options?: {
  workspaceRoot?: string;
  generatedAt?: string;
}): SeoCollectionDriftReport {
  const workspaceRoot = resolve(options?.workspaceRoot || process.cwd());
  const collectionsDir = resolve(workspaceRoot, 'src/content/collections');

  if (!existsSync(collectionsDir)) {
    throw new Error(`collections directory not found: ${collectionsDir}`);
  }

  const files = readdirSync(collectionsDir)
    .filter((file) => file.endsWith('.json'))
    .sort();

  const canonicalMap = readCanonicalMap(workspaceRoot);
  const items = files.flatMap((file) => collectIssues(file, readJson<CollectionEntry>(join(collectionsDir, file)), canonicalMap));
  const issuesByCode = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.code] = (acc[item.code] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: options?.generatedAt || new Date().toISOString(),
    totalCollections: files.length,
    totalIssues: items.length,
    issuesByCode,
    items,
  };
}
