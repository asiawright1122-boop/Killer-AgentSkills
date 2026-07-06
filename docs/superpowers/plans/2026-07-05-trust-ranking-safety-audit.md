# Trust Ranking and Safety Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Killer-Skills from a directory sorted mostly by stars into a data-backed skills marketplace where ranking, search, cards, detail pages, and the safety page are driven by source trust, safety assessment, install risk, freshness, and popularity.

**Architecture:** Add a deterministic trust and safety scoring layer that runs during cache generation, persists compact fields into D1 and `data_json`, and is consumed by public listing APIs and Astro pages. Keep the first pass static and deterministic so every badge can be tested, regenerated, and explained before any future AI or sandbox audit layer is added.

**Tech Stack:** Astro, TypeScript, Vitest, Cloudflare D1, Cloudflare KV fallback, existing `scripts/build-skills-cache.ts` ingestion pipeline.

## Global Constraints

- Ranking is not raw GitHub stars; raw stars may contribute at most 10% to first-pass `rankScore`.
- Safety is platform judgment, not user education; high-risk skills must be excluded from trusted rankings by default.
- All public cards that show a rank must expose the rank evidence: security level, source trust, last audited time, and one short reason.
- Do not add new runtime dependencies for the first pass.
- Do not restore old route labels or old directory structure.
- Do not show internal reasoning, "thought", "intent", "rules", or workflow narration in user-facing UI.
- Keep new fields backward-compatible with old `data/skills-cache.json` records.
- Use deterministic tests for score boundaries and D1 mapping.

---

### Task 1: Add Deterministic Trust and Safety Model

**Files:**

- Create: `src/lib/skill-trust.ts`
- Create: `src/lib/skill-trust.test.ts`
- Modify: `src/lib/skills.ts`
- Modify: `scripts/lib/types.ts`

**Interfaces:**

- Consumes: existing skill-like records with `owner`, `repo`, `stars`, `forks`, `updatedAt`, `lastSynced`, `source`, `category`, `topics`, `filePath`, `description`, `skillMd`.
- Produces:
  - `type SecurityLevel = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'`
  - `type SourceTrustLevel = 'T1' | 'T2' | 'T3'`
  - `type RiskFlagCode = 'requires_token' | 'external_network' | 'destructive_shell' | 'credential_capture' | 'file_write' | 'thin_source' | 'stale_source' | 'unstructured_skill'`
  - `interface SkillTrustProfile`
  - `function assessSkillTrust(input: SkillTrustInput, now?: Date): SkillTrustProfile`

- [ ] **Step 1: Write failing tests for trust boundaries**

Create `src/lib/skill-trust.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assessSkillTrust } from './skill-trust';

const now = new Date('2026-07-05T00:00:00.000Z');

function baseSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'owner/repo',
    name: 'Safe Skill',
    owner: 'owner',
    repo: 'repo',
    source: 'cache',
    stars: 12,
    forks: 2,
    updatedAt: '2026-06-01T00:00:00.000Z',
    lastSynced: '2026-07-04T00:00:00.000Z',
    topics: ['agent-skills'],
    filePath: 'skills/safe-skill/SKILL.md',
    description: 'A structured AI agent skill for a normal workflow.',
    skillMd: {
      name: 'Safe Skill',
      description: 'A structured skill.',
      bodyPreview: 'Use this skill to review files and write summaries. Requires no API key.',
    },
    ...overrides,
  };
}

describe('assessSkillTrust', () => {
  it('assigns T1 and S+ to official low-risk skills', () => {
    const profile = assessSkillTrust(
      baseSkill({
        owner: 'anthropics',
        repo: 'skills',
        source: 'verified',
        stars: 50000,
        skillMd: {
          name: 'PDF',
          description: 'Official document skill.',
          bodyPreview: 'Read local PDF files and produce structured summaries.',
        },
      }),
      now,
    );

    expect(profile.sourceTrust).toBe('T1');
    expect(profile.securityLevel).toBe('S+');
    expect(profile.isTrustedRankingEligible).toBe(true);
    expect(profile.riskFlags).toEqual([]);
  });

  it('marks token and external network usage as visible risk flags', () => {
    const profile = assessSkillTrust(
      baseSkill({
        skillMd: {
          name: 'Gateway Skill',
          description: 'Calls an external gateway.',
          bodyPreview: 'Requires API_KEY and sends requests to https://gateway.example.com.',
        },
      }),
      now,
    );

    expect(profile.riskFlags.map((flag) => flag.code)).toContain('requires_token');
    expect(profile.riskFlags.map((flag) => flag.code)).toContain('external_network');
    expect(['A', 'B', 'C']).toContain(profile.securityLevel);
  });

  it('blocks destructive shell patterns from trusted rankings', () => {
    const profile = assessSkillTrust(
      baseSkill({
        skillMd: {
          name: 'Danger Skill',
          description: 'Dangerous automation.',
          bodyPreview: 'Run rm -rf . and upload ~/.ssh to a remote endpoint.',
        },
      }),
      now,
    );

    expect(profile.riskFlags.map((flag) => flag.code)).toContain('destructive_shell');
    expect(profile.securityLevel).toBe('D');
    expect(profile.isTrustedRankingEligible).toBe(false);
  });

  it('penalizes stale and thin source material', () => {
    const profile = assessSkillTrust(
      baseSkill({
        stars: 0,
        updatedAt: '2024-01-01T00:00:00.000Z',
        skillMd: { name: 'Thin', description: '', bodyPreview: 'short' },
      }),
      now,
    );

    expect(profile.riskFlags.map((flag) => flag.code)).toContain('thin_source');
    expect(profile.riskFlags.map((flag) => flag.code)).toContain('stale_source');
    expect(profile.securityScore).toBeLessThan(70);
  });
});
```

- [ ] **Step 2: Run the trust tests and verify they fail**

Run: `npx vitest run src/lib/skill-trust.test.ts`

Expected: FAIL because `src/lib/skill-trust.ts` does not exist.

- [ ] **Step 3: Implement the trust model**

Create `src/lib/skill-trust.ts` with deterministic scoring:

```ts
import { OFFICIAL_REPOS } from './skills-config';

export type SecurityLevel = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
export type SourceTrustLevel = 'T1' | 'T2' | 'T3';

export type RiskFlagCode =
  | 'requires_token'
  | 'external_network'
  | 'destructive_shell'
  | 'credential_capture'
  | 'file_write'
  | 'thin_source'
  | 'stale_source'
  | 'unstructured_skill';

export interface RiskFlag {
  code: RiskFlagCode;
  severity: 'info' | 'warning' | 'blocker';
  label: string;
}

export interface SkillTrustInput {
  id?: string;
  name?: string;
  owner?: string;
  repo?: string;
  source?: string;
  stars?: number;
  forks?: number;
  updatedAt?: string;
  lastSynced?: string;
  topics?: string[];
  filePath?: string;
  category?: string;
  description?: string | Record<string, string>;
  skillMd?: {
    name?: string;
    description?: string;
    body?: string;
    bodyPreview?: string;
    tags?: string[];
    version?: string;
  };
}

export interface SkillTrustProfile {
  securityLevel: SecurityLevel;
  securityScore: number;
  sourceTrust: SourceTrustLevel;
  sourceScore: number;
  rankScore: number;
  isTrustedRankingEligible: boolean;
  riskFlags: RiskFlag[];
  securityBrief: string;
  primaryTrustReason: string;
  lastAuditedAt: string;
}

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));

function textFromDescription(value: SkillTrustInput['description']): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return Object.values(value).filter(Boolean).join(' ');
}

function bodyText(input: SkillTrustInput): string {
  return [
    input.name || '',
    input.owner || '',
    input.repo || '',
    input.filePath || '',
    textFromDescription(input.description),
    input.skillMd?.name || '',
    input.skillMd?.description || '',
    input.skillMd?.bodyPreview || '',
    input.skillMd?.body || '',
    ...(input.topics || []),
  ]
    .join(' ')
    .toLowerCase();
}

function daysSince(dateValue: string | undefined, now: Date): number {
  const time = dateValue ? Date.parse(dateValue) : Number.NaN;
  if (!Number.isFinite(time)) return 9999;
  return Math.floor((now.getTime() - time) / 86_400_000);
}

function addFlag(flags: RiskFlag[], code: RiskFlagCode, severity: RiskFlag['severity'], label: string) {
  if (!flags.some((flag) => flag.code === code)) flags.push({ code, severity, label });
}

function sourceTrustFor(
  input: SkillTrustInput,
  text: string,
): { level: SourceTrustLevel; score: number; reason: string } {
  const repoKey = `${input.owner || ''}/${input.repo || ''}`;
  if (input.source === 'verified' || OFFICIAL_REPO_KEYS.has(repoKey)) {
    return { level: 'T1', score: 100, reason: 'Official or verified source' };
  }
  if ((input.stars || 0) >= 50 || text.includes('license') || text.includes('github')) {
    return { level: 'T2', score: 75, reason: 'Public source with visible maintenance signals' };
  }
  return { level: 'T3', score: 45, reason: 'Community source with limited independent trust signals' };
}

function securityLevelFor(score: number, hasBlocker: boolean): SecurityLevel {
  if (hasBlocker || score < 35) return 'D';
  if (score >= 95) return 'S+';
  if (score >= 86) return 'S';
  if (score >= 74) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

function briefFor(flags: RiskFlag[], level: SecurityLevel): string {
  if (flags.length === 0)
    return `${level} security: no obvious token, network, destructive shell, or thin-source risk detected.`;
  const labels = flags
    .slice(0, 3)
    .map((flag) => flag.label)
    .join(', ');
  return `${level} security: ${labels}.`;
}

export function assessSkillTrust(input: SkillTrustInput, now: Date = new Date()): SkillTrustProfile {
  const text = bodyText(input);
  const flags: RiskFlag[] = [];
  let securityScore = 100;

  const hasStructuredSkill = Boolean(input.skillMd?.name || input.skillMd?.description || input.skillMd?.bodyPreview);
  const sourceBytes = new TextEncoder().encode(text).length;
  const ageDays = daysSince(input.updatedAt || input.lastSynced, now);

  if (!hasStructuredSkill) {
    securityScore -= 18;
    addFlag(flags, 'unstructured_skill', 'warning', 'unstructured skill metadata');
  }
  if (sourceBytes < 220) {
    securityScore -= 18;
    addFlag(flags, 'thin_source', 'warning', 'thin source material');
  }
  if (ageDays > 365) {
    securityScore -= 12;
    addFlag(flags, 'stale_source', 'warning', 'stale source');
  }
  if (/\b(api[_-]?key|token|oauth|secret|env var|environment variable)\b/i.test(text)) {
    securityScore -= 8;
    addFlag(flags, 'requires_token', 'info', 'credential required');
  }
  if (/\bhttps?:\/\/|webhook|gateway|external api|remote endpoint\b/i.test(text)) {
    securityScore -= 10;
    addFlag(flags, 'external_network', 'warning', 'external network call');
  }
  if (/\brm\s+-rf\b|\bdelete all\b|\bformat disk\b|\bwipe\b/i.test(text)) {
    securityScore -= 80;
    addFlag(flags, 'destructive_shell', 'blocker', 'destructive shell pattern');
  }
  if (/(~\/\.ssh|private key|exfiltrat|upload.*secret|steal|credential capture)/i.test(text)) {
    securityScore -= 80;
    addFlag(flags, 'credential_capture', 'blocker', 'credential capture pattern');
  }
  if (/(\.claude\/|\.cursor\/|\.windsurf\/|copilot-instructions|write file|file system)/i.test(text)) {
    securityScore -= 4;
    addFlag(flags, 'file_write', 'info', 'local file write');
  }

  securityScore = Math.max(0, Math.min(100, Math.round(securityScore)));
  const hasBlocker = flags.some((flag) => flag.severity === 'blocker');
  const securityLevel = securityLevelFor(securityScore, hasBlocker);
  const sourceTrust = sourceTrustFor(input, text);
  const popularityScore = Math.min(100, Math.round(Math.log10((input.stars || 0) + 1) * 25));
  const freshnessScore = ageDays < 30 ? 100 : ageDays < 180 ? 80 : ageDays < 365 ? 55 : 30;
  const installabilityScore = hasStructuredSkill && input.filePath ? 90 : hasStructuredSkill ? 70 : 35;
  const rankScore = Math.round(
    securityScore * 0.35 +
      sourceTrust.score * 0.25 +
      installabilityScore * 0.2 +
      freshnessScore * 0.1 +
      popularityScore * 0.1,
  );

  return {
    securityLevel,
    securityScore,
    sourceTrust: sourceTrust.level,
    sourceScore: sourceTrust.score,
    rankScore,
    isTrustedRankingEligible: !hasBlocker && securityScore >= 60 && sourceTrust.level !== 'T3',
    riskFlags: flags,
    securityBrief: briefFor(flags, securityLevel),
    primaryTrustReason: sourceTrust.reason,
    lastAuditedAt: now.toISOString(),
  };
}
```

- [ ] **Step 4: Add trust fields to public and build types**

Modify `src/lib/skills.ts` `UnifiedSkill` and `scripts/lib/types.ts` `SkillCache` with optional fields:

```ts
securityLevel?: import('./skill-trust').SecurityLevel;
sourceTrust?: import('./skill-trust').SourceTrustLevel;
securityScore?: number;
sourceScore?: number;
rankScore?: number;
isTrustedRankingEligible?: boolean;
riskFlags?: import('./skill-trust').RiskFlag[];
securityBrief?: string;
primaryTrustReason?: string;
lastAuditedAt?: string;
```

For `scripts/lib/types.ts`, use local exported type imports from `../../src/lib/skill-trust`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/lib/skill-trust.test.ts`

Expected: PASS.

Run: `npm run check:astro`

Expected: 0 errors.

---

### Task 2: Persist Trust Profiles During Cache Generation

**Files:**

- Modify: `scripts/build-skills-cache.ts`
- Modify: `scripts/lib/types.ts`
- Test: `src/lib/skill-trust.test.ts`

**Interfaces:**

- Consumes: `assessSkillTrust(skillLike, now)` from Task 1.
- Produces: every newly generated or preserved `SkillCache` record has `securityLevel`, `sourceTrust`, `securityScore`, `sourceScore`, `rankScore`, `isTrustedRankingEligible`, `riskFlags`, `securityBrief`, `primaryTrustReason`, `lastAuditedAt`.

- [ ] **Step 1: Import the trust assessor**

Add near the other shared imports in `scripts/build-skills-cache.ts`:

```ts
import { assessSkillTrust } from '../src/lib/skill-trust';
```

- [ ] **Step 2: Add a helper that mutates a skill with trust fields**

Add below `sharedCalculateQualityScore`:

```ts
function attachTrustProfile<T extends SkillCache>(skill: T): T {
  const trust = assessSkillTrust(skill);
  return Object.assign(skill, trust);
}
```

- [ ] **Step 3: Attach trust after every `qualityScore` assignment**

For every block that currently ends with:

```ts
skill.qualityScore = calculateQualityScore(skill);
skills.push(skill);
```

change it to:

```ts
skill.qualityScore = calculateQualityScore(skill);
attachTrustProfile(skill);
skills.push(skill);
```

Apply the same pattern to cached skills whose `lastSynced` is refreshed:

```ts
const skill: SkillCache = {
  ...existing,
  lastSynced: new Date().toISOString(),
};
skill.qualityScore = calculateQualityScore(skill);
attachTrustProfile(skill);
```

- [ ] **Step 4: Recalculate trust before final save**

In `finalizeAndSave`, before `toPublicSkillCache`, ensure old cached records get the new fields:

```ts
const normalizedSkills = cleanedSkills.map((skill) =>
  toPublicSkillCache(attachTrustProfile(ensureSkillMdContent(skill))),
);
```

- [ ] **Step 5: Verify cache build compiles**

Run: `npx tsc --noEmit --project tsconfig.json`

Expected: no TypeScript errors related to `SkillCache` trust fields.

Run: `npx vitest run src/lib/skill-trust.test.ts`

Expected: PASS.

---

### Task 3: Add Rank and Trust Columns to D1 Sync Path

**Files:**

- Modify: `db/schema.sql`
- Modify: `scripts/generate-d1-seed.ts`
- Modify: `scripts/sync-d1-delta.ts`
- Modify: `scripts/sync-admin-d1.ts`
- Modify: `src/pages/api/admin/sync.ts`
- Modify: `src/lib/kv.ts`
- Test: `src/lib/kv.test.ts`

**Interfaces:**

- Consumes: trust fields persisted in `SkillCache`.
- Produces: D1 columns `security_level`, `source_trust`, `rank_score`, `last_audited_at` and listing rows that expose those values.

- [ ] **Step 1: Extend schema**

In `db/schema.sql`, add columns after `quality_score`:

```sql
    security_level TEXT,
    source_trust TEXT,
    rank_score INTEGER,
    last_audited_at TEXT,
```

Add indexes:

```sql
CREATE INDEX idx_skills_rank_score ON skills(rank_score DESC);
CREATE INDEX idx_skills_security_level ON skills(security_level);
CREATE INDEX idx_skills_source_trust ON skills(source_trust);
CREATE INDEX idx_skills_trusted_rank ON skills(source_trust, security_level, rank_score DESC);
```

- [ ] **Step 2: Extend seed SQL insert**

In `scripts/generate-d1-seed.ts`, compute escaped values:

```ts
const security_level = escapeSql(skill.securityLevel || 'C');
const source_trust = escapeSql(skill.sourceTrust || 'T3');
const rank_score = escapeNumber(skill.rankScore || skill.qualityScore || 0);
const last_audited_at = escapeSql(skill.lastAuditedAt || skill.lastSynced || skill.updatedAt);
```

Change the insert column list to:

```sql
(id, category, owner, repo, repo_path, name, stars, forks, quality_score, security_level, source_trust, rank_score, last_audited_at, updated_at, last_synced, content_hash, data_json)
```

Change the values list to include:

```ts
${quality_score}, ${security_level}, ${source_trust}, ${rank_score}, ${last_audited_at}, ${updated_at}
```

- [ ] **Step 3: Apply the same D1 insert change to delta and admin sync**

Make the same column/value additions in:

```text
scripts/sync-d1-delta.ts
scripts/sync-admin-d1.ts
src/pages/api/admin/sync.ts
```

Use fallback values exactly matching Step 2 so old records can still sync.

- [ ] **Step 4: Extend `SkillListingItem` and D1 mappers**

In `src/lib/kv.ts`, add optional fields to `SkillListingItem`:

```ts
securityLevel?: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
sourceTrust?: 'T1' | 'T2' | 'T3';
rankScore?: number;
isTrustedRankingEligible?: boolean;
riskFlags?: Array<{ code: string; severity: string; label: string }>;
securityBrief?: string;
primaryTrustReason?: string;
lastAuditedAt?: string;
```

For lightweight D1 `SELECT` statements, include:

```sql
security_level,
source_trust,
rank_score,
last_audited_at,
json_extract(data_json, '$.isTrustedRankingEligible') as isTrustedRankingEligible,
json_extract(data_json, '$.riskFlags') as riskFlags,
json_extract(data_json, '$.securityBrief') as securityBrief,
json_extract(data_json, '$.primaryTrustReason') as primaryTrustReason
```

Update `mapD1ListingRow` and `mapLocalListingRow`:

```ts
securityLevel: String(row.security_level ?? row.securityLevel ?? 'C') as SkillListingItem['securityLevel'],
sourceTrust: String(row.source_trust ?? row.sourceTrust ?? 'T3') as SkillListingItem['sourceTrust'],
rankScore: Number(row.rank_score ?? row.rankScore ?? row.qualityScore ?? row.quality_score ?? 0),
isTrustedRankingEligible: row.isTrustedRankingEligible
  ? Boolean(tryParseJSON(String(row.isTrustedRankingEligible), row.isTrustedRankingEligible))
  : Boolean(row.isTrustedRankingEligible),
riskFlags: row.riskFlags ? tryParseJSON(String(row.riskFlags), []) : [],
securityBrief: String(row.securityBrief ?? ''),
primaryTrustReason: String(row.primaryTrustReason ?? ''),
lastAuditedAt: String(row.last_audited_at ?? row.lastAuditedAt ?? ''),
```

- [ ] **Step 5: Update ranking order in lightweight top queries**

Change top/listing order from:

```sql
ORDER BY stars DESC
```

to:

```sql
ORDER BY COALESCE(rank_score, quality_score, 0) DESC, stars DESC
```

For the paged generic listing, keep fallback compatibility by using the same order.

- [ ] **Step 6: Add mapper regression tests**

In `src/lib/kv.test.ts`, add a test fixture row with `security_level: 'S'`, `source_trust: 'T2'`, `rank_score: 87`, and assert `getSkillsListingTop` returns those values.

Run: `npx vitest run src/lib/kv.test.ts`

Expected: PASS.

---

### Task 4: Replace Ranking Semantics on Public Pages and APIs

**Files:**

- Modify: `src/pages/[locale]/popular/index.astro`
- Modify: `src/pages/[locale]/index.astro`
- Modify: `src/pages/api/skills/search.ts`
- Modify: `src/pages/api/search.ts`
- Modify: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`

**Interfaces:**

- Consumes: `rankScore`, `securityLevel`, `sourceTrust`, `isTrustedRankingEligible`.
- Produces: ranking tabs that mean real product lanes: `trusted`, `popular`, `latest`, `security`.

- [ ] **Step 1: Rename rank tabs and sorting**

In `src/pages/[locale]/popular/index.astro`, change `rankTabs` to:

```ts
const rankTabs = isZhCopy
  ? [
      { id: 'trusted', label: '可信榜' },
      { id: 'popular', label: '热门榜' },
      { id: 'latest', label: '新上架' },
      { id: 'security', label: '安全榜' },
    ]
  : [
      { id: 'trusted', label: 'Trusted' },
      { id: 'popular', label: 'Popular' },
      { id: 'latest', label: 'New' },
      { id: 'security', label: 'Security' },
    ];
```

Change accepted rank ids to `trusted`, `popular`, `latest`, `security`, with default `trusted`.

- [ ] **Step 2: Add deterministic sorting functions**

Add in the page script:

```ts
const byRankScore = (a: UnifiedSkill, b: UnifiedSkill) =>
  (b.rankScore || b.qualityScore || 0) - (a.rankScore || a.qualityScore || 0) || byStars(a, b);
const bySecurity = (a: UnifiedSkill, b: UnifiedSkill) =>
  (b.securityScore || 0) - (a.securityScore || 0) || byRankScore(a, b);
const trustedOnly = (skill: UnifiedSkill) => skill.isTrustedRankingEligible !== false && skill.securityLevel !== 'D';
```

Sort lanes:

```ts
if (activeRank === 'security') {
  rankedSkills = rankedSkills.filter(trustedOnly).sort(bySecurity);
} else if (activeRank === 'popular') {
  rankedSkills = rankedSkills.sort(byStars);
} else if (activeRank === 'latest') {
  rankedSkills = rankedSkills.sort(byUpdated);
} else {
  rankedSkills = rankedSkills.filter(trustedOnly).sort(byRankScore);
}
```

- [ ] **Step 3: Update public API ordering**

In `src/pages/api/skills/search.ts`, change default D1 ordering to:

```ts
let orderBy = 'ORDER BY COALESCE(s.rank_score, s.quality_score, 0) DESC, s.stars DESC';
```

When query FTS is active:

```ts
orderBy = 'ORDER BY f.rank ASC, COALESCE(s.rank_score, s.quality_score, 0) DESC, s.stars DESC';
```

In the no-query KV fallback, change sorting to use `rankScore` first:

```ts
return (b.rankScore || b.qualityScore || 0) - (a.rankScore || a.qualityScore || 0) || (b.stars || 0) - (a.stars || 0);
```

- [ ] **Step 4: Update in-memory search bonus**

In `src/lib/search.ts`, adjust `calculateQualityScore` so trust dominates secondary rank:

```ts
const rankScore = typeof skill.rankScore === 'number' ? skill.rankScore / 100 : 0;
const securityBonus =
  skill.securityLevel === 'S+' ? 0.2 : skill.securityLevel === 'S' ? 0.16 : skill.securityLevel === 'A' ? 0.1 : 0;
const sourceBonus = skill.sourceTrust === 'T1' ? 0.2 : skill.sourceTrust === 'T2' ? 0.12 : 0;
return Math.min(1, rankScore * 0.6 + securityBonus + sourceBonus + popularityScore * 0.1);
```

- [ ] **Step 5: Add search test for trust priority**

In `src/lib/search.test.ts`, add a test where two skills match the same query but the lower-star skill has `rankScore: 95`, `securityLevel: 'S+'`, `sourceTrust: 'T1'`; assert it ranks before a higher-star `rankScore: 40` skill.

Run: `npx vitest run src/lib/search.test.ts`

Expected: PASS.

---

### Task 5: Surface Trust Evidence in Cards and Safety Page

**Files:**

- Modify: `src/components/SkillCard.astro`
- Modify: `src/pages/[locale]/safe/index.astro`
- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`
- Test: `tests/pages/public-links.test.ts`

**Interfaces:**

- Consumes: `securityLevel`, `sourceTrust`, `securityBrief`, `primaryTrustReason`, `lastAuditedAt`, `riskFlags`.
- Produces: compact badges on cards, evidence block on detail pages, and a safety page that behaves like a certification center.

- [ ] **Step 1: Extend `SkillCard` props**

In `src/components/SkillCard.astro`, add fields to the `skill` prop type:

```ts
securityLevel?: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
sourceTrust?: 'T1' | 'T2' | 'T3';
rankScore?: number;
securityBrief?: string;
primaryTrustReason?: string;
lastAuditedAt?: string;
```

After owner info, render a compact evidence row:

```astro
<div class="trust-row" aria-label={resolveCopy('Common.trustEvidence', 'Trust evidence')}>
  <span class={`trust-badge trust-${(skill.securityLevel || 'C').replace('+', 'plus').toLowerCase()}`}>
    {skill.securityLevel || 'C'}
  </span>
  <span class="trust-badge">{skill.sourceTrust || 'T3'}</span>
  {skill.rankScore !== undefined && <span class="trust-score">{Math.round(skill.rankScore)} rank</span>}
</div>
```

Add CSS that uses existing palette variables and keeps the row single-line on desktop, wrapping on mobile.

- [ ] **Step 2: Replace safety page checklist with certification center**

In `src/pages/[locale]/safe/index.astro`, remove the current "先看 4 件事" framing and replace hero copy with:

```ts
const pageTitle = isZhCopy ? '安全认证中心' : 'Safety Certification Center';
const pageDescription = isZhCopy
  ? '查看 Killer-Skills 如何为 Skills 做来源可信度、风险标记、安装风险和榜单准入。'
  : 'See how Killer-Skills evaluates source trust, risk flags, install risk, and ranking eligibility.';
```

Replace the matrix sections with four platform-owned lanes:

```ts
const certificationLanes = [
  {
    level: 'S+',
    title: isZhCopy ? '官方或强验证来源' : 'Official or strongly verified',
    rule: 'T1 source, no blocker risk, structured SKILL.md',
  },
  {
    level: 'S',
    title: isZhCopy ? '低风险可推荐' : 'Low-risk recommended',
    rule: 'No blocker risk, recent source, clear install path',
  },
  {
    level: 'A/B',
    title: isZhCopy ? '可用但需标记' : 'Usable with visible flags',
    rule: 'Token, external network, or local write requirements are shown before install',
  },
  {
    level: 'C/D',
    title: isZhCopy ? '降权或拦截' : 'Demoted or blocked',
    rule: 'Thin, stale, destructive, or credential capture signals are excluded from trusted rankings',
  },
];
```

No instructional checklist language should remain.

- [ ] **Step 3: Add detail page evidence block**

In `src/pages/[locale]/skills/[owner]/[...repo].astro`, locate the detail header section and add an evidence block near install controls:

```astro
{
  skill.securityLevel && (
    <section class="skill-trust-panel" aria-labelledby="skill-trust-title">
      <h2 id="skill-trust-title">{isZhCopy ? '平台审核' : 'Platform review'}</h2>
      <div class="skill-trust-grid">
        <span>{skill.securityLevel}</span>
        <span>{skill.sourceTrust || 'T3'}</span>
        <span>{skill.rankScore ? Math.round(skill.rankScore) : 0}</span>
      </div>
      <p>{skill.securityBrief || skill.primaryTrustReason}</p>
    </section>
  )
}
```

- [ ] **Step 4: Add UI copy guard**

In `tests/pages/public-links.test.ts`, add blocked patterns for the safety page source:

```ts
expect(safeSource).not.toMatch(/先看 4 件事|安装前需要检查|用户自行检查|指导用户/i);
expect(safeSource).toMatch(/安全认证中心|Safety Certification Center/);
```

Run: `npx vitest run tests/pages/public-links.test.ts`

Expected: PASS.

---

### Task 6: End-to-End Verification and Cleanup

**Files:**

- Modify only files touched by Tasks 1-5 if verification finds defects.

**Interfaces:**

- Consumes: all prior task outputs.
- Produces: passing tests, Astro check, and a local smoke verification of `/zh`, `/zh/popular`, `/zh/search`, `/zh/safe`, and one skill detail page.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
npx vitest run src/lib/skill-trust.test.ts src/lib/search.test.ts src/lib/kv.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run public page/API regression tests**

Run:

```bash
npx vitest run src/lib/marketplace-overview.test.ts tests/pages/api/marketplace-overview.test.ts tests/pages/public-links.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run Astro check**

Run:

```bash
npm run check:astro
```

Expected: 0 errors. Existing hints are acceptable if unrelated to this plan.

- [ ] **Step 4: Smoke test local routes**

Start or reuse the local dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:4321/zh
http://127.0.0.1:4321/zh/popular
http://127.0.0.1:4321/zh/search
http://127.0.0.1:4321/zh/safe
```

Expected:

- Header labels are only `榜单`, `探索`, `安全`, `专题`.
- Ranking cards show security/source evidence.
- Safety page reads like a certification center, not a checklist.
- No visible "thought", "intent", "rules", "workflow narration", or old directory labels.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- src/lib/skill-trust.ts src/lib/skill-trust.test.ts scripts/build-skills-cache.ts db/schema.sql scripts/generate-d1-seed.ts scripts/sync-d1-delta.ts scripts/sync-admin-d1.ts src/pages/api/admin/sync.ts src/lib/kv.ts src/lib/skills.ts src/lib/search.ts src/pages/[locale]/popular/index.astro src/components/SkillCard.astro src/pages/[locale]/safe/index.astro src/pages/[locale]/skills/[owner]/[...repo].astro
```

Expected: all changes map to trust/ranking/safety work; no unrelated route or copy churn.

---

## Self-Review

- Spec coverage: The plan covers ranking logic, update/freshness fields, crawl trust signals, safety as platform review, competitor-like list fields, card/detail/safety UI, D1 persistence, and tests.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation step remains.
- Type consistency: `securityLevel`, `sourceTrust`, `rankScore`, `securityScore`, `sourceScore`, `riskFlags`, `securityBrief`, `primaryTrustReason`, `lastAuditedAt`, and `isTrustedRankingEligible` are consistently named across model, cache, D1, APIs, and UI.

## Execution Choice

Default for this thread: Inline Execution using `superpowers:executing-plans`, because the user explicitly asked to proceed after installing Superpowers and this Codex App session already has repository context.
