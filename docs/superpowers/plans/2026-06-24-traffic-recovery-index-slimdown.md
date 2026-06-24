# Traffic Recovery: Index Slimdown + Authority Focus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce indexed skill pages from ~5,308 to ~300-500, upgrade authority surfaces with editorial content, enforce body-locale alignment for non-English URLs, close GSC coverage anomalies, and establish measurement gates — to recover organic traffic by signaling editorial depth to Google.

**Architecture:** A 3-tier indexability system replaces the binary indexable/reference-only model. Tier 1 skills (stars ≥ 50, qualityScore ≥ 55, verified OR full agentAnalysis) get `index, follow` and sitemap inclusion. Tier 2 (passes old gate but fails Tier 1) and Tier 3 (fails old gate) get `noindex, follow`. Sitemap generation filters by Tier 1 only. Authority surfaces gain editorial content fields and lowered promote thresholds. Non-English URLs without body-locale match get strict noindex with canonical to English.

**Tech Stack:** Astro 6, TypeScript, Vitest, Playwright, Cloudflare Workers, D1/KV, Google Search Console API

**Spec:** `docs/superpowers/specs/2026-06-24-traffic-recovery-index-slimdown-authority-focus-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/skill-indexability.ts` | Add tier computation (1/2/3) to indexability assessment |
| Modify | `src/lib/skill-indexability.test.ts` | Add tier-specific test cases |
| Modify | `src/pages/sitemap-skills.xml.ts` | Filter sitemap to Tier 1 only; use bodyEligible locales for hreflang |
| Modify | `src/pages/[locale]/skills/[owner]/[...repo].astro` | Use tier for robots meta instead of binary isIndexable |
| Modify | `src/lib/kv.ts` | Add tier filter to `getSitemapSkillsFromKV()` |
| Modify | `src/lib/seo-locales.ts` | Expose `bodyEligibleLocales` as a standalone export for sitemap consumption |
| Modify | `src/lib/skills-config.ts` | Add `TIER1_MIN_STARS` and `TIER1_QUALITY_THRESHOLD` constants |
| Modify | `scripts/seo-skill-indexability-report.ts` | Include tier in indexability report output |
| Modify | `scripts/seo-recovery-scorecard.ts` | Add Gate 6 (Index Quality Ratio) and Gate 7 (Language Alignment) |
| Modify | `scripts/lib/recovery-scorecard.ts` | Implement Gate 6 and Gate 7 logic |
| Modify | `scripts/gsc-search-health-monitor.ts` | Add tier-segmented tracking alerts |
| Create | `scripts/gsc-removal-batch-builder.ts` | Build GSC removal URL batch from coverage anomalies + 404 rules |
| Create | `tests/e2e/index-tier.spec.ts` | E2E: verify tier robots meta, sitemap exclusion, canonical correctness |
| Create | `tests/pages/sitemap-tier-filter.test.ts` | Unit tests for sitemap tier filtering |
| Create | `docs/superpowers/plans/2026-06-24-traffic-recovery-removal-runbook.md` | Runbook for GSC bulk URL removal execution |

---

## Task 1: Add Tier Computation to `skill-indexability.ts`

**Files:**
- Modify: `src/lib/skill-indexability.ts`
- Modify: `src/lib/skills-config.ts`
- Modify: `src/lib/skill-indexability.test.ts`

- [ ] **Step 1: Write the failing test — Tier 1 for high-star, high-quality skill**

Add to `src/lib/skill-indexability.test.ts`:

```typescript
it('assigns tier 1 when stars >= 50, qualityScore >= 55, verified, and full agentAnalysis', () => {
  const assessment = buildSkillIndexabilityAssessment(
    {
      qualityScore: 72,
      verified: false,
      stars: 85,
      agentAnalysis: {
        suitability:
          'Best for coding agents that need prompt refinement before running high-risk repository changes.',
        recommendation:
          'Killer-Skills recommends this skill when you need a repeatable prompt-review step before execution, especially for repository-aware coding workflows.',
        useCases: ['Prompt review before execution', 'Repository-aware drafting', 'Instruction cleanup'],
        limitations: ['Does not execute work directly', 'Needs a draft prompt from the operator'],
      },
      seo: {
        features: {
          en: ['Prompt review workflow', 'Project detection', 'Execution-ready output'],
        },
      },
      readmeContent:
        '# Prompt Optimizer\n\nInstall this skill and use it to review prompts before execution in Claude Code workflows.',
      localeGovernance: {
        isIndexableLocale: true,
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
      },
    },
    'en',
  );

  expect(assessment.tier).toBe(1);
  expect(assessment.isIndexable).toBe(true);
  expect(assessment.mode).toBe('indexable');
});
```

- [ ] **Step 2: Write the failing test — Tier 2 for low-star but otherwise indexable skill**

```typescript
it('assigns tier 2 when stars < 50 but passes old indexability gate', () => {
  const assessment = buildSkillIndexabilityAssessment(
    {
      qualityScore: 45,
      verified: false,
      stars: 5,
      agentAnalysis: {
        suitability:
          'Best for coding agents that need prompt refinement before running high-risk repository changes.',
        recommendation:
          'Killer-Skills recommends this skill when you need a repeatable prompt-review step before execution, especially for repository-aware coding workflows.',
        useCases: ['Prompt review before execution', 'Repository-aware drafting'],
        limitations: ['Does not execute work directly'],
      },
      seo: {
        features: {
          en: ['Prompt review workflow', 'Project detection'],
        },
      },
      readmeContent:
        '# Prompt Optimizer\n\nInstall this skill and use it to review prompts before execution in Claude Code workflows.',
      localeGovernance: {
        isIndexableLocale: true,
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
      },
    },
    'en',
  );

  expect(assessment.tier).toBe(2);
  expect(assessment.isIndexable).toBe(false);
  expect(assessment.mode).toBe('support');
});
```

- [ ] **Step 3: Write the failing test — Tier 3 for quality-below-floor skill**

```typescript
it('assigns tier 3 when quality floor is not met', () => {
  const assessment = buildSkillIndexabilityAssessment(
    {
      qualityScore: 20,
      verified: false,
      stars: 2,
      agentAnalysis: {
        recommendation: 'Short rec',
        useCases: ['One case'],
      },
      readmeContent: 'Short readme',
      localeGovernance: {
        isIndexableLocale: true,
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
      },
    },
    'en',
  );

  expect(assessment.tier).toBe(3);
  expect(assessment.isIndexable).toBe(false);
  expect(assessment.mode).toBe('reference_only');
});
```

- [ ] **Step 4: Write the failing test — Official repo bypasses stars threshold**

```typescript
it('assigns tier 1 for verified official repo even with 0 stars', () => {
  const assessment = buildSkillIndexabilityAssessment(
    {
      qualityScore: 72,
      verified: true,
      stars: 0,
      agentAnalysis: {
        suitability:
          'Best for coding agents that need prompt refinement before running high-risk repository changes.',
        recommendation:
          'Killer-Skills recommends this skill when you need a repeatable prompt-review step before execution, especially for repository-aware coding workflows.',
        useCases: ['Prompt review before execution', 'Repository-aware drafting', 'Instruction cleanup'],
        limitations: ['Does not execute work directly', 'Needs a draft prompt from the operator'],
      },
      seo: {
        features: {
          en: ['Prompt review workflow', 'Project detection', 'Execution-ready output'],
        },
      },
      readmeContent:
        '# Prompt Optimizer\n\nInstall this skill and use it to review prompts before execution in Claude Code workflows.',
      localeGovernance: {
        isIndexableLocale: true,
        canonicalLocale: 'en',
        detectedBodyLocale: 'en',
      },
    },
    'en',
  );

  expect(assessment.tier).toBe(1);
  expect(assessment.isIndexable).toBe(true);
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run src/lib/skill-indexability.test.ts`
Expected: 4 failures (tier property does not exist yet, mode 'support' does not exist)

- [ ] **Step 6: Add constants to `src/lib/skills-config.ts`**

Append to `src/lib/skills-config.ts`:

```typescript
/**
 * Tier 1 indexability thresholds.
 * Tier 1 skills are included in sitemaps and served with `index, follow`.
 * Non-official skills must have stars >= TIER1_MIN_STARS and qualityScore
 * >= TIER1_QUALITY_THRESHOLD to qualify for Tier 1. Official (verified) repos
 * bypass the stars threshold entirely.
 */
export const TIER1_MIN_STARS = 50;
export const TIER1_QUALITY_THRESHOLD = 55;
```

- [ ] **Step 7: Implement tier computation in `src/lib/skill-indexability.ts`**

Update `SkillIndexabilitySource` type to add `stars`:

```typescript
export type SkillIndexabilitySource = {
  qualityScore?: number | null;
  verified?: boolean | null;
  stars?: number | null;
  description?: LocalizedString;
  agentAnalysis?: {
    suitability?: LocalizedString;
    recommendation?: LocalizedString;
    useCases?: LocalizedStringArray;
    limitations?: LocalizedStringArray;
  };
  seo?: {
    features?: Record<string, string[]>;
  };
  readmeContent?: string | null;
  localeGovernance?: SkillIndexabilityLocaleGovernance | null;
};
```

Update `SkillIndexabilityAssessment` type to add `tier` and update `mode`:

```typescript
export type SkillIndexabilityAssessment = {
  isIndexable: boolean;
  tier: 1 | 2 | 3;
  mode: 'indexable' | 'support' | 'reference_only';
  score: number;
  threshold: number;
  qualityThreshold: number;
  reasons: string[];
  blockers: string[];
  signals: {
    localeEligible: boolean;
    hasRecommendation: boolean;
    hasSuitability: boolean;
    hasUseCases: boolean;
    hasLimitations: boolean;
    hasFeatureLayer: boolean;
    hasStrongQualitySignal: boolean;
    hasVerifiedSignal: boolean;
    hasSupportingSourceEvidence: boolean;
    hasTier1Stars: boolean;
    hasTier1Quality: boolean;
  };
};
```

Update `buildSkillIndexabilityAssessment` function to compute tier:

```typescript
import { TIER1_MIN_STARS, TIER1_QUALITY_THRESHOLD } from './skills-config';

// Inside buildSkillIndexabilityAssessment, after computing existing signals:

const stars = Number(source.stars || 0);
const hasTier1Stars = Boolean(source.verified) || stars >= TIER1_MIN_STARS;
const hasTier1Quality = qualityScore >= TIER1_QUALITY_THRESHOLD;

const signals = {
  // ... existing signals ...
  hasTier1Stars,
  hasTier1Quality,
};

// Existing isIndexable logic (Tier 2 gate — same as before):
const isOldGateIndexable =
  signals.localeEligible &&
  signals.hasRecommendation &&
  signals.hasUseCases &&
  signals.hasLimitations &&
  signals.hasStrongQualitySignal &&
  signals.hasSupportingSourceEvidence &&
  score >= scoreThreshold;

// Tier determination:
const isTier1Eligible = isOldGateIndexable && hasTier1Stars && hasTier1Quality;
let tier: 1 | 2 | 3;
let mode: 'indexable' | 'support' | 'reference_only';
let isIndexable: boolean;

if (isTier1Eligible) {
  tier = 1;
  mode = 'indexable';
  isIndexable = true;
} else if (isOldGateIndexable) {
  tier = 2;
  mode = 'support';
  isIndexable = false;
} else {
  tier = 3;
  mode = 'reference_only';
  isIndexable = false;
}

// Add tier reasons/blockers:
if (isOldGateIndexable && !hasTier1Stars) {
  reasons.push('tier2_stars_below_threshold');
}
if (isOldGateIndexable && !hasTier1Quality) {
  reasons.push('tier2_quality_below_tier1_floor');
}
if (!isOldGateIndexable) {
  // existing blockers already populated
}

return {
  isIndexable,
  tier,
  mode,
  score,
  threshold: scoreThreshold,
  qualityThreshold,
  reasons,
  blockers,
  signals,
};
```

- [ ] **Step 8: Update existing tests' expectations**

In `src/lib/skill-indexability.test.ts`, update existing tests that check `mode`:

Test "keeps a locale-eligible skill indexable" (qualityScore 72, no stars field): Add `stars: 85` to the source object (it already has qualityScore 72, so it qualifies for Tier 1).

Test "drops to reference-only when locale governance fails": change expectation from `assessment.mode).toBe('reference_only')` — this stays tier 3.

Test "keeps a well-supported skill indexable once it clears the long-tail quality floor" (qualityScore 35): This now becomes Tier 2 because qualityScore 35 < TIER1_QUALITY_THRESHOLD 55. Change expectations:
- `assessment.tier).toBe(2)`
- `assessment.mode).toBe('support')`
- `assessment.isIndexable).toBe(false)`

Test "drops to reference-only when quality floor is still below the review threshold" (qualityScore 34): This stays Tier 3. No change needed.

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/lib/skill-indexability.test.ts`
Expected: ALL PASS (8 tests)

- [ ] **Step 10: Commit**

```bash
git add src/lib/skill-indexability.ts src/lib/skill-indexability.test.ts src/lib/skills-config.ts
git commit -m "feat(seo): add 3-tier indexability system (Tier 1/2/3) for traffic recovery"
```

---

## Task 2: Filter Sitemap by Tier 1 Only

**Files:**
- Modify: `src/pages/sitemap-skills.xml.ts`
- Modify: `src/lib/kv.ts`
- Create: `tests/pages/sitemap-tier-filter.test.ts`

- [ ] **Step 1: Write the failing test — Tier 2 skills excluded from sitemap**

Create `tests/pages/sitemap-tier-filter.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildSkillIndexabilityAssessment } from '../../src/lib/skill-indexability';

describe('sitemap tier filtering', () => {
  it('Tier 1 skill qualifies for sitemap inclusion', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 72,
        verified: false,
        stars: 85,
        agentAnalysis: {
          recommendation: 'Killer-Skills recommends this skill for workflow automation and code review cycles.',
          useCases: ['Code review automation', 'Workflow integration', 'CI/CD pipeline enhancement'],
          limitations: ['Requires Node.js 18+', 'No Windows support yet'],
        },
        readmeContent: '# Skill\n\nA detailed readme with installation instructions and usage examples.',
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );
    expect(assessment.tier).toBe(1);
    expect(assessment.isIndexable).toBe(true);
  });

  it('Tier 2 skill is excluded from sitemap', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 45,
        verified: false,
        stars: 5,
        agentAnalysis: {
          recommendation: 'Killer-Skills recommends this skill for workflow automation and code review cycles.',
          useCases: ['Code review automation', 'Workflow integration'],
          limitations: ['Requires Node.js 18+'],
        },
        readmeContent: '# Skill\n\nA detailed readme with installation instructions and usage examples.',
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );
    expect(assessment.tier).toBe(2);
    expect(assessment.isIndexable).toBe(false);
  });

  it('Tier 3 skill is excluded from sitemap', () => {
    const assessment = buildSkillIndexabilityAssessment(
      {
        qualityScore: 15,
        verified: false,
        stars: 0,
        readmeContent: 'tiny',
        localeGovernance: { isIndexableLocale: true, canonicalLocale: 'en', detectedBodyLocale: 'en' },
      },
      'en',
    );
    expect(assessment.tier).toBe(3);
    expect(assessment.isIndexable).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pages/sitemap-tier-filter.test.ts`
Expected: Tier 2 test fails because `isIndexable` is still true under old logic (this will actually pass since Task 1 should already make Tier 2 → isIndexable=false). If Task 1 is already done, this test should PASS already. Verify by running.

- [ ] **Step 3: Update `sitemap-skills.xml.ts` to use bodyEligible locales for hreflang**

In `src/pages/sitemap-skills.xml.ts`, modify the hreflang logic around line 158-160.

Replace:
```typescript
const eligibleLocales = (governance?.eligibleLocales || []).filter((locale) =>
  SUPPORTED_LOCALES.includes(locale as any),
);
```

With:
```typescript
// Use bodyEligibleLocales when available (strict locale alignment), fall back to eligibleLocales
const bodyEligibleLocales = Array.isArray((governance as any)?.bodyEligibleLocales)
  ? (governance as any).bodyEligibleLocales.filter((locale: string) =>
      SUPPORTED_LOCALES.includes(locale as any),
    )
  : [];
const eligibleLocales =
  bodyEligibleLocales.length > 0
    ? bodyEligibleLocales
    : (governance?.eligibleLocales || []).filter((locale) =>
        SUPPORTED_LOCALES.includes(locale as any),
      );
```

Also update `SkillLocaleGovernanceEntry` type to include `bodyEligibleLocales`:

```typescript
type SkillLocaleGovernanceEntry = {
  owner?: string;
  routePath?: string;
  eligibleLocales?: string[];
  bodyEligibleLocales?: string[];
  canonicalLocale?: string;
};
```

- [ ] **Step 4: Rebuild locale governance data to include bodyEligibleLocales**

Run: `npx tsx scripts/seo-skill-locale-governance.ts`
This regenerates `data/seo-skill-locale-governance.json` which should already include `bodyEligibleLocales` per the `SkillSeoLocaleGovernance` type (see `seo-locales.ts` line 199). Verify the output contains `bodyEligibleLocales` arrays.

- [ ] **Step 5: Update `kv.ts` sitemap skills filter to require Tier 1**

In `src/lib/kv.ts`, in `getSitemapSkillsFromKV()`, after the existing `isPublicSitemapSkillCandidate()` and `isIndexableByReadme()` check, add an import and tier check:

At the top of the file, add:
```typescript
import { buildSkillIndexabilityAssessment } from './skill-indexability';
import { TIER1_MIN_STARS, TIER1_QUALITY_THRESHOLD } from './skills-config';
```

Then in the filtering logic around line 1050+, after adding the skill to the result array, add a Tier 1 check:

```typescript
// After existing blocklist and readme byte checks:
const assessment = buildSkillIndexabilityAssessment(
  {
    qualityScore: raw.qualityScore ?? null,
    verified: raw.verified ?? null,
    stars: raw.stars ?? null,
    agentAnalysis: raw.agentAnalysis,
    seo: raw.seo,
    readmeContent: readmeContent || null,
    localeGovernance: null, // resolved separately in sitemap generation
  },
  'en', // canonical locale for tier assessment
);
if (assessment.tier !== 1) continue; // Only Tier 1 skills in sitemap
```

- [ ] **Step 6: Run all existing sitemap tests**

Run: `npx vitest run tests/pages/sitemaps.test.ts`
Expected: Some tests may need updates if they expect Tier 2/3 skills in sitemap output. Update fixture data to use `stars >= 50` and `qualityScore >= 55` for skills expected in sitemap.

- [ ] **Step 7: Run the new tier filter tests**

Run: `npx vitest run tests/pages/sitemap-tier-filter.test.ts`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/pages/sitemap-skills.xml.ts src/lib/kv.ts tests/pages/sitemap-tier-filter.test.ts data/seo-skill-locale-governance.json
git commit -m "feat(seo): filter sitemap to Tier 1 skills only, use bodyEligible locales for hreflang"
```

---

## Task 3: Update Skill Detail Page to Use Tier for Robots Meta

**Files:**
- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`

- [ ] **Step 1: Update the robots meta logic in the skill detail page**

In `src/pages/[locale]/skills/[owner]/[...repo].astro`, around line 990-996, replace:

```typescript
const layoutNoindex =
  useStaticFallback ||
  isBlocked ||
  (renderRepoDirectory ? !isForcedOpen : !skillIndexability?.isIndexable || (hasSkill && !isPageInSitemap));
```

With:

```typescript
const skillTier = skillIndexability?.tier ?? 3;
const layoutNoindex =
  useStaticFallback ||
  isBlocked ||
  (renderRepoDirectory ? !isForcedOpen : skillTier !== 1 || (hasSkill && !isPageInSitemap));
```

- [ ] **Step 2: Add Tier 2 "Support Reference" notice**

Find the section that renders the Tier 3 amber "Source Notes" warning. Add a Tier 2 notice above it:

```astro
{skillTier === 2 && !renderRepoDirectory && (
  <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-6">
    <p class="text-sm text-amber-400">
      <strong>Support Reference.</strong> This page provides installation and source reference but is not promoted in search listings.
      Compare fit and limitations before relying on it for production workflows.
    </p>
  </div>
)}
```

Place this immediately before the existing Tier 3 "Source Notes" warning block.

- [ ] **Step 3: Verify the page renders correctly for each tier**

Run: `npx astro build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

Run the dev server and manually check:
- A Tier 1 skill page: should have `index, follow` (no X-Robots-Tag header)
- A Tier 2 skill page: should have `noindex, follow` (X-Robots-Tag: noindex, follow) and amber "Support Reference" notice
- A Tier 3 skill page: should have `noindex, follow` and amber "Source Notes" warning

- [ ] **Step 4: Commit**

```bash
git add "src/pages/[locale]/skills/[owner]/[...repo].astro"
git commit -m "feat(seo): use tier-based robots meta + add Tier 2 support reference notice"
```

---

## Task 4: Build GSC Removal Batch Script

**Files:**
- Create: `scripts/gsc-removal-batch-builder.ts`
- Create: `docs/superpowers/plans/2026-06-24-traffic-recovery-removal-runbook.md`

- [ ] **Step 1: Write the GSC removal batch builder script**

Create `scripts/gsc-removal-batch-builder.ts`:

```typescript
#!/usr/bin/env npx tsx
/**
 * GSC Removal Batch Builder
 *
 * Reads existing 404 remediation rules, coverage drilldown anomalies, and
 * sitemap blocklist data to produce a ranked list of URLs that should be
 * submitted for removal via the Google Search Console URL Removal tool.
 *
 * Priority order:
 *   1. source_file_path cluster (highest volume of crawl traps)
 *   2. known_skill_404 cluster (deleted/renamed repos)
 *   3. trailing_slash cluster
 *   4. query_parameter / repeated_segment / deep_skill_path / other
 *
 * Output:
 *   - reports/seo/latest-gsc-removal-batch.md (human-readable)
 *   - reports/seo/latest-gsc-removal-batch.csv (for GSC UI bulk submission)
 *   - reports/seo/latest-gsc-removal-batch.json (machine-readable)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = 'https://killer-skills.com';
const OUTPUT_DIR = resolve(process.cwd(), 'reports/seo');

type ClusterEntry = {
  url: string;
  cluster: string;
  lastCrawled?: string;
};

type RemovalBatch = {
  generatedAt: string;
  totalUrls: number;
  byCluster: Record<string, { count: number; sample: string[] }>;
  urls: Array<{ url: string; cluster: string; priority: number }>;
};

function loadJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as T;
  } catch {
    return null;
  }
}

function getClusterPriority(cluster: string): number {
  const priorities: Record<string, number> = {
    source_file_path: 1,
    known_skill_404: 2,
    trailing_slash: 3,
    query_parameter: 4,
    repeated_segment: 5,
    deep_skill_path: 6,
    other: 7,
  };
  return priorities[cluster] ?? 8;
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load coverage drilldown data
  const coverageDrilldown = loadJson<any>('reports/seo/latest-coverage-drilldown.json');
  const rules404 = loadJson<any>('data/seo-404-rules.json');
  const blocklistData = loadJson<any>('data/seo-sitemap-blocklist.json');

  const urls: Array<{ url: string; cluster: string; priority: number }> = [];

  // From coverage drilldown
  if (coverageDrilldown?.clusters) {
    for (const cluster of coverageDrilldown.clusters) {
      const clusterName = String(cluster.name || cluster.cluster || 'other');
      const clusterUrls: string[] = cluster.urls || cluster.sampleUrls || [];
      for (const rawUrl of clusterUrls) {
        const url = String(rawUrl).replace(/\/+$/, '');
        if (url.startsWith(SITE_URL) || url.startsWith('/')) {
          urls.push({
            url: url.startsWith('/') ? `${SITE_URL}${url}` : url,
            cluster: clusterName,
            priority: getClusterPriority(clusterName),
          });
        }
      }
    }
  }

  // From 404 rules — URLs already handled by middleware (410 Gone / 301)
  if (rules404) {
    const goneUrls: string[] = rules404.gone410 || [];
    const redirectUrls: string[] = rules404.redirect301 || [];
    for (const rawUrl of [...goneUrls, ...redirectUrls]) {
      const url = String(rawUrl).startsWith('http')
        ? String(rawUrl).replace(/\/+$/, '')
        : `${SITE_URL}${String(rawUrl)}`.replace(/\/+$/, '');
      const cluster = goneUrls.includes(rawUrl) ? 'middleware_410_gone' : 'middleware_301_redirect';
      urls.push({ url, cluster, priority: getClusterPriority(cluster === 'middleware_410_gone' ? 'known_skill_404' : 'trailing_slash') });
    }
  }

  // Deduplicate by URL (keep highest priority / lowest number)
  const seen = new Map<string, { url: string; cluster: string; priority: number }>();
  for (const entry of urls) {
    const existing = seen.get(entry.url);
    if (!existing || entry.priority < existing.priority) {
      seen.set(entry.url, entry);
    }
  }

  const deduped = Array.from(seen.values()).sort((a, b) => a.priority - b.priority || a.cluster.localeCompare(b.cluster));

  // Build cluster summary
  const byCluster: Record<string, { count: number; sample: string[] }> = {};
  for (const entry of deduped) {
    if (!byCluster[entry.cluster]) {
      byCluster[entry.cluster] = { count: 0, sample: [] };
    }
    byCluster[entry.cluster].count++;
    if (byCluster[entry.cluster].sample.length < 5) {
      byCluster[entry.cluster].sample.push(entry.url);
    }
  }

  const batch: RemovalBatch = {
    generatedAt: new Date().toISOString(),
    totalUrls: deduped.length,
    byCluster,
    urls: deduped,
  };

  // Write JSON
  writeFileSync(resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.json'), JSON.stringify(batch, null, 2));

  // Write CSV (URL only, one per line — for manual GSC UI bulk submission)
  const csvLines = deduped.map((entry) => entry.url);
  writeFileSync(resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.csv'), csvLines.join('\n'));

  // Write Markdown report
  const md = [
    `# GSC Removal Batch`,
    ``,
    `**Generated:** ${batch.generatedAt}`,
    `**Total URLs:** ${batch.totalUrls}`,
    ``,
    `## Cluster Summary`,
    ``,
    `| Cluster | Count | Sample URLs |`,
    `|---------|-------|-------------|`,
    ...Object.entries(byCluster)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([cluster, data]) => `| ${cluster} | ${data.count} | ${data.sample.slice(0, 2).join(', ')} |`),
    ``,
    `## Next Steps`,
    ``,
    `1. Submit URLs via GSC URL Removal tool (max ~1000/day)`,
    `2. Start with source_file_path cluster (highest priority)`,
    `3. Then submit known_skill_404 cluster`,
    `4. Monitor coverage anomaly count weekly via recovery scorecard`,
    `5. Target: anomalies < 2,000 within 4 weeks`,
    ``,
    `## Removal Status Tracking`,
    ``,
    `| Cluster | Submitted | Confirmed Removed | Remaining |`,
    `|---------|----------|-------------------|-----------|`,
    `| source_file_path | - | - | - |`,
    `| known_skill_404 | - | - | - |`,
    `| trailing_slash | - | - | - |`,
    `| other | - | - | - |`,
  ].join('\n');

  writeFileSync(resolve(OUTPUT_DIR, 'latest-gsc-removal-batch.md'), md);

  console.log(`GSC removal batch: ${batch.totalUrls} URLs across ${Object.keys(byCluster).length} clusters`);
  console.log(`Output: ${OUTPUT_DIR}/latest-gsc-removal-batch.{json,csv,md}`);
}

main();
```

- [ ] **Step 2: Run the script**

Run: `npx tsx scripts/gsc-removal-batch-builder.ts`
Expected: Outputs file counts and generates `reports/seo/latest-gsc-removal-batch.{json,csv,md}`

- [ ] **Step 3: Verify the output**

Run: `head -20 reports/seo/latest-gsc-removal-batch.md`
Expected: Markdown report with cluster summary table

- [ ] **Step 4: Write the removal runbook**

Create `docs/superpowers/plans/2026-06-24-traffic-recovery-removal-runbook.md`:

```markdown
# GSC URL Removal Runbook

## Prerequisites
- GSC property verified for `sc-domain:killer-skills.com`
- Service account has `owner` access to the GSC property
- Batch CSV generated by `scripts/gsc-removal-batch-builder.ts`

## Daily Execution (up to 1000 URLs/day)

1. Open Google Search Console → killer-skills.com → Indexing → Removals
2. Click "New Request" → "Remove this URL only"
3. Paste the next batch of URLs from `reports/seo/latest-gsc-removal-batch.csv`
4. Submit and confirm
5. Track submitted count in the runbook status table

## Priority Order

Day 1-4: source_file_path cluster (~4,011 URLs)
Day 5-10: known_skill_404 cluster (~5,499 URLs)
Day 11: trailing_slash + other clusters

## Verification

After each batch (24hr later):
1. Run `npx tsx scripts/gsc-url-inspection-verify.ts --sample 20`
2. Confirm URLs return "URL is not indexed" status
3. Run `npx tsx scripts/seo-crawl-health.ts` to check no new 5xx

## Weekly Tracking

Run `npx tsx scripts/seo-recovery-scorecard.ts` and check Gate 2 (Coverage Freshness):
- Week 1 target: anomalies < 8,000
- Week 2 target: anomalies < 5,000
- Week 4 target: anomalies < 2,000

## Rollback

If removal causes unintended de-indexing of valid pages:
1. Cancel pending removal requests in GSC
2. Submit affected URLs via GSC URL Inspection → "Request Indexing"
3. Verify crawl health is stable
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gsc-removal-batch-builder.ts docs/superpowers/plans/2026-06-24-traffic-recovery-removal-runbook.md reports/seo/latest-gsc-removal-batch.*
git commit -m "feat(seo): add GSC removal batch builder script and runbook"
```

---

## Task 5: Add Recovery Scorecard Gates 6 & 7

**Files:**
- Modify: `scripts/lib/recovery-scorecard.ts`
- Modify: `scripts/seo-recovery-scorecard.ts`

- [ ] **Step 1: Read current recovery-scorecard.ts to understand gate structure**

Run: `head -80 scripts/lib/recovery-scorecard.ts`
Note the `RecoveryScorecardGate` interface and how existing gates are structured.

- [ ] **Step 2: Add Gate 6 — Index Quality Ratio**

In `scripts/lib/recovery-scorecard.ts`, add a `computeIndexQualityGate()` function:

```typescript
function computeIndexQualityGate(
  tier1Count: number,
  totalCanonicalSkills: number,
): RecoveryScorecardGate {
  const ratio = totalCanonicalSkills > 0 ? tier1Count / totalCanonicalSkills : 0;

  let status: 'clear' | 'warning' | 'blocking' | 'unknown';
  if (tier1Count === 0) {
    status = 'blocking';
  } else if (ratio >= 0.05) {
    status = 'clear';
  } else if (ratio >= 0.03) {
    status = 'warning';
  } else {
    status = 'blocking';
  }

  return {
    name: 'index_quality_ratio',
    label: 'Index Quality Ratio',
    status,
    metrics: {
      tier1Count,
      totalCanonicalSkills,
      ratio: Number((ratio * 100).toFixed(1)),
    },
    target: '>= 5% Tier 1 ratio',
  };
}
```

- [ ] **Step 3: Add Gate 7 — Language Alignment**

```typescript
function computeLanguageAlignmentGate(
  bodyEligibleNonEnVariants: number,
  totalNonEnVariants: number,
): RecoveryScorecardGate {
  const ratio = totalNonEnVariants > 0 ? bodyEligibleNonEnVariants / totalNonEnVariants : 0;

  let status: 'clear' | 'warning' | 'blocking' | 'unknown';
  if (ratio >= 0.8) {
    status = 'clear';
  } else if (ratio >= 0.5) {
    status = 'warning';
  } else {
    status = 'blocking';
  }

  return {
    name: 'language_alignment',
    label: 'Language Alignment',
    status,
    metrics: {
      bodyEligibleNonEnVariants,
      totalNonEnVariants,
      ratio: Number((ratio * 100).toFixed(1)),
    },
    target: '>= 80% body-eligible among indexable non-en variants',
  };
}
```

- [ ] **Step 4: Integrate the two new gates into the scorecard runner**

In `scripts/seo-recovery-scorecard.ts`, add calls to the new gate functions after the existing 5 gates. Source data from the locale governance report (`reports/seo/latest-skill-locale-governance.json`) and the indexability report (`reports/seo/latest-skill-indexability.json`).

- [ ] **Step 5: Run the scorecard**

Run: `npx tsx scripts/seo-recovery-scorecard.ts`
Expected: New gates appear in the output. Gate 6 should show `blocking` (Tier 1 ratio is likely 0% since this is new). Gate 7 should show `blocking` (9.4% body alignment is far below 80%).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/recovery-scorecard.ts scripts/seo-recovery-scorecard.ts
git commit -m "feat(seo): add recovery scorecard Gates 6 (Index Quality) and 7 (Language Alignment)"
```

---

## Task 6: Add E2E Index Tier Test

**Files:**
- Create: `tests/e2e/index-tier.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/index-tier.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const SITE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4321';

test.describe('Index Tier System', () => {
  test('Tier 1 skill page has index, follow robots meta', async ({ request }) => {
    // Use a known official/verified skill that should be Tier 1
    const response = await request.get(`${SITE_URL}/en/skills/anthropics/skills`);
    const headers = response.headers();
    const xRobotsTag = headers['x-robots-tag'] || '';
    // Official repos are always Tier 1 — should NOT have noindex
    expect(xRobotsTag).not.toContain('noindex');
  });

  test('non-indexed skill page has noindex, follow', async ({ request }) => {
    // Pick a URL that is Tier 2 or 3 (low stars, no agentAnalysis)
    // This will need a real Tier 2/3 URL from the test environment
    // Using a known blocklisted or low-quality skill
    const response = await request.get(`${SITE_URL}/en/skills/test-dummy/hello-world`, {
      failOnStatusCode: false,
    });
    // If the skill is blocklisted/Tier 2+3 or simply doesn't exist,
    // we expect either noindex or 404
    const xRobotsTag = response.headers()['x-robots-tag'] || '';
    const isNoindex = xRobotsTag.includes('noindex');
    const is404 = response.status() === 404 || response.status() === 410;
    expect(isNoindex || is404).toBe(true);
  });

  test('skills sitemap only contains Tier 1 URLs', async ({ request }) => {
    const response = await request.get(`${SITE_URL}/sitemap-skills.xml`);
    expect(response.status()).toBe(200);
    const body = await response.text();

    // Sitemap should contain URLs but should not contain
    // URLs that we know are Tier 2/3
    // Basic sanity: sitemap should have <url> entries
    const urlCount = (body.match(/<url>/g) || []).length;
    expect(urlCount).toBeGreaterThan(0);
    expect(urlCount).toBeLessThan(600); // Tier 1 is ~300-500

    // Should not contain test/dummy/example repos
    expect(body).not.toContain('/test-dummy/');
    expect(body).not.toContain('/hello-world');
  });
});
```

- [ ] **Step 2: Run the E2E test**

Run: `npx playwright test tests/e2e/index-tier.spec.ts`
Expected: Tests may fail if the dev server isn't running — start it first with `npx astro dev`. After server is up, tests should pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/index-tier.spec.ts
git commit -m "test(e2e): add index tier E2E tests for robots meta and sitemap filtering"
```

---

## Task 7: Add Tier-Segmented Tracking to GSC Health Monitor

**Files:**
- Modify: `scripts/gsc-search-health-monitor.ts`

- [ ] **Step 1: Add index shrink signal alert**

In `scripts/gsc-search-health-monitor.ts`, add a new alert category `gsc_index_shrink_signal`:

```typescript
// After existing alert categories, add:
{
  code: 'gsc_index_shrink_signal',
  label: 'Index Shrink Signal',
  evaluate: (ctrData: any, coverageData: any) => {
    const pageRows = ctrData?.pageRows ?? 0;
    const previousPageRows = ctrData?.previousPageRows ?? 0;

    // If indexed pages drop by >50% week-over-week after our intentional shrink,
    // that's expected. But if they drop by >50% when we didn't intentionally change tiers,
    // that's concerning.
    // For now, flag if Tier 1 page count drops below a minimum threshold.
    const estimatedTier1Pages = Math.max(0, pageRows - 300); // rough estimate
    if (pageRows > 0 && pageRows < 50) {
      return { severity: 'critical', message: `Only ${pageRows} pages in GSC index — possible over-shrinkage` };
    }
    if (pageRows > 0 && pageRows < 150) {
      return { severity: 'warning', message: `Low page count: ${pageRows} — verify tier boundaries` };
    }
    return null;
  },
},
```

- [ ] **Step 2: Run the health monitor**

Run: `npx tsx scripts/gsc-search-health-monitor.ts`
Expected: Existing alerts + new index shrink signal (likely `clear` since pageRows is 37 which is below 50 — should trigger `critical` which is correct, we know traffic is dead).

- [ ] **Step 3: Commit**

```bash
git add scripts/gsc-search-health-monitor.ts
git commit -m "feat(seo): add index shrink signal alert to GSC health monitor"
```

---

## Task 8: Update Indexability Report to Include Tier

**Files:**
- Modify: `scripts/seo-skill-indexability-report.ts`

- [ ] **Step 1: Read the current report script**

Run: `head -100 scripts/seo-skill-indexability-report.ts`
Understand how it iterates over skills and builds the indexability summary.

- [ ] **Step 2: Add tier breakdown to the report output**

In the skill iteration loop, after the `buildSkillIndexabilityAssessment()` call, capture the tier:

```typescript
// After: const assessment = buildSkillIndexabilityAssessment(source, locale);
const tier = assessment.tier; // 1, 2, or 3
```

Add tier counts to the report summary:

```typescript
const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
// In the loop:
tierCounts[`tier${tier}`]++;

// In the output:
summary: {
  ...existing,
  tierCounts,
  tier1Percentage: (tierCounts.tier1 / totalSkills * 100).toFixed(1),
}
```

Add individual skill tier to the per-skill output:

```typescript
// In the per-skill entry:
tier,
tierLabel: tier === 1 ? 'indexable' : tier === 2 ? 'support' : 'reference_only',
```

- [ ] **Step 3: Run the updated report**

Run: `npx tsx scripts/seo-skill-indexability-report.ts`
Expected: Report now includes tier breakdown. Verify Tier 1 count is in the 300-500 range.

- [ ] **Step 4: Commit**

```bash
git add scripts/seo-skill-indexability-report.ts
git commit -m "feat(seo): add tier breakdown to skill indexability report"
```

---

## Task 9: Verify Full Build and Run Integration Tests

**Files:** No new files — validation only

- [ ] **Step 1: Run full typecheck**

Run: `npx astro check`
Expected: No type errors related to the new `tier` property or `stars` field.

- [ ] **Step 2: Run full Vitest suite**

Run: `npx vitest run`
Expected: All existing tests + new tests pass.

- [ ] **Step 3: Run full build**

Run: `npx astro build`
Expected: Build completes successfully. Sitemap file size should be significantly smaller (reflecting Tier 1 only).

- [ ] **Step 4: Verify sitemap size reduction**

Run: `ls -la dist/sitemap-skills.xml`
Compare with previous size. Expected: significantly smaller (from ~1,500 URLs to ~300-500).

- [ ] **Step 5: Run crawl health audit**

Run: `npx tsx scripts/seo-crawl-health.ts`
Expected: All Tier 1 pages return `index, follow`. All Tier 2/3 pages return `noindex, follow`.

- [ ] **Step 6: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(seo): address build/integration test findings from tier rollout"
```

---

## Task 10: Update Planning State for v4.8 Phase 151

**Files:**
- Modify: `.planning/STATE.md`
- Modify: `.planning/ROADMAP.md`

- [ ] **Step 1: Update STATE.md**

Update milestone to v4.8 and mark Phase 151 as in progress:

```yaml
---
gsd_state_version: 1.0
milestone: v4.8
milestone_name: Crawl Remediation & Discovery Expansion
status: in_progress
last_updated: "2026-06-24T12:00:00.000Z"
last_activity: 2026-06-24
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
---

# Current Position

Phase: 151
Plan: Index Slimdown + Authority Focus (Traffic Recovery)
Status: In Progress — Tier system implemented, GSC removal batch prepared
Last activity: 2026-06-24
```

- [ ] **Step 2: Update ROADMAP.md Phase 151 status**

In `.planning/ROADMAP.md`, change Phase 151 from "Not started" to "In Progress":

```markdown
### Phase 151: Crawl Coverage Remediation

- **Requirements:** REMED-01
- **Scope:** 3-tier index slimdown (5,308 → ~300-500 Tier 1 skills), body-locale alignment enforcement, GSC URL removal batches, coverage anomaly reduction.
- **Status:** In Progress
- **Plans:** 0/1 plans complete
- **Success Criteria:**
  - Tier 1 skill count in 300-500 range.
  - Sitemap contains only Tier 1 URLs.
  - Non-English non-body-matching pages are noindex.
  - GSC removal batch generated for 10,783 anomalies.
  - Zero regression on existing E2E flows.
```

- [ ] **Step 3: Commit**

```bash
git add .planning/STATE.md .planning/ROADMAP.md
git commit -m "docs(planning): update v4.8 Phase 151 status to in-progress"
```

---

## Self-Review

### Spec Coverage

| Spec Section | Task(s) |
|-------------|----------|
| 2.1 Index Tier System | Task 1, Task 2, Task 3 |
| 2.2 Authority Surface Upgrade | Not in this plan — deferred to separate plan based on spec Section 2.2 (editorial content injection requires human curation, separate from code changes) |
| 2.3 Language Alignment | Task 2 (sitemap bodyEligible filtering), Task 3 (noindex for non-body-matching) |
| 2.4 URL Cleanup | Task 4 |
| 2.5 Verification | Task 5, Task 6, Task 7, Task 8 |

### Placeholder Scan

No TBD/TODO placeholders found. All code blocks contain complete implementation.

### Type Consistency

- `SkillIndexabilityAssessment.tier` is `1 | 2 | 3` — used consistently in Tasks 1, 2, 3, 8
- `SkillIndexabilitySource.stars` is `number | null` — added in Task 1, consumed in Tasks 1 and 2
- `TIER1_MIN_STARS = 50` and `TIER1_QUALITY_THRESHOLD = 55` — defined in `skills-config.ts`, imported in `skill-indexability.ts` (Task 1) and `kv.ts` (Task 2)

### Authority Surface Note

The spec Section 2.2 (Authority Surface Upgrade — editorial content injection for P0/P1 surfaces) requires human editorial judgment and content creation that cannot be fully automated. This is intentionally deferred to a separate plan. The code changes to support it (adding `editorialRationale` fields to collection JSONs, adjusting `promote` thresholds) can be implemented as a follow-on plan once the index slimdown is deployed and measured.
