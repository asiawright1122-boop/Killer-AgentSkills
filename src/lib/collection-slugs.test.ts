import { describe, expect, it } from 'vitest';
import automationCollectionData from '../content/collections/top-automation-mcp-servers.json';
import aiAgentsCollectionData from '../content/collections/top-ai-agents-mcp-servers.json';
import cliCollectionData from '../content/collections/top-cli-mcp-servers.json';
import codexCollectionData from '../content/collections/top-codex-mcp-servers.json';
import communityCollectionData from '../content/collections/top-community-mcp-servers.json';
import copilotCollectionData from '../content/collections/top-copilot-mcp-servers.json';
import cursorCollectionData from '../content/collections/top-cursor-mcp-servers.json';
import developerToolsCollectionData from '../content/collections/top-developer-tools-mcp-servers.json';
import devopsCollectionData from '../content/collections/top-devops-mcp-servers.json';
import mcpFrameworksCollectionData from '../content/collections/top-mcp-server-mcp-servers.json';
import mcpUtilitiesCollectionData from '../content/collections/top-mcp-mcp-servers.json';
import frameworkCollectionData from '../content/collections/top-framework-mcp-servers.json';
import collectionCanonicalMap from '../../data/seo-collection-canonical-map.json';
import geminiCliCollectionData from '../content/collections/top-gemini-cli-mcp-servers.json';
import geminiCollectionData from '../content/collections/top-gemini-mcp-servers.json';
import hacktoberfestCollectionData from '../content/collections/top-hacktoberfest-mcp-servers.json';
import mcp2026CollectionData from '../content/collections/top-mcp-servers-2026.json';
import nextjsCollectionData from '../content/collections/top-nextjs-mcp-servers.json';
import officialCollectionData from '../content/collections/top-official-mcp-servers.json';
import openaiCollectionData from '../content/collections/top-openai-mcp-servers.json';
import opencodeCollectionData from '../content/collections/top-opencode-mcp-servers.json';
import orchestrationCollectionData from '../content/collections/top-orchestration-mcp-servers.json';
import productivityCollectionData from '../content/collections/top-productivity-mcp-servers.json';
import promptEngineeringCollectionData from '../content/collections/top-prompt-engineering-mcp-servers.json';
import pythonCollectionData from '../content/collections/top-python-mcp-servers.json';
import reactCollectionData from '../content/collections/top-react-mcp-servers.json';
import rustCollectionData from '../content/collections/top-rust-mcp-servers.json';
import typescriptCollectionData from '../content/collections/top-typescript-mcp-servers.json';
import workflowCollectionData from '../content/collections/top-workflow-mcp-servers.json';
import { getCollectionCanonicalSlug, getCollectionLegacySlugs, resolveCollectionBySlug } from './collection-slugs';

type MockCollection = {
  id: string;
  data: {
    canonicalSlug?: string;
    legacySlugs?: string[];
  };
};

describe('getCollectionCanonicalSlug', () => {
  it('falls back to the file slug when no canonical slug is configured', () => {
    const collection: MockCollection = {
      id: 'top-community-skills.json',
      data: {},
    };

    expect(getCollectionCanonicalSlug(collection)).toBe('top-community-skills');
  });

  it('returns explicit canonical slugs for migrated skills-first collections', () => {
    const collection: MockCollection = {
      id: 'top-agentic-ai-mcp-servers.json',
      data: {
        canonicalSlug: 'top-agentic-ai-platforms-orchestration-tools',
      },
    };

    expect(getCollectionCanonicalSlug(collection)).toBe('top-agentic-ai-platforms-orchestration-tools');
  });

  it('keeps the current canonical slugs for the remaining mcp-mcp overlap pair', () => {
    expect(getCollectionCanonicalSlug({ id: 'top-mcp-mcp-servers.json', data: mcpUtilitiesCollectionData })).toBe(
      'top-ai-agent-workflow-skills-integrations-utilities',
    );
    expect(
      getCollectionCanonicalSlug({ id: 'top-mcp-server-mcp-servers.json', data: mcpFrameworksCollectionData }),
    ).toBe('top-ai-agent-integration-frameworks-bridges-infra-tooling');
  });
});

describe('getCollectionLegacySlugs', () => {
  it('treats the file slug as an implicit legacy slug when canonical slug differs', () => {
    const collection: MockCollection = {
      id: 'top-mcp-mcp-servers.json',
      data: {
        canonicalSlug: 'top-ai-agent-workflow-skills-integrations-utilities',
      },
    };

    expect(getCollectionLegacySlugs(collection)).toEqual(['top-mcp-mcp-servers']);
  });

  it('merges explicit legacy slugs without duplicating the canonical slug', () => {
    const collection: MockCollection = {
      id: 'top-mcp-server-mcp-servers.json',
      data: {
        canonicalSlug: 'top-ai-agent-integration-frameworks-bridges-infra-tooling',
        legacySlugs: ['top-mcp-server-mcp-servers', 'top-ai-agent-integration-frameworks-bridges-infra-tooling'],
      },
    };

    expect(getCollectionLegacySlugs(collection)).toEqual(['top-mcp-server-mcp-servers']);
  });
});

describe('collection canonical map artifact', () => {
  it('records the current keep-distinct decision for the remaining mcp overlap pair', () => {
    expect(collectionCanonicalMap.generatedAt).toBe('2026-03-19');
    expect(collectionCanonicalMap.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSlug: 'top-mcp-mcp-servers',
          decision: 'keep',
          canonicalSlug: 'top-ai-agent-workflow-skills-integrations-utilities',
          redirectPhase: 'later',
        }),
        expect.objectContaining({
          sourceSlug: 'top-mcp-server-mcp-servers',
          decision: 'keep',
          canonicalSlug: 'top-ai-agent-integration-frameworks-bridges-infra-tooling',
          redirectPhase: 'later',
        }),
      ]),
    );
  });
});

describe('resolveCollectionBySlug', () => {
  const collections: MockCollection[] = [
    {
      id: 'top-mcp-mcp-servers.json',
      data: {
        canonicalSlug: 'top-ai-agent-workflow-skills-integrations-utilities',
      },
    },
    {
      id: 'top-agentic-ai-mcp-servers.json',
      data: {
        canonicalSlug: 'top-agentic-ai-platforms-orchestration-tools',
      },
    },
    {
      id: 'top-ai-agents-mcp-servers.json',
      data: aiAgentsCollectionData,
    },
    {
      id: 'top-automation-mcp-servers.json',
      data: automationCollectionData,
    },
    {
      id: 'top-cli-mcp-servers.json',
      data: cliCollectionData,
    },
    {
      id: 'top-codex-mcp-servers.json',
      data: codexCollectionData,
    },
    {
      id: 'top-copilot-mcp-servers.json',
      data: copilotCollectionData,
    },
    {
      id: 'top-cursor-mcp-servers.json',
      data: cursorCollectionData,
    },
    {
      id: 'top-developer-tools-mcp-servers.json',
      data: developerToolsCollectionData,
    },
    {
      id: 'top-devops-mcp-servers.json',
      data: devopsCollectionData,
    },
    {
      id: 'top-framework-mcp-servers.json',
      data: frameworkCollectionData,
    },
    {
      id: 'top-gemini-cli-mcp-servers.json',
      data: geminiCliCollectionData,
    },
    {
      id: 'top-gemini-mcp-servers.json',
      data: geminiCollectionData,
    },
    {
      id: 'top-hacktoberfest-mcp-servers.json',
      data: hacktoberfestCollectionData,
    },
    {
      id: 'top-mcp-servers-2026.json',
      data: mcp2026CollectionData,
    },
    {
      id: 'top-nextjs-mcp-servers.json',
      data: nextjsCollectionData,
    },
    {
      id: 'top-official-mcp-servers.json',
      data: officialCollectionData,
    },
    {
      id: 'top-openai-mcp-servers.json',
      data: openaiCollectionData,
    },
    {
      id: 'top-opencode-mcp-servers.json',
      data: opencodeCollectionData,
    },
    {
      id: 'top-orchestration-mcp-servers.json',
      data: orchestrationCollectionData,
    },
    {
      id: 'top-productivity-mcp-servers.json',
      data: productivityCollectionData,
    },
    {
      id: 'top-prompt-engineering-mcp-servers.json',
      data: promptEngineeringCollectionData,
    },
    {
      id: 'top-python-mcp-servers.json',
      data: pythonCollectionData,
    },
    {
      id: 'top-react-mcp-servers.json',
      data: reactCollectionData,
    },
    {
      id: 'top-community-mcp-servers.json',
      data: communityCollectionData,
    },
    {
      id: 'top-rust-mcp-servers.json',
      data: rustCollectionData,
    },
    {
      id: 'top-typescript-mcp-servers.json',
      data: typescriptCollectionData,
    },
    {
      id: 'top-workflow-mcp-servers.json',
      data: workflowCollectionData,
    },
    {
      id: 'top-community-skills.json',
      data: {},
    },
  ];

  it('resolves legacy slugs to the collection and exposes the canonical slug', () => {
    const resolved = resolveCollectionBySlug(collections, 'top-mcp-mcp-servers');

    expect(resolved).not.toBeNull();
    expect(resolved?.canonicalSlug).toBe('top-ai-agent-workflow-skills-integrations-utilities');
    expect(resolved?.isCanonical).toBe(false);
    expect(resolved?.collection.id).toBe('top-mcp-mcp-servers.json');
  });

  it('resolves canonical slugs directly', () => {
    const resolved = resolveCollectionBySlug(collections, 'top-ai-agent-workflow-skills-integrations-utilities');

    expect(resolved).not.toBeNull();
    expect(resolved?.canonicalSlug).toBe('top-ai-agent-workflow-skills-integrations-utilities');
    expect(resolved?.isCanonical).toBe(true);
  });

  it('resolves additional skills-first legacy slugs to their canonical targets', () => {
    const resolved = resolveCollectionBySlug(collections, 'top-agentic-ai-mcp-servers');

    expect(resolved).not.toBeNull();
    expect(resolved?.canonicalSlug).toBe('top-agentic-ai-platforms-orchestration-tools');
    expect(resolved?.isCanonical).toBe(false);
  });

  it('merges overlapping ai-agents collection slugs into the agentic canonical target', () => {
    expect(resolveCollectionBySlug(collections, 'top-ai-agents-mcp-servers')?.canonicalSlug).toBe(
      'top-agentic-ai-platforms-orchestration-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-ai-agent-platforms-orchestration-tools')?.canonicalSlug).toBe(
      'top-agentic-ai-platforms-orchestration-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-agentic-ai-platforms-orchestration-tools')?.isCanonical).toBe(
      true,
    );
  });

  it('resolves third-batch legacy collection slugs to canonical workflow-first targets', () => {
    expect(resolveCollectionBySlug(collections, 'top-automation-mcp-servers')?.canonicalSlug).toBe(
      'top-agent-workflow-automation-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-cli-mcp-servers')?.canonicalSlug).toBe(
      'top-cli-terminal-ai-agent-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-codex-mcp-servers')?.canonicalSlug).toBe(
      'top-codex-workflow-skills-developer-integrations',
    );
    expect(resolveCollectionBySlug(collections, 'top-copilot-mcp-servers')?.canonicalSlug).toBe(
      'top-github-copilot-companion-skills-dev-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-cursor-mcp-servers')?.canonicalSlug).toBe(
      'top-cursor-compatible-skills-workflow-integrations',
    );
  });

  it('resolves fourth-batch legacy collection slugs to canonical workflow-first targets', () => {
    expect(resolveCollectionBySlug(collections, 'top-developer-tools-mcp-servers')?.canonicalSlug).toBe(
      'top-developer-tooling-ai-agent-work',
    );
    expect(resolveCollectionBySlug(collections, 'top-devops-mcp-servers')?.canonicalSlug).toBe(
      'top-devops-operations-automation-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-framework-mcp-servers')?.canonicalSlug).toBe(
      'top-frameworks-sdk-foundations-agents',
    );
    expect(resolveCollectionBySlug(collections, 'top-gemini-cli-mcp-servers')?.canonicalSlug).toBe(
      'top-gemini-cli-workflow-tools-terminal-automation-skills',
    );
    expect(resolveCollectionBySlug(collections, 'top-gemini-mcp-servers')?.canonicalSlug).toBe(
      'top-gemini-compatible-dev-tools-agent-workflow-skills',
    );
  });

  it('resolves fifth-batch legacy collection slugs to canonical workflow-first targets', () => {
    expect(resolveCollectionBySlug(collections, 'top-hacktoberfest-mcp-servers')?.canonicalSlug).toBe(
      'top-hacktoberfest-ai-skills-open-source-contributors',
    );
    expect(resolveCollectionBySlug(collections, 'top-nextjs-mcp-servers')?.canonicalSlug).toBe(
      'top-nextjs-ai-tools-full-stack-developer-workflows',
    );
    expect(resolveCollectionBySlug(collections, 'top-official-mcp-servers')?.canonicalSlug).toBe(
      'top-official-ai-skills-trusted-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-openai-mcp-servers')?.canonicalSlug).toBe(
      'top-openai-powered-ai-agent-tools',
    );
    expect(resolveCollectionBySlug(collections, 'top-opencode-mcp-servers')?.canonicalSlug).toBe(
      'top-opencode-workflow-tools-companion-integrations',
    );
  });

  it('resolves sixth-batch legacy collection slugs to canonical workflow-first targets', () => {
    expect(resolveCollectionBySlug(collections, 'top-orchestration-mcp-servers')?.canonicalSlug).toBe(
      'top-orchestration-platforms-agent-execution',
    );
    expect(resolveCollectionBySlug(collections, 'top-productivity-mcp-servers')?.canonicalSlug).toBe(
      'top-productivity-tools-ai-enabled-developers',
    );
    expect(resolveCollectionBySlug(collections, 'top-prompt-engineering-mcp-servers')?.canonicalSlug).toBe(
      'top-prompt-engineering-tools-agent-workflows',
    );
    expect(resolveCollectionBySlug(collections, 'top-python-mcp-servers')?.canonicalSlug).toBe(
      'top-python-ai-agent-tools-developer-workflows',
    );
    expect(resolveCollectionBySlug(collections, 'top-react-mcp-servers')?.canonicalSlug).toBe(
      'top-react-ai-tools-ui-workflows-component-development',
    );
  });

  it('resolves seventh-batch legacy collection slugs to canonical workflow-first targets', () => {
    expect(resolveCollectionBySlug(collections, 'top-community-mcp-servers')?.canonicalSlug).toBe(
      'top-community-skills-ai-utilities',
    );
    expect(resolveCollectionBySlug(collections, 'top-rust-mcp-servers')?.canonicalSlug).toBe(
      'top-rust-ai-tools-systems-workflows-reliability',
    );
    expect(resolveCollectionBySlug(collections, 'top-typescript-mcp-servers')?.canonicalSlug).toBe(
      'top-typescript-ai-tools-developer-workflows',
    );
    expect(resolveCollectionBySlug(collections, 'top-workflow-mcp-servers')?.canonicalSlug).toBe(
      'top-agent-workflow-building-tools',
    );
  });

  it('resolves top-mcp-servers-2026 legacy slug to canonical workflow-first target', () => {
    expect(resolveCollectionBySlug(collections, 'top-mcp-servers-2026')?.canonicalSlug).toBe(
      'top-ai-agent-workflow-skills-integrations-2026',
    );
  });

  it('returns null for unknown slugs', () => {
    expect(resolveCollectionBySlug(collections, 'missing-slug')).toBeNull();
  });
});
