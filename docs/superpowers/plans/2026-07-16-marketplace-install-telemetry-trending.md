# Marketplace Install Telemetry And Trending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-preserving successful CLI install telemetry, website install-action telemetry, a seven-day Trending ranking, platform-specific install commands, and clearer existing-route marketplace copy without expanding indexable URLs.

**Architecture:** A narrow event contract validates all CLI and web events. A dedicated D1 table stores daily HMAC-deduplicated interactions independently from the skills catalog, while a fail-open store module returns empty activity when D1 is unavailable. The Rankings route enriches its bounded skill list with recent activity and applies a pure Trending comparator; browser and CLI reporters submit events best-effort without affecting installation or clipboard behavior.

**Tech Stack:** Astro 6, TypeScript, Cloudflare Workers, D1, Workers KV rate limiting, Vitest, Playwright, Commander-based Node CLI.

## Global Constraints

- Keep successful CLI installs and website install actions as separate metrics and labels.
- Never store raw IP addresses, full user agents, local paths, credentials, repository contents, or stable device identifiers.
- Respect `DO_NOT_TRACK` and `KILLER_SKILLS_TELEMETRY=0|false|off|no`; skip all telemetry under `KILLER_SKILLS_TEST`.
- Telemetry failures must not fail or materially delay CLI installation, clipboard actions, rankings, or crawler responses.
- Only marketplace-admitted skills may appear in Trending.
- Trending must fall back exactly to Popular ordering when analytics is empty or unavailable.
- Keep the event table independent from `skills`; do not join analytics into core catalog queries or middleware.
- Do not add bulk indexable routes or sitemap entries. `/[locale]/popular?rank=trending` remains `noindex, follow`.
- Keep the daily GitHub skill harvesting workflow enabled.
- Use test-first red-green-refactor for every production behavior change.

---

## File Map

**New files**

- `db/migrations/2026-07-16-skill-interactions.sql`: forward-only production D1 migration.
- `src/lib/skill-interaction-events.ts`: event types, payload validation, user-agent family normalization, HMAC actor digest.
- `src/lib/skill-interaction-events.test.ts`: pure event contract and privacy tests.
- `src/lib/skill-interaction-store.ts`: D1 insert, recent metric query, and fail-open cache.
- `src/lib/skill-interaction-store.test.ts`: D1 SQL and failure behavior tests.
- `src/pages/api/analytics/skill-event.ts`: rate-limited ingestion endpoint.
- `tests/pages/api/analytics/skill-event.test.ts`: endpoint tests.
- `src/lib/marketplace-trending.ts`: activity attachment, score calculation, Trending comparator and fallback.
- `src/lib/marketplace-trending.test.ts`: ranking tests.
- `src/lib/client/skill-interaction-reporter.ts`: fire-and-forget browser event reporter.
- `src/lib/client/skill-interaction-reporter.test.ts`: beacon/fetch fallback tests.
- `packages/cli/src/utils/telemetry.ts`: CLI opt-out and successful-install reporting.
- `packages/cli/tests/telemetry.test.ts`: CLI telemetry tests.

**Modified files**

- `db/schema.sql`: include the interaction table in fresh database setup.
- `src/lib/kv.ts`: add `ANALYTICS_HASH_SALT` to runtime environment typing.
- `src/env.d.ts`: add the secret to Cloudflare runtime typing.
- `src/lib/skills.ts`: add optional activity fields to `UnifiedSkill` for presentation.
- `src/pages/[locale]/popular/index.astro`: load activity, add Trending mode and fallback copy.
- `src/components/SkillCard.astro`: expose seven-day install counts and event metadata.
- `src/components/SkillInstall.astro`: render platform command modes and event metadata.
- `src/pages/[locale]/skills/[owner]/[...repo].astro`: pass canonical skill reference and locale into the install component.
- `src/layouts/Layout.astro`: report successful copy actions after clipboard completion.
- `packages/cli/src/commands/install.ts`: preserve canonical skill reference and report successful non-local installs.
- `packages/cli/README.md`: document telemetry and opt-out behavior.
- `packages/cli/README.zh-CN.md`: document telemetry and opt-out behavior in Chinese.
- `packages/cli/package.json`: publish patch version `1.10.1`.
- `packages/cli/package-lock.json`: keep the CLI package lock version aligned.
- `packages/cli/CHANGELOG.md`: document anonymous successful-install telemetry and opt-out controls.
- `src/pages/[locale]/skills/index.astro`: reviewed/installable directory positioning.
- `src/pages/[locale]/categories/index.astro`: real capability index copy and dedicated category links.
- `src/pages/[locale]/privacy/index.astro`: anonymous ranking analytics and CLI opt-out disclosure.
- `tests/pages/public-links.test.ts`: public copy, install commands, privacy, and no-new-route guards.
- `tests/e2e/marketplace-ui.spec.ts`: Trending and install-mode browser coverage.
- `tests/e2e/navigation.spec.ts`: updated Skills H1 expectations.
- `wrangler.toml`: documentation comment for the new secret only; secret value remains remote.
- `package.json`: add the bounded D1 interaction-retention command.
- `.github/workflows/data-pipeline.yml`: run bounded interaction cleanup without changing harvest lanes.

---

### Task 1: Define The Interaction Contract And Daily Actor Digest

**Files:**
- Create: `src/lib/skill-interaction-events.ts`
- Create: `src/lib/skill-interaction-events.test.ts`

**Interfaces:**
- Produces: `SkillInteractionEventType`, `SkillInteractionPlatform`, `SkillInteractionSurface`, `ValidatedSkillInteraction`, `validateSkillInteractionPayload(input)`, `isTelemetryCrawler(userAgent)`, `createDailyActorHash(options)`.
- Consumes: Web Crypto available in Workers and Node 18+.

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  createDailyActorHash,
  isTelemetryCrawler,
  validateSkillInteractionPayload,
} from './skill-interaction-events';

describe('validateSkillInteractionPayload', () => {
  it('accepts a canonical CLI install event', () => {
    expect(
      validateSkillInteractionPayload({
        eventType: 'cli_install',
        skillRef: 'anthropics/skills/frontend-design',
        platform: 'claude',
        surface: 'cli',
        clientVersion: '1.10.1',
      }),
    ).toEqual({
      eventType: 'cli_install',
      skillRef: 'anthropics/skills/frontend-design',
      source: 'cli',
      platform: 'claude',
      surface: 'cli',
      locale: '',
      clientVersion: '1.10.1',
    });
  });

  it.each([
    { eventType: 'cli_install', skillRef: '../secret', platform: 'claude', surface: 'cli' },
    { eventType: 'command_copy', skillRef: 'owner/repo', platform: 'codex', surface: 'cli' },
    { eventType: 'platform_copy', skillRef: 'owner/repo', platform: 'unknown', surface: 'detail' },
  ])('rejects invalid or contradictory payload %#', (payload) => {
    expect(validateSkillInteractionPayload(payload)).toBeNull();
  });
});

describe('daily anonymous actor hashing', () => {
  it('is stable within a day and unlinkable across days', async () => {
    const base = { salt: 'test-secret', ip: '203.0.113.5', userAgent: 'killer-skills/1.10.1' };
    const first = await createDailyActorHash({ ...base, eventDate: '2026-07-16' });
    const same = await createDailyActorHash({ ...base, eventDate: '2026-07-16' });
    const nextDay = await createDailyActorHash({ ...base, eventDate: '2026-07-17' });
    expect(first).toBe(same);
    expect(first).not.toBe(nextDay);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('recognizes search and AI crawlers', () => {
    expect(isTelemetryCrawler('Googlebot/2.1')).toBe(true);
    expect(isTelemetryCrawler('GPTBot/1.0')).toBe(true);
    expect(isTelemetryCrawler('killer-skills/1.10.1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run src/lib/skill-interaction-events.test.ts --reporter=verbose`

Expected: FAIL because `skill-interaction-events.ts` does not exist.

- [ ] **Step 3: Implement the minimal event contract**

```ts
export type SkillInteractionEventType = 'cli_install' | 'command_copy' | 'platform_copy';
export type SkillInteractionPlatform = '' | 'auto' | 'claude' | 'codex' | 'cursor' | 'multi';
export type SkillInteractionSurface = 'cli' | 'detail' | 'card';

export interface ValidatedSkillInteraction {
  eventType: SkillInteractionEventType;
  skillRef: string;
  source: 'cli' | 'web';
  platform: SkillInteractionPlatform;
  surface: SkillInteractionSurface;
  locale: string;
  clientVersion: string;
}

const SAFE_SKILL_REF = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.\/-]+)?$/;
const PLATFORMS = new Set(['', 'auto', 'claude', 'codex', 'cursor', 'multi']);
const SURFACES = new Set(['cli', 'detail', 'card']);
const LOCALES = new Set(['', 'en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'ru', 'ar']);

export function validateSkillInteractionPayload(input: unknown): ValidatedSkillInteraction | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const eventType = String(value.eventType || '') as SkillInteractionEventType;
  const skillRef = String(value.skillRef || '').trim().replace(/^\/+|\/+$/g, '');
  const platform = String(value.platform || '') as SkillInteractionPlatform;
  const surface = String(value.surface || '') as SkillInteractionSurface;
  const locale = String(value.locale || '');
  const clientVersion = String(value.clientVersion || '').slice(0, 32);
  if (!['cli_install', 'command_copy', 'platform_copy'].includes(eventType)) return null;
  if (skillRef.length > 180 || skillRef.includes('..') || !SAFE_SKILL_REF.test(skillRef)) return null;
  if (!PLATFORMS.has(platform) || !SURFACES.has(surface) || !LOCALES.has(locale)) return null;
  const source = eventType === 'cli_install' ? 'cli' : 'web';
  if (source === 'cli' && surface !== 'cli') return null;
  if (source === 'web' && surface === 'cli') return null;
  if (eventType === 'platform_copy' && !['claude', 'codex', 'cursor'].includes(platform)) return null;
  return { eventType, skillRef, source, platform, surface, locale, clientVersion };
}

export function isTelemetryCrawler(userAgent: string): boolean {
  return /(googlebot|bingbot|baiduspider|yandexbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|killer-skills-warmup-bot)/i.test(userAgent);
}

export async function createDailyActorHash(options: {
  salt: string;
  eventDate: string;
  ip: string;
  userAgent: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(options.salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const family = options.userAgent.toLowerCase().replace(/\d+(?:\.\d+)*/g, '#').slice(0, 80);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${options.eventDate}|${options.ip}|${family}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npx vitest run src/lib/skill-interaction-events.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add src/lib/skill-interaction-events.ts src/lib/skill-interaction-events.test.ts
git commit -m "feat: define skill interaction events"
```

---

### Task 2: Add Independent D1 Storage And Activity Queries

**Files:**
- Create: `db/migrations/2026-07-16-skill-interactions.sql`
- Create: `src/lib/skill-interaction-store.ts`
- Create: `src/lib/skill-interaction-store.test.ts`
- Modify: `db/schema.sql`
- Modify: `package.json`
- Modify: `.github/workflows/data-pipeline.yml`
- Modify: `tests/pages/public-links.test.ts`

**Interfaces:**
- Consumes: `ValidatedSkillInteraction` from Task 1.
- Produces: `SkillInteractionMetrics`, `recordSkillInteraction(db, event)`, `getRecentSkillInteractionMetrics(db, now?)`.

- [ ] **Step 1: Write failing D1 store tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { getRecentSkillInteractionMetrics, recordSkillInteraction } from './skill-interaction-store';

describe('recordSkillInteraction', () => {
  it('uses INSERT OR IGNORE with daily identity fields', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    await recordSkillInteraction({ prepare } as any, {
      eventDate: '2026-07-16',
      actorHash: 'a'.repeat(64),
      eventType: 'cli_install',
      skillRef: 'owner/repo/skill',
      source: 'cli',
      platform: 'codex',
      surface: 'cli',
      locale: '',
      clientVersion: '1.10.1',
    });
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO skill_interactions'));
    expect(run).toHaveBeenCalledOnce();
  });

  it('fails open when D1 is unavailable', async () => {
    await expect(recordSkillInteraction(undefined, {} as any)).resolves.toBe(false);
  });
});

describe('getRecentSkillInteractionMetrics', () => {
  it('maps grouped seven and thirty day metrics by canonical skill ref', async () => {
    const all = vi.fn().mockResolvedValue({ success: true, results: [{
      skill_ref: 'owner/repo/skill', cli_installs_7d: 2, cli_installs_30d: 5,
      install_actions_7d: 3, install_actions_30d: 9, trend_score: 31,
    }] });
    const db = { prepare: vi.fn(() => ({ bind: () => ({ all }) })) };
    const metrics = await getRecentSkillInteractionMetrics(db as any, new Date('2026-07-16T12:00:00Z'));
    expect(metrics.get('owner/repo/skill')).toEqual({
      cliInstalls7d: 2, cliInstalls30d: 5, installActions7d: 3, installActions30d: 9, trendScore: 31,
    });
  });

  it('returns an empty map when the table is missing', async () => {
    const db = { prepare: vi.fn(() => ({ bind: () => ({ all: vi.fn().mockRejectedValue(new Error('no such table')) }) })) };
    await expect(getRecentSkillInteractionMetrics(db as any, new Date('2026-07-16T12:00:00Z'))).resolves.toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run the store tests and verify RED**

Run: `npx vitest run src/lib/skill-interaction-store.test.ts --reporter=verbose`

Expected: FAIL because the store module does not exist.

- [ ] **Step 3: Add the forward-only migration and fresh-schema definitions**

Write this SQL to `db/migrations/2026-07-16-skill-interactions.sql` and append the same idempotent definitions to `db/schema.sql`. Do not add a `DROP TABLE skill_interactions` statement.

```sql
CREATE TABLE IF NOT EXISTS skill_interactions (
  event_date TEXT NOT NULL,
  skill_ref TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  surface TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT '',
  client_version TEXT NOT NULL DEFAULT '',
  actor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (event_date, skill_ref, event_type, source, platform, surface, actor_hash)
);

CREATE INDEX IF NOT EXISTS idx_skill_interactions_date
  ON skill_interactions(event_date DESC);

CREATE INDEX IF NOT EXISTS idx_skill_interactions_skill_date
  ON skill_interactions(skill_ref, event_date DESC);
```

- [ ] **Step 4: Implement fail-open inserts and grouped seven/thirty-day queries**

```ts
import type { ValidatedSkillInteraction } from './skill-interaction-events';

export interface StoredSkillInteraction extends ValidatedSkillInteraction {
  eventDate: string;
  actorHash: string;
}

export interface SkillInteractionMetrics {
  cliInstalls7d: number;
  cliInstalls30d: number;
  installActions7d: number;
  installActions30d: number;
  trendScore: number;
}

export async function recordSkillInteraction(db: D1Database | undefined, event: StoredSkillInteraction): Promise<boolean> {
  if (!db) return false;
  try {
    const result = await db.prepare(`INSERT OR IGNORE INTO skill_interactions
      (event_date, skill_ref, event_type, source, platform, surface, locale, client_version, actor_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(event.eventDate, event.skillRef, event.eventType, event.source, event.platform, event.surface,
        event.locale, event.clientVersion, event.actorHash, new Date().toISOString())
      .run();
    return result.success === true;
  } catch {
    return false;
  }
}
```

Use this grouped query, binding `today`, `dayMinus1`, `dayMinus3`, `dayMinus6`, and `dayMinus29` in that order:

```sql
SELECT
  skill_ref,
  SUM(CASE WHEN event_type = 'cli_install' AND event_date >= ?5 THEN 1 ELSE 0 END) AS cli_installs_30d,
  SUM(CASE WHEN event_type = 'cli_install' AND event_date >= ?4 THEN 1 ELSE 0 END) AS cli_installs_7d,
  SUM(CASE WHEN event_type IN ('command_copy', 'platform_copy') AND event_date >= ?5 THEN 1 ELSE 0 END) AS install_actions_30d,
  SUM(CASE WHEN event_type IN ('command_copy', 'platform_copy') AND event_date >= ?4 THEN 1 ELSE 0 END) AS install_actions_7d,
  SUM(CASE
    WHEN event_type = 'cli_install' AND event_date >= ?2 THEN 12
    WHEN event_type = 'cli_install' AND event_date >= ?3 THEN 8
    WHEN event_type = 'cli_install' AND event_date >= ?4 THEN 5
    WHEN event_type = 'platform_copy' AND event_date >= ?4 THEN 2
    WHEN event_type = 'command_copy' AND event_date >= ?4 THEN 1
    ELSE 0
  END) AS trend_score
FROM skill_interactions
WHERE event_date BETWEEN ?5 AND ?1
GROUP BY skill_ref
```

Convert rows into `Map<string, SkillInteractionMetrics>`. Add a 60-second bounded in-isolate cache keyed by the current UTC date. Catch all D1 errors and return `new Map()`.

- [ ] **Step 5: Add bounded retention deletion to the existing scheduled pipeline**

Add this package script:

```json
"cleanup:skill-interactions": "wrangler d1 execute killer-skills-db --remote --command=\"DELETE FROM skill_interactions WHERE rowid IN (SELECT rowid FROM skill_interactions WHERE event_date < date('now', '-35 days') LIMIT 5000);\""
```

Add a `Cleanup expired skill interactions` step to `.github/workflows/data-pipeline.yml` after dependency installation. Run only for scheduled `data-build` executions, set `continue-on-error: true`, invoke `npm run cleanup:skill-interactions`, and provide the existing `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets. Do not change `resolve`, `run_harvest`, schedule, target, or build-mode logic.

Add a source guard in `tests/pages/public-links.test.ts` that requires the cleanup command to contain `event_date < date('now', '-35 days')` and `LIMIT 5000`, and requires the workflow to contain the cleanup step with `continue-on-error: true`.

- [ ] **Step 6: Run store tests and schema checks**

Run:

```bash
npx vitest run src/lib/skill-interaction-store.test.ts tests/pages/public-links.test.ts --reporter=verbose
git diff --check
```

Expected: PASS and no whitespace errors.

- [ ] **Step 7: Commit storage**

```bash
git add db/schema.sql db/migrations/2026-07-16-skill-interactions.sql src/lib/skill-interaction-store.ts src/lib/skill-interaction-store.test.ts package.json .github/workflows/data-pipeline.yml tests/pages/public-links.test.ts
git commit -m "feat: store anonymous skill interactions"
```

---

### Task 3: Add The Rate-Limited Ingestion Endpoint

**Files:**
- Create: `src/pages/api/analytics/skill-event.ts`
- Create: `tests/pages/api/analytics/skill-event.test.ts`
- Modify: `src/lib/kv.ts`
- Modify: `src/env.d.ts`
- Modify: `wrangler.toml`

**Interfaces:**
- Consumes: Task 1 validation/hash functions, Task 2 `recordSkillInteraction`, existing `getClientIP`, `checkRateLimit`, `createRateLimiter`.
- Produces: `POST /api/analytics/skill-event` with `204`, `400`, or `429` and `X-Robots-Tag: noindex, nofollow`.

- [ ] **Step 1: Write failing endpoint tests**

Write these endpoint tests using the existing API context helper:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAPIContext, createMockEnv } from '../../../../src/lib/api-test-utils';

vi.mock('../../../../src/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/rate-limit')>();
  return { ...actual, checkRateLimit: vi.fn() };
});

describe('POST /api/analytics/skill-event', () => {
  let POST: typeof import('../../../../src/pages/api/analytics/skill-event').POST;
  let checkRateLimit: typeof import('../../../../src/lib/rate-limit').checkRateLimit;
  let run: ReturnType<typeof vi.fn>;
  let prepare: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ POST } = await import('../../../../src/pages/api/analytics/skill-event'));
    ({ checkRateLimit } = await import('../../../../src/lib/rate-limit'));
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
    prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run })) }));
  });

  function context(body: unknown, headers: Record<string, string> = {}, withDb = true) {
    return createAPIContext({
      url: 'http://localhost/api/analytics/skill-event',
      body,
      headers: { 'user-agent': 'killer-skills/1.10.1', 'cf-connecting-ip': '203.0.113.5', ...headers },
      env: createMockEnv({
        ANALYTICS_HASH_SALT: 'test-secret',
        ...(withDb ? { DB: { prepare } as unknown as D1Database } : {}),
      }),
    }) as any;
  }

  it('stores one valid CLI event and returns 204', async () => {
    const response = await POST(context({
      eventType: 'cli_install', skillRef: 'owner/repo/skill', platform: 'codex', surface: 'cli', clientVersion: '1.10.1',
    }));
    expect(response.status).toBe(204);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE INTO skill_interactions'));
    expect(run).toHaveBeenCalledOnce();
  });

  it('returns 400 for an invalid skill reference', async () => {
    const response = await POST(context({ eventType: 'cli_install', skillRef: '../secret', platform: 'codex', surface: 'cli' }));
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-JSON content type', async () => {
    const ctx = context({ eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }, {
      'Content-Type': 'text/plain',
    });
    const response = await POST(ctx);
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 204 without D1 writes for Googlebot', async () => {
    const response = await POST(context(
      { eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' },
      { 'user-agent': 'Googlebot/2.1' },
    ));
    expect(response.status).toBe(204);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('returns 204 when D1 is unavailable', async () => {
    const response = await POST(context(
      { eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }, {}, false,
    ));
    expect(response.status).toBe(204);
  });

  it('returns 429 when the rate limit rejects the request', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const response = await POST(context({ eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('always returns noindex API headers', async () => {
    const response = await POST(context({ eventType: 'command_copy', skillRef: 'owner/repo', platform: 'auto', surface: 'card' }));
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });
});
```

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `npx vitest run tests/pages/api/analytics/skill-event.test.ts --reporter=verbose`

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Add runtime secret typing and config documentation**

Add `ANALYTICS_HASH_SALT?: string` to both environment types. Add only this comment to `wrangler.toml`; never add a value:

```toml
#   wrangler secret put ANALYTICS_HASH_SALT
```

- [ ] **Step 4: Implement the endpoint**

```ts
import type { APIRoute } from 'astro';
import { createDailyActorHash, isTelemetryCrawler, validateSkillInteractionPayload } from '../../../lib/skill-interaction-events';
import { recordSkillInteraction } from '../../../lib/skill-interaction-store';
import { checkRateLimit, createRateLimiter, getClientIP } from '../../../lib/rate-limit';
import { getRuntimeEnv } from '../../../lib/runtime-env';
import type { Env } from '../../../lib/kv';

export const prerender = false;
const fallbackLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const headers = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };

export const POST: APIRoute = async ({ request, locals }) => {
  const userAgent = request.headers.get('user-agent') || '';
  if (isTelemetryCrawler(userAgent)) return new Response(null, { status: 204, headers });
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return new Response(null, { status: 400, headers });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 2048) return new Response(null, { status: 400, headers });
  let raw: unknown;
  try { raw = await request.json(); } catch { return new Response(null, { status: 400, headers }); }
  const event = validateSkillInteractionPayload(raw);
  if (!event) return new Response(null, { status: 400, headers });
  const env = await getRuntimeEnv<Env>(locals);
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env?.SKILLS_CACHE, { bucket: 'skill-event', key: ip, max: 60, periodSec: 60 }, fallbackLimiter);
  if (!allowed) return new Response(null, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
  if (!env?.DB || !env.ANALYTICS_HASH_SALT) return new Response(null, { status: 204, headers });
  const eventDate = new Date().toISOString().slice(0, 10);
  const actorHash = await createDailyActorHash({ salt: env.ANALYTICS_HASH_SALT, eventDate, ip, userAgent });
  await recordSkillInteraction(env.DB, { ...event, eventDate, actorHash });
  return new Response(null, { status: 204, headers });
};
```

- [ ] **Step 5: Run endpoint and rate-limit tests**

Run:

```bash
npx vitest run tests/pages/api/analytics/skill-event.test.ts src/lib/rate-limit.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 6: Commit the API**

```bash
git add src/pages/api/analytics/skill-event.ts tests/pages/api/analytics/skill-event.test.ts src/lib/kv.ts src/env.d.ts wrangler.toml
git commit -m "feat: ingest skill interaction events"
```

---

### Task 4: Add Pure Trending Ranking And Route Integration

**Files:**
- Create: `src/lib/marketplace-trending.ts`
- Create: `src/lib/marketplace-trending.test.ts`
- Modify: `src/lib/skills.ts`
- Modify: `src/pages/[locale]/popular/index.astro`
- Modify: `src/components/SkillCard.astro`
- Modify: `tests/pages/public-links.test.ts`
- Modify: `tests/e2e/marketplace-ui.spec.ts`

**Interfaces:**
- Consumes: Task 2 `SkillInteractionMetrics`, existing `getMarketplaceSkills` and `compareMarketplaceSkillsPopular`.
- Produces: `attachSkillActivity(skills, metrics)`, `sortSkillsTrending(skills)`, optional `cliInstalls7d`, `installActions7d`, `trendScore` fields on `UnifiedSkill`.

- [ ] **Step 1: Write failing pure ranking tests**

```ts
const makeSkill = (id: string, activity: Partial<UnifiedSkill> = {}): UnifiedSkill => ({
  id,
  name: id,
  skillName: id,
  owner: 'owner',
  repo: id,
  description: `${id} description`,
  category: 'developer',
  topics: [],
  stars: 10,
  forks: 0,
  source: 'verified',
  updatedAt: '2026-07-16T00:00:00.000Z',
  qualityScore: 80,
  securityLevel: 'A',
  sourceTrust: 'T1',
  rankScore: 80,
  isTrustedRankingEligible: true,
  filePath: 'SKILL.md',
  ...activity,
});

it('ranks recent CLI installs above website copies', () => {
  const ranked = sortSkillsTrending([
    makeSkill('copy-heavy', { trendScore: 8, cliInstalls7d: 0 }),
    makeSkill('installed', { trendScore: 12, cliInstalls7d: 1 }),
  ]);
  expect(ranked.map((skill) => skill.id)).toEqual(['installed', 'copy-heavy']);
});

it('falls back exactly to Popular when every trend score is zero', () => {
  expect(sortSkillsTrending(skills).map((skill) => skill.id))
    .toEqual(sortMarketplaceSkillsPopular(skills).map((skill) => skill.id));
});

it('removes non-admitted skills before Trending', () => {
  expect(sortSkillsTrending([safeSkill, { ...blockedSkill, trendScore: 999 }])).toEqual([safeSkill]);
});
```

- [ ] **Step 2: Run ranking tests and verify RED**

Run: `npx vitest run src/lib/marketplace-trending.test.ts --reporter=verbose`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add optional activity fields and implement the comparator**

```ts
export function sortSkillsTrending(skills: UnifiedSkill[]): UnifiedSkill[] {
  const admitted = getPublicMarketplaceSkills(skills);
  if (!admitted.some((skill) => Number(skill.trendScore || 0) > 0)) {
    return admitted.sort(compareMarketplaceSkillsPopular);
  }
  return admitted.sort((a, b) =>
    Number(b.trendScore || 0) - Number(a.trendScore || 0) ||
    Number(b.cliInstalls7d || 0) - Number(a.cliInstalls7d || 0) ||
    compareMarketplaceSkillsPopular(a, b),
  );
}
```

`attachSkillActivity` must look up by canonical `skill.id`, with an owner/route fallback only through the existing route helper, and copy metrics onto bounded skill objects without mutating the originals.

- [ ] **Step 4: Add failing route source tests**

Update `tests/pages/public-links.test.ts` to require:

```ts
expect(popularSource).toContain("requestedRank === 'trending'");
expect(popularSource).toContain("getRecentSkillInteractionMetrics(env.DB)");
expect(popularSource).toContain("sortSkillsTrending");
expect(popularSource).toContain("rank=trending");
expect(popularSource).toContain("noindex, follow");
```

- [ ] **Step 5: Run source tests and verify RED**

Run: `npx vitest run tests/pages/public-links.test.ts --reporter=verbose`

Expected: FAIL on missing Trending integration.

- [ ] **Step 6: Integrate Trending into the bounded Rankings route**

Load skills, messages, overview, and interaction metrics in the existing parallel data path. Attach activity only after marketplace admission, select Popular/Latest/Trending, and add the third tab. When no score is present, show a compact accumulating-state message. Keep `hasListingParams` true for Trending so canonical/noindex behavior remains unchanged.

In `SkillCard.astro`, add:

```astro
{Number(skill.cliInstalls7d || 0) > 0 && (
  <span data-testid="skill-7d-installs">{skill.cliInstalls7d} {locale.startsWith('zh') ? '次 7 天安装' : '7d installs'}</span>
)}
```

Only render this metric when nonzero.

- [ ] **Step 7: Extend E2E ranking checks**

Add `/zh/popular?rank=trending` to `coreRoutes` and assert it renders either activity-ordered cards or the accumulating-state message. Do not require seeded analytics in local development.

- [ ] **Step 8: Run ranking tests**

Run:

```bash
npx vitest run src/lib/marketplace-trending.test.ts src/lib/marketplace-policy.test.ts tests/pages/public-links.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 9: Commit Trending**

```bash
git add src/lib/marketplace-trending.ts src/lib/marketplace-trending.test.ts src/lib/skills.ts src/pages/'[locale]'/popular/index.astro src/components/SkillCard.astro tests/pages/public-links.test.ts tests/e2e/marketplace-ui.spec.ts
git commit -m "feat: rank trending skills by recent activity"
```

---

### Task 5: Add Platform Install Modes And Browser Install Actions

**Files:**
- Create: `src/lib/client/skill-interaction-reporter.ts`
- Create: `src/lib/client/skill-interaction-reporter.test.ts`
- Modify: `src/components/SkillInstall.astro`
- Modify: `src/components/SkillCard.astro`
- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Modify: `src/layouts/Layout.astro`
- Modify: `tests/pages/public-links.test.ts`
- Modify: `tests/e2e/marketplace-ui.spec.ts`

**Interfaces:**
- Consumes: `skillRef`, `locale`, `surface`, selected platform.
- Produces: `reportSkillInteraction(payload, navigatorLike?, fetchLike?)`, four detail install modes, card/detail event metadata.

- [ ] **Step 1: Write failing browser reporter tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { reportSkillInteraction } from './skill-interaction-reporter';

const payload = {
  eventType: 'platform_copy', skillRef: 'owner/repo/skill', platform: 'codex', surface: 'detail', locale: 'en',
};

describe('reportSkillInteraction', () => {
  it('prefers sendBeacon with an application/json blob', () => {
    const sendBeacon = vi.fn(() => true);
    const fetchImpl = vi.fn();
    reportSkillInteraction(payload, { sendBeacon } as any, fetchImpl as any);
    expect(sendBeacon).toHaveBeenCalledWith('/api/analytics/skill-event', expect.any(Blob));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to keepalive fetch when sendBeacon is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    reportSkillInteraction(payload, {} as any, fetchImpl as any);
    expect(fetchImpl).toHaveBeenCalledWith('/api/analytics/skill-event', expect.objectContaining({
      method: 'POST', keepalive: true, body: JSON.stringify(payload),
    }));
  });

  it('swallows synchronous and asynchronous reporting failures', () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    expect(() => reportSkillInteraction(payload, {} as any, fetchImpl as any)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run reporter tests and verify RED**

Run: `npx vitest run src/lib/client/skill-interaction-reporter.test.ts --reporter=verbose`

Expected: FAIL because the reporter does not exist.

- [ ] **Step 3: Implement the fire-and-forget reporter**

```ts
export function reportSkillInteraction(
  payload: Record<string, string>,
  navigatorLike: Pick<Navigator, 'sendBeacon'> = navigator,
  fetchLike: typeof fetch = fetch,
): void {
  try {
    const body = JSON.stringify(payload);
    if (navigatorLike.sendBeacon) {
      const queued = navigatorLike.sendBeacon('/api/analytics/skill-event', new Blob([body], { type: 'application/json' }));
      if (queued) return;
    }
    void fetchLike('/api/analytics/skill-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics never changes install behavior.
  }
}
```

Keep the optional navigator/fetch parameters in the production signature so tests do not mutate globals.

- [ ] **Step 4: Add failing install-mode source tests**

Require all exact commands and metadata:

```ts
expect(installSource).toContain('--ide claude');
expect(installSource).toContain('--ide codex');
expect(installSource).toContain('--ide cursor');
expect(installSource).toContain('data-install-platform');
expect(installSource).not.toContain('data-scheme="cursor://"');
expect(installSource).not.toContain('data-scheme="windsurf://"');
```

- [ ] **Step 5: Run source tests and verify RED**

Run: `npx vitest run tests/pages/public-links.test.ts --reporter=verbose`

Expected: FAIL on missing platform commands.

- [ ] **Step 6: Refactor `SkillInstall` into an accessible stable segmented control**

Add required props `skillRef` and `locale`. Server-render the Auto-detect command as the initially visible command. Build the four commands from `skillRef`; never parse visible command text. Use buttons with `role="tab"`, `aria-selected`, `data-install-command-value`, and fixed panel dimensions. The component script switches the visible command and updates the copy button's `data-command` and `data-install-platform`.

Remove Cursor/Windsurf URI deep-link buttons and their binding script. Keep the primary action and copy button available without JavaScript.

- [ ] **Step 7: Add explicit metadata to every install action**

Detail controls:

```astro
data-skill-ref={skillRef}
data-install-event="platform_copy"
data-install-surface="detail"
data-install-platform="auto"
data-install-locale={locale}
```

Card controls use `command_copy`, `card`, `auto`, and the canonical install path already computed by `SkillCard`.

- [ ] **Step 8: Report only after successful clipboard writes**

Import `reportSkillInteraction` into the bundled Layout script. Call it inside each clipboard `.then(...)` after successful write. Do not report in `.catch(...)`. Replace the unique `#install-copy-btn` selector with a class/data selector so one page can support stable install controls without duplicate IDs.

- [ ] **Step 9: Add Playwright install-mode coverage**

On a skill detail page:

```ts
await page.getByRole('tab', { name: 'Codex' }).click();
await expect(page.getByTestId('install-command')).toContainText('--ide codex');
await page.getByRole('tab', { name: 'Claude Code' }).click();
await expect(page.getByTestId('install-command')).toContainText('--ide claude');
```

Assert fixed panel dimensions do not cause horizontal overflow at 390px.

- [ ] **Step 10: Run focused tests**

Run:

```bash
npx vitest run src/lib/client/skill-interaction-reporter.test.ts tests/pages/public-links.test.ts tests/csp/inline-handlers.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 11: Commit browser interactions**

```bash
git add src/lib/client/skill-interaction-reporter.ts src/lib/client/skill-interaction-reporter.test.ts src/components/SkillInstall.astro src/components/SkillCard.astro src/pages/'[locale]'/skills/'[owner]'/'[...repo].astro' src/layouts/Layout.astro tests/pages/public-links.test.ts tests/e2e/marketplace-ui.spec.ts
git commit -m "feat: add platform install actions"
```

---

### Task 6: Report Successful CLI Installs With Opt-Out

**Files:**
- Create: `packages/cli/src/utils/telemetry.ts`
- Create: `packages/cli/tests/telemetry.test.ts`
- Modify: `packages/cli/src/commands/install.ts`
- Modify: `packages/cli/README.md`
- Modify: `packages/cli/README.zh-CN.md`

**Interfaces:**
- Consumes: `skillRef`, installed IDE keys, package version.
- Produces: `isTelemetryDisabled(env)`, `reportSuccessfulInstall(event, options?)`; `InstallResult.skillRef` and `InstallResult.installedTargets`.

- [ ] **Step 1: Write failing CLI telemetry tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { isTelemetryDisabled, reportSuccessfulInstall } from '../src/utils/telemetry';

describe('isTelemetryDisabled', () => {
  it.each([
    [{ DO_NOT_TRACK: '1' }, true],
    [{ KILLER_SKILLS_TELEMETRY: '0' }, true],
    [{ KILLER_SKILLS_TELEMETRY: 'false' }, true],
    [{ KILLER_SKILLS_TEST: '1' }, true],
    [{}, false],
  ])('evaluates %#', (env, expected) => expect(isTelemetryDisabled(env)).toBe(expected));
});

const event = { skillRef: 'owner/repo/skill', platform: 'codex' as const, clientVersion: '1.10.1' };

it('posts a successful install event', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  await reportSuccessfulInstall(event, { fetchImpl: fetchImpl as any, env: {} });
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://killer-skills.com/api/analytics/skill-event',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ ...event, eventType: 'cli_install', surface: 'cli' }),
    }),
  );
});

it('never throws when fetch rejects or reaches the timeout', async () => {
  const rejected = vi.fn().mockRejectedValue(new Error('offline'));
  await expect(reportSuccessfulInstall(event, { fetchImpl: rejected as any, env: {} })).resolves.toBeUndefined();
  const pending = vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  await expect(reportSuccessfulInstall(event, { fetchImpl: pending as any, timeoutMs: 5, env: {} })).resolves.toBeUndefined();
});

it('does not post missing canonical refs or opted-out events', async () => {
  const fetchImpl = vi.fn();
  await reportSuccessfulInstall({ ...event, skillRef: 'local-skill' }, { fetchImpl: fetchImpl as any, env: {} });
  await reportSuccessfulInstall(event, { fetchImpl: fetchImpl as any, env: { KILLER_SKILLS_TELEMETRY: '0' } });
  expect(fetchImpl).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run CLI telemetry tests and verify RED**

Run: `npm --prefix packages/cli test -- --run tests/telemetry.test.ts`

Expected: FAIL because `utils/telemetry.ts` does not exist.

- [ ] **Step 3: Implement the opt-out and bounded reporter**

```ts
const FALSE_VALUES = new Set(['0', 'false', 'off', 'no']);

export function isTelemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.KILLER_SKILLS_TEST) return true;
  if (env.DO_NOT_TRACK && !FALSE_VALUES.has(env.DO_NOT_TRACK.toLowerCase())) return true;
  return env.KILLER_SKILLS_TELEMETRY ? FALSE_VALUES.has(env.KILLER_SKILLS_TELEMETRY.toLowerCase()) : false;
}

export async function reportSuccessfulInstall(event: {
  skillRef: string;
  platform: 'auto' | 'claude' | 'codex' | 'cursor' | 'multi';
  clientVersion: string;
}, options: { fetchImpl?: typeof fetch; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Promise<void> {
  if (isTelemetryDisabled(options.env) || !event.skillRef.includes('/')) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 750);
  try {
    await (options.fetchImpl || fetch)('https://killer-skills.com/api/analytics/skill-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': `killer-skills/${event.clientVersion}` },
      body: JSON.stringify({ ...event, eventType: 'cli_install', surface: 'cli' }),
      signal: controller.signal,
    });
  } catch {
    // Installation already succeeded; telemetry is best effort.
  } finally {
    clearTimeout(timer);
  }
}
```

Keep environment and fetch injection in the production signature so tests do not depend on process-global mutation.

- [ ] **Step 4: Preserve canonical references through install results**

Extend `InstallResult`:

```ts
interface InstallResult {
  skillName: string;
  sourceType: 'registry' | 'github' | 'local';
  installed: string[];
  installedTargets: string[];
  skillRef?: string;
  webUrl?: string;
}
```

Each successful GitHub install returns `skillRef: skillPath` and exact IDE keys in `installedTargets`. Local installs omit `skillRef` and are never reported. Registry installs preserve the returned GitHub result instead of rebuilding a partial result that loses `skillRef`.

- [ ] **Step 5: Report after successful installation without changing the result**

After local stats tracking, call `reportSuccessfulInstall` only when `result.skillRef` exists. Map one installed target to `claude`, `codex`, or `cursor`; multiple targets to `multi`; other single targets to `auto`. Read the package version through the same `createRequire` pattern already used by `src/index.ts`.

- [ ] **Step 6: Document telemetry and opt-out controls**

Add a short `Anonymous install statistics` section to both READMEs. State exactly what is sent, what is not sent, and both environment-variable opt-outs. Do not call telemetry mandatory.

- [ ] **Step 7: Run CLI tests and build**

Run:

```bash
npm --prefix packages/cli test
npm --prefix packages/cli run build
```

Expected: all CLI tests PASS and TypeScript build exits 0.

- [ ] **Step 8: Commit CLI telemetry**

```bash
git add packages/cli/src/utils/telemetry.ts packages/cli/tests/telemetry.test.ts packages/cli/src/commands/install.ts packages/cli/README.md packages/cli/README.zh-CN.md
git commit -m "feat(cli): report anonymous successful installs"
```

---

### Task 7: Reposition Existing Routes And Update Privacy Copy

**Files:**
- Modify: `src/pages/[locale]/skills/index.astro`
- Modify: `src/pages/[locale]/categories/index.astro`
- Modify: `src/pages/[locale]/privacy/index.astro`
- Modify: `tests/pages/public-links.test.ts`
- Modify: `tests/e2e/marketplace-ui.spec.ts`
- Modify: `tests/e2e/navigation.spec.ts`

**Interfaces:**
- Produces: reviewed/installable Skills promise, capability-led Categories index, transparent analytics disclosure.

- [ ] **Step 1: Replace the old expectations with failing public-copy tests**

Require:

```ts
expect(skillsIndexSource).toContain("'Reviewed AI Agent Skills Directory'");
expect(skillsIndexSource).toContain('Find and install reviewed skills for Claude Code, Codex, Cursor');
expect(categoriesSource).toContain("'AI Agent Skill Categories'");
expect(categoriesSource).toContain('href={`/${locale}/categories/${category.id}`}');
expect(categoriesSource).not.toMatch(/Legacy category|旧分类|筛选逻辑|filtering logic/);
expect(privacySource).toContain('KILLER_SKILLS_TELEMETRY=0');
expect(privacySource).toContain('DO_NOT_TRACK=1');
```

- [ ] **Step 2: Run public-copy tests and verify RED**

Run: `npx vitest run tests/pages/public-links.test.ts --reporter=verbose`

Expected: FAIL on old H1s, old category links, and missing privacy disclosure.

- [ ] **Step 3: Update Skills copy without unstable counts**

Use:

```ts
const pageTitle = isZhCopy ? '已审核的 AI Agent Skills 目录' : 'Reviewed AI Agent Skills Directory';
const pageDescription = isZhCopy
  ? '查找并安装适用于 Claude Code、Codex、Cursor 与其他兼容 Agent 的已审核 Skills。'
  : 'Find and install reviewed skills for Claude Code, Codex, Cursor, and other compatible agents.';
```

Replace the section description with direct comparison language about task, source, recency, and install path.

- [ ] **Step 4: Update Categories into a capability index**

Set the English H1 to `AI Agent Skill Categories` and write equivalent Chinese copy. Link each category card to `/${locale}/categories/${category.id}`. Remove both the legacy explanation and the section that tells users to use a different route instead.

- [ ] **Step 5: Add privacy disclosure**

State that the site stores daily anonymous install/action counts for ranking, that raw IP and stable device identifiers are not retained, and that CLI users can opt out. Keep the language factual and consistent in English and Chinese sections already present in the page.

- [ ] **Step 6: Update browser H1 expectations**

Change the Skills and Categories H1s in both Playwright specs. Retain one visible H1 and existing no-overflow checks.

- [ ] **Step 7: Run focused public-surface tests**

Run:

```bash
npx vitest run tests/pages/public-links.test.ts tests/pages/public-text-routes.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 8: Commit route copy**

```bash
git add src/pages/'[locale]'/skills/index.astro src/pages/'[locale]'/categories/index.astro src/pages/'[locale]'/privacy/index.astro tests/pages/public-links.test.ts tests/e2e/marketplace-ui.spec.ts tests/e2e/navigation.spec.ts
git commit -m "feat: clarify reviewed marketplace positioning"
```

---

### Task 8: Full Verification, Migration, Deployment, And CLI Release

**Files:**
- Verify all modified files.
- Production operation: D1 database `killer-skills-db`.
- Production secret: `ANALYTICS_HASH_SALT`.
- Package release: `packages/cli` patch version.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: deployed website ingestion/Trending and published CLI successful-install reporting.

- [ ] **Step 1: Run the complete focused unit suite**

Run:

```bash
npx vitest run \
  src/lib/skill-interaction-events.test.ts \
  src/lib/skill-interaction-store.test.ts \
  src/lib/marketplace-trending.test.ts \
  src/lib/client/skill-interaction-reporter.test.ts \
  tests/pages/api/analytics/skill-event.test.ts \
  src/lib/marketplace-policy.test.ts \
  tests/pages/public-links.test.ts \
  tests/pages/public-text-routes.test.ts \
  tests/csp/inline-handlers.test.ts \
  --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 2: Run static and build verification**

Run:

```bash
git diff --check
npx tsc --noEmit --project tsconfig.json
npm run check:astro
npm run build
npm --prefix packages/cli test
npm --prefix packages/cli run build
```

Expected: every command exits 0.

- [ ] **Step 3: Run desktop and mobile Playwright checks**

Start the local server using the repository's established E2E command, then run:

```bash
npx playwright test tests/e2e/marketplace-ui.spec.ts tests/e2e/navigation.spec.ts --reporter=line
```

Expected: Skills, Categories, Popular, Latest, Trending, and one detail page pass at 390px and 1280px with no overflow.

- [ ] **Step 4: Commit any verification-only fixes**

If verification required fixes, rerun the failed command and commit the tracked fixes in this isolated worktree:

```bash
git add -u
git commit -m "fix: harden install telemetry verification"
```

- [ ] **Step 5: Create and store the production HMAC secret**

Generate a 32-byte random value without printing it into logs or files, then pipe it directly to:

```bash
npx wrangler secret put ANALYTICS_HASH_SALT
```

Expected: Wrangler confirms the secret was uploaded. Never commit the value.

- [ ] **Step 6: Apply the forward-only D1 migration**

Run:

```bash
npx wrangler d1 execute killer-skills-db --remote --file=db/migrations/2026-07-16-skill-interactions.sql
npx wrangler d1 execute killer-skills-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='skill_interactions';"
```

Expected: the second command returns `skill_interactions`.

- [ ] **Step 7: Deploy the website/Worker**

Run: `npm run deploy`

Expected: build and Cloudflare deployment succeed with a new version ID.

- [ ] **Step 8: Verify production ingestion and fail-open behavior**

Send one invalid event and expect `400`; send one valid synthetic web event and expect `204`; send a crawler event and expect `204` with no row-count change. Query only aggregate fields:

```bash
npx wrangler d1 execute killer-skills-db --remote --command="SELECT event_date, event_type, source, platform, COUNT(*) AS unique_events FROM skill_interactions GROUP BY event_date, event_type, source, platform ORDER BY event_date DESC LIMIT 20;"
```

Expected: no raw IP or user-agent columns exist, and the valid event appears only as an aggregate.

- [ ] **Step 9: Verify public crawler contracts**

Run the existing crawler contract/probe command against `/en/skills`, `/en/categories`, `/en/popular?rank=trending`, and one sitemap skill URL. Repeat uncached requests sufficiently to detect Worker CPU regression.

Expected: all responses are `200`, no `1102`, and Trending absence/data does not alter crawler status.

- [ ] **Step 10: Publish the CLI patch release**

Set `packages/cli/package.json` and `packages/cli/package-lock.json` to version `1.10.1`. Add a `1.10.1` changelog entry for anonymous successful-install telemetry and the two opt-out controls. Rerun CLI tests/build, then publish with:

```bash
npm --prefix packages/cli test
npm --prefix packages/cli run build
npm --prefix packages/cli publish
```

Expected: npm publishes `killer-skills@1.10.1`. Do not publish if `npm whoami` fails or if `1.10.1` already exists.

- [ ] **Step 11: Verify one real CLI install event**

Install a public test skill with an explicit IDE target:

```bash
npx killer-skills@latest add find-skills --ide codex --yes
```

Query seven-day aggregate counts and confirm one `cli_install` appears for the canonical reference. Then rerun with `KILLER_SKILLS_TELEMETRY=0` and confirm the aggregate does not increase.

- [ ] **Step 12: Final production report and commit/push state**

Report:

- website commit and deployed Cloudflare version;
- migration and secret status without revealing secret material;
- focused tests, typecheck, Astro check, build, Playwright, and CLI results;
- production API statuses and crawler response sample;
- CLI package version and npm publish status;
- first seven-day install/intent aggregate evidence;
- unchanged daily harvest workflow status.

Push the completed branch only after all required checks pass.
