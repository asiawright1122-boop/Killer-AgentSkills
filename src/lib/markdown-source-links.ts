type RepositoryLinkContext = {
  owner: string;
  repo: string;
  sourceFilePath?: string | null;
};

export type ResolvedMarkdownTarget = {
  href: string;
  isExternal: boolean;
  fromRepositoryRelative: boolean;
};

const ABSOLUTE_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_LINK_PROTOCOL_RE = /^(https?:|mailto:|tel:)/i;
const SAFE_IMAGE_PROTOCOL_RE = /^(https?:|data:)/i;

function normalizeSourceFilePath(sourceFilePath?: string | null): string {
  return String(sourceFilePath || '')
    .trim()
    .replace(/^\/+/, '');
}

function getSourceDirectory(sourceFilePath?: string | null): string {
  const normalizedPath = normalizeSourceFilePath(sourceFilePath);
  if (!normalizedPath) return '';

  const parts = normalizedPath.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  parts.pop();
  return parts.join('/');
}

function resolveRepositoryRelativePath(rawTarget: string, sourceFilePath?: string | null): string {
  const sourceDirectory = getSourceDirectory(sourceFilePath);
  const baseUrl = `https://repo.local/${sourceDirectory ? `${sourceDirectory}/` : ''}`;
  const resolved = new URL(rawTarget, baseUrl);
  return `${resolved.pathname.replace(/^\/+/, '')}${resolved.search}${resolved.hash}`;
}

function buildRepositoryBlobUrl(
  owner: string,
  repo: string,
  rawTarget: string,
  sourceFilePath?: string | null,
): string {
  const resolvedPath = resolveRepositoryRelativePath(rawTarget, sourceFilePath);
  return `https://github.com/${owner}/${repo}/blob/HEAD/${resolvedPath}`;
}

function buildRepositoryRawUrl(owner: string, repo: string, rawTarget: string, sourceFilePath?: string | null): string {
  const resolvedPath = resolveRepositoryRelativePath(rawTarget, sourceFilePath);
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${resolvedPath}`;
}

function resolveDirectTarget(rawTarget: string, safeProtocolRe: RegExp): ResolvedMarkdownTarget {
  const trimmedTarget = rawTarget.trim();
  if (!trimmedTarget) {
    return {
      href: '#',
      isExternal: false,
      fromRepositoryRelative: false,
    };
  }

  if (trimmedTarget.startsWith('#')) {
    return {
      href: trimmedTarget,
      isExternal: false,
      fromRepositoryRelative: false,
    };
  }

  if (trimmedTarget.startsWith('//')) {
    return {
      href: `https:${trimmedTarget}`,
      isExternal: true,
      fromRepositoryRelative: false,
    };
  }

  if (ABSOLUTE_PROTOCOL_RE.test(trimmedTarget)) {
    return {
      href: safeProtocolRe.test(trimmedTarget) ? trimmedTarget : '#',
      isExternal: /^https?:/i.test(trimmedTarget),
      fromRepositoryRelative: false,
    };
  }

  return {
    href: trimmedTarget,
    isExternal: false,
    fromRepositoryRelative: true,
  };
}

export function resolveRepositoryMarkdownLink(rawHref: string, context: RepositoryLinkContext): ResolvedMarkdownTarget {
  const directTarget = resolveDirectTarget(rawHref, SAFE_LINK_PROTOCOL_RE);
  if (!directTarget.fromRepositoryRelative) return directTarget;

  return {
    href: buildRepositoryBlobUrl(context.owner, context.repo, rawHref, context.sourceFilePath),
    isExternal: true,
    fromRepositoryRelative: true,
  };
}

export function resolveRepositoryMarkdownImage(rawSrc: string, context: RepositoryLinkContext): ResolvedMarkdownTarget {
  const directTarget = resolveDirectTarget(rawSrc, SAFE_IMAGE_PROTOCOL_RE);
  if (!directTarget.fromRepositoryRelative) return directTarget;

  return {
    href: buildRepositoryRawUrl(context.owner, context.repo, rawSrc, context.sourceFilePath),
    isExternal: true,
    fromRepositoryRelative: true,
  };
}
