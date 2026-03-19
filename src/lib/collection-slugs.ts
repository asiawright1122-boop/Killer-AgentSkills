type CollectionSlugData = {
  canonicalSlug?: string;
  legacySlugs?: string[];
};

type CollectionLike = {
  id: string;
  data?: CollectionSlugData;
};

const COLLECTION_CANONICAL_SLUG_OVERRIDES: Record<string, string> = {
  'top-mcp-mcp-servers': 'top-ai-agent-workflow-skills-integrations-utilities',
  'top-mcp-server-mcp-servers': 'top-ai-agent-integration-frameworks-bridges-infra-tooling',
};

function normalizeSlug(slug: string): string {
  return slug.replace(/\.json$/i, '');
}

export function getCollectionFileSlug(collection: CollectionLike): string {
  return normalizeSlug(collection.id);
}

export function getCollectionCanonicalSlug(collection: CollectionLike): string {
  const fileSlug = getCollectionFileSlug(collection);
  return collection.data?.canonicalSlug || COLLECTION_CANONICAL_SLUG_OVERRIDES[fileSlug] || fileSlug;
}

export function getCollectionLegacySlugs(collection: CollectionLike): string[] {
  const canonicalSlug = getCollectionCanonicalSlug(collection);
  const legacySlugs = new Set<string>();
  const fileSlug = getCollectionFileSlug(collection);

  if (fileSlug !== canonicalSlug) {
    legacySlugs.add(fileSlug);
  }

  for (const slug of collection.data?.legacySlugs || []) {
    const normalizedSlug = normalizeSlug(slug);
    if (normalizedSlug && normalizedSlug !== canonicalSlug) {
      legacySlugs.add(normalizedSlug);
    }
  }

  return [...legacySlugs];
}

export function resolveCollectionBySlug<T extends CollectionLike>(collections: T[], slug: string) {
  const normalizedSlug = normalizeSlug(slug);

  for (const collection of collections) {
    const canonicalSlug = getCollectionCanonicalSlug(collection);
    if (canonicalSlug === normalizedSlug) {
      return { collection, canonicalSlug, isCanonical: true };
    }

    if (getCollectionLegacySlugs(collection).includes(normalizedSlug)) {
      return { collection, canonicalSlug, isCanonical: false };
    }
  }

  return null;
}
