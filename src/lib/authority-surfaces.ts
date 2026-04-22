import authoritySurfacesData from '../../data/authority-surfaces.json';

type LocalizedText = Record<string, string>;

type AuthoritySurfaceRecord = {
  id: string;
  role: 'primary' | 'supporting';
  tier: 'P0' | 'P1' | 'P2' | 'P3';
  surfaceClass: string;
  href: string;
  title: LocalizedText;
  description: LocalizedText;
  placements: string[];
};

type AuthoritySurfaceData = {
  surfaces: AuthoritySurfaceRecord[];
  editorialQueue: Array<{
    id: string;
    surfaceId: string;
    priority: string;
    action: LocalizedText;
    why: LocalizedText;
  }>;
  linkingRules: Array<{
    id: string;
    rule: LocalizedText;
  }>;
};

export type ResolvedAuthoritySurface = Omit<AuthoritySurfaceRecord, 'href' | 'title' | 'description'> & {
  href: string;
  title: string;
  description: string;
};

const data = authoritySurfacesData as AuthoritySurfaceData;
const relatedAuthorityCollectionIdsBySlug: Record<string, string[]> = {
  'top-claude-code-skills': [
    'collection-windsurf',
    'collection-gemini',
    'collection-opencode',
    'collection-typescript',
  ],
  'top-windsurf-skills': [
    'collection-claude-code',
    'collection-gemini',
    'collection-opencode',
    'collection-typescript',
  ],
  'top-gemini-compatible-dev-tools-agent-workflow-skills': [
    'collection-opencode',
    'collection-claude-code',
    'collection-framework',
    'collection-nextjs',
  ],
  'top-opencode-workflow-tools-companion-integrations': [
    'collection-gemini',
    'collection-claude-code',
    'collection-framework',
    'collection-python',
  ],
  'top-nextjs-ai-tools-full-stack-developer-workflows': [
    'collection-react',
    'collection-typescript',
    'collection-python',
    'collection-devops',
  ],
  'top-python-ai-agent-tools-developer-workflows': [
    'collection-typescript',
    'collection-nextjs',
    'collection-devops',
    'collection-framework',
  ],
  'top-react-ai-tools-ui-workflows-component-development': [
    'collection-nextjs',
    'collection-typescript',
    'collection-community',
    'collection-claude-code',
  ],
  'top-typescript-ai-tools-developer-workflows': [
    'collection-nextjs',
    'collection-react',
    'collection-framework',
    'collection-devops',
  ],
  'top-rust-ai-tools-systems-workflows-reliability': [
    'collection-devops',
    'collection-framework',
    'collection-community',
    'collection-typescript',
  ],
  'top-devops-operations-automation-tools': [
    'collection-rust',
    'collection-framework',
    'collection-python',
    'collection-nextjs',
  ],
  'top-frameworks-sdk-foundations-agents': [
    'collection-devops',
    'collection-typescript',
    'collection-community',
    'collection-gemini',
  ],
  'top-community-contributed-ai-agent-skills': [
    'collection-framework',
    'collection-react',
    'collection-claude-code',
    'collection-windsurf',
  ],
};

const collectionRecoverySurfaceIdsBySlug: Record<string, string[]> = {
  'top-official-ai-skills-trusted-tools': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-official-ai-agent-skills-guide',
    'blog-ide-comparison',
  ],
  'top-cursor-compatible-skills-workflow-integrations': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-ide-comparison',
    'collection-official-trusted-tools',
  ],
  'top-claude-code-skills': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-ide-comparison',
    'collection-official-trusted-tools',
  ],
  'top-windsurf-skills': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-ide-comparison',
    'collection-official-trusted-tools',
  ],
  'top-gemini-compatible-dev-tools-agent-workflow-skills': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'solution-workflow-automation',
    'blog-ide-comparison',
  ],
  'top-codex-workflow-skills-developer-integrations': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'solution-workflow-automation',
    'collection-official-trusted-tools',
  ],
  'top-openai-powered-ai-agent-tools': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-official-ai-agent-skills-guide',
    'collection-official-trusted-tools',
  ],
  'top-github-copilot-companion-skills-dev-tools': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-ide-comparison',
    'collection-official-trusted-tools',
  ],
  'top-opencode-workflow-tools-companion-integrations': [
    'docs-cli-overview',
    'solution-agent-workflows',
    'solution-workflow-automation',
    'collection-agent-workflows',
  ],
  'top-cli-terminal-ai-agent-tools': [
    'docs-cli-overview',
    'solution-process-automation',
    'solution-agent-workflows',
    'blog-how-to-install-ai-agent-skills',
  ],
  'top-agent-workflow-automation-tools': [
    'solution-workflow-automation',
    'solution-process-automation',
    'docs-cli-overview',
    'collection-agent-workflows',
  ],
  'top-orchestration-platforms-agent-execution': [
    'solution-process-automation',
    'solution-agent-workflows',
    'docs-cli-overview',
    'collection-agent-workflows',
  ],
  'top-nextjs-ai-tools-full-stack-developer-workflows': [
    'solution-workflow-automation',
    'docs-cli-overview',
    'solution-agent-workflows',
    'collection-official-trusted-tools',
  ],
  'top-python-ai-agent-tools-developer-workflows': [
    'solution-data-extraction',
    'solution-process-automation',
    'docs-cli-overview',
    'collection-agent-workflows',
  ],
  'top-react-ai-tools-ui-workflows-component-development': [
    'solution-workflow-automation',
    'docs-cli-overview',
    'solution-agent-workflows',
    'blog-ide-comparison',
  ],
  'top-typescript-ai-tools-developer-workflows': [
    'solution-workflow-automation',
    'solution-process-automation',
    'docs-cli-overview',
    'collection-agent-workflows',
  ],
  'top-rust-ai-tools-systems-workflows-reliability': [
    'solution-process-automation',
    'solution-data-extraction',
    'docs-cli-overview',
    'collection-official-trusted-tools',
  ],
  'top-devops-operations-automation-tools': [
    'solution-process-automation',
    'solution-workflow-automation',
    'docs-cli-overview',
    'collection-official-trusted-tools',
  ],
  'top-developer-tooling-ai-agent-work': [
    'solution-workflow-automation',
    'solution-process-automation',
    'docs-cli-overview',
    'collection-official-trusted-tools',
  ],
  'top-frameworks-sdk-foundations-agents': [
    'solution-agent-workflows',
    'solution-process-automation',
    'docs-cli-overview',
    'blog-official-ai-agent-skills-guide',
  ],
  'top-community-contributed-ai-agent-skills': [
    'collection-agent-workflows',
    'solution-agent-workflows',
    'blog-official-ai-agent-skills-guide',
    'docs-cli-overview',
  ],
};

const defaultCollectionRecoverySurfaceIds = [
  'docs-cli-overview',
  'solution-agent-workflows',
  'solution-workflow-automation',
  'collection-official-trusted-tools',
  'collection-agent-workflows',
  'blog-ide-comparison',
];

export function resolveAuthorityText(text: LocalizedText, locale: string): string {
  return text[locale] || (locale.startsWith('zh') ? text.zh : text.en) || text.en || Object.values(text)[0] || '';
}

export function resolveAuthorityHref(locale: string, hrefTemplate: string): string {
  return hrefTemplate.replaceAll('{locale}', locale);
}

function resolveSurface(locale: string, surface: AuthoritySurfaceRecord): ResolvedAuthoritySurface {
  return {
    id: surface.id,
    role: surface.role,
    tier: surface.tier,
    surfaceClass: surface.surfaceClass,
    placements: surface.placements,
    href: resolveAuthorityHref(locale, surface.href),
    title: resolveAuthorityText(surface.title, locale),
    description: resolveAuthorityText(surface.description, locale),
  };
}

function getSurfaceSlug(surface: Pick<ResolvedAuthoritySurface, 'href'>): string {
  return surface.href.split('/').filter(Boolean).pop() || '';
}

export function getAuthoritySurfaceEntries(
  locale: string,
  options: {
    ids?: string[];
    placement?: string;
    includeSupporting?: boolean;
  } = {},
): ResolvedAuthoritySurface[] {
  const idOrder = new Map((options.ids || []).map((id, index) => [id, index]));
  const filtered = data.surfaces.filter((surface) => {
    if (!options.includeSupporting && surface.role !== 'primary') return false;
    if (options.ids && options.ids.length > 0 && !idOrder.has(surface.id)) return false;
    if (options.placement && !surface.placements.includes(options.placement)) return false;
    return true;
  });

  const sorted =
    options.ids && options.ids.length > 0
      ? filtered.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
      : filtered;

  return sorted.map((surface) => resolveSurface(locale, surface));
}

export function getRelatedAuthorityCollectionEntries(
  locale: string,
  canonicalSlug: string,
  limit = 4,
): ResolvedAuthoritySurface[] {
  const prioritizedIds = relatedAuthorityCollectionIdsBySlug[canonicalSlug] || [];
  const prioritized = getAuthoritySurfaceEntries(locale, { ids: prioritizedIds }).filter(
    (surface) => surface.surfaceClass === 'collection' && getSurfaceSlug(surface) !== canonicalSlug,
  );

  if (prioritized.length >= limit) {
    return prioritized.slice(0, limit);
  }

  const seen = new Set(prioritized.map((surface) => surface.id));
  const fallback = getAuthoritySurfaceEntries(locale, { placement: 'collections' }).filter(
    (surface) =>
      surface.surfaceClass === 'collection' && getSurfaceSlug(surface) !== canonicalSlug && !seen.has(surface.id),
  );

  return [...prioritized, ...fallback].slice(0, limit);
}

export function getCollectionRecoveryPathEntries(
  locale: string,
  canonicalSlug: string,
  options: {
    excludeHrefs?: string[];
    limit?: number;
  } = {},
): ResolvedAuthoritySurface[] {
  const limit = options.limit ?? 4;
  const excludedHrefs = new Set(options.excludeHrefs || []);
  const prioritizedIds = collectionRecoverySurfaceIdsBySlug[canonicalSlug] || [];
  const prioritized =
    prioritizedIds.length > 0
      ? getAuthoritySurfaceEntries(locale, { ids: prioritizedIds }).filter(
          (surface) => !excludedHrefs.has(surface.href) && getSurfaceSlug(surface) !== canonicalSlug,
        )
      : [];

  if (prioritized.length >= limit) {
    return prioritized.slice(0, limit);
  }

  const seen = new Set(prioritized.map((surface) => surface.id));
  const fallback = getAuthoritySurfaceEntries(locale, { ids: defaultCollectionRecoverySurfaceIds }).filter(
    (surface) => !seen.has(surface.id) && !excludedHrefs.has(surface.href) && getSurfaceSlug(surface) !== canonicalSlug,
  );

  return [...prioritized, ...fallback].slice(0, limit);
}

export function getAuthorityLinkingRules(locale: string): string[] {
  return data.linkingRules.map((rule) => resolveAuthorityText(rule.rule, locale));
}

export function getAuthorityEditorialQueue(locale: string): Array<{
  id: string;
  surfaceId: string;
  priority: string;
  action: string;
  why: string;
}> {
  return data.editorialQueue.map((item) => ({
    id: item.id,
    surfaceId: item.surfaceId,
    priority: item.priority,
    action: resolveAuthorityText(item.action, locale),
    why: resolveAuthorityText(item.why, locale),
  }));
}
