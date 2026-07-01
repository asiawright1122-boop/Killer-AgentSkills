/**
 * Collections runtime loader.
 *
 * Loads collections data from KV at runtime (production) or from local JSON
 * files in dev mode. This prevents the Content Layer from inlining all
 * collections JSON into the Worker bundle.
 */

export type { Env } from './kv';

export interface CollectionEntry {
  id: string;
  slug: string;
  data: {
    title: Record<string, string>;
    description: Record<string, string>;
    seoTitle?: Record<string, string>;
    seoDescription?: Record<string, string>;
    keywords?: Record<string, string[]>;
    longDescription?: Record<string, string>;
    skills: string[];
    featuredSkillRefs?: string[];
    canonicalSlug?: string;
    legacySlugs?: string[];
    author: string;
    featured: boolean;
    category?: string;
    editorialRationale?: Record<string, string>;
    editorial?: {
      reviewSummary?: Record<string, string>;
      selectionReason?: Record<string, string>;
      trustSignals?: Record<string, string[]>;
      groupingLogic?: Record<string, string[]>;
      maintenance?: {
        reviewedAt: string;
        cadence?: Record<string, string>;
        maintainedBy?: Record<string, string>;
        verification?: Record<string, string>;
      };
      executionExamples?: Array<{
        title: Record<string, string>;
        summary: Record<string, string>;
        steps: Record<string, string[]>;
      }>;
      decisionTracks?: Array<{
        title: Record<string, string>;
        summary: Record<string, string>;
        whenToUse?: Record<string, string>;
        checkpoints?: Record<string, string[]>;
        skillRefs?: string[];
        nextStepHref?: string;
        nextStepLabel?: Record<string, string>;
      }>;
      nextSteps?: Array<{
        href: string;
        label: Record<string, string>;
        description: Record<string, string>;
      }>;
    };
  };
}

// Type that matches the Content Layer CollectionEntry for compatibility
export interface CollectionEntryLike {
  id: string;
  data: CollectionEntry['data'];
}

let _collectionsCache: CollectionEntry[] | null = null;
let _collectionsCacheTime = 0;

async function readLocalCollections(): Promise<CollectionEntry[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(process.cwd(), 'src/content/collections');

  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const entries: CollectionEntry[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const data = JSON.parse(content);
      const slug = file.replace(/\.json$/, '');
      entries.push({
        id: slug,
        slug,
        data,
      });
    } catch {
      // Ignore malformed files
    }
  }

  return entries;
}

export async function getCollections(env?: { SKILLS_CACHE?: KVNamespace }): Promise<CollectionEntry[]> {
  if (_collectionsCache && Date.now() - _collectionsCacheTime < 30000) {
    return _collectionsCache;
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('collections');
      if (raw) {
        _collectionsCache = JSON.parse(raw) as CollectionEntry[];
        _collectionsCacheTime = Date.now();
        return _collectionsCache;
      }
    } catch {
      // Ignore KV errors, fall through to local
    }
  }

  // Fallback: local files (dev mode)
  if (import.meta.env.DEV) {
    try {
      _collectionsCache = await readLocalCollections();
      _collectionsCacheTime = Date.now();
      return _collectionsCache;
    } catch {
      // Ignore errors
    }
  }

  return [];
}

/**
 * Mimics Astro's getCollection('collections') for SSR pages.
 * Returns an array compatible with CollectionEntry type.
 */
export async function getCollectionsFromRuntime(env?: { SKILLS_CACHE?: KVNamespace }): Promise<CollectionEntryLike[]> {
  const entries = await getCollections(env);
  return entries.map((e) => ({
    id: e.id,
    data: e.data,
  }));
}

export function clearCollectionsCache(): void {
  _collectionsCache = null;
  _collectionsCacheTime = 0;
}
