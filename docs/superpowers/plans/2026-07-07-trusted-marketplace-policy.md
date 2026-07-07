# Trusted Marketplace Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize Killer-Skills public admission, rankings, quarantine reasons, and trust badges in one marketplace policy layer used by all public marketplace routes.

**Architecture:** Add `src/lib/marketplace-policy.ts` as the single rule layer for admission, sorting, public badges, and detail trust data. Keep `src/lib/marketplace-filters.ts` as a compatibility facade so existing route imports keep working while API search, cards, related skills, and detail pages move onto the same policy contract.

**Tech Stack:** Astro 6, TypeScript, existing `UnifiedSkill` catalog types, Vitest, Prettier, Astro check, production preview SEO smoke/crawl gates.

## Global Constraints

- Public marketplace routes only show skills that pass baseline review.
- Baseline review excludes blocker risk flags.
- Baseline review excludes `securityLevel=D`.
- Baseline review excludes `isTrustedRankingEligible=false`, `0`, `"0"`, or `"false"`.
- Baseline review admits `sourceTrust=T1` and `sourceTrust=T2`.
- Baseline review quarantines `sourceTrust=T3`.
- Official is a source attribute, not a category.
- Official skills must still pass baseline review.
- Popular ranking uses approved skills only.
- Latest ranking uses approved skills only.
- Cards show compact signals: Reviewed, Official or Community, Token required, Network access, File write, Recently updated.
- Detail pages show fuller trust evidence: safety level, source trust, review status, risk flags, audit time, source repository, install path, and why the skill is listed.
- Safety is not a primary navigation item.
- Do not add verbose instructional blocks to primary routes.
- Keep existing URLs stable.

---

## File Structure

### New files

- `src/lib/marketplace-policy.ts`
  - Owns public admission, quarantine reason codes, card trust badges, detail trust panel data, popular sorting, latest sorting, and metadata admission checks for API/search contexts.
- `src/lib/marketplace-policy.test.ts`
  - Tests admission, quarantine reasons, sorting, badge mapping, detail trust data, and metadata admission.

### Modified files

- `src/lib/marketplace-filters.ts`
  - Becomes a compatibility facade that re-exports policy functions under existing names.
- `src/lib/marketplace-filters.test.ts`
  - Keeps compatibility tests, updated to include `sourceTrust` and blocker risk cases.
- `src/lib/occupations.test.ts`
  - Updates fixtures so tests intentionally pass baseline review with `sourceTrust: 'T2'`.
- `src/components/SkillCard.astro`
  - Uses `buildMarketplaceCardTrust()` for badge labels and title copy instead of local risk/source logic.
- `src/lib/skill-detail-view.ts`
  - Uses or re-exports detail trust helper when the detail page needs non-Astro tested logic.
- `src/lib/skill-detail-view.test.ts`
  - Covers compact detail chips and the "why listed" detail trust model.
- `src/pages/[locale]/skills/[owner]/[...repo].astro`
  - Uses `buildMarketplaceDetailTrust()` for trust panel rows and filters related skills through the public policy.
- `src/pages/api/search.ts`
  - Replaces local metadata admission with `isMarketplaceMetadataAdmitted()` and updates SQL admission to require `T1/T2` plus no blocker risk flags.

---

### Task 1: Create Marketplace Policy Domain Layer

**Files:**

- Create: `src/lib/marketplace-policy.ts`
- Create: `src/lib/marketplace-policy.test.ts`

**Interfaces:**

- Consumes:
  - `UnifiedSkill` from `src/lib/skills.ts`
  - `RiskFlag`, `RiskFlagCode`, `SecurityLevel`, `SourceTrustLevel` from `src/lib/skill-trust.ts`
  - `OFFICIAL_REPOS` from `src/lib/skills-config.ts`
- Produces:
  - `type SourceKind = 'official' | 'community'`
  - `type MarketplaceRankKind = 'popular' | 'latest'`
  - `type MarketplaceQuarantineReasonCode`
  - `interface MarketplaceAdmission`
  - `interface MarketplaceBadge`
  - `interface MarketplaceCardTrust`
  - `interface MarketplaceDetailTrust`
  - `getSkillSourceKind(skill: UnifiedSkill): SourceKind`
  - `getMarketplaceAdmission(skill: UnifiedSkill): MarketplaceAdmission`
  - `isPublicMarketplaceSkill(skill: UnifiedSkill): boolean`
  - `getPublicMarketplaceSkills(skills: UnifiedSkill[]): UnifiedSkill[]`
  - `compareMarketplaceSkillsPopular(a: UnifiedSkill, b: UnifiedSkill): number`
  - `sortMarketplaceSkillsPopular(skills: UnifiedSkill[]): UnifiedSkill[]`
  - `sortMarketplaceSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[]`
  - `buildMarketplaceCardTrust(skill: UnifiedSkill, options: { locale: string; now?: Date }): MarketplaceCardTrust`
  - `buildMarketplaceDetailTrust(skill: UnifiedSkill, options: { locale: string; routePath?: string; now?: Date }): MarketplaceDetailTrust`
  - `isMarketplaceMetadataAdmitted(data: Record<string, unknown>, options?: { requireExplicitAdmission?: boolean }): boolean`

- [ ] **Step 1: Write failing policy tests**

Create `src/lib/marketplace-policy.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import type { UnifiedSkill } from './skills';
import {
  buildMarketplaceCardTrust,
  buildMarketplaceDetailTrust,
  getMarketplaceAdmission,
  getPublicMarketplaceSkills,
  getSkillSourceKind,
  isMarketplaceMetadataAdmitted,
  isPublicMarketplaceSkill,
  sortMarketplaceSkillsLatest,
  sortMarketplaceSkillsPopular,
} from './marketplace-policy';

const baseSkill = (overrides: Partial<UnifiedSkill> = {}): UnifiedSkill =>
  ({
    id: overrides.id || `${overrides.owner || 'owner'}/${overrides.repo || 'repo'}`,
    name: overrides.name || 'useful-skill',
    skillName: overrides.skillName || overrides.name || 'useful-skill',
    owner: overrides.owner || 'owner',
    repo: overrides.repo || 'repo',
    description: overrides.description || 'Useful AI agent workflow with installable instructions.',
    category: overrides.category || 'developer',
    topics: overrides.topics || ['ai-agents', 'developer-tools'],
    stars: overrides.stars ?? 25,
    source: overrides.source || 'cache',
    securityLevel: overrides.securityLevel || 'A',
    sourceTrust: overrides.sourceTrust || 'T2',
    rankScore: overrides.rankScore ?? 75,
    qualityScore: overrides.qualityScore ?? 70,
    isTrustedRankingEligible: overrides.isTrustedRankingEligible ?? true,
    updatedAt: overrides.updatedAt || '2026-07-01T00:00:00.000Z',
    filePath: overrides.filePath || '.claude/skills/useful-skill/SKILL.md',
    skillMd: overrides.skillMd || {
      name: 'useful-skill',
      description: 'Useful AI agent workflow with installable instructions.',
      bodyPreview: 'Use this skill to support reviewed developer workflows.',
    },
    riskFlags: overrides.riskFlags || [],
    ...overrides,
  }) as UnifiedSkill;

describe('marketplace policy admission', () => {
  it('admits reviewed T1 and T2 skills', () => {
    const t1 = baseSkill({ sourceTrust: 'T1' });
    const t2 = baseSkill({ sourceTrust: 'T2' });

    expect(isPublicMarketplaceSkill(t1)).toBe(true);
    expect(isPublicMarketplaceSkill(t2)).toBe(true);
    expect(getMarketplaceAdmission(t2)).toEqual({ admitted: true, reasons: [] });
  });

  it('quarantines D level skills', () => {
    const admission = getMarketplaceAdmission(baseSkill({ securityLevel: 'D' }));

    expect(admission.admitted).toBe(false);
    expect(admission.reasons).toContain('security_level_d');
  });

  it('quarantines blocker risk flags', () => {
    const admission = getMarketplaceAdmission(
      baseSkill({
        riskFlags: [{ code: 'destructive_shell', severity: 'blocker', label: 'destructive shell pattern' }],
      }),
    );

    expect(admission.admitted).toBe(false);
    expect(admission.reasons).toContain('blocker_risk');
  });

  it('quarantines false-like trusted ranking eligibility', () => {
    expect(getMarketplaceAdmission(baseSkill({ isTrustedRankingEligible: false })).reasons).toContain(
      'not_trusted_ranking_eligible',
    );
    expect(getMarketplaceAdmission(baseSkill({ isTrustedRankingEligible: 0 as never })).reasons).toContain(
      'not_trusted_ranking_eligible',
    );
    expect(getMarketplaceAdmission(baseSkill({ isTrustedRankingEligible: 'false' as never })).reasons).toContain(
      'not_trusted_ranking_eligible',
    );
  });

  it('quarantines explicit T3 source trust', () => {
    const admission = getMarketplaceAdmission(baseSkill({ sourceTrust: 'T3' }));

    expect(admission.admitted).toBe(false);
    expect(admission.reasons).toContain('source_trust_t3');
  });

  it('quarantines unstructured skills without useful public source material', () => {
    const admission = getMarketplaceAdmission(
      baseSkill({
        name: '',
        skillName: '',
        repo: '',
        description: '',
        filePath: '',
        skillMd: {},
      }),
    );

    expect(admission.admitted).toBe(false);
    expect(admission.reasons).toContain('unstructured_source');
  });

  it('keeps official status as source kind but still applies admission', () => {
    const official = baseSkill({ owner: 'anthropics', repo: 'skills', sourceTrust: 'T1' });
    const blockedOfficial = baseSkill({ owner: 'anthropics', repo: 'skills', sourceTrust: 'T1', securityLevel: 'D' });

    expect(getSkillSourceKind(official)).toBe('official');
    expect(isPublicMarketplaceSkill(official)).toBe(true);
    expect(isPublicMarketplaceSkill(blockedOfficial)).toBe(false);
  });
});

describe('marketplace policy ranking', () => {
  it('filters public skills before sorting', () => {
    const publicSkill = baseSkill({ name: 'public', rankScore: 90 });
    const quarantined = baseSkill({ name: 'quarantined', sourceTrust: 'T3', rankScore: 100 });

    expect(getPublicMarketplaceSkills([quarantined, publicSkill]).map((skill) => skill.name)).toEqual(['public']);
  });

  it('sorts popular by rank score, quality score, stars, and name', () => {
    const trusted = baseSkill({ name: 'trusted', rankScore: 90, qualityScore: 70, stars: 4 });
    const quality = baseSkill({ name: 'quality', rankScore: 80, qualityScore: 95, stars: 10 });
    const stars = baseSkill({ name: 'stars', rankScore: 80, qualityScore: 95, stars: 500 });

    expect(sortMarketplaceSkillsPopular([quality, trusted, stars]).map((skill) => skill.name)).toEqual([
      'trusted',
      'stars',
      'quality',
    ]);
  });

  it('sorts latest by updatedAt after admission', () => {
    const newer = baseSkill({ name: 'newer', updatedAt: '2026-07-01T00:00:00.000Z' });
    const older = baseSkill({ name: 'older', updatedAt: '2026-01-01T00:00:00.000Z' });
    const blocked = baseSkill({ name: 'blocked', updatedAt: '2026-08-01T00:00:00.000Z', securityLevel: 'D' });

    expect(sortMarketplaceSkillsLatest(getPublicMarketplaceSkills([older, blocked, newer])).map((skill) => skill.name)).toEqual([
      'newer',
      'older',
    ]);
  });
});

describe('marketplace public signals', () => {
  it('builds compact card badges', () => {
    const cardTrust = buildMarketplaceCardTrust(
      baseSkill({
        sourceTrust: 'T2',
        riskFlags: [
          { code: 'requires_token', severity: 'info', label: 'credential required' },
          { code: 'external_network', severity: 'warning', label: 'external network call' },
          { code: 'file_write', severity: 'info', label: 'local file write' },
        ],
      }),
      { locale: 'en', now: new Date('2026-07-07T00:00:00.000Z') },
    );

    expect(cardTrust.badges.map((badge) => badge.label)).toEqual([
      'Community',
      'Reviewed',
      'Token',
      'Network',
      'File write',
      'Recently updated',
    ]);
    expect(cardTrust.title).toContain('reviewed');
  });

  it('builds localized detail trust rows and why-listed copy', () => {
    const detailTrust = buildMarketplaceDetailTrust(baseSkill({ sourceTrust: 'T1' }), {
      locale: 'zh',
      routePath: 'owner/repo',
      now: new Date('2026-07-07T00:00:00.000Z'),
    });

    expect(detailTrust.reviewStatus).toBe('admitted');
    expect(detailTrust.rows.map((row) => row.label)).toEqual(['安全等级', '来源等级', '审核状态', '风险信号', '最后审查']);
    expect(detailTrust.whyListed).toContain('T1');
    expect(detailTrust.sourceRepository).toBe('owner/repo');
    expect(detailTrust.installPath).toBe('owner/repo');
  });
});

describe('marketplace metadata admission', () => {
  it('requires explicit metadata when requested', () => {
    expect(isMarketplaceMetadataAdmitted({}, { requireExplicitAdmission: true })).toBe(false);
    expect(
      isMarketplaceMetadataAdmitted(
        { securityLevel: 'A', sourceTrust: 'T2', isTrustedRankingEligible: true, riskFlags: [] },
        { requireExplicitAdmission: true },
      ),
    ).toBe(true);
  });

  it('rejects metadata with T3 source trust or blocker flags', () => {
    expect(isMarketplaceMetadataAdmitted({ securityLevel: 'A', sourceTrust: 'T3', isTrustedRankingEligible: true })).toBe(
      false,
    );
    expect(
      isMarketplaceMetadataAdmitted({
        securityLevel: 'A',
        sourceTrust: 'T2',
        isTrustedRankingEligible: true,
        riskFlags: [{ code: 'credential_capture', severity: 'blocker', label: 'credential capture pattern' }],
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run policy tests and confirm red**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts
```

Expected: failure containing `Failed to resolve import "./marketplace-policy"`.

- [ ] **Step 3: Implement marketplace policy module**

Create `src/lib/marketplace-policy.ts` with:

```ts
import type { UnifiedSkill } from './skills';
import { OFFICIAL_REPOS } from './skills-config';
import type { RiskFlag, RiskFlagCode, SecurityLevel, SourceTrustLevel } from './skill-trust';

export type SourceKind = 'official' | 'community';
export type MarketplaceRankKind = 'popular' | 'latest';

export type MarketplaceQuarantineReasonCode =
  | 'security_level_d'
  | 'blocker_risk'
  | 'not_trusted_ranking_eligible'
  | 'source_trust_t3'
  | 'unstructured_source'
  | 'missing_install_path';

export interface MarketplaceAdmission {
  admitted: boolean;
  reasons: MarketplaceQuarantineReasonCode[];
}

export interface MarketplaceBadge {
  id: string;
  label: string;
  tone: 'neutral' | 'positive' | 'warning';
}

export interface MarketplaceCardTrust {
  sourceKind: SourceKind;
  admitted: boolean;
  badges: MarketplaceBadge[];
  title: string;
}

export interface MarketplaceDetailTrust {
  reviewStatus: 'admitted' | 'quarantined';
  sourceKind: SourceKind;
  sourceRepository: string;
  installPath: string;
  whyListed: string;
  rows: Array<{ label: string; value: string }>;
  badges: MarketplaceBadge[];
  riskLabels: string[];
  quarantineReasons: MarketplaceQuarantineReasonCode[];
}

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));
const OFFICIAL_OWNERS = new Set(
  Object.values(OFFICIAL_REPOS)
    .filter((repo) => repo.verified)
    .map((repo) => repo.owner),
);

const RISK_LABELS: Record<RiskFlagCode, Record<'en' | 'zh', string>> = {
  requires_token: { en: 'Token', zh: 'Token' },
  external_network: { en: 'Network', zh: '联网' },
  destructive_shell: { en: 'Destructive shell', zh: '破坏性命令' },
  credential_capture: { en: 'Credential capture', zh: '凭证抓取' },
  file_write: { en: 'File write', zh: '写文件' },
  thin_source: { en: 'Thin source', zh: '材料过薄' },
  stale_source: { en: 'Stale source', zh: '长期未更新' },
  unstructured_skill: { en: 'Unstructured', zh: '结构不足' },
};

function isZh(locale: string): boolean {
  return locale.startsWith('zh');
}

function numericSortValue(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dateSortValue(value: string | null | undefined): number {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function skillDisplayName(skill: UnifiedSkill): string {
  return String(skill.name || skill.skillName || skill.repo || '');
}

function isFalseLike(value: unknown): boolean {
  return value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false';
}

function textFrom(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map((entry) => textFrom(entry)).join(' ').trim();
  if (!value || typeof value !== 'object') return '';
  return Object.values(value as Record<string, unknown>)
    .map((entry) => textFrom(entry))
    .join(' ')
    .trim();
}

function hasStructuredPublicSource(skill: UnifiedSkill): boolean {
  return Boolean(
    textFrom(skill.name || skill.skillName || skill.repo) &&
      (textFrom(skill.description).length > 0 ||
        textFrom(skill.skillMd?.name).length > 0 ||
        textFrom(skill.skillMd?.description).length > 0 ||
        textFrom(skill.skillMd?.bodyPreview).length > 0 ||
        textFrom(skill.skillMd?.body).length > 0 ||
        textFrom(skill.filePath).length > 0),
  );
}

function hasInstallPath(skill: UnifiedSkill): boolean {
  return Boolean(skill.owner && (skill.repo || skill.id || skill.filePath));
}

function hasBlockerRisk(riskFlags: Array<Partial<RiskFlag>> | undefined): boolean {
  return Boolean((riskFlags || []).some((flag) => flag.severity === 'blocker'));
}

function riskLabels(riskFlags: Array<Partial<RiskFlag>> | undefined, locale: string, limit = 5): string[] {
  const labels: string[] = [];
  const zh = isZh(locale);

  for (const flag of riskFlags || []) {
    const code = flag.code as RiskFlagCode | undefined;
    const label = code && RISK_LABELS[code] ? RISK_LABELS[code][zh ? 'zh' : 'en'] : flag.label || code || '';
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length >= limit) break;
  }

  return labels;
}

function daysSince(dateValue: string | undefined, now: Date): number {
  const timestamp = dateValue ? Date.parse(dateValue) : Number.NaN;
  if (!Number.isFinite(timestamp)) return 9999;
  return Math.floor((now.getTime() - timestamp) / 86_400_000);
}

function sourceTrustFor(skill: UnifiedSkill): SourceTrustLevel {
  if (skill.sourceTrust === 'T1' || skill.sourceTrust === 'T2' || skill.sourceTrust === 'T3') {
    return skill.sourceTrust;
  }

  const repoKey = `${skill.owner || ''}/${skill.repo || ''}`;
  if (skill.source === 'verified' || OFFICIAL_REPO_KEYS.has(repoKey) || OFFICIAL_OWNERS.has(skill.owner)) {
    return 'T1';
  }

  if ((skill.stars || 0) >= 50 || textFrom(skill.filePath) || textFrom(skill.skillMd).length >= 220) {
    return 'T2';
  }

  return 'T3';
}

function securityLevelFor(skill: UnifiedSkill): SecurityLevel {
  if (skill.securityLevel) return skill.securityLevel;
  return getSkillSourceKind(skill) === 'official' ? 'S' : 'C';
}

function pushBadge(badges: MarketplaceBadge[], badge: MarketplaceBadge): void {
  if (!badges.some((item) => item.id === badge.id)) badges.push(badge);
}

export function getSkillSourceKind(skill: UnifiedSkill): SourceKind {
  if (skill.sourceKind === 'official' || skill.sourceKind === 'community') return skill.sourceKind;

  const key = `${skill.owner || ''}/${skill.repo || ''}`;
  if (skill.source === 'verified' || OFFICIAL_REPO_KEYS.has(key) || OFFICIAL_OWNERS.has(skill.owner)) {
    return 'official';
  }

  return 'community';
}

export function getMarketplaceAdmission(skill: UnifiedSkill): MarketplaceAdmission {
  const reasons: MarketplaceQuarantineReasonCode[] = [];
  const sourceTrust = sourceTrustFor(skill);

  if (securityLevelFor(skill) === 'D') reasons.push('security_level_d');
  if (hasBlockerRisk(skill.riskFlags)) reasons.push('blocker_risk');
  if (isFalseLike(skill.isTrustedRankingEligible)) reasons.push('not_trusted_ranking_eligible');
  if (sourceTrust === 'T3') reasons.push('source_trust_t3');
  if (!hasStructuredPublicSource(skill)) reasons.push('unstructured_source');
  if (!hasInstallPath(skill)) reasons.push('missing_install_path');

  return { admitted: reasons.length === 0, reasons };
}

export function isPublicMarketplaceSkill(skill: UnifiedSkill): boolean {
  return getMarketplaceAdmission(skill).admitted;
}

export function getPublicMarketplaceSkills(skills: UnifiedSkill[]): UnifiedSkill[] {
  return skills.filter(isPublicMarketplaceSkill).map((skill) => ({
    ...skill,
    sourceKind: getSkillSourceKind(skill),
    sourceTrust: sourceTrustFor(skill),
    securityLevel: securityLevelFor(skill),
  }));
}

export function compareMarketplaceSkillsPopular(a: UnifiedSkill, b: UnifiedSkill): number {
  return (
    numericSortValue(b.rankScore) - numericSortValue(a.rankScore) ||
    numericSortValue(b.qualityScore) - numericSortValue(a.qualityScore) ||
    numericSortValue(b.stars) - numericSortValue(a.stars) ||
    skillDisplayName(a).localeCompare(skillDisplayName(b))
  );
}

export function sortMarketplaceSkillsPopular(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort(compareMarketplaceSkillsPopular);
}

export function sortMarketplaceSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[] {
  return [...skills].sort((a, b) => {
    const byDate = dateSortValue(b.updatedAt) - dateSortValue(a.updatedAt);
    if (byDate !== 0) return byDate;
    return compareMarketplaceSkillsPopular(a, b);
  });
}

export function buildMarketplaceCardTrust(
  skill: UnifiedSkill,
  options: { locale: string; now?: Date },
): MarketplaceCardTrust {
  const now = options.now || new Date();
  const zh = isZh(options.locale);
  const sourceKind = getSkillSourceKind(skill);
  const admission = getMarketplaceAdmission(skill);
  const badges: MarketplaceBadge[] = [];

  pushBadge(badges, {
    id: sourceKind,
    label: sourceKind === 'official' ? (zh ? '官方' : 'Official') : zh ? '社区' : 'Community',
    tone: sourceKind === 'official' ? 'positive' : 'neutral',
  });

  if (admission.admitted) {
    pushBadge(badges, { id: 'reviewed', label: zh ? '已审查' : 'Reviewed', tone: 'positive' });
  }

  for (const label of riskLabels(skill.riskFlags, options.locale, 3)) {
    const id = label.toLowerCase().replace(/\s+/g, '-');
    pushBadge(badges, { id, label, tone: label === 'Token' || label === '联网' || label === 'Network' ? 'warning' : 'neutral' });
  }

  if (daysSince(skill.updatedAt, now) <= 90) {
    pushBadge(badges, { id: 'recently-updated', label: zh ? '近期更新' : 'Recently updated', tone: 'positive' });
  }

  const title = admission.admitted
    ? zh
      ? `已审查；来源 ${sourceTrustFor(skill)}；${sourceKind === 'official' ? '官方来源' : '社区来源'}`
      : `Baseline reviewed; source ${sourceTrustFor(skill)}; ${sourceKind} source`
    : zh
      ? `未公开推荐：${admission.reasons.join(', ')}`
      : `Not publicly promoted: ${admission.reasons.join(', ')}`;

  return { sourceKind, admitted: admission.admitted, badges, title };
}

export function buildMarketplaceDetailTrust(
  skill: UnifiedSkill,
  options: { locale: string; routePath?: string; now?: Date },
): MarketplaceDetailTrust {
  const now = options.now || new Date();
  const zh = isZh(options.locale);
  const sourceKind = getSkillSourceKind(skill);
  const sourceTrust = sourceTrustFor(skill);
  const securityLevel = securityLevelFor(skill);
  const admission = getMarketplaceAdmission(skill);
  const sourceRepository = `${skill.owner || ''}/${skill.repo || ''}`.replace(/^\/|\/$/g, '');
  const installPath = options.routePath || sourceRepository || skill.id || '';
  const riskList = riskLabels(skill.riskFlags, options.locale, 5);
  const reviewedAt = (skill as { lastAuditedAt?: string }).lastAuditedAt || skill.updatedAt || '';
  const reviewStatus = admission.admitted ? 'admitted' : 'quarantined';
  const badges = buildMarketplaceCardTrust(skill, { locale: options.locale, now }).badges;
  const riskValue = riskList.length ? riskList.join(', ') : zh ? '无阻断风险' : 'No blockers';
  const whyListed = admission.admitted
    ? zh
      ? `该 Skill 来源为 ${sourceTrust}，未检测到阻断风险，并提供可定位的安装来源。`
      : `This skill is listed because it has ${sourceTrust} source trust, no blocker risk, and an installable source path.`
    : zh
      ? `该 Skill 未进入公开推荐：${admission.reasons.join(', ')}。`
      : `This skill is not publicly promoted: ${admission.reasons.join(', ')}.`;

  return {
    reviewStatus,
    sourceKind,
    sourceRepository,
    installPath,
    whyListed,
    badges,
    riskLabels: riskList,
    quarantineReasons: admission.reasons,
    rows: [
      { label: zh ? '安全等级' : 'Security', value: securityLevel },
      { label: zh ? '来源等级' : 'Source trust', value: sourceTrust },
      { label: zh ? '审核状态' : 'Review status', value: admission.admitted ? (zh ? '已通过基础审核' : 'Baseline reviewed') : zh ? '隔离' : 'Quarantined' },
      { label: zh ? '风险信号' : 'Risk signals', value: riskValue },
      { label: zh ? '最后审查' : 'Last reviewed', value: reviewedAt ? reviewedAt.slice(0, 10) : zh ? '未知' : 'Unknown' },
    ],
  };
}

export function isMarketplaceMetadataAdmitted(
  data: Record<string, unknown>,
  options: { requireExplicitAdmission?: boolean } = {},
): boolean {
  const hasExplicitAdmission =
    Object.prototype.hasOwnProperty.call(data, 'securityLevel') &&
    Object.prototype.hasOwnProperty.call(data, 'sourceTrust') &&
    Object.prototype.hasOwnProperty.call(data, 'isTrustedRankingEligible');

  if (options.requireExplicitAdmission && !hasExplicitAdmission) return false;
  if (String(data.securityLevel || '').toUpperCase() === 'D') return false;
  if (String(data.sourceTrust || '').toUpperCase() === 'T3') return false;
  if (isFalseLike(data.isTrustedRankingEligible)) return false;
  if (hasBlockerRisk(data.riskFlags as Array<Partial<RiskFlag>> | undefined)) return false;
  return true;
}
```

- [ ] **Step 4: Run policy tests and confirm green**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts
```

Expected: all tests in `src/lib/marketplace-policy.test.ts` pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/lib/marketplace-policy.ts src/lib/marketplace-policy.test.ts
git commit -m "feat: add trusted marketplace policy"
```

Expected: commit succeeds.

---

### Task 2: Replace Marketplace Filters With A Policy Facade

**Files:**

- Modify: `src/lib/marketplace-filters.ts`
- Modify: `src/lib/marketplace-filters.test.ts`
- Modify: `src/lib/occupations.test.ts`

**Interfaces:**

- Consumes:
  - Policy exports from Task 1.
- Produces:
  - Existing `marketplace-filters` function names remain valid for routes already importing them:
    - `compareSkillsPopular`
    - `getMarketplaceSkills`
    - `getSkillSourceKind`
    - `isMarketplaceApprovedSkill`
    - `sortSkillsLatest`
    - `sortSkillsPopular`

- [ ] **Step 1: Write failing compatibility expectations**

Update `src/lib/marketplace-filters.test.ts` so the existing test helper creates admitted skills by default:

```ts
const skill = (overrides: Partial<UnifiedSkill>): UnifiedSkill =>
  ({
    id: overrides.id || `${overrides.owner || 'owner'}/${overrides.repo || 'repo'}`,
    name: overrides.name || 'skill',
    skillName: overrides.skillName || overrides.name || 'skill',
    owner: overrides.owner || 'owner',
    repo: overrides.repo || 'repo',
    description: overrides.description || 'Useful agent skill with installable instructions.',
    category: overrides.category || 'developer',
    topics: overrides.topics || [],
    stars: overrides.stars ?? 0,
    source: overrides.source || 'cache',
    securityLevel: overrides.securityLevel || 'A',
    sourceTrust: overrides.sourceTrust || 'T2',
    isTrustedRankingEligible: overrides.isTrustedRankingEligible ?? true,
    filePath: overrides.filePath || '.claude/skills/skill/SKILL.md',
    skillMd: overrides.skillMd || {
      name: 'skill',
      description: 'Useful agent skill with installable instructions.',
      bodyPreview: 'Reviewed public skill source.',
    },
    updatedAt: overrides.updatedAt || '2026-07-01T00:00:00.000Z',
    ...overrides,
  }) as UnifiedSkill;
```

Add this test inside the existing `describe('marketplace filters', () => { ... })` block:

```ts
it('excludes explicit T3 and blocker-risk skills through the compatibility facade', () => {
  const t3 = skill({ name: 't3', sourceTrust: 'T3' });
  const blocker = skill({
    name: 'blocker',
    riskFlags: [{ code: 'credential_capture', severity: 'blocker', label: 'credential capture pattern' }],
  });
  const approved = skill({ name: 'approved' });

  expect(getMarketplaceSkills([t3, blocker, approved]).map((item) => item.name)).toEqual(['approved']);
});
```

Update `src/lib/occupations.test.ts` fixtures so any skill meant to appear publicly includes:

```ts
sourceTrust: overrides.sourceTrust || 'T2',
isTrustedRankingEligible: overrides.isTrustedRankingEligible ?? true,
filePath: overrides.filePath || '.claude/skills/test/SKILL.md',
skillMd: overrides.skillMd || {
  name: overrides.name || 'skill',
  description: 'Reviewed occupation test skill.',
  bodyPreview: 'Reviewed occupation test skill source.',
},
```

- [ ] **Step 2: Run compatibility tests and confirm red**

Run:

```bash
npx vitest run src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts
```

Expected: failure until `marketplace-filters.ts` delegates to `marketplace-policy.ts`.

- [ ] **Step 3: Replace marketplace-filters with facade exports**

Replace `src/lib/marketplace-filters.ts` with:

```ts
export type { SourceKind } from './marketplace-policy';
export {
  compareMarketplaceSkillsPopular as compareSkillsPopular,
  getPublicMarketplaceSkills as getMarketplaceSkills,
  getSkillSourceKind,
  isPublicMarketplaceSkill as isMarketplaceApprovedSkill,
  sortMarketplaceSkillsLatest as sortSkillsLatest,
  sortMarketplaceSkillsPopular as sortSkillsPopular,
} from './marketplace-policy';
```

- [ ] **Step 4: Run compatibility tests and confirm green**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/lib/marketplace-filters.ts src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts
git commit -m "refactor: route marketplace filters through policy"
```

Expected: commit succeeds.

---

### Task 3: Move Search API Admission Onto Policy

**Files:**

- Modify: `src/pages/api/search.ts`

**Interfaces:**

- Consumes:
  - `isMarketplaceMetadataAdmitted(data, options)` from `src/lib/marketplace-policy.ts`.
- Produces:
  - Search API excludes D, T3, false-like eligibility, and blocker metadata before returning results.

- [ ] **Step 1: Replace local metadata helpers with policy import**

In `src/pages/api/search.ts`, change the marketplace import section from:

```ts
import { getMarketplaceSkills } from '../../lib/marketplace-filters';
```

to:

```ts
import { getMarketplaceSkills } from '../../lib/marketplace-filters';
import { isMarketplaceMetadataAdmitted } from '../../lib/marketplace-policy';
```

Delete these local functions from `src/pages/api/search.ts`:

```ts
function isFalseLike(value: unknown): boolean {
  return value === false || value === 0 || value === '0' || value === 'false';
}

function hasExplicitAdmissionMetadata(data: { securityLevel?: unknown; isTrustedRankingEligible?: unknown }): boolean {
  return (
    Object.prototype.hasOwnProperty.call(data, 'securityLevel') &&
    data.securityLevel !== null &&
    data.securityLevel !== undefined &&
    Object.prototype.hasOwnProperty.call(data, 'isTrustedRankingEligible') &&
    data.isTrustedRankingEligible !== null &&
    data.isTrustedRankingEligible !== undefined
  );
}

function isMarketplaceMetadataAdmitted(
  data: { securityLevel?: unknown; isTrustedRankingEligible?: unknown },
  options: { requireExplicitAdmission?: boolean } = {},
): boolean {
  if (options.requireExplicitAdmission && !hasExplicitAdmissionMetadata(data)) return false;
  if (String(data.securityLevel || '').toUpperCase() === 'D') return false;
  if (
    isFalseLike(data.isTrustedRankingEligible) ||
    (typeof data.isTrustedRankingEligible === 'string' && isFalseLike(data.isTrustedRankingEligible.toLowerCase()))
  ) {
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Tighten D1 admission SQL**

Replace the current `MARKETPLACE_ADMISSION_SQL` value with:

```ts
const MARKETPLACE_ADMISSION_SQL = `
  (s.security_level IS NULL OR s.security_level != 'D')
  AND COALESCE(s.source_trust, json_extract(s.data_json, '$.sourceTrust'), '') IN ('T1', 'T2')
  AND (
    json_extract(s.data_json, '$.isTrustedRankingEligible') IS NULL
    OR (
      json_extract(s.data_json, '$.isTrustedRankingEligible') != 0
      AND LOWER(CAST(json_extract(s.data_json, '$.isTrustedRankingEligible') AS TEXT)) != 'false'
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(COALESCE(json_extract(s.data_json, '$.riskFlags'), '[]')) AS risk
    WHERE json_extract(risk.value, '$.severity') = 'blocker'
  )
`;
```

- [ ] **Step 3: Preserve vector metadata filtering**

Keep the semantic match filter in `src/pages/api/search.ts` using the imported policy function:

```ts
semanticMatches = (vectorizeResp.matches || []).filter((match: { metadata?: Record<string, unknown> }) =>
  isMarketplaceMetadataAdmitted(match.metadata || {}, { requireExplicitAdmission: true }),
);
```

Keep keyword row filtering using the imported policy function:

```ts
keywordMatches = ftsRows.filter((row) => isMarketplaceMetadataAdmitted(row));
```

- [ ] **Step 4: Run focused API and policy tests**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts src/lib/search.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 5: Run TypeScript check for SQL string and import correctness**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits 0.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add src/pages/api/search.ts
git commit -m "fix: enforce marketplace policy in search api"
```

Expected: commit succeeds.

---

### Task 4: Use Policy Badges On Skill Cards

**Files:**

- Modify: `src/components/SkillCard.astro`
- Modify: `src/lib/marketplace-policy.test.ts`

**Interfaces:**

- Consumes:
  - `buildMarketplaceCardTrust(skill, { locale })` from `src/lib/marketplace-policy.ts`.
- Produces:
  - Card badges generated by policy, with no local source/risk duplicate logic.

- [ ] **Step 1: Add a zh card badge assertion**

Add this test to `src/lib/marketplace-policy.test.ts` inside `describe('marketplace public signals', () => { ... })`:

```ts
it('builds zh card badges without exposing scoring internals', () => {
  const cardTrust = buildMarketplaceCardTrust(
    baseSkill({
      sourceKind: 'official',
      sourceTrust: 'T1',
      riskFlags: [{ code: 'file_write', severity: 'info', label: 'local file write' }],
    }),
    { locale: 'zh', now: new Date('2026-07-07T00:00:00.000Z') },
  );

  expect(cardTrust.badges.map((badge) => badge.label)).toContain('官方');
  expect(cardTrust.badges.map((badge) => badge.label)).toContain('已审查');
  expect(cardTrust.badges.map((badge) => badge.label)).toContain('写文件');
  expect(cardTrust.title).not.toContain('rankScore');
});
```

- [ ] **Step 2: Run card policy test**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts -t "zh card badges"
```

Expected: the test passes from Task 1 implementation.

- [ ] **Step 3: Replace local card trust logic**

In `src/components/SkillCard.astro`, add this import:

```ts
import { buildMarketplaceCardTrust } from '../lib/marketplace-policy';
```

Remove these local variables:

```ts
const securityLevel = skill.securityLevel || (isVerified ? 'S' : 'C');
const rankScore = typeof skill.rankScore === 'number' ? Math.round(skill.rankScore) : undefined;
const sourceKind = skill.sourceKind || (isVerified ? 'official' : 'community');
const sourceKindLabel =
  sourceKind === 'official' ? (isZhLocale ? '官方' : 'Official') : isZhLocale ? '社区' : 'Community';
const reviewedLabel = isZhLocale ? '已审查' : 'Reviewed';
const riskLabels = new Map([
  ['requires_token', isZhLocale ? 'Token' : 'Token'],
  ['file_write', isZhLocale ? '写文件' : 'File write'],
  ['external_network', isZhLocale ? '联网' : 'Network'],
]);
const riskEvidence = (skill.riskFlags || [])
  .map((flag) => riskLabels.get(flag.code))
  .filter((label, index, labels): label is string => Boolean(label) && labels.indexOf(label) === index)
  .slice(0, 3);
const cardEvidenceTitle = [skill.securityBrief, rankScore !== undefined ? `Rank score ${rankScore}` : '']
  .filter(Boolean)
  .join(' · ');
```

Keep the score data attributes by replacing the removed `rankScore` dependency with:

```ts
const cardTrust = buildMarketplaceCardTrust(skill as any, { locale });
const cardEvidenceTitle = cardTrust.title;
```

Then replace the trust chip markup block with:

```astro
<div class="relative z-0 mb-4 flex flex-wrap gap-1.5 text-[10px] font-mono font-black" title={cardEvidenceTitle}>
  {
    cardTrust.badges.map((badge) => (
      <span
        class:list={[
          'market-chip px-2 py-1 text-[10px]',
          badge.tone === 'warning' && 'border-[var(--border)] bg-transparent text-[var(--muted-foreground)]',
          badge.tone === 'positive' && 'border-[var(--primary)]',
        ]}
      >
        {badge.label}
      </span>
    ))
  }
</div>
```

- [ ] **Step 4: Run Astro check for component syntax**

Run:

```bash
npm run check:astro
```

Expected: Astro exits 0 errors.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src/components/SkillCard.astro src/lib/marketplace-policy.test.ts
git commit -m "refactor: render skill card trust badges from policy"
```

Expected: commit succeeds.

---

### Task 5: Use Policy Detail Trust And Filter Related Skills

**Files:**

- Modify: `src/lib/skill-detail-view.ts`
- Modify: `src/lib/skill-detail-view.test.ts`
- Modify: `src/pages/[locale]/skills/[owner]/[...repo].astro`

**Interfaces:**

- Consumes:
  - `buildMarketplaceDetailTrust(skill, { locale, routePath })` from `src/lib/marketplace-policy.ts`.
  - `getPublicMarketplaceSkills(skills)` from `src/lib/marketplace-policy.ts`.
- Produces:
  - Detail page trust panel rows driven by policy.
  - Related skills exclude quarantined skills.

- [ ] **Step 1: Add detail helper export**

In `src/lib/skill-detail-view.ts`, add:

```ts
export { buildMarketplaceDetailTrust } from './marketplace-policy';
```

- [ ] **Step 2: Add detail trust test**

Add this import to `src/lib/skill-detail-view.test.ts`:

```ts
import { buildMarketplaceDetailTrust } from './skill-detail-view';
```

Add this test:

```ts
it('builds install decision trust evidence for detail pages', () => {
  const trust = buildMarketplaceDetailTrust(
    {
      id: 'owner/repo',
      name: 'repo',
      owner: 'owner',
      repo: 'repo',
      description: 'Reviewed installable skill.',
      securityLevel: 'A',
      sourceTrust: 'T2',
      isTrustedRankingEligible: true,
      filePath: '.claude/skills/repo/SKILL.md',
      updatedAt: '2026-07-01T00:00:00.000Z',
      riskFlags: [{ code: 'external_network', severity: 'warning', label: 'external network call' }],
      skillMd: {
        name: 'repo',
        description: 'Reviewed installable skill.',
        bodyPreview: 'Reviewed installable skill source.',
      },
    } as any,
    { locale: 'en', routePath: 'owner/repo', now: new Date('2026-07-07T00:00:00.000Z') },
  );

  expect(trust.reviewStatus).toBe('admitted');
  expect(trust.rows.map((row) => row.label)).toContain('Risk signals');
  expect(trust.riskLabels).toEqual(['Network']);
  expect(trust.whyListed).toContain('T2');
});
```

- [ ] **Step 3: Run detail test**

Run:

```bash
npx vitest run src/lib/skill-detail-view.test.ts
```

Expected: all tests in `src/lib/skill-detail-view.test.ts` pass.

- [ ] **Step 4: Import policy helpers in detail page**

In `src/pages/[locale]/skills/[owner]/[...repo].astro`, add:

```ts
import { buildMarketplaceDetailTrust, getPublicMarketplaceSkills } from '../../../../lib/marketplace-policy';
```

- [ ] **Step 5: Replace local detail trust row construction**

Replace the `trustReviewRows`, `visibleRiskLabels`, `detailRiskChips`, and `detailReviewStatus` local construction with:

```ts
const marketplaceDetailTrust = buildMarketplaceDetailTrust(skill as any, {
  locale,
  routePath: installPath,
});
const trustReviewRows = marketplaceDetailTrust.rows;
const visibleRiskLabels = marketplaceDetailTrust.riskLabels;
const detailRiskChips = marketplaceDetailTrust.riskLabels.slice(0, 4);
const detailReviewStatus =
  marketplaceDetailTrust.reviewStatus === 'admitted'
    ? isZhLocale
      ? '已通过基础审核'
      : 'Baseline reviewed'
    : isZhLocale
      ? '未进入推荐目录'
      : 'Not promoted';
```

Replace any detail panel "why listed" copy in the page with:

```astro
<p class="text-sm font-mono text-[var(--muted-foreground)]">
  {marketplaceDetailTrust.whyListed}
</p>
```

- [ ] **Step 6: Filter related skills through public policy**

After the page computes `relatedSkillsSource`, replace:

```ts
let relatedSkills = relatedSkillsSource;
```

with:

```ts
let relatedSkills = getPublicMarketplaceSkills(relatedSkillsSource as any[]);
```

- [ ] **Step 7: Run focused detail checks**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts src/lib/skill-detail-view.test.ts
npm run check:astro
```

Expected: Vitest and Astro check exit 0.

- [ ] **Step 8: Commit Task 5**

Run:

```bash
git add src/lib/skill-detail-view.ts src/lib/skill-detail-view.test.ts 'src/pages/[locale]/skills/[owner]/[...repo].astro'
git commit -m "refactor: drive skill detail trust from policy"
```

Expected: commit succeeds.

---

### Task 6: Final Verification And Deployment Gate Check

**Files:**

- No source files changed in this task.

**Interfaces:**

- Consumes:
  - All commits from Tasks 1-5.
- Produces:
  - Evidence that the trusted marketplace policy changes pass local quality gates and production-preview SEO gates.

- [ ] **Step 1: Run formatting checks**

Run:

```bash
npm run format:check
npm run format:check:seo-automation
```

Expected: both commands exit 0.

- [ ] **Step 2: Run lint and type checks**

Run:

```bash
npm run lint
npm run lint:seo-automation
npm run typecheck
npm run check:astro
```

Expected: all commands exit 0.

- [ ] **Step 3: Run focused and full tests**

Run:

```bash
npx vitest run src/lib/marketplace-policy.test.ts src/lib/marketplace-filters.test.ts src/lib/occupations.test.ts src/lib/skill-detail-view.test.ts src/lib/search.test.ts
npx vitest --run --reporter=dot
```

Expected: focused tests pass and the full Vitest suite exits 0.

- [ ] **Step 4: Build production output**

Run:

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 5: Run production preview SEO gates**

Start preview:

```bash
npm run preview -- --host 127.0.0.1 --port 4327
```

In a second terminal, run:

```bash
npm run seo:smoke -- http://127.0.0.1:4327
SEO_CRAWL_MAX_PAGES=110 SEO_CRAWL_CONCURRENCY=20 SEO_CRAWL_ALLOW_RECOVERED_5XX=0 npm run report:seo:crawl-health -- http://127.0.0.1:4327
```

Expected:

- SEO smoke exits 0.
- Crawl health exits 0.
- Crawl health reports `onPageSeoErrors=0`.
- Crawl health reports `final5xx=0`.
- Crawl health reports `recoveredFlaky5xx=0`.

- [ ] **Step 6: Stop preview server**

Stop the preview server with `Ctrl+C`.

Expected: no local preview server remains from this task.

- [ ] **Step 7: Commit verification notes if source changed during verification**

Run:

```bash
git status --short
```

Expected: no changes. If formatting changed files, run:

```bash
git add <formatted-files>
git commit -m "style: format trusted marketplace policy changes"
```

Expected: commit succeeds only when there are formatted files.
