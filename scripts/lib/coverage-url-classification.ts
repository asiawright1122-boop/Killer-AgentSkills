const DEFAULT_SKILL_PATH_REGEX = /^\/[a-z]{2}\/skills\/[^/]+\/(.+)$/i;

function getLastNonEmptySegment(parts: string[]): string {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) return parts[i];
  }
  return '';
}

export function getSkillRouteSegments(pathname: string): string[] | null {
  const match = pathname.match(DEFAULT_SKILL_PATH_REGEX);
  if (!match) return null;
  return match[1].split('/').filter(Boolean);
}

export function isFileLikeSkillRouteTail(routeSegments: string[], fileExtRegex: RegExp): boolean {
  const normalized = routeSegments.filter(Boolean);
  if (normalized.length < 2) return false;
  const tail = getLastNonEmptySegment(normalized);
  return Boolean(tail) && fileExtRegex.test(tail);
}

export function hasFileLikeLastSegment(pathname: string, fileExtRegex: RegExp): boolean {
  const tail = getLastNonEmptySegment(pathname.split('/').filter(Boolean));
  return Boolean(tail) && fileExtRegex.test(tail);
}

export function isSourceFilePathname(pathname: string, fileExtRegex: RegExp): boolean {
  const routeSegments = getSkillRouteSegments(pathname);
  if (routeSegments) {
    return isFileLikeSkillRouteTail(routeSegments, fileExtRegex);
  }
  return hasFileLikeLastSegment(pathname, fileExtRegex);
}

export function countExtraSkillSegments(pathname: string): number {
  const routeSegments = getSkillRouteSegments(pathname);
  if (!routeSegments || routeSegments.length < 3) return 0;
  return routeSegments.length - 2;
}

export function hasRepeatedSegment(pathname: string): boolean {
  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] === parts[i - 1]) return true;
  }
  return false;
}
