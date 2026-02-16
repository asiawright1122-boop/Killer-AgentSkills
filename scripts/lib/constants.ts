import * as fs from 'fs';
import * as path from 'path';

// ===== Core Constants =====
export const SUPPORTED_LOCALES = ["zh", "ja", "ko", "es", "fr", "de", "pt", "ru", "ar"];
export const GITHUB_API = 'https://api.github.com';
export const KV_NAMESPACE_ID = 'eb71984285c54c3488c17a32391b9fe5';

// ===== Official Repos =====
const officialReposPath = path.join(process.cwd(), 'data/official-repos.json');
export const OFFICIAL_REPOS: Array<{ owner: string; repo: string; skillsPath: string }> = fs.existsSync(officialReposPath)
    ? JSON.parse(fs.readFileSync(officialReposPath, 'utf-8'))
    : [];

export function isOfficialRepo(owner: string, repo?: string): boolean {
    if (!repo) {
        return OFFICIAL_REPOS.some((r) => r.owner === owner);
    }
    return OFFICIAL_REPOS.some((r) => r.owner === owner && r.repo === repo);
}

// ===== Validation Constants =====
export const EXCLUDE_KEYWORDS = [
    'interview', 'notes', 'blog', 'resume', 'portfolio', 'leetcode',
    'algorithm', 'tutorial', 'course', 'book', 'learning', 'study', 'guide'
];

export const SUSPICIOUS_NAMES = [
    'test', 'demo', 'example', 'hello-world', 'todo', 'temp', 'dummy'
];

export const SKILL_HEADERS = [
    '# usage', '## usage', '### usage',
    '# input', '## input', '### input',
    '# parameters', '## parameters', '### parameters',
    '# arguments', '## arguments', '### arguments',
    '# output', '## output', '### output',
    '# actions', '## actions', '### actions',
    '# instructions', '## instructions', '### instructions',
    '# api', '## api',
    '# examples', '## examples', '### examples',
    '# guidelines', '## guidelines', '### guidelines',
    '# common commands', '## common commands', '### common commands',
    '# when to use', '## when to use', '### when to use'
];

export const FUNCTIONAL_KEYWORDS = [
    'action', 'input', 'output', 'trigger', 'api', 'tool',
    'schema', 'guideline', 'instruction', 'command'
];

// ===== Category Mapping Rules =====
export const CATEGORY_RULES: Record<string, string[]> = {
    'ai': ['ai', 'llm', 'machine-learning', 'gpt', 'openai', 'anthropic', 'claude', 'gemini', 'model'],
    'development': ['development', 'dev-tools', 'debugging', 'linter', 'typescript', 'javascript', 'python', 'go', 'rust', 'backend', 'frontend'],
    'testing': ['testing', 'test', 'jest', 'vitest', 'pytest', 'e2e', 'unit-test'],
    'data': ['data', 'analytics', 'analysis', 'visualization', 'chart', 'pandas', 'sql'],
    'database': ['database', 'db', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'qdrant', 'vector-db'],
    'search': ['search', 'seo', 'exa', 'google-search', 'bing'],
    'web-scraping': ['scraping', 'crawler', 'spider', 'puppeteer', 'playwright', 'browser-use'],
    'browser': ['browser', 'automation', 'chrome'],
    'api': ['api', 'rest', 'graphql', 'http', 'request'],
    'devops': ['devops', 'docker', 'kubernetes', 'aws', 'cloud', 'deploy', 'ci-cd', 'terraform', 'infrastructure'],
    'security': ['security', 'auth', 'authentication', 'oauth', 'secret', 'vulnerability'],
    'git': ['git', 'github', 'version-control', 'commit', 'pr'],
    'code-review': ['code-review', 'review'],
    'design': ['design', 'ui', 'ux', 'css', 'tailwind', 'component', 'figma', 'svg', 'image'],
    'productivity': ['productivity', 'efficiency', 'workflow', 'automation', 'tool', 'utility', 'notion', 'obsidian'],
    'cli': ['cli', 'terminal', 'shell', 'bash', 'zsh', 'command-line'],
    'documentation': ['documentation', 'docs', 'markdown'],
};

// ===== Language Names (for translation UIs) =====
export const LANG_NAMES: Record<string, string> = {
    zh: 'Chinese (Simplified)',
    ja: 'Japanese',
    ko: 'Korean',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic'
};
