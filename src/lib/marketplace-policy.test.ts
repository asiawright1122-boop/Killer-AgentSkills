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

  it('quarantines repo-only metadata as unstructured source', () => {
    const admission = getMarketplaceAdmission(
      baseSkill({
        name: '',
        skillName: '',
        description: '',
        filePath: '',
        skillMd: {},
        owner: 'owner',
        repo: 'repo-only',
        id: 'owner/repo-only',
        sourceTrust: 'T2',
      }),
    );

    expect(admission.admitted).toBe(false);
    expect(admission.reasons).toContain('unstructured_source');
  });

  it('quarantines skills missing an install path', () => {
    const admission = getMarketplaceAdmission(
      baseSkill({
        owner: '',
        repo: '',
        id: '',
        filePath: '',
      }),
    );

    expect(admission.admitted).toBe(false);
    expect(admission.reasons).toContain('missing_install_path');
  });

  it('admits skills with complete owner and repo even without file path', () => {
    const admission = getMarketplaceAdmission(
      baseSkill({
        owner: 'owner',
        repo: 'repo',
        filePath: '',
      }),
    );

    expect(admission).toEqual({ admitted: true, reasons: [] });
  });

  it('admits skills with file path only', () => {
    const admission = getMarketplaceAdmission(
      baseSkill({
        owner: '',
        repo: '',
        id: '',
        filePath: '.claude/skills/file-only/SKILL.md',
      }),
    );

    expect(admission).toEqual({ admitted: true, reasons: [] });
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
    expect(cardTrust).toMatchObject({
      sourceKind: 'community',
      admitted: true,
    });
    expect(cardTrust.badges).toEqual([
      { id: 'community', label: 'Community', tone: 'neutral' },
      { id: 'reviewed', label: 'Reviewed', tone: 'positive' },
      { id: 'requires_token', label: 'Token', tone: 'warning' },
      { id: 'external_network', label: 'Network', tone: 'warning' },
      { id: 'file_write', label: 'File write', tone: 'warning' },
      { id: 'recent', label: 'Recently updated', tone: 'positive' },
    ]);
    expect(cardTrust.title).toContain('reviewed');
  });

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
      '来源仓库',
      '安装路径',
    ]);
    expect(detailTrust.sourceKind).toBe('community');
    expect(detailTrust.whyListed).toContain('T1');
    expect(detailTrust.sourceRepository).toBe('owner/repo');
    expect(detailTrust.installPath).toBe('owner/repo');
    expect(detailTrust.rows.find((row) => row.label === '来源仓库')?.value).toBe('owner/repo');
    expect(detailTrust.rows.find((row) => row.label === '安装路径')?.value).toBe('owner/repo');
    expect(detailTrust.badges).toEqual([
      { id: 'community', label: '社区', tone: 'neutral' },
      { id: 'reviewed', label: '已审查', tone: 'positive' },
      { id: 'recent', label: '最近更新', tone: 'positive' },
    ]);
    expect(detailTrust.riskLabels).toEqual([]);
    expect(detailTrust.quarantineReasons).toEqual([]);
  });

  it('shows unknown last reviewed when no audit or source update date exists', () => {
    const detailTrust = buildMarketplaceDetailTrust(
      baseSkill({
        updatedAt: '',
        lastAuditedAt: undefined,
      }),
      {
        locale: 'en',
        now: new Date('2026-07-07T00:00:00.000Z'),
      },
    );

    expect(detailTrust.rows.find((row) => row.label === 'Last audited')?.value).toBe('Unknown');
  });

  it('prefers source updated date when audit date is missing', () => {
    const detailTrust = buildMarketplaceDetailTrust(
      baseSkill({
        updatedAt: '2026-06-15T12:00:00.000Z',
        lastAuditedAt: undefined,
      }),
      {
        locale: 'en',
        now: new Date('2026-07-07T00:00:00.000Z'),
      },
    );

    expect(detailTrust.rows.find((row) => row.label === 'Last audited')?.value).toBe('2026-06-15T12:00:00.000Z');
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
    expect(detailTrust.quarantineReasons).toContain('source_trust_t3');
  });

  it('keeps fully missing install path details empty for quarantined skills', () => {
    const detailTrust = buildMarketplaceDetailTrust(
      baseSkill({
        owner: '',
        repo: '',
        id: '',
        filePath: '',
      }),
      {
        locale: 'en',
        now: new Date('2026-07-07T00:00:00.000Z'),
      },
    );

    expect(detailTrust.reviewStatus).toBe('quarantined');
    expect(detailTrust.installPath).toBe('');
    expect(detailTrust.sourceRepository).toBe('');
    expect(detailTrust.rows.find((row) => row.label === 'Source repository')?.value).toBe('');
    expect(detailTrust.rows.find((row) => row.label === 'Install path')?.value).toBe('');
    expect(detailTrust.quarantineReasons).toContain('missing_install_path');
  });

  it('does not let route path mask missing intrinsic install evidence', () => {
    const detailTrust = buildMarketplaceDetailTrust(
      baseSkill({
        owner: '',
        repo: '',
        id: '',
        filePath: '',
      }),
      {
        locale: 'en',
        routePath: 'masked/by-route',
        now: new Date('2026-07-07T00:00:00.000Z'),
      },
    );

    expect(detailTrust.reviewStatus).toBe('quarantined');
    expect(detailTrust.installPath).toBe('');
    expect(detailTrust.quarantineReasons).toContain('missing_install_path');
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

  it('accepts explicit admission metadata without risk flags when none are present', () => {
    expect(
      isMarketplaceMetadataAdmitted(
        { securityLevel: 'A', sourceTrust: 'T2', isTrustedRankingEligible: true },
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

  it('normalizes metadata casing and parses stringified blocker flags', () => {
    expect(
      isMarketplaceMetadataAdmitted({
        securityLevel: 'a',
        sourceTrust: 't2',
        isTrustedRankingEligible: true,
      }),
    ).toBe(true);
    expect(
      isMarketplaceMetadataAdmitted({
        securityLevel: 'A',
        sourceTrust: 'T2',
        isTrustedRankingEligible: true,
        riskFlags: JSON.stringify([
          { code: 'credential_capture', severity: 'Blocker', label: 'credential capture pattern' },
        ]),
      }),
    ).toBe(false);
  });
});
