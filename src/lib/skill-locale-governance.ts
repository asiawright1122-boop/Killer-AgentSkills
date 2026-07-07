// getRuntimeEnv from './runtime-env' is available for future use
// when governance needs env-level access

export interface SkillLocaleGovernanceRecord {
  owner: string;
  routePath: string;
  canonicalLocale: string | null;
  publishedLocales: string[];
}

// Shared governance map used by both middleware and skill-locale-link
export const skillLocaleGovernanceMap = new Map<string, SkillLocaleGovernanceRecord>();

let _governanceLoaded = false;
let _governanceLoadPromise: Promise<void> | null = null;

function shouldPreferLocalRuntimeData(): boolean {
  return import.meta.env?.DEV === true || typeof process !== 'undefined';
}

async function readLocalSkillLocaleGovernance(): Promise<unknown | null> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const localPath = path.resolve(process.cwd(), 'data/seo-skill-locale-governance.json');
  if (!fs.existsSync(localPath)) return null;

  const content = fs.readFileSync(localPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load skill locale governance data from KV (production) or local file (dev).
 * Populates the shared `skillLocaleGovernanceMap`.
 */
export async function loadSkillLocaleGovernance(env: { SKILLS_CACHE?: KVNamespace }): Promise<void> {
  if (_governanceLoaded) return;
  if (_governanceLoadPromise) return _governanceLoadPromise;

  _governanceLoadPromise = (async () => {
    try {
      const isDevRuntime = shouldPreferLocalRuntimeData();

      if (isDevRuntime) {
        try {
          const localData = await readLocalSkillLocaleGovernance();
          if (localData) {
            populateGovernanceMap(localData);
            _governanceLoaded = true;
            return;
          }
        } catch {
          // Ignore local fallback errors
        }
      }

      // Try KV first (production)
      if (env?.SKILLS_CACHE) {
        const raw = await env.SKILLS_CACHE.get('seo-skill-locale-governance');
        if (raw) {
          const data = JSON.parse(raw);
          populateGovernanceMap(data);
          _governanceLoaded = true;
          return;
        }
      }

      // Fallback: local file (dev mode only)
      if (isDevRuntime) {
        try {
          const localData = await readLocalSkillLocaleGovernance();
          if (localData) {
            populateGovernanceMap(localData);
            _governanceLoaded = true;
            return;
          }
        } catch {
          // Ignore local fallback errors
        }
      }

      console.warn('[Governance] No skill locale governance data available');
    } catch (e) {
      console.error('[Governance] Failed to load skill locale governance:', e);
    } finally {
      _governanceLoaded = true;
    }
  })();

  return _governanceLoadPromise;
}

function populateGovernanceMap(data: unknown): void {
  const records = ((data as { skills?: unknown[]; records?: unknown[] }).skills ??
    (data as { records?: unknown[] }).records ??
    []) as unknown[];

  for (const record of records) {
    const typedRecord = record as Partial<SkillLocaleGovernanceRecord>;
    const owner = typeof typedRecord.owner === 'string' ? typedRecord.owner.trim() : '';
    const routePath = typeof typedRecord.routePath === 'string' ? typedRecord.routePath.trim() : '';
    if (!owner || !routePath) continue;

    const canonicalLocale =
      typeof typedRecord.canonicalLocale === 'string' && typedRecord.canonicalLocale.trim().length > 0
        ? typedRecord.canonicalLocale.trim().toLowerCase()
        : null;
    const publishedLocales = Array.isArray(typedRecord.publishedLocales)
      ? typedRecord.publishedLocales
          .filter((locale): locale is string => typeof locale === 'string' && locale.trim().length > 0)
          .map((locale) => locale.trim().toLowerCase())
      : [];

    skillLocaleGovernanceMap.set(`${owner.toLowerCase()}/${routePath.toLowerCase()}`, {
      owner,
      routePath,
      canonicalLocale,
      publishedLocales,
    });
  }
}

/**
 * Check if governance data has been loaded (populated).
 */
export function isGovernanceLoaded(): boolean {
  return _governanceLoaded;
}

/**
 * Inject pre-loaded governance data (used by tests to bypass KV/DEV requirements).
 * Accepts the same raw JSON shape as the KV/local-file sources.
 */
export function setSkillLocaleGovernanceCache(data: unknown): void {
  skillLocaleGovernanceMap.clear();
  populateGovernanceMap(data);
  _governanceLoaded = true;
}

/**
 * Local dev eager load: populate governance map from local file on import in dev mode.
 * This ensures synchronous access works in local dev without KV.
 */
if (shouldPreferLocalRuntimeData()) {
  loadSkillLocaleGovernance({}).catch(() => {
    // Ignore — will retry on first request
  });
}
