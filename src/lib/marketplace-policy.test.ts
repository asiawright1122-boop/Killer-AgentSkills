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

  it('quarantines missing or unknown source trust', () => {
    const missingTrust = getMarketplaceAdmission(baseSkill({ sourceTrust: undefined }));
    const unknownTrust = getMarketplaceAdmission(baseSkill({ sourceTrust: 'TX' as never }));

    expect(missingTrust.admitted).toBe(false);
    expect(missingTrust.reasons).toContain('source_trust_t3');
    expect(unknownTrust.admitted).toBe(false);
    expect(unknownTrust.reasons).toContain('source_trust_t3');
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

  it('treats unrelated repos under verified owners as community unless explicitly marked official', () => {
    const ownerOnlyMatch = baseSkill({ owner: 'anthropics', repo: 'community-tool', sourceTrust: 'T2' });
    const verifiedSource = baseSkill({ owner: 'some-owner', repo: 'some-repo', source: 'verified', sourceTrust: 'T2' });

    expect(getSkillSourceKind(ownerOnlyMatch)).toBe('community');
    expect(getSkillSourceKind(verifiedSource)).toBe('official');
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

    expect(
      sortMarketplaceSkillsLatest(getPublicMarketplaceSkills([older, blocked, newer])).map((skill) => skill.name),
    ).toEqual(['newer', 'older']);
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
    expect(detailTrust.rows.map((row) => row.label)).toEqual([
      '安全等级',
      '来源等级',
      '审核状态',
      '风险信号',
      '最后审查',
    ]);
    expect(detailTrust.whyListed).toContain('T1');
    expect(detailTrust.sourceRepository).toBe('owner/repo');
    expect(detailTrust.installPath).toBe('owner/repo');
  });

  it('uses quarantined detail trust copy for non-admitted skills', () => {
    const detailTrust = buildMarketplaceDetailTrust(baseSkill({ sourceTrust: undefined }), {
      locale: 'en',
      routePath: 'owner/repo',
      now: new Date('2026-07-07T00:00:00.000Z'),
    });

    expect(detailTrust.reviewStatus).toBe('quarantined');
    expect(detailTrust.whyListed).not.toContain('passed baseline review');
    expect(detailTrust.whyListed).toContain('quarantined');
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
    expect(
      isMarketplaceMetadataAdmitted({ securityLevel: 'A', sourceTrust: 'T3', isTrustedRankingEligible: true }),
    ).toBe(false);
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
