import * as fs from 'fs';
import * as path from 'path';
import { LOCALE_NAMES, NON_DEFAULT_LOCALES } from '../../config/locales.mjs';

// ===== Core Constants =====
export const SUPPORTED_LOCALES = [...NON_DEFAULT_LOCALES];
export const NON_DEFAULT_SCRIPT_LOCALES = [...NON_DEFAULT_LOCALES];
export const GITHUB_API = 'https://api.github.com';
export const KV_NAMESPACE_ID = process.env.CLOUDFLARE_SKILLS_CACHE_NAMESPACE_ID || '6130f39a06e14319b0ee4becb0d09842';

// ===== Official Repos =====
const officialReposPath = path.join(process.cwd(), 'data/official-repos.json');
export const OFFICIAL_REPOS: Array<{ owner: string; repo: string; skillsPath: string }> = fs.existsSync(
  officialReposPath,
)
  ? JSON.parse(fs.readFileSync(officialReposPath, 'utf-8'))
  : [];

export function isOfficialRepo(owner: string, repo?: string): boolean {
  if (!repo) {
    return OFFICIAL_REPOS.some((r) => r.owner === owner);
  }
  return OFFICIAL_REPOS.some((r) => r.owner === owner && r.repo === repo);
}

// ===== Validation Constants =====
// NOTE: These should stay in sync with src/lib/shared/validation.ts (single source of truth).
// Use precise phrases (e.g. 'algorithm interview') instead of bare 'algorithm'
// to avoid false-positiving legitimate skills like 'algorithmic-art'.
export const EXCLUDE_KEYWORDS = [
  'interview',
  'notes',
  'blog',
  'resume',
  'portfolio',
  'leetcode',
  'algorithm interview',
  'algorithm questions',
  'algorithm practice',
  'tutorial',
  'course',
  'book',
  'learning',
  'study',
  'guide',
  'product manager',
  'product management',
  'mvp builder',
  'mvp-generator',
  'startup',
  'studiojinsei', // Added to prevent crawling leaked API keys
  'cheatsheet',
  'cheat sheet',
  'awesome list',
  'dotfiles',
  'my dotfiles',
  'personal config',
];

export const SUSPICIOUS_NAMES = ['test', 'demo', 'example', 'hello-world', 'todo', 'temp', 'dummy'];

export const SKILL_HEADERS = [
  '# usage',
  '## usage',
  '### usage',
  '# input',
  '## input',
  '### input',
  '# parameters',
  '## parameters',
  '### parameters',
  '# arguments',
  '## arguments',
  '### arguments',
  '# output',
  '## output',
  '### output',
  '# actions',
  '## actions',
  '### actions',
  '# instructions',
  '## instructions',
  '### instructions',
  '# api',
  '## api',
  '# examples',
  '## examples',
  '### examples',
  '# guidelines',
  '## guidelines',
  '### guidelines',
  '# common commands',
  '## common commands',
  '### common commands',
  '# when to use',
  '## when to use',
  '### when to use',
];

export const FUNCTIONAL_KEYWORDS = [
  'action',
  'input',
  'output',
  'trigger',
  'api',
  'tool',
  'schema',
  'guideline',
  'instruction',
  'command',
];

// ===== Category Mapping Rules =====
export const CATEGORY_RULES: Record<string, string[]> = {
  finance: [
    'finance',
    'money',
    'stock',
    'crypto',
    'currency',
    'market',
    'invest',
    'bank',
    'economy',
    'price',
    'defi',
    'trading',
    'wallet',
  ],
  data: [
    'data',
    'analytics',
    'database',
    'sql',
    'visualization',
    'chart',
    'scrape',
    'crawling',
    'etl',
    'pipeline',
    'bi',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
  ],
  browser: [
    'browser',
    'scraping',
    'puppeteer',
    'selenium',
    'playwright',
    'chrome',
    'firefox',
    'crawler',
    'headless',
    'browser-use',
  ],
  productivity: [
    'productivity',
    'workflow',
    'utility',
    'manager',
    'organize',
    'time',
    'calendar',
    'email',
    'notion',
    'slack',
    'schedule',
    'task',
  ],
  design: ['design', 'ui', 'ux', 'frontend', 'css', 'style', 'art', 'creative', 'image', 'figma', 'tailwind'],
  devops: [
    'devops',
    'cloud',
    'kubernetes',
    'docker',
    'aws',
    'azure',
    'gcp',
    'deploy',
    'ci/cd',
    'server',
    'linux',
    'hosting',
    'cloudflare',
  ],
  security: [
    'security',
    'auth',
    'authentication',
    'authorization',
    'privacy',
    'encryption',
    'oauth',
    'password',
    'jwt',
  ],
  communication: ['communication', 'chat', 'message', 'discord', 'telegram', 'whatsapp', 'sms', 'social'],
  ai: [
    'ai',
    'machine-learning',
    'nlp',
    'llm',
    'gpt',
    'agent',
    'agents',
    'openai',
    'anthropic',
    'claude',
    'gemini',
    'llama',
    'prompt',
    'rag',
  ],
  developer: [
    'development',
    'coding',
    'programming',
    'git',
    'github',
    'api',
    'sdk',
    'cli',
    'framework',
    'library',
    'language',
    'test',
    'debug',
    'code-review',
    'ide',
    'mcp',
    'typescript',
    'python',
    'javascript',
    'react',
    'node',
    'rust',
    'go',
    'ruby',
  ],
  documentation: ['documentation', 'markdown', 'docs', 'readme', 'pdf'],
};

// ===== Language Names (for translation UIs) =====
export const LANG_NAMES: Record<string, string> = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [locale, LOCALE_NAMES[locale]]),
);
