# Phase 1: Authority Surface Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive 34 promote-ready surfaces from "architecture exists" to "metadata + internal links + trust signals wired", starting with a quality-gated manifest backfill and ending with collection-frontmatter guard, manifest-driven JSON-LD validation, and rendering of the existing-but-unrendered `groupingLogic` editorial field.

**Architecture:** Three parallel threads, sequenced by a manifest-backfill prerequisite:
1. **Manifest as single source of structural truth** — backfill missing collection surfaces, then make `authority-surface-public-data.ts` a generated artifact (structural fields only; user-facing copy stays hand-authored).
2. **Metadata automation + validation** — collection frontmatter guard (blog-guard parity) + manifest-driven structured-data validation.
3. **Render wiring** — `SkillRelated` reads manifest; `groupingLogic` rendered; collections-hub two trust sections; `linkingRules` runtime compliance helper; drift/quality-audit extended to see editorial fields.

**Tech Stack:** TypeScript, Astro SSR (Cloudflare Workers), vitest, jq-style JSON scripts, `npx tsx` runners. No new runtime deps.

---

## Spec coverage map

| Spec § | Implements | Tasks |
|---|---|---|
| §4.4 manifest backfill | T1 |
| §4.1 sync-authority-surface-public-data | T2 |
| §4.2 collection-frontmatter-guard | T3 |
| §4.3 structured-data-validate → manifest-driven | T4 |
| §4.7 SkillRelated reads manifest | T5 |
| §5 linkingRules runtime helper | T6 |
| §4.6 collections-hub two trust sections | T7 |
| §4.5 groupingLogic render | T8 |
| §4.8 drift/quality-audit editorial fields | T9 |

---

## File Structure

### New files
- `scripts/backfill-authority-surface-collections.ts` — scan disk collections, append quality-gated ones to manifest. Reports to `reports/seo/latest-authority-surface-backfill.{json,md}`.
- `scripts/sync-authority-surface-public-data.ts` — generator: read manifest, emit `src/lib/authority-surface-public-data.ts` (structural fields only).
- `scripts/seo-collection-frontmatter-guard.ts` — entrypoint; delegates rules to `scripts/lib/seo-collection-frontmatter-guard.ts`.
- `scripts/lib/seo-collection-frontmatter-guard.ts` — pure rules (title/description/seoTitle/seoDescription/keywords) over a parsed collection JSON.导出 `lintCollectionFrontmatter(data, slug)`.
- `src/lib/authority-linking-rules.ts` — `assertLinkingRulesCompliance(entries, opts)` dev-only helper.
- `src/lib/__tests__/authority-linking-rules.test.ts` — vitest for the helper (only imports `vitest`, no Astro).
- `src/lib/__tests__/skill-related-authority-paths.test.ts` — asserts SkillRelated mapping produces surface ids resolvable in `authoritySurfacePublicData`.
- `scripts/lib/__tests__/seo-collection-frontmatter-guard.test.ts` — vitest for the pure rules.
- `scripts/lib/__tests__/backfill-authority-surface-collections.test.ts` — vitest for the quality-gate logic (pure function).

### Modified files
- `data/authority-surfaces.json` — backfilled (Task 1 commit; structural result).
- `src/lib/authority-surface-public-data.ts` — becomes a generated file (Task 2) **with a hand-authored `publicCopy` map keyed by surface id** preserved across regenerations (see §4.1 resolution below).
- `scripts/seo-structured-data-validate.ts` — replace hardcoded `P0_SURFACES` with manifest-derived surface list.
- `src/components/SkillRelated.astro` — replace inline `getRelevantAuthoritySurfaces` with `getAuthoritySurfaceEntries(...)` calls.
- `src/pages/[locale]/collections/[...slug].astro` — add `groupingLogic` render section.
- `src/pages/[locale]/collections/index.astro` — add two trust sections after "Why These Collections Exist".
- `src/i18n.ts` — add `Collections.whenToUseCuratedTitle/Body`, `Collections.directorySecondaryTitle/Body` keys (en + zh).
- `scripts/lib/seo-collection-drift.ts` — extend `CollectionData` interface and add 3 new drift codes for editorial fields.
- `scripts/seo-collection-quality-audit.ts` — extend `CollectionData` and add advisory editorial-completeness score.
- `package.json` — add `sync:authority-surfaces`, `seo:collection-frontmatter:guard`, `backfill:authority-surfaces` scripts.

### §4.1 resolution (carry from spec self-review)

The spec says the generator derives `authority-surface-public-data.ts` from the manifest. But exploration shows **the user-facing `title`/`description` copy differs** between the two files (manifest copy is strategic/internal-facing; public-data copy is user-facing). To avoid rewriting existing user copy, the generator syncs only **structural fields** (`id`, `role`, `tier`, `surfaceClass`, `href`, `placements`) and **merges** with a hand-authored `publicCopy` map keyed by surface id (kept in a separate import `src/lib/authority-surface-public-copy.ts`). New surfaces missing from `publicCopy` cause a hard error so missing copy is explicit. This preserves both the "single source of structural truth" goal and existing user-facing wording.

---

## Task 1: Manifest backfill — quality-gated collection surface intake

**Files:**
- Create: `scripts/backfill-authority-surface-collections.ts`
- Create: `scripts/lib/__tests__/backfill-authority-surface-collections.test.ts`
- Create: `scripts/lib/backfill-authority-surface-collections.ts` (pure quality-gate)
- Reports to: `reports/seo/latest-authority-surface-backfill.{json,md}`
- Modify: `data/authority-surfaces.json` (after manual review)

- [ ] **Step 1: Write the failing test for the pure quality-gate**

`scripts/lib/__tests__/backfill-authority-surface-collections.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { evaluateCollectionForBackfill } from '../backfill-authority-surface-collections';

describe('backfill quality gate', () => {
  it('admits a collection with editorial block and reviewedAt', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { selectionReason: { en: 'x' }, maintenance: { reviewedAt: '2026-06-01' } },
    } as any, { existingSlugs: new Set(['other']), driftIssues: {} });
    expect(result.admit).toBe(true);
  });

  it('rejects a collection already in manifest', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { maintenance: { reviewedAt: '2026-06-01' } },
    } as any, { existingSlugs: new Set(['top-foo']), driftIssues: {} });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('already_in_manifest');
  });

  it('rejects a collection missing editorial block', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
    } as any, { existingSlugs: new Set(), driftIssues: {} });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('missing_editorial');
  });

  it('rejects a collection missing reviewedAt', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { selectionReason: { en: 'x' }, maintenance: {} },
    } as any, { existingSlugs: new Set(), driftIssues: {} });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('missing_reviewed_at');
  });

  it('rejects a collection flagged in drift issues', () => {
    const result = evaluateCollectionForBackfill({
      canonicalSlug: 'top-foo',
      editorial: { selectionReason: { en: 'x' }, maintenance: { reviewedAt: '2026-06-01' } },
    } as any, { existingSlugs: new Set(), driftIssues: { 'top-foo': ['duplicate_mcp_slug_token'] } });
    expect(result.admit).toBe(false);
    expect(result.reason).toBe('drift_issue');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/__tests__/backfill-authority-surface-collections.test.ts`
Expected: FAIL with "Cannot find module '../backfill-authority-surface-collections'".

- [ ] **Step 3: Implement the pure quality-gate**

`scripts/lib/backfill-authority-surface-collections.ts`:
```ts
export type BackfillVerdict = {
  admit: boolean;
  reason: 'already_in_manifest' | 'missing_editorial' | 'missing_reviewed_at' | 'drift_issue' | 'ok';
};

export type EvaluateArgs = {
  existingSlugs: Set<string>;
  driftIssues: Record<string, string[]>;
};

const DRIFT_CODES_THAT_BLOCK = new Set([
  'duplicate_mcp_slug_token',
  'duplicate_server_slug_token',
  'canonical_map_mismatch',
]);

export function evaluateCollectionForBackfill(
  collection: { canonicalSlug?: string; editorial?: { selectionReason?: unknown; trustSignals?: unknown; maintenance?: { reviewedAt?: string } } },
  args: EvaluateArgs,
): BackfillVerdict {
  const slug = collection.canonicalSlug;
  if (!slug) return { admit: false, reason: 'missing_editorial' };
  if (args.existingSlugs.has(slug)) return { admit: false, reason: 'already_in_manifest' };

  const issues = args.driftIssues[slug] ?? [];
  if (issues.some((code) => DRIFT_CODES_THAT_BLOCK.has(code))) {
    return { admit: false, reason: 'drift_issue' };
  }

  const editorial = collection.editorial;
  const hasEditorialContent =
    editorial &&
    ((editorial.selectionReason && Object.values(editorial.selectionReason as Record<string, string>).some(Boolean)) ||
      (editorial.trustSignals && Object.values(editorial.trustSignals as Record<string, string[]>).some((v) => v && v.length)));
  if (!hasEditorialContent) return { admit: false, reason: 'missing_editorial' };
  if (!editorial?.maintenance?.reviewedAt) return { admit: false, reason: 'missing_reviewed_at' };

  return { admit: true, reason: 'ok' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/backfill-authority-surface-collections.test.ts`
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Implement the driver script that reads disk + manifest + writes report**

`scripts/backfill-authority-surface-collections.ts`:
```ts
#!/usr/bin/env npx tsx
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateCollectionForBackfill } from './lib/backfill-authority-surface-collections';

type LocalizedText = Record<string, string>;
type AuthorityManifest = {
  surfaces: Array<{ id: string; surfaceClass: string; href: string; tier: string }>;
};
type CollectionJson = {
  canonicalSlug?: string;
  title?: LocalizedText;
  description?: LocalizedText;
  editorial?: {
    selectionReason?: LocalizedText;
    trustSignals?: Record<string, string[]>;
    maintenance?: { reviewedAt?: string };
  };
  featured?: boolean;
  category?: string;
};

const ROOT = process.cwd();
const COLLECTIONS_DIR = resolve(ROOT, 'src/content/collections');
const MANIFEST_PATH = resolve(ROOT, 'data/authority-surfaces.json');
const DRIFT_PATH = resolve(ROOT, 'data/seo-collection-drift.json');
const REPORT_DIR = resolve(ROOT, 'reports/seo');
const REPORT_BASE = 'latest-authority-surface-backfill';

function readJson<T>(p: string): T {
  if (!p) return {} as T;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return {} as T;
  }
}

function loadManifestSlugs(manifest: AuthorityManifest): Set<string> {
  return new Set(
    manifest.surfaces
      .filter((s) => s.surfaceClass === 'collection')
      .map((s) => s.href.replace(/^\/{locale}\/collections\//, '')),
  );
}

function loadDriftIssues(): Record<string, string[]> {
  const drift = readJson<{ issues?: Array<{ slug: string; code: string }> }>(DRIFT_PATH);
  const map: Record<string, string[]> = {};
  for (const issue of drift.issues ?? []) {
    (map[issue.slug] ??= []).push(issue.code);
  }
  return map;
}

function loadDiskCollections(): CollectionJson[] {
  return readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<CollectionJson>(resolve(COLLECTIONS_DIR, f)));
}

function buildSurfaceRecordFromCollection(slug: string, c: CollectionJson) {
  return {
    id: `collection-${slug.replace(/^top-/, '').replace(/-/g, '-')}`,
    role: 'primary',
    tier: c.featured ? 'P0' : 'P1',
    surfaceClass: 'collection',
    href: `/{locale}/collections/${slug}`,
    title: c.title ?? { en: slug },
    description: c.description ?? { en: '' },
    rationale: { en: `Backfilled from disk collection ${slug}; meets editorial + reviewedAt quality gate.` },
    placements: ['home', 'skills', 'collections', 'solutions'],
  };
}

function main() {
  const manifest = readJson<AuthorityManifest>(MANIFEST_PATH);
  const existingSlugs = loadManifestSlugs(manifest);
  const driftIssues = loadDriftIssues();
  const disk = loadDiskCollections();

  type Row = { slug: string; verdict: string; admit: boolean };
  const rows: Row[] = [];
  const admitted: Array<{ slug: string; record: ReturnType<typeof buildSurfaceRecordFromCollection> }> = [];

  for (const c of disk) {
    const slug = c.canonicalSlug;
    if (!slug) continue;
    const verdict = evaluateCollectionForBackfill(c, { existingSlugs, driftIssues });
    rows.push({ slug, verdict: verdict.reason, admit: verdict.admit });
    if (verdict.admit) admitted.push({ slug, record: buildSurfaceRecordFromCollection(slug, c) });
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    existingManifestSlugs: [...existingSlugs].sort(),
    diskCollectionCount: disk.filter((c) => c.canonicalSlug).length,
    admitted: admitted.map((a) => a.slug).sort(),
    deferred: rows.filter((r) => !r.admit).map((r) => ({ slug: r.slug, reason: r.verdict })).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.json`), JSON.stringify(report, null, 2) + '\n');

  const md = [
    `# Authority Surface Backfill Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `## Summary`,
    `- existing manifest collection slugs: ${report.existingManifestSlugs.length}`,
    `- disk collections with canonicalSlug: ${report.diskCollectionCount}`,
    `- admitted (ready to append): ${report.admitted.length}`,
    `- deferred: ${report.deferred.length}`,
    ``,
    `## Admitted (${report.admitted.length})`,
    ...report.admitted.map((s) => `- ${s}`),
    ``,
    `## Deferred (${report.deferred.length})`,
    ...report.deferred.map((d) => `- ${d.slug} — ${d.reason}`),
    ``,
  ].join('\n');
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.md`), md);

  console.log(`Backfill report written: ${REPORT_DIR}/${REPORT_BASE}.{json,md}`);
  console.log(`Admitted ${admitted.length} new collection surfaces. To apply, append to data/authority-surfaces.json manually.`);
}

main();
```

- [ ] **Step 6: Run the driver script and inspect the report**

Run: `npx tsx scripts/backfill-authority-surface-collections.ts`
Expected: prints summary; `reports/seo/latest-authority-surface-backfill.md` lists admitted + deferred with reasons; admitted count should be in the 5–15 range (depends on current editorial coverage — known that 26/38 have reviewedAt).

- [ ] **Step 7: Manually append admitted surfaces to `data/authority-surfaces.json`**

Open `data/authority-surfaces.json`, append each admitted surface's record from `buildSurfaceRecordFromCollection` to the `surfaces[]` array (preserve the manifest's existing ordering convention — primary collections grouped by tier). Use the JSON report's `admitted` field for the slug list; consult `reports/seo/latest-authority-surface-backfill.json` for each record's `id` (or craft a readable id following the existing `collection-<short-name>` pattern).

**Do NOT commit yet** — this step produces a manifest change for human review; commit happens in Step 8 after a sanity check.

- [ ] **Step 8: Verify manifest integrity and commit**

Run: `npx tsx scripts/seo-authority-surface-program.ts` (existing validator/generator that asserts unique ids and tier counts; should not error).
Expected: no "Duplicate id" errors, summary surfaces count increased by admitted count.

```bash
git add data/authority-surfaces.json reports/seo/latest-authority-surface-backfill.json reports/seo/latest-authority-surface-backfill.md scripts/backfill-authority-surface-collections.ts scripts/lib/backfill-authority-surface-collections.ts scripts/lib/__tests__/backfill-authority-surface-collections.test.ts
git commit -m "feat(seo): backfill authority surface manifest with quality-gated collections

Adds a backfill script that scans src/content/collections/*.json and
admits collections meeting editorial + reviewedAt quality gates. Appends
admitted surfaces to data/authority-surfaces.json so the manifest becomes
the complete collection-surface inventory.

[skip ci]"
```

---

## Task 2: sync-authority-surface-public-data generator

**Files:**
- Create: `scripts/sync-authority-surface-public-data.ts`
- Create: `src/lib/authority-surface-public-copy.ts` (hand-authored user-facing copy map, extracted from current `authority-surface-public-data.ts`)
- Modify: `src/lib/authority-surface-public-data.ts` (becomes generated; structural fields from manifest + copy merged from `authority-surface-public-copy.ts`)

**Resolution: structural fields auto-synced; user-facing title/description live in a separate hand-authored `authority-surface-public-copy.ts`.**

- [ ] **Step 1: Extract existing user-facing copy into `src/lib/authority-surface-public-copy.ts`**

Create `src/lib/authority-surface-public-copy.ts` by copying the `title`/`description` pairs from the current `src/lib/authority-surface-public-data.ts` verbatim, keyed by surface id:

```ts
// Hand-authored user-facing copy for authority surfaces, keyed by surface id.
// Generator (scripts/sync-authority-surface-public-data.ts) merges this with
// structural fields from data/authority-surfaces.json. DO NOT auto-regenerate.
export const authoritySurfacePublicCopy: Record<string, {
  title: { en: string; zh: string };
  description: { en: string; zh: string };
}> = {
  'home-root': {
    title: { en: 'Killer-Skills Homepage', zh: '首页总入口' },
    description: {
      en: 'Start with curated collections, official tools, solution pages, and installation guidance.',
      zh: '从精选合集、官方工具、场景方案和安装文档开始。',
    },
  },
  // ... (all 33 surfaces from the current authority-surface-public-data.ts)
  'skills-directory': {
    title: { en: 'Full Skills Directory', zh: '全量 Skills 目录' },
    description: {
      en: 'Browse the full skills directory when you want wider coverage after checking curated starting points.',
      zh: '看过精选入口后，如果还需要更广的覆盖范围，可以继续浏览完整 skills 目录。',
    },
  },
};
```

Use the existing `authority-surface-public-data.ts` content (lines 1–516) to populate every entry — copy title.en/zh and description.en/zh verbatim for each surface id in order.

- [ ] **Step 2: Add a vitest asserting every manifest surface has public copy**

`src/lib/__tests__/authority-surface-public-copy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { authoritySurfacePublicCopy } from '../authority-surface-public-copy';

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'data/authority-surfaces.json'), 'utf8'),
) as { surfaces: Array<{ id: string }> };

describe('authoritySurfacePublicCopy coverage', () => {
  for (const surface of manifest.surfaces) {
    it(`${surface.id} has user-facing copy`, () => {
      const copy = authoritySurfacePublicCopy[surface.id];
      expect(copy, `surface ${surface.id} missing from authoritySurfacePublicCopy`).toBeDefined();
      expect(copy.title?.en, `${surface.id} title.en`).toBeTruthy();
      expect(copy.title?.zh, `${surface.id} title.zh`).toBeTruthy();
      expect(copy.description?.en, `${surface.id} description.en`).toBeTruthy();
      expect(copy.description?.zh, `${surface.id} description.zh`).toBeTruthy();
    });
  }
});
```

- [ ] **Step 3: Add copy entries for backfilled surfaces until the test passes**

For every surface admitted in Task 1 Step 7 that is now in the manifest but missing from `authoritySurfacePublicCopy`, write a new entry using the manifest's `title`/`description` localized text as a starting point, polished into user-facing form (the manifest copy may be strategic — rephrase to user-facing voice, matching the tone of existing entries like `collection-claude-code`).

Run: `npx vitest run src/lib/__tests__/authority-surface-public-copy.test.ts`
Expected: PASS once every manifest surface has copy in both en and zh.

- [ ] **Step 4: Write the generator script**

`scripts/sync-authority-surface-public-data.ts`:
```ts
#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type LocalizedText = Record<string, string>;
type ManifestSurface = {
  id: string;
  role: string;
  tier: string;
  surfaceClass: string;
  href: string;
  placements: string[];
};
type Manifest = { surfaces: ManifestSurface[] };
type PublicCopyEntry = {
  title: { en: string; zh: string };
  description: { en: string; zh: string };
};

const ROOT = process.cwd();
const MANIFEST_PATH = resolve(ROOT, 'data/authority-surfaces.json');
const OUTPUT_PATH = resolve(ROOT, 'src/lib/authority-surface-public-data.ts');

function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

// Inline import of the copy map (avoid TS path resolution issues in tsx).
const copyModule = require('../src/lib/authority-surface-public-copy');
const publicCopy: Record<string, PublicCopyEntry> = copyModule.authoritySurfacePublicCopy;

function renderSurface(s: ManifestSurface): string {
  const copy = publicCopy[s.id];
  if (!copy) {
    throw new Error(`Surface ${s.id} missing from authoritySurfacePublicCopy. Add hand-authored copy in src/lib/authority-surface-public-copy.ts.`);
  }
  const placements = `[${s.placements.map((p) => `'${p}'`).join(', ')}]`;
  return [
    `    {`,
    `      id: '${s.id}',`,
    `      role: '${s.role}',`,
    `      tier: '${s.tier}',`,
    `      surfaceClass: '${s.surfaceClass}',`,
    `      href: '${s.href}',`,
    `      title: { en: ${JSON.stringify(copy.title.en)}, zh: ${JSON.stringify(copy.title.zh)} },`,
    `      description: { en: ${JSON.stringify(copy.description.en)}, zh: ${JSON.stringify(copy.description.zh)} },`,
    `      placements: ${placements},`,
    `    },`,
  ].join('\n');
}

function main() {
  const manifest = readManifest();
  const head = [
    `// AUTO-GENERATED by scripts/sync-authority-surface-public-data.ts — DO NOT EDIT.`,
    `// Structural fields come from data/authority-surfaces.json; user-facing copy is`,
    `// hand-authored in src/lib/authority-surface-public-copy.ts.`,
    `// Regenerate with: npm run sync:authority-surfaces`,
    ``,
    `export const authoritySurfacePublicData = {`,
    `  surfaces: [`,
  ].join('\n');
  const body = manifest.surfaces.map(renderSurface).join('\n');
  const tail = `  ],\n} as const;\n`;
  writeFileSync(OUTPUT_PATH, head + body + '\n' + tail);
  console.log(`Wrote ${OUTPUT_PATH} (${manifest.surfaces.length} surfaces)`);
}

main();
```

- [ ] **Step 5: Add the npm script**

In `package.json`, add to the `"scripts"` block (alphabetical near other `sync:*` scripts):
```json
"sync:authority-surfaces": "npx tsx scripts/sync-authority-surface-public-data.ts",
```

- [ ] **Step 6: Run the generator and diff against the current file**

Run: `npm run sync:authority-surfaces && git diff --stat src/lib/authority-surface-public-data.ts`
Expected: the file is rewritten with the new header comment and the structural fields now mirror the manifest exactly. The title/description text for originally-present surfaces is **unchanged** because copy came verbatim from the extracted `authority-surface-public-copy.ts`. New backfilled surfaces show their hand-authored copy.

- [ ] **Step 7: Run the existing authority-surfaces test to confirm no behavioral regression**

Run: `npx vitest run src/lib/authority-surfaces.test.ts`
Expected: PASS — recovery-path routing and localized titles still match (the test asserts titles like `'CLI 总览文档'` came from the existing copy, which is preserved).

- [ ] **Step 8: Add a CI-parity check that the generated file is up to date**

In `package.json`, extend the closest existing guard script (look for one like `guard:public-ai-output` or add a new one):
```json
"guard:authority-surfaces-sync": "npm run sync:authority-surfaces && git diff --exit-code src/lib/authority-surface-public-data.ts",
```
Then include `guard:authority-surfaces-sync` in the `validate:public-surface` aggregate script's command list (replace `npm run` aggregate is acceptable; append `&& npm run guard:authority-surfaces-sync`).

- [ ] **Step 9: Commit**

```bash
git add scripts/sync-authority-surface-public-data.ts src/lib/authority-surface-public-copy.ts src/lib/authority-surface-public-data.ts src/lib/__tests__/authority-surface-public-copy.test.ts package.json
git commit -m "feat(seo): generate authority-surface-public-data from manifest + hand-authored copy

Splits the hand-maintained TS dup into: structural fields (synced from
data/authority-surfaces.json by scripts/sync-authority-surface-public-data.ts)
plus user-facing copy (hand-authored in src/lib/authority-surface-public-copy.ts).
A vitest asserts every manifest surface has copy; a CI guard asserts the
generated file matches what the generator emits.

[skip ci]"
```

---

## Task 3: collection-frontmatter-guard

**Files:**
- Create: `scripts/lib/seo-collection-frontmatter-guard.ts` (pure rules)
- Create: `scripts/lib/__tests__/seo-collection-frontmatter-guard.test.ts`
- Create: `scripts/seo-collection-frontmatter-guard.ts` (driver)
- Reports to: `reports/seo/latest-collection-frontmatter-guard.{json,md}`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test for the pure rules**

`scripts/lib/__tests__/seo-collection-frontmatter-guard.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { lintCollectionFrontmatter } from '../seo-collection-frontmatter-guard';

describe('lintCollectionFrontmatter', () => {
  it('passes a well-formed collection', () => {
    const result = lintCollectionFrontmatter({
      title: { en: 'A'.repeat(40), zh: '齐' .repeat(20) },
      description: { en: 'B'.repeat(120), zh: '内' .repeat(60) },
      seoTitle: { en: 'C'.repeat(50) },
      seoDescription: { en: 'D'.repeat(120) },
      keywords: { en: ['agent workflow', 'skills'] },
    } as any, 'good-slug');
    expect(result.violations).toEqual([]);
  });

  it('flags missing title', () => {
    const result = lintCollectionFrontmatter({ title: {} } as any, 's');
    expect(result.violations).toContainEqual(expect.objectContaining({ field: 'title', code: 'missing' }));
  });

  it('flags seoTitle over 60 chars', () => {
    const result = lintCollectionFrontmatter({ title: { en: 'ok' }, seoTitle: { en: 'X'.repeat(65) } } as any, 's');
    expect(result.violations).toContainEqual(expect.objectContaining({ field: 'seoTitle', code: 'too_long' }));
  });

  it('flags seoDescription over 155 chars', () => {
    const result = lintCollectionFrontmatter({ title: { en: 'ok' }, seoDescription: { en: 'X'.repeat(160) } } as any, 's');
    expect(result.violations).toContainEqual(expect.objectContaining({ field: 'seoDescription', code: 'too_long' }));
  });

  it('flags seoDescription under 40 chars', () => {
    const result = lintCollectionFrontmatter({ title: { en: 'ok' }, seoDescription: { en: 'X'.repeat(30) } } as any, 's');
    expect(result.violations).toContainEqual(expect.objectContaining({ field: 'seoDescription', code: 'too_short' }));
  });

  it('flags low-intent keywords', () => {
    const result = lintCollectionFrontmatter({ title: { en: 'ok' }, keywords: { en: ['best skills', 'top tools'] } } as any, 's');
    expect(result.violations.some((v) => v.field === 'keywords' && v.code === 'low_intent')).toBe(true);
  });

  it('does not flag slug prefix top-* in keywords check (slug is not keywords)', () => {
    const result = lintCollectionFrontmatter({ title: { en: 'ok' }, keywords: { en: ['agent workflow'] } }, 'top-claude-code-skills');
    expect(result.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/__tests__/seo-collection-frontmatter-guard.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement the pure rules**

`scripts/lib/seo-collection-frontmatter-guard.ts`:
```ts
export type LintViolation = {
  field: 'title' | 'description' | 'seoTitle' | 'seoDescription' | 'keywords';
  code: 'missing' | 'too_short' | 'too_long' | 'low_intent' | 'empty';
  locale: string;
  message: string;
};

export type LintResult = {
  violations: LintViolation[];
  warnings: LintViolation[];
};

const LOW_INTENT_KEYWORDS = new Set(['best', 'top', 'free', 'comparison', 'interview', 'what is']);
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MIN = 40;
const SEO_DESCRIPTION_MAX = 155;

function isMostlyAscii(text: string): boolean {
  if (!text) return true;
  let ascii = 0;
  for (const ch of text) if (ch.charCodeAt(0) <= 127) ascii += 1;
  return ascii / text.length >= 0.8;
}

function checkLocalizedField(
  out: LintViolation[],
  field: LintViolation['field'],
  values: Record<string, string> | undefined,
  minLen: number,
  maxLen: number,
  isCjkShorter: boolean,
  slug: string,
): void {
  if (!values || Object.keys(values).length === 0) {
    out.push({ field, code: 'missing', locale: '*', message: `${field} missing for ${slug}` });
    return;
  }
  for (const [locale, value] of Object.entries(values)) {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      out.push({ field, code: 'empty', locale, message: `${field} empty (${locale}) in ${slug}` });
      continue;
    }
    const effectiveMin = isCjkShorter && !isMostlyAscii(trimmed) ? Math.floor(minLen / 2) : minLen;
    const effectiveMax = isCjkShorter && !isMostlyAscii(trimmed) ? Math.floor(maxLen / 2) : maxLen;
    if (trimmed.length > maxLen) {
      out.push({ field, code: 'too_long', locale, message: `${field} too long (${trimmed.length} > ${maxLen}, ${locale}) in ${slug}` });
    }
    if (trimmed.length < effectiveMin) {
      out.push({ field, code: 'too_short', locale, message: `${field} too short (${trimmed.length} < ${effectiveMin}, ${locale}) in ${slug}` });
    }
  }
}

function checkKeywords(out: LintViolation[], values: Record<string, string[]> | undefined, slug: string): void {
  if (!values) return;
  for (const [locale, list] of Object.entries(values)) {
    for (const kw of list ?? []) {
      const tokens = kw.toLowerCase().split(/\s+/);
      for (const t of tokens) {
        if (LOW_INTENT_KEYWORDS.has(t)) {
          out.push({
            field: 'keywords',
            code: 'low_intent',
            locale,
            message: `keyword "${kw}" contains low-intent token "${t}" in ${slug}`,
          });
        }
      }
    }
  }
}

export function lintCollectionFrontmatter(data: {
  title?: Record<string, string>;
  description?: Record<string, string>;
  seoTitle?: Record<string, string>;
  seoDescription?: Record<string, string>;
  keywords?: Record<string, string[]>;
}, slug: string): LintResult {
  const violations: LintViolation[] = [];
  const warnings: LintViolation[] = [];

  checkLocalizedField(violations, 'title', data.title, 6, 80, true, slug);
  checkLocalizedField(violations, 'description', data.description, 30, 240, true, slug);
  // seoTitle / seoDescription: optional but if present, must satisfy length bounds.
  if (data.seoTitle) checkLocalizedField(violations, 'seoTitle', data.seoTitle, 6, SEO_TITLE_MAX, true, slug);
  if (data.seoDescription) checkLocalizedField(violations, 'seoDescription', data.seoDescription, SEO_DESCRIPTION_MIN, SEO_DESCRIPTION_MAX, true, slug);
  checkKeywords(violations, data.keywords, slug);

  return { violations, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/__tests__/seo-collection-frontmatter-guard.test.ts`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Implement the driver**

`scripts/seo-collection-frontmatter-guard.ts`:
```ts
#!/usr/bin/env npx tsx
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintCollectionFrontmatter, type LintResult } from './lib/seo-collection-frontmatter-guard';

const ROOT = process.cwd();
const COLLECTIONS_DIR = resolve(ROOT, 'src/content/collections');
const REPORT_DIR = resolve(ROOT, 'reports/seo');
const REPORT_BASE = 'latest-collection-frontmatter-guard';

function loadCollections(): Array<{ slug: string; data: any }> {
  return readdirSync(COLLECTIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(readFileSync(resolve(COLLECTIONS_DIR, f), 'utf8'));
      const slug = data.canonicalSlug ?? f.replace(/\.json$/, '');
      return { slug, data };
    });
}

function main() {
  const items = loadCollections();
  const results: Array<{ slug: string; result: LintResult }> = [];
  let totalViolations = 0;
  let totalWarnings = 0;
  for (const { slug, data } of items) {
    const result = lintCollectionFrontmatter(data, slug);
    results.push({ slug, result });
    totalViolations += result.violations.length;
    totalWarnings += result.warnings.length;
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    collectionCount: items.length,
    totalViolations,
    totalWarnings,
    collections: results.map((r) => ({
      slug: r.slug,
      violations: r.result.violations,
      warnings: r.result.warnings,
    })),
  };
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.json`), JSON.stringify(report, null, 2) + '\n');

  const md = [
    `# Collection Frontmatter Guard Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `## Summary`,
    `- collections checked: ${report.collectionCount}`,
    `- violations: ${totalViolations}`,
    `- warnings: ${totalWarnings}`,
    ``,
    `## Collections with violations`,
    ...results
      .filter((r) => r.result.violations.length > 0)
      .map((r) => `- **${r.slug}** (${r.result.violations.length})\n` +
        r.result.violations.map((v) => `  - [${v.field}] ${v.code} (${v.locale}) — ${v.message}`).join('\n')),
    ``,
  ].join('\n');
  writeFileSync(resolve(REPORT_DIR, `${REPORT_BASE}.md`), md);

  if (totalViolations > 0) {
    console.error(`Collection frontmatter guard failed with ${totalViolations} violation(s).`);
    console.error(`See reports/seo/${REPORT_BASE}.md`);
    process.exit(1);
  }
  console.log(`Collection frontmatter guard passed: ${items.length} collections checked.`);
}

main();
```

- [ ] **Step 6: Add the npm script**

In `package.json` (near other `seo:frontmatter:guard`-style scripts):
```json
"seo:collection-frontmatter:guard": "node --import tsx scripts/seo-collection-frontmatter-guard.ts",
```

- [ ] **Step 7: Run the guard and read the report**

Run: `npx tsx scripts/seo-collection-frontmatter-guard.ts`
Expected: a report listing however many collections exceed bounds. If violations exceed 0, fix the offending collection JSON files (trim seoTitle/seoDescription, drop low-intent keywords) — these are content fixes and should be done in the same commit as the guard introduction so the guard passes from day one.

- [ ] **Step 8: Add the guard to CI aggregate**

In `package.json`, append `&& npm run seo:collection-frontmatter:guard` to the `validate:public-surface` script's command list.

- [ ] **Step 9: Commit**

```bash
git add scripts/seo-collection-frontmatter-guard.ts scripts/lib/seo-collection-frontmatter-guard.ts scripts/lib/__tests__/seo-collection-frontmatter-guard.test.ts reports/seo/latest-collection-frontmatter-guard.json reports/seo/latest-collection-frontmatter-guard.md package.json
# Also add any collection JSON content fixes:
git add src/content/collections/*.json
git commit -m "feat(seo): add collection frontmatter guard (blog-guard parity)

Pure rule module + driver validating seoTitle<=60 / seoDescription<=155 /
non-empty title+description / no low-intent keywords across all
src/content/collections/*.json. Blog's seo-frontmatter-guard now has a
collection counterpart. Wired into validate:public-surface aggregate.

[skip ci]"
```

---

## Task 4: structured-data-validate — manifest-driven surface list

**Files:**
- Modify: `scripts/seo-structured-data-validate.ts` (replace hardcoded `P0_SURFACES`)

- [ ] **Step 1: Read current `P0_SURFACES` and `SCHEMA_REQUIRED_FIELDS`**

Run: `sed -n '80,150p' scripts/seo-structured-data-validate.ts` — to see the current hardcoded array and the per-type required-fields map.

- [ ] **Step 2: Replace the hardcoded array with a manifest-derived loader**

Locate the `P0_SURFACES` const and the surrounding loader. Replace with a function that reads `data/authority-surfaces.json` and emits one entry per surface where `surfaceClass === 'collection'` and `tier` is `'P0'` or `'P1'`. Each entry: `{ url: <resolved href>, surfaceClass, tier, id }`. Reuse `scripts/lib/authority-surfaces-paths.ts::extractPathFromHref` to convert `/{locale}/collections/<slug>` into `/en/collections/<slug>`.

The expected-schema mapping becomes:
- `surfaceClass === 'collection'` → expects `ItemList`
- `surfaceClass === 'hub'` (collections-hub) → expects `CollectionPage`

`guide`, `comparison`, `solution`, `directory` surfaces are out of scope for this validation run (per spec §4.3, only collections are extended here).

Insert above `main()`:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractPathFromHref } from './lib/authority-surfaces-paths';

type ManifestSurface = { id: string; tier: string; surfaceClass: string; href: string };
type Manifest = { surfaces: ManifestSurface[] };

function loadSurfacesFromManifest(): Array<{ id: string; url: string; expectedSchema: string }> {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'data/authority-surfaces.json'), 'utf8')) as Manifest;
  return manifest.surfaces
    .filter((s) => s.surfaceClass === 'collection' && (s.tier === 'P0' || s.tier === 'P1'))
    .map((s) => {
      const path = extractPathFromHref(s.href); // strips {locale} → /collections/<slug>
      const url = `https://killer-skills.com/en${path}`;
      const expectedSchema = s.surfaceClass === 'collection' ? 'ItemList' : 'CollectionPage';
      return { id: s.id, url, expectedSchema };
    });
}
```

Then replace any references to `P0_SURFACES` with `loadSurfacesFromManifest()` in the validation loop and report output. Mark the report header as "manifest-derived surface set".

- [ ] **Step 3: Run the validator and confirm coverage**

Run: `npx tsx scripts/seo-structured-data-validate.ts`
Expected: validator fetches manifest-derived set (≈17 P0+P1 collections pre-backfill; more after Task 1 commit), one row per surface in `reports/seo/latest-structured-data-validation.md`, with the expected schema type per surface. If live fetches fail due to local environment, the script's existing network-failure fallback applies; ensure the report's `surfaceCount` matches the manifest P0+P1 collection count.

- [ ] **Step 4: Commit**

```bash
git add scripts/seo-structured-data-validate.ts reports/seo/latest-structured-data-validation.json reports/seo/latest-structured-data-validation.md
git commit -m "feat(seo): structured-data-validate now driven by authority surface manifest

Replaces the hardcoded P0_SURFACES list with a manifest-derived set covering
all P0+P1 collection surfaces. New surfaces admitted by backfill (Task 1)
are automatically picked up — no more hardcoded shortlist drift.

[skip ci]"
```

---

## Task 5: SkillRelated.astro reads manifest

**Files:**
- Modify: `src/components/SkillRelated.astro` (replace inline `getRelevantAuthoritySurfaces` lines 35-132)
- Create: `src/lib/__tests__/skill-related-authority-paths.test.ts`

- [ ] **Step 1: Read the current `getRelevantAuthoritySurfaces` to preserve its category→surface selection logic**

Run: `sed -n '1,140p' src/components/SkillRelated.astro`

Document which (category-pattern → set of surface ids) mappings the inline function encodes:
- always: `collections-hub`, `docs-installation`, `skills-directory`
- claude/ai-agent/workflow/productivity: add `collection-official-trusted-tools`, `collection-agent-workflows`
- cursor/ide/editor/completion: add `collection-cursor`
- (workflow automation keywords): add `solution-agent-workflows`

- [ ] **Step 2: Write a failing test that verifies the new mapping resolves to public-data surfaces**

`src/lib/__tests__/skill-related-authority-paths.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pickAuthoritySurfaceIdsForCategory } from '../skill-related-authority-paths';
import { authoritySurfacePublicData } from '../authority-surface-public-data';

const knownIds = new Set(authoritySurfacePublicData.surfaces.map((s) => s.id));

describe('pickAuthoritySurfaceIdsForCategory', () => {
  it('always includes hub/installation/directory', () => {
    const ids = pickAuthoritySurfaceIdsForCategory('unmatched');
    expect(ids).toContain('collections-hub');
    expect(ids).toContain('docs-installation');
    expect(ids).toContain('skills-directory');
  });

  it('adds official + workflow collections for claude category', () => {
    const ids = pickAuthoritySurfaceIdsForCategory('claude');
    expect(ids).toContain('collection-official-trusted-tools');
    expect(ids).toContain('collection-agent-workflows');
  });

  it('adds cursor collection for editor category', () => {
    const ids = pickAuthoritySurfaceIdsForCategory('cursor');
    expect(ids).toContain('collection-cursor');
  });

  it('all returned ids exist in authoritySurfacePublicData', () => {
    const ids = pickAuthoritySurfaceIdsForCategory('claude');
    for (const id of ids) expect(knownIds.has(id), `unknown id ${id}`).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/skill-related-authority-paths.test.ts`
Expected: FAIL "Cannot find module '../skill-related-authority-paths'".

- [ ] **Step 4: Implement the shared pure mapper**

`src/lib/skill-related-authority-paths.ts`:
```ts
// Picks authority surface ids to surface on a skill detail page based on its category.
// Surface metadata itself is resolved at render-time by getAuthoritySurfaceEntries;
// this module only owns the category→surface-id routing, kept in one place so it
// cannot drift from authoritySurfacePublicData.

const ALWAYS = ['collections-hub', 'docs-installation', 'skills-directory'] as const;

export function pickAuthoritySurfaceIdsForCategory(category: string | undefined): string[] {
  const cat = (category ?? '').toLowerCase();
  const ids = [...ALWAYS];

  if (/(^|[^a-z])(claude|ai-agent|workflow|productivity)([^a-z]|$)/.test(cat)) {
    ids.push('collection-official-trusted-tools', 'collection-agent-workflows');
  }
  if (/(^|[^a-z])(cursor|ide|editor|completion)([^a-z]|$)/.test(cat)) {
    ids.push('collection-cursor');
  }
  if (/(^|[^a-z])(workflow-automation|process-automation|agent-workflow)([^a-z]|$)/.test(cat)) {
    ids.push('solution-agent-workflows');
  }
  return ids;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/skill-related-authority-paths.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 6: Rewrite `SkillRelated.astro`'s `getRelevantAuthoritySurfaces` to use the mapper + manifest resolver**

In `src/components/SkillRelated.astro`, remove the entire local `getRelevantAuthoritySurfaces(category)` function (the one with hardcoded inline strings, currently around lines 35–132). Import `getAuthoritySurfaceEntries` from `../lib/authority-surfaces` (already imported elsewhere in the file) and `pickAuthoritySurfaceIdsForCategory` from `../lib/skill-related-authority-paths`. Replace the call site that produced the authority section with:

```astro
---
import { getAuthoritySurfaceEntries } from '../lib/authority-surfaces';
import { pickAuthoritySurfaceIdsForCategory } from '../lib/skill-related-authority-paths';
// ...existing imports...
const { /* existing props */ category } = Astro.props;
const authoritySurfaceIds = pickAuthoritySurfaceIdsForCategory(category);
const authoritySurfaceEntries = getAuthoritySurfaceEntries(Astro.currentLocaleAsString, { ids: authoritySurfaceIds, includeSupporting: true });
---
```

Then re-render the existing "Related Authority Paths" section by iterating `authoritySurfaceEntries` (each entry has `id`, `title`, `description`, `href`) — preserve the layout/HTML classes the section already uses; only the data source changes from local constants to entries from the manifest resolver. Drop the per-surface `icon` mapping if it exists, or move icons into a small id→icon map keyed by surface id (icons are presentational, allowed to stay local).

- [ ] **Step 7: Run the existing SkillRelated-adjacent tests + a fresh full vitest run on the affected area**

Run: `npx vitest run src/lib/__tests__/skill-related-authority-paths.test.ts src/lib/authority-surfaces.test.ts`
Expected: PASS.

- [ ] **Step 8: Smoke build the affected pages**

Run: `npm run build`
Expected: build succeeds. (If the build surfaces a path/locale type issue in `Astro.currentLocaleAsString`, fall back to the existing locale-resolution pattern already used in the file; do not introduce a new locale resolution mechanism.)

- [ ] **Step 9: Commit**

```bash
git add src/components/SkillRelated.astro src/lib/skill-related-authority-paths.ts src/lib/__tests__/skill-related-authority-paths.test.ts
git commit -m "refactor(seo): SkillRelated reads authority surfaces from manifest resolver

Removes the inline-hardcoded surface metadata in SkillRelated.astro and
replaces it with pickAuthoritySurfaceIdsForCategory (pure mapper) +
getAuthoritySurfaceEntries (manifest resolver). A vitest asserts every
returned id resolves against authoritySurfacePublicData, so future
manifest changes can no longer silently drift from the skill detail page.

[skip ci]"
```

---

## Task 6: linkingRules runtime compliance helper

**Files:**
- Create: `src/lib/authority-linking-rules.ts`
- Create: `src/lib/__tests__/authority-linking-rules.test.ts`
- Modify: `src/pages/[locale]/collections/[...slug].astro` (dev-only call)

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/authority-linking-rules.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { assertLinkingRulesCompliance } from '../authority-linking-rules';

describe('assertLinkingRulesCompliance', () => {
  it('warns when a collection surface has no nextSteps into docs/solutions', () => {
    const warnings: string[] = [];
    assertLinkingRulesCompliance(
      [{ surfaceId: 'collection-foo', slug: 'top-foo', nextSteps: [] }],
      { warn: (m: string) => warnings.push(m) },
    );
    expect(warnings.some((w) => w.includes('collection-foo'))).toBe(true);
  });

  it('passes silently when nextSteps include a docs/solutions href', () => {
    const warnings: string[] = [];
    assertLinkingRulesCompliance(
      [{
        surfaceId: 'collection-foo', slug: 'top-foo',
        nextSteps: [{ href: '/en/docs/installation', label: 'Install' }],
      }],
      { warn: (m: string) => warnings.push(m) },
    );
    expect(warnings).toEqual([]);
  });

  it('respects the collections-need-next-steps rule only for collection surfaces', () => {
    const warnings: string[] = [];
    assertLinkingRulesCompliance(
      [{ surfaceId: 'docs-installation', slug: '', nextSteps: [] }],
      { warn: (m: string) => warnings.push(m) },
    );
    expect(warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/authority-linking-rules.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement the helper**

`src/lib/authority-linking-rules.ts`:
```ts
// Dev-only observability for the manifest's linkingRules. Does NOT throw — only
// surfaces violations through opts.warn (default console.warn). SSR-safe: skipped
// by the caller when import.meta.env.PROD.

export type LinkingRulesComplianceCheck = {
  surfaceId: string;
  slug: string;
  surfaceClass?: string;
  nextSteps: Array<{ href: string; label?: string }>;
};

export type LinkingRulesComplianceOpts = {
  warn: (message: string) => void;
};

const DOCS_OR_SOLUTIONS = /\/(docs|solutions)(\/|$)/;

export function assertLinkingRulesCompliance(
  checks: LinkingRulesComplianceCheck[],
  opts: LinkingRulesComplianceOpts,
): void {
  for (const check of checks) {
    // collections-need-next-steps: collection surfaces must offer >=1 next step into docs/solutions.
    if (check.surfaceId.startsWith('collection-') || check.surfaceClass === 'collection') {
      const hasNextIntoDocsOrSolutions = (check.nextSteps ?? []).some((s) => DOCS_OR_SOLUTIONS.test(s.href ?? ''));
      if (!hasNextIntoDocsOrSolutions) {
        opts.warn(
          `[linkingRules] surface ${check.surfaceId} (slug=${check.slug}) has no nextStep into docs/ or solutions/ — violates 'collections-need-next-steps'.`,
        );
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/authority-linking-rules.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Wire the dev-only call into the collection detail page**

In `src/pages/[locale]/collections/[...slug].astro`, near the bottom of the frontmatter (after `editorialSelectionReason` and `supportingEditorialNextSteps` are computed, around line 348–356 area), add:

```ts
import { assertLinkingRulesCompliance } from '@lib/authority-linking-rules';
// ...after editorialNextSteps resolution:
if (import.meta.env.DEV) {
  assertLinkingRulesCompliance(
    [{
      surfaceId: `collection-${canonicalSlug.replace(/^top-/, '')}`,
      slug: canonicalSlug,
      surfaceClass: 'collection',
      nextSteps: editorialNextSteps ?? [],
    }],
    { warn: (m) => console.warn(m) },
  );
}
```

Replace the `@lib` alias with whatever alias the file already uses for `src/lib` (verify by `grep -n "from '@" src/pages/[locale]/collections/[...slug].astro | head -3` and use the existing alias; if none, use the relative path `../../../lib/authority-linking-rules`).

- [ ] **Step 6: Smoke the dev build**

Run: `npm run dev` then load `http://localhost:4321/en/collections/top-claude-code-skills` and watch the server console.
Expected: no `linkingRules` warnings for collections that DO have docs/solutions nextSteps; only warnings (if any) for collections that lack them. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/lib/authority-linking-rules.ts src/lib/__tests__/authority-linking-rules.test.ts src/pages/[locale]/collections/[...slug].astro
git commit -m "feat(seo): first runtime observability for authority surface linkingRules

assertLinkingRulesCompliance surfaces dev-only console warnings when a
collection surface lacks a nextStep into docs/ or solutions/, the first
runtime touch of the manifest's collections-need-next-steps rule. SSR-safe:
skipped in PROD.

[skip ci]"
```

---

## Task 7: collections-hub two trust sections

**Files:**
- Modify: `src/i18n.ts` (add new keys)
- Modify: `src/pages/[locale]/collections/index.astro` (insert two sections)

- [ ] **Step 1: Add i18n keys**

In `src/i18n.ts`, find the `Collections` namespace and add (matching the existing nesting pattern in the file — locate the `Collections:` block and add these as siblings of `seoTitle`/`seoDescription`):

```ts
Collections: {
  // ...existing keys...
  whenToUseCuratedTitle: {
    en: 'When to use curated paths',
    zh: '何时走精选路径',
  },
  whenToUseCuratedBody: {
    en: 'Start with curated collections when you want tools that have clear ownership, verifiable installation, visible maintenance, and a concrete first task. Switch to the full directory when breadth matters more than judgment.',
    zh: '当你需要明确归属、可验证的安装方式、可见维护状态和具体首个任务时，先走精选合集；当广度比判断更重要时，再回到全量目录。',
  },
  directorySecondaryTitle: {
    en: 'Why the full directory stays secondary',
    zh: '为什么全量目录是次级入口',
  },
  directorySecondaryBody: {
    en: 'The full skills directory supports breadth and retrieval, but it is intentionally a supporting surface after curated entry points. It does not carry the recovery strategy on its own — collections and solutions lead first.',
    zh: '全量 skills 目录负责广度与检索，但它是有意保留的次级入口，不独自承担恢复策略；collections 与 solutions 才是首要入口。',
  },
},
```

- [ ] **Step 2: Add a vitest asserting the new keys exist in both locales**

If there is a general i18n coverage test (`src/i18n.test.ts` already exists per the test runner script), no new test is needed — coverage is enforced by the existing harness. Otherwise add:

`src/lib/__tests__/collections-hub-trust-i18n.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { tr } from '@i18n'; // adjust import to the actual export used in src/i18n.ts

describe('collections hub trust sections i18n', () => {
  it('renders en and zh for whenToUseCurated', () => {
    expect(tr('en', 'Collections.whenToUseCuratedTitle')).toBeTruthy();
    expect(tr('zh', 'Collections.whenToUseCuratedTitle')).toBeTruthy();
    expect(tr('en', 'Collections.whenToUseCuratedBody')).toBeTruthy();
    expect(tr('zh', 'Collections.whenToUseCuratedBody')).toBeTruthy();
  });

  it('renders en and zh for directorySecondary', () => {
    expect(tr('en', 'Collections.directorySecondaryTitle')).toBeTruthy();
    expect(tr('zh', 'Collections.directorySecondaryTitle')).toBeTruthy();
    expect(tr('en', 'Collections.directorySecondaryBody')).toBeTruthy();
    expect(tr('zh', 'Collections.directorySecondaryBody')).toBeTruthy();
  });
});
```

Adjust the tr signature to match the actual export in `src/i18n.ts` (read the file to confirm before writing the test). If the existing i18n test already covers new keys, skip this step.

- [ ] **Step 3: Insert the two sections in the collections hub**

In `src/pages/[locale]/collections/index.astro`, locate the end of the "Why These Collections Exist" block (currently around lines 279–314) and the start of the "Decision-to-Setup Path" block (around lines 316). Between them, insert:

```astro
<section class="collections-trust-when-curated">
  <h2>{tr(typedLocale, 'Collections.whenToUseCuratedTitle')}</h2>
  <p>{tr(typedLocale, 'Collections.whenToUseCuratedBody')}</p>
</section>

<section class="collections-trust-directory-secondary">
  <h2>{tr(typedLocale, 'Collections.directorySecondaryTitle')}</h2>
  <p>{tr(typedLocale, 'Collections.directorySecondaryBody')}</p>
</section>
```

Use the same `tr(locale, key)` call shape the surrounding code already uses (verify the surrounding helper — likely `tr(typedLocale, 'Collections.existingKey')`). Match the existing section wrapper class naming style (kebab-case with `collections-` prefix like the surrounding blocks). Keep the markup deliberately simple (`<section><h2><p>`) to match the editorial tone of "Why These Collections Exist" — no card grid needed.

- [ ] **Step 4: Run any i18n tests and smoke the hub**

Run: `npx vitest run src/i18n.test.ts src/lib/__tests__/collections-hub-trust-i18n.test.ts 2>/dev/null || npx vitest run src/i18n.test.ts`
Expected: PASS.

Then `npm run dev` and load `http://localhost:4321/en/collections` and `http://localhost:4321/zh/collections`, eyeball that both new sections render between "Why These Collections Exist" and "Decision-to-Setup Path". Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/i18n.ts src/pages/[locale]/collections/index.astro src/lib/__tests__/collections-hub-trust-i18n.test.ts
git commit -m "feat(seo): add 'when curated' + 'directory secondary' trust sections to collections hub

Resolves the collections-hub editorial-queue demand: hub now explains
when to use curated paths and why the full directory is intentionally
secondary. en + zh i18n. Renders between 'Why These Collections Exist'
and 'Decision-to-Setup Path'.

[skip ci]"
```

---

## Task 8: groupingLogic render section in collection detail

**Files:**
- Modify: `src/pages/[locale]/collections/[...slug].astro`

- [ ] **Step 1: Locate the existing "Selection Notes" section and the `trustSignals` render pattern**

Run: `sed -n '515,570p' src/pages/[locale]/collections/[...slug].astro` — to confirm the exact JSX of the trust-signals grid being reused as the template for groupingLogic.

Also confirm `editorial.groupingLogic` shape in the schema at `src/lib/collections-runtime.ts:13-78` — it is `Record<locale, string[]>`.

- [ ] **Step 2: Extract the localized `groupingLogic` value next to the other editorial fields**

In the frontmatter region (around lines 275–349 where `editorialSelectionReason`, `editorialTrustSignals`, `editorialMaintenanceItems` are resolved), add:

```ts
const editorialGroupingLogic: string[] | undefined =
  cData.editorial?.groupingLogic ?
    resolveLocalized(cData.editorial.groupingLogic, []) :
    undefined;
```

`resolveLocalized` is already imported in the file; verify the variant that handles arrays. If the local `resolveLocalized` only handles strings, iterate the map and return the first non-empty array for the locale with the same fallback ladder the surrounding code uses (locale → en → first available).

- [ ] **Step 3: Insert the render block after "Selection Notes" and before "Decision Tracks"**

After the closing `</section>` of the Selection Notes block (around line 569) and before the Decision Tracks block (line ~609), insert:

```astro
{editorialGroupingLogic && editorialGroupingLogic.length > 0 && (
  <section class="collection-grouping-logic">
    <h2>{tr(typedLocale, 'Collections.groupingLogicTitle', 'Grouping Logic')}</h2>
    <ul class="collection-grouping-logic__list">
      {editorialGroupingLogic.map((item) => <li>{item}</li>)}
    </ul>
  </section>
)}
```

If i18n does not have a `Collections.groupingLogicTitle` key, add it (en `'Grouping Logic'`, zh `'分组逻辑'`) in `src/i18n.ts` under `Collections:`. The inline fallback string `'Grouping Logic'` in the `tr()` call covers the case but adding the key is cleaner.

- [ ] **Step 4: Add a vitest asserting groupingLogic copy is non-empty when present**

`src/lib/__tests__/collection-grouping-logic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Coll = { editorial?: { groupingLogic?: Record<string, string[]> } };
const files = require('node:fs').readdirSync(resolve(process.cwd(), 'src/content/collections'))
  .filter((f: string) => f.endsWith('.json'));

describe('collection groupingLogic copy is non-empty when present', () => {
  for (const f of files) {
    const data = JSON.parse(readFileSync(resolve(process.cwd(), 'src/content/collections', f), 'utf8')) as Coll;
    if (!data.editorial?.groupingLogic) continue;
    it(`${f} has non-empty en groupingLogic`, () => {
      const en = data.editorial!.groupingLogic!.en ?? [];
      expect(en.length, `${f} groupingLogic.en empty`).toBeGreaterThan(0);
      for (const item of en) {
        expect(item.trim().length, `${f} groupingLogic en item empty`).toBeGreaterThan(0);
      }
    });
  }
});
```

Run: `npx vitest run src/lib/__tests__/collection-grouping-logic.test.ts`
Expected: PASS for each collection that currently has groupingLogic (e.g. `top-official-mcp-servers.json` per exploration; possibly others).

- [ ] **Step 5: Smoke render**

Run: `npm run dev`, load a collection whose JSON has `editorial.groupingLogic` (verify by `grep -l groupingLogic src/content/collections/*.json`), e.g. `http://localhost:4321/en/collections/top-official-mcp-servers`. Confirm the new "Grouping Logic" section renders between Selection Notes and Decision Tracks. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/pages/[locale]/collections/[...slug].astro src/i18n.ts src/lib/__tests__/collection-grouping-logic.test.ts
git commit -m "feat(seo): render editorial.groupingLogic on collection detail page

The field existed in the CollectionEntry schema and was populated in
collection JSON but never read by the template; it now renders as a
'Grouping Logic' list between Selection Notes and Decision Tracks.
A vitest guards against empty/blank groupingLogic entries.

[skip ci]"
```

---

## Task 9: extend drift + quality-audit with editorial fields

**Files:**
- Modify: `scripts/lib/seo-collection-drift.ts`
- Modify: `scripts/seo-collection-quality-audit.ts`

- [ ] **Step 1: Read the current CollectionData interface in each script**

Run: `sed -n '1,40p' scripts/lib/seo-collection-drift.ts` and `sed -n '1,40p' scripts/seo-collection-quality-audit.ts` — to identify the exact `CollectionData` type and the report output shape used for adding codes/advisories without breaking back-compat.

- [ ] **Step 2: Extend `seo-collection-drift.ts`**

Add `editorial?` to `CollectionData`. The interface should match:
```ts
type EditorialData = {
  selectionReason?: Record<string, string>;
  trustSignals?: Record<string, string[]>;
  maintenance?: { reviewedAt?: string };
};
```

Extend the existing `CollectionData`:
```ts
type CollectionData = {
  // ...existing fields...
  editorial?: EditorialData;
};
```

Add three new drift codes to the existing `code` union:
- `editorial_missing_reviewed_at` — collection has non-empty `editorial.selectionReason` OR `editorial.trustSignals` but `editorial.maintenance.reviewedAt` is missing/empty.
- `editorial_stale_reviewed_at` — `reviewedAt` is present and earlier than 90 days before today (compare against `new Date()` — for testability, accept an optional `now: Date` argument to the diff function, defaulting to `new Date()`).
- `editorial_empty_selection` — both `editorial.selectionReason` and `editorial.trustSignals` are missing/empty (in all locales).

For each existing collection loop iteration, push these new codes to the collection's issue list. Preserve the existing issue codes.

- [ ] **Step 3: Add a vitest for the new drift codes**

`scripts/lib/__tests__/seo-collection-drift.test.ts` (if not already present; if a sibling test exists, extend it instead of duplicating):
```ts
import { describe, expect, it } from 'vitest';
// adjust import to the pure detector function in seo-collection-drift.ts
import { detectEditorialDrift } from '../seo-collection-drift';

describe('detectEditorialDrift', () => {
  it('flags editorial_missing_reviewed_at', () => {
    const out = detectEditorialDrift({
      editorial: { selectionReason: { en: 'x' }, maintenance: {} },
    } as any, new Date('2026-07-04'));
    expect(out).toContain('editorial_missing_reviewed_at');
  });
  it('flags editorial_stale_reviewed_at when older than 90 days', () => {
    const out = detectEditorialDrift({
      editorial: { maintenance: { reviewedAt: '2026-03-01' } },
    } as any, new Date('2026-07-04'));
    expect(out).toContain('editorial_stale_reviewed_at');
  });
  it('does not flag fresh reviewedAt', () => {
    const out = detectEditorialDrift({
      editorial: { maintenance: { reviewedAt: '2026-06-15' } },
    } as any, new Date('2026-07-04'));
    expect(out).not.toContain('editorial_stale_reviewed_at');
  });
  it('flags editorial_empty_selection', () => {
    const out = detectEditorialDrift({ editorial: { maintenance: { reviewedAt: '2026-07-01' } } } as any, new Date('2026-07-04'));
    expect(out).toContain('editorial_empty_selection');
  });
  it('passes a fully populated collection', () => {
    const out = detectEditorialDrift({
      editorial: { selectionReason: { en: 'x' }, trustSignals: { en: ['a'] }, maintenance: { reviewedAt: '2026-06-15' } },
    } as any, new Date('2026-07-04'));
    expect(out).toEqual([]);
  });
});
```

If the existing `seo-collection-drift` module does not export a `detectEditorialDrift` pure function, refactor the code path so the editorial detection is a pure function `detectEditorialDrift(data, now)` that the main loop calls (this is a small, test-friendly extraction). Adjust the import path accordingly.

- [ ] **Step 4: Run the drift test and then the full script**

Run: `npx vitest run scripts/lib/__tests__/seo-collection-drift.test.ts`
Expected: PASS.

Run: `npm run report:seo:collection-drift`
Expected: `data/seo-collection-drift.json` now contains editorial-related codes for collections that fail the new checks. The script's exit behavior should remain the same (the drift script does not exit non-zero on per-collection issues; it writes them to the JSON).

- [ ] **Step 5: Extend `seo-collection-quality-audit.ts`**

Add the same `editorial?` field to its `CollectionData`. Add an advisory (non-blocking) editorial-completeness score per collection: count how many of `{selectionReason, trustSignals, maintenance.reviewedAt, executionExamples}` are non-empty across the en locale. Score range 0..4. Include the score in the advisory output for each collection; collections with score < 2 produce an advisory row in the report's existing warnings section. Do NOT change the script's exit code (advisories only).

- [ ] **Step 6: Add a quick vitest for the advisory scoring**

Extend or create `scripts/lib/__tests__/seo-collection-quality-audit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { editorialCompletenessScore } from '../seo-collection-quality-audit'; // adjust path if function lives elsewhere

describe('editorialCompletenessScore', () => {
  it('returns 4 when all four editorial fields present', () => {
    expect(editorialCompletenessScore({
      editorial: {
        selectionReason: { en: 'x' },
        trustSignals: { en: ['a'] },
        maintenance: { reviewedAt: '2026-06-01' },
        executionExamples: [{ title: { en: 't' }, summary: { en: 's' }, steps: { en: [] } }],
      },
    } as any)).toBe(4);
  });
  it('returns 0 when editorial absent', () => {
    expect(editorialCompletenessScore({} as any)).toBe(0);
  });
  it('returns 2 with selectionReason + reviewedAt only', () => {
    expect(editorialCompletenessScore({
      editorial: { selectionReason: { en: 'x' }, maintenance: { reviewedAt: '2026-06-01' } },
    } as any)).toBe(2);
  });
});
```

If the scoring function does not exist, extract it as a pure `editorialCompletenessScore(data)` and have the main loop call it.

- [ ] **Step 7: Run the quality-audit test, then run the full audit**

Run: `npx vitest run scripts/lib/__tests__/seo-collection-quality-audit.test.ts`
Expected: PASS.

Run: `npm run report:seo:collection-quality` (or the closest existing script name — verify with `grep -E '"report:seo:collection' package.json`).
Expected: report now includes an `editorialCompleteness` score per collection and advisory rows for low-scoring collections; existing code paths unchanged.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/seo-collection-drift.ts scripts/lib/__tests__/seo-collection-drift.test.ts scripts/seo-collection-quality-audit.ts scripts/lib/__tests__/seo-collection-quality-audit.test.ts data/seo-collection-drift.json
git commit -m "feat(seo): drift + quality-audit now see editorial trust-signal fields

seo-collection-drift adds 3 editorial codes (missing/stale reviewedAt,
empty selection). seo-collection-quality-audit adds an editorial
completeness score as advisory. Existing collection content can now be
governed for trust-signal staleness, not just slug/meta-field presence.

[skip ci]"
```

---

## Self-Review (post-plan)

**1. Spec coverage:** Walk through each spec subsection:
- §4.4 backfill → Task 1 ✓
- §4.1 sync generator → Task 2 ✓ (§4.1 resolution re: copy separation applied)
- §4.2 frontmatter guard → Task 3 ✓
- §4.3 structured-data-validate → Task 4 ✓
- §4.7 SkillRelated → Task 5 ✓
- §5 linkingRules helper → Task 6 ✓
- §4.6 hub trust sections → Task 7 ✓
- §4.5 groupingLogic → Task 8 ✓
- §4.8 drift + quality-audit → Task 9 ✓
- §1.3 8/38 missing reviewedAt: surfaced by Task 9's `editorial_missing_reviewed_at` code — coverage exists; remediation of those 8 collections is content work triggered by the new code, not a separate task (the report pins them).

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later". Where steps reference types from earlier tasks (`evaluateCollectionForBackfill`, `lintCollectionFrontmatter`, `pickAuthoritySurfaceIdsForCategory`, `assertLinkingRulesCompliance`, `detectEditorialDrift`, `editorialCompletenessScore`), the type signature is shown at definition and matched at use. Where a step says "verify with grep" or "verify by running", the exact command is given. The single "adjust import/alias" in Steps that touch unfamiliar i18n or alias surfaces is acknowledged because the exact import shape is verifiable at execution time and cannot be safely guessed.

**3. Type consistency:** 
- `BackfillVerdict.reason` union in Task 1 matches the test cases ✓
- `LintViolation.field` and `code` unions in Task 3 match the test assertions ✓
- `LinkingRulesComplianceCheck.surfaceId` and `nextSteps` shape in Task 6 matches the test fixtures ✓
- `detectEditorialDrift(data, now)` signature in Task 9 is consistent across definition and test ✓
- `editorialCompletenessScore(data)` similarly consistent ✓

No internal inconsistencies found. Plan ready.
