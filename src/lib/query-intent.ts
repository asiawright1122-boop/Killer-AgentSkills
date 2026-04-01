type IntentConfig = {
  id: string;
  patterns: RegExp[];
  keywords: string[];
};

export type QueryIntent = {
  id: string;
  displayTerm: string;
  description: string;
  keywords: string[];
};

const INTENTS: IntentConfig[] = [
  {
    id: 'mcp-servers',
    patterns: [/\bmcp\b/i, /\bmcp\s*server/i, /model\s*context\s*protocol/i],
    keywords: ['ai agent skills', 'developer workflow skills', 'mcp integrations'],
  },
  {
    id: 'workflow-automation',
    patterns: [/\bworkflow\s*automation\b/i, /\bautomated\s*workflow/i, /\bagentic\s*workflow/i, /\bworkflow\s*agent/i],
    keywords: ['workflow automation', 'agent workflow', 'automation workflow', 'ai workflow tools'],
  },
  {
    id: 'process-automation',
    patterns: [
      /\bprocess\s*automation\b/i,
      /\bbusiness\s*process\b/i,
      /\bworkflow\s*process/i,
      /\bsop\s*automation\b/i,
    ],
    keywords: ['process automation', 'business process automation', 'sop automation', 'workflow process'],
  },
  {
    id: 'document-automation',
    patterns: [
      /\bdocument\s*automation\b/i,
      /\breport\s*automation\b/i,
      /\bpdf\s*automation\b/i,
      /\bdocx?\s*automation\b/i,
    ],
    keywords: ['document automation', 'report automation', 'pdf automation', 'document workflow'],
  },
  {
    id: 'browser-automation',
    patterns: [/\bbrowser\s*automation\b/i, /\bweb\s*automation\b/i, /\bsite\s*automation\b/i, /\bweb\s*scraping\b/i],
    keywords: ['browser automation', 'web automation', 'web scraping', 'site workflow'],
  },
  {
    id: 'data-extraction',
    patterns: [/\bdata\s*extraction\b/i, /\bdata\s*pipeline\b/i, /\bdata\s*workflow\b/i, /\betl\b/i],
    keywords: ['data extraction', 'data workflow', 'etl automation', 'reporting automation'],
  },
  {
    id: 'skill-installation',
    patterns: [
      /\binstall\s+(an?\s+)?(ai\s+)?(agent\s+)?skill/i,
      /\bskill\s*installation\b/i,
      /\bskill\s*setup\b/i,
      /\bsetup\s+(an?\s+)?(ai\s+)?(agent\s+)?skill/i,
      /\bkiller-skills\s+add\b/i,
    ],
    keywords: ['install AI agent skills', 'skill installation', 'agent setup', 'killer-skills add'],
  },
  {
    id: 'workflow-templates',
    patterns: [
      /\bworkflow\s*template/i,
      /\bautomation\s*template/i,
      /\bskill\s*template/i,
      /\bagent\s*playbook/i,
      /\bworkflow\s*starter/i,
    ],
    keywords: ['workflow templates', 'automation templates', 'skill templates', 'agent playbook'],
  },
  {
    id: 'ai-agent-skills',
    patterns: [/\bai\s*agent\s*skills?\b/i, /\bagent\s*skills?\b/i, /ai\s*skills?/i],
    keywords: ['ai agent skills', 'agent skills', 'ai coding assistant'],
  },
  {
    id: 'claude-code-skills',
    patterns: [/\bclaude\s*code\b/i, /\bclaude\s*skills?\b/i],
    keywords: ['claude code skills', 'claude tools', 'claude code setup'],
  },
  {
    id: 'cursor-skills',
    patterns: [/\bcursor\b/i, /\bcursor\s*skills?\b/i],
    keywords: ['cursor skills', 'cursor ai tools', 'cursor setup'],
  },
  {
    id: 'windsurf-skills',
    patterns: [/\bwindsurf\b/i, /\bwindsurf\s*skills?\b/i],
    keywords: ['windsurf skills', 'windsurf ai tools', 'windsurf setup'],
  },
];

const normalizeQuery = (query: string) => query.toLowerCase().replace(/\s+/g, ' ').trim();

export function resolveQueryIntent(query: string, t: (k: string, fb?: string) => string): QueryIntent | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const matched = INTENTS.find((intent) => intent.patterns.some((pattern) => pattern.test(normalized)));
  if (!matched) return null;

  return {
    id: matched.id,
    displayTerm: t(`Query.Intent.${matched.id}.label`, matched.id),
    description: t(`Query.Intent.${matched.id}.description`, ''),
    keywords: matched.keywords,
  };
}
