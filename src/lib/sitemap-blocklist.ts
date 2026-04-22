export type SitemapBlocklistData = {
  rules?: {
    excludeExact?: unknown;
    excludeRepo?: unknown;
  };
};

export type CompiledSitemapBlocklist = {
  exactKeys: Set<string>;
  repoKeys: Set<string>;
};

function normalizeKeyPart(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeOwnerRouteKey(owner: unknown, routePath: unknown): string {
  const ownerPart = normalizeKeyPart(owner);
  const routePart = normalizeKeyPart(routePath);
  return ownerPart && routePart ? `${ownerPart}/${routePart}` : '';
}

function normalizeOwnerRepoKey(owner: unknown, repo: unknown): string {
  const ownerPart = normalizeKeyPart(owner);
  const repoPart = normalizeKeyPart(repo);
  return ownerPart && repoPart ? `${ownerPart}/${repoPart}` : '';
}

function parseArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeKeyPart(entry)).filter((entry) => entry.length > 0);
}

export function compileSitemapBlocklist(raw: unknown): CompiledSitemapBlocklist {
  const typed = raw as SitemapBlocklistData;
  const exactKeys = new Set<string>(parseArrayOfStrings(typed?.rules?.excludeExact));
  const repoKeys = new Set<string>(parseArrayOfStrings(typed?.rules?.excludeRepo));
  return { exactKeys, repoKeys };
}

export function isSitemapSkillBlocked(
  owner: unknown,
  routePath: unknown,
  blocklist: CompiledSitemapBlocklist,
): boolean {
  const exactKey = normalizeOwnerRouteKey(owner, routePath);
  if (!exactKey) return false;
  if (blocklist.exactKeys.has(exactKey)) return true;

  const routePart = normalizeKeyPart(routePath);
  const repoSegment = routePart.split('/').filter(Boolean)[0];
  if (!repoSegment) return false;

  return blocklist.repoKeys.has(normalizeOwnerRepoKey(owner, repoSegment));
}
