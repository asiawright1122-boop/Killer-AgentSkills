export type SitemapSkillEntry = {
  owner: string;
  repo: string;
  routePath: string;
  updatedAt?: string;
};

const FILE_LIKE_SEGMENT_REGEX = /\.(md|ts|js|py|json|go|yaml|yml|toml|rs|rb|css|html|xml|txt)$/i;
const INVALID_ROUTE_SEGMENT_REGEX = /[?:#]/;
const ROOT_SOURCE_FILE_SEGMENTS = new Set(['readme.md', 'agents.md', 'skill.md']);

type SkillRouteInput = {
  id?: unknown;
  owner?: unknown;
  repo?: unknown;
  routePath?: unknown;
};

type SitemapSkillInput = SkillRouteInput & {
  updatedAt?: unknown;
  updated_at?: unknown;
};

function cleanSegment(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidPublicSkillRouteSegment(segment: string): boolean {
  if (!segment) return false;
  if (segment.includes('/')) return false;
  if (segment === '.' || segment === '..') return false;
  if (INVALID_ROUTE_SEGMENT_REGEX.test(segment)) return false;
  return !FILE_LIKE_SEGMENT_REGEX.test(segment);
}

function isValidPublicSkillRepoSegment(segment: string): boolean {
  if (!segment) return false;
  if (segment.includes('/')) return false;
  if (segment === '.' || segment === '..') return false;
  if (ROOT_SOURCE_FILE_SEGMENTS.has(segment.toLowerCase())) return false;
  return !INVALID_ROUTE_SEGMENT_REGEX.test(segment);
}

export function getSkillRouteSegments(input: SkillRouteInput): string[] | null {
  const owner = cleanSegment(input.owner);
  const repo = cleanSegment(input.repo);
  const explicitRoutePath = cleanSegment(input.routePath);

  if (!owner || !repo) return null;

  if (explicitRoutePath) {
    const explicitSegments = explicitRoutePath
      .split('/')
      .map((segment) => cleanSegment(segment))
      .filter(Boolean);
    if (explicitSegments.length < 1 || explicitSegments.length > 2) return null;
    if (explicitSegments[0].toLowerCase() !== repo.toLowerCase()) return null;
    const [explicitRepo, explicitSubSkill] = explicitSegments;
    if (!isValidPublicSkillRepoSegment(explicitRepo)) return null;
    if (explicitSubSkill && !isValidPublicSkillRouteSegment(explicitSubSkill)) return null;
    return explicitSegments;
  }

  const rawId = cleanSegment(input.id);
  if (!rawId) {
    return isValidPublicSkillRepoSegment(repo) ? [repo] : null;
  }

  const idSegments = rawId.split('/').filter(Boolean);
  if (idSegments.length < 2 || idSegments.length > 3) return null;

  const [idOwner, idRepo, idSubSkill] = idSegments;
  if (idOwner.toLowerCase() !== owner.toLowerCase()) return null;
  if (idRepo.toLowerCase() !== repo.toLowerCase()) return null;

  if (idSubSkill && ROOT_SOURCE_FILE_SEGMENTS.has(idSubSkill.toLowerCase())) {
    return isValidPublicSkillRepoSegment(repo) ? [repo] : null;
  }

  const routeSegments = idSubSkill ? [repo, idSubSkill] : [repo];
  if (!isValidPublicSkillRepoSegment(routeSegments[0])) return null;
  if (routeSegments[1] && !isValidPublicSkillRouteSegment(routeSegments[1])) return null;

  return routeSegments;
}

export function getSkillRoutePath(input: SkillRouteInput): string | null {
  const routeSegments = getSkillRouteSegments(input);
  return routeSegments ? routeSegments.join('/') : null;
}

export function buildLocalizedSkillPath(locale: string, owner: string, routePath: string): string {
  const encodedOwner = encodeURIComponent(cleanSegment(owner));
  const encodedRoutePath = routePath
    .split('/')
    .map((segment) => encodeURIComponent(cleanSegment(segment)))
    .join('/');
  return `/${locale}/skills/${encodedOwner}/${encodedRoutePath}`;
}

export function normalizeSitemapSkillEntry(input: SitemapSkillInput): SitemapSkillEntry | null {
  const owner = cleanSegment(input.owner);
  const repo = cleanSegment(input.repo);
  const routePath = getSkillRoutePath({
    id: input.id,
    owner,
    repo,
    routePath: (input as Record<string, unknown>).routePath,
  });

  if (!owner || !repo || !routePath) return null;

  const updatedAtRaw = cleanSegment(input.updatedAt) || cleanSegment(input.updated_at);
  return {
    owner,
    repo,
    routePath,
    ...(updatedAtRaw ? { updatedAt: updatedAtRaw } : {}),
  };
}
