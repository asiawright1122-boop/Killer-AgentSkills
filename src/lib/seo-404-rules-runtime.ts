/**
 * SEO 404 rules runtime loader.
 *
 * Loads seo-404-rules.json from KV at runtime (production) or from local JSON
 * file in dev mode. This prevents the bundler from inlining the ~60 KiB JSON
 * file into the Worker bundle.
 */

export interface Seo404Rule {
  pattern: string;
  type: 'redirect301' | 'gone410' | 'rewrite';
  target?: string;
  statusCode?: number;
}

let _rulesCache: Seo404Rule[] | null = null;
let _rulesCacheTime = 0;

function shouldPreferLocalRuntimeData(): boolean {
  return import.meta.env?.DEV === true || typeof process !== 'undefined';
}

async function readLocalSeo404Rules(): Promise<Seo404Rule[] | null> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const filePath = path.resolve(process.cwd(), 'data/seo-404-rules.json');
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Seo404Rule[];
}

export async function getSeo404Rules(env?: { SKILLS_CACHE?: KVNamespace }): Promise<Seo404Rule[]> {
  if (_rulesCache && Date.now() - _rulesCacheTime < 60000) {
    return _rulesCache;
  }

  const isDevRuntime = shouldPreferLocalRuntimeData();

  if (isDevRuntime) {
    try {
      const localRules = await readLocalSeo404Rules();
      if (localRules) {
        _rulesCache = localRules;
        _rulesCacheTime = Date.now();
        return _rulesCache;
      }
    } catch {
      // Ignore errors and fall through to KV.
    }
  }

  // Try KV first (production)
  if (env?.SKILLS_CACHE) {
    try {
      const raw = await env.SKILLS_CACHE.get('seo-404-rules');
      if (raw) {
        _rulesCache = JSON.parse(raw) as Seo404Rule[];
        _rulesCacheTime = Date.now();
        return _rulesCache;
      }
    } catch {
      // Ignore KV errors
    }
  }

  // Fallback: local file (dev mode)
  if (isDevRuntime) {
    try {
      const localRules = await readLocalSeo404Rules();
      if (localRules) {
        _rulesCache = localRules;
        _rulesCacheTime = Date.now();
        return _rulesCache;
      }
    } catch {
      // Ignore errors
    }
  }

  return [];
}

export function clearSeo404RulesCache(): void {
  _rulesCache = null;
  _rulesCacheTime = 0;
}

/** Inject pre-loaded data (used by tests to bypass KV/DEV requirements). */
export function setSeo404RulesCache(data: Seo404Rule[]): void {
  _rulesCache = data;
  _rulesCacheTime = Date.now();
}
