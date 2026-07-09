import { resolveSkillDetailLocale } from './skill-locale-link';
import { buildLocalizedSkillPath, getSkillRoutePath } from './skill-route-paths';

export type SkillDetailLinkInput = {
  id?: unknown;
  owner?: unknown;
  repo?: unknown;
  routePath?: unknown;
};

export type ResolvedSkillDetailLink = {
  owner: string;
  routePath: string;
  detailLocale: string;
  href: string;
};

function cleanSegment(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveSkillDetailLink(
  input: SkillDetailLinkInput,
  requestedLocale: string,
): ResolvedSkillDetailLink | null {
  const owner = cleanSegment(input.owner);
  const repo = cleanSegment(input.repo);
  const routePath = getSkillRoutePath(input) || repo;

  if (!owner || !routePath) return null;

  const detailLocale = resolveSkillDetailLocale(owner, routePath, requestedLocale, { preserveRequestedLocale: true });
  return {
    owner,
    routePath,
    detailLocale,
    href: buildLocalizedSkillPath(detailLocale, owner, routePath),
  };
}
