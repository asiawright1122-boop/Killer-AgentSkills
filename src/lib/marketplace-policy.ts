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
  | 'unstructured_source';

export interface MarketplaceAdmission {
  admitted: boolean;
  reasons: MarketplaceQuarantineReasonCode[];
}

export interface MarketplaceBadge {
  code: 'official' | 'community' | 'reviewed' | 'requires_token' | 'external_network' | 'file_write' | 'recent';
  label: string;
}

export interface MarketplaceCardTrust {
  title: string;
  badges: MarketplaceBadge[];
}

export interface MarketplaceDetailTrustRow {
  label: string;
  value: string;
}

export interface MarketplaceDetailTrust {
  reviewStatus: 'admitted' | 'quarantined';
  rows: MarketplaceDetailTrustRow[];
  whyListed: string;
  sourceRepository: string;
  installPath: string;
}

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));
const OFFICIAL_OWNERS = new Set(
  Object.values(OFFICIAL_REPOS)
    .filter((repo) => repo.verified)
    .map((repo) => repo.owner),
);

const RECENTLY_UPDATED_DAYS = 30;

const CARD_RISK_BADGES: Record<string, { en: string; zh: string }> = {
  requires_token: { en: 'Token', zh: 'Token' },
  external_network: { en: 'Network', zh: '联网' },
  file_write: { en: 'File write', zh: '写文件' },
};

const DETAIL_RISK_LABELS: Record<RiskFlagCode, { en: string; zh: string }> = {
  requires_token: { en: 'Token required', zh: '需要 Token' },
  external_network: { en: 'Network access', zh: '需要联网' },
  destructive_shell: { en: 'Destructive shell', zh: '破坏性命令' },
  credential_capture: { en: 'Credential capture', zh: '凭证捕获' },
  file_write: { en: 'File write', zh: '写入文件' },
  thin_source: { en: 'Thin source', zh: '来源材料过少' },
  stale_source: { en: 'Stale source', zh: '来源陈旧' },
  unstructured_skill: { en: 'Unstructured metadata', zh: '元数据不完整' },
};

function isZhLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('zh');
}

function numericSortValue(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dateSortValue(value: string | null | undefined): number {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function skillDisplayName(skill: UnifiedSkill): string {
  return String(skill.name || skill.skillName || skill.repo || skill.id || '');
}

function isFalseyRankingEligibility(value: unknown): boolean {
  return value === false || value === 0 || value === '0' || value === 'false';
}

function hasBlockerRisk(flags: RiskFlag[] | undefined): boolean {
  return (flags || []).some((flag) => flag.severity === 'blocker');
}

function hasUsefulPublicSourceMaterial(skill: UnifiedSkill): boolean {
  const description =
    typeof skill.description === 'string'
      ? skill.description
      : Object.values(skill.description || {})
          .filter((value): value is string => Boolean(value))
          .join(' ');

  return Boolean(
    (skill.name || '').trim() ||
    (skill.skillName || '').trim() ||
    (skill.repo || '').trim() ||
    description.trim() ||
    (skill.filePath || '').trim() ||
    (skill.skillMd?.name || '').trim() ||
    (skill.skillMd?.description || '').trim() ||
    (skill.skillMd?.bodyPreview || '').trim() ||
    (skill.skillMd?.body || '').trim(),
  );
}

function localizedBadge(code: MarketplaceBadge['code'], locale: string): MarketplaceBadge {
  const zh = isZhLocale(locale);
  const labels: Record<MarketplaceBadge['code'], string> = {
    official: zh ? '官方' : 'Official',
    community: zh ? '社区' : 'Community',
    reviewed: zh ? '已审查' : 'Reviewed',
    requires_token: zh ? 'Token' : 'Token',
    external_network: zh ? '联网' : 'Network',
    file_write: zh ? '写文件' : 'File write',
    recent: zh ? '最近更新' : 'Recently updated',
  };
  return { code, label: labels[code] };
}

function localizedRiskSummary(flags: RiskFlag[] | undefined, locale: string): string {
  const zh = isZhLocale(locale);
  if (!flags || flags.length === 0) {
    return zh ? '无阻断' : 'No blockers';
  }

  return flags
    .map((flag) => DETAIL_RISK_LABELS[flag.code]?.[zh ? 'zh' : 'en'] || flag.label)
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .join(', ');
}

function localizedReviewStatus(admission: MarketplaceAdmission, locale: string): string {
  if (isZhLocale(locale)) {
    return admission.admitted ? '已准入' : '已隔离';
  }
  return admission.admitted ? 'Admitted' : 'Quarantined';
}

function localizedWhyListed(skill: UnifiedSkill, locale: string): string {
  const zh = isZhLocale(locale);
  const sourceTrust = skill.sourceTrust || 'Unknown';
  const sourceKind = getSkillSourceKind(skill);
  if (zh) {
    return `因通过基础审查而展示：来源等级 ${sourceTrust}，来源类型为${sourceKind === 'official' ? '官方' : '社区'}。`;
  }
  return `Listed because it passed baseline review with source trust ${sourceTrust} from a ${sourceKind} source.`;
}

function installPathForSkill(skill: UnifiedSkill, routePath?: string): string {
  return routePath || `${skill.owner}/${skill.repo}`;
}

export function compareMarketplaceSkillsPopular(a: UnifiedSkill, b: UnifiedSkill): number {
  return (
    numericSortValue(b.rankScore) - numericSortValue(a.rankScore) ||
    numericSortValue(b.qualityScore) - numericSortValue(a.qualityScore) ||
    numericSortValue(b.stars) - numericSortValue(a.stars) ||
    skillDisplayName(a).localeCompare(skillDisplayName(b))
  );
}

export function getSkillSourceKind(skill: UnifiedSkill): SourceKind {
  if (skill.sourceKind === 'official' || skill.sourceKind === 'community') {
    return skill.sourceKind;
  }

  const repoKey = `${skill.owner}/${skill.repo}`;
  if (skill.source === 'verified' || OFFICIAL_REPO_KEYS.has(repoKey) || OFFICIAL_OWNERS.has(skill.owner)) {
    return 'official';
  }

  return 'community';
}

export function getMarketplaceAdmission(skill: UnifiedSkill): MarketplaceAdmission {
  const reasons: MarketplaceQuarantineReasonCode[] = [];

  if (skill.securityLevel === 'D') {
    reasons.push('security_level_d');
  }

  if (hasBlockerRisk(skill.riskFlags)) {
    reasons.push('blocker_risk');
  }

  if (isFalseyRankingEligibility(skill.isTrustedRankingEligible)) {
    reasons.push('not_trusted_ranking_eligible');
  }

  if (skill.sourceTrust === 'T3') {
    reasons.push('source_trust_t3');
  }

  if (!hasUsefulPublicSourceMaterial(skill)) {
    reasons.push('unstructured_source');
  }

  return {
    admitted: reasons.length === 0,
    reasons,
  };
}

export function isPublicMarketplaceSkill(skill: UnifiedSkill): boolean {
  return getMarketplaceAdmission(skill).admitted;
}

export function getPublicMarketplaceSkills(skills: UnifiedSkill[]): UnifiedSkill[] {
  return skills.filter(isPublicMarketplaceSkill).map((skill) => ({
    ...skill,
    sourceKind: getSkillSourceKind(skill),
  }));
}

export function sortMarketplaceSkillsPopular(skills: UnifiedSkill[]): UnifiedSkill[] {
  return getPublicMarketplaceSkills(skills).sort(compareMarketplaceSkillsPopular);
}

export function sortMarketplaceSkillsLatest(skills: UnifiedSkill[]): UnifiedSkill[] {
  return getPublicMarketplaceSkills(skills).sort((a, b) => {
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
  const badges: MarketplaceBadge[] = [
    localizedBadge(getSkillSourceKind(skill), options.locale),
    localizedBadge('reviewed', options.locale),
  ];

  for (const flag of skill.riskFlags || []) {
    if (flag.code in CARD_RISK_BADGES) {
      const badgeCode = flag.code as 'requires_token' | 'external_network' | 'file_write';
      if (!badges.some((badge) => badge.code === badgeCode)) {
        badges.push(localizedBadge(badgeCode, options.locale));
      }
    }
  }

  if (now.getTime() - dateSortValue(skill.updatedAt) <= RECENTLY_UPDATED_DAYS * 86_400_000) {
    badges.push(localizedBadge('recent', options.locale));
  }

  const title = isZhLocale(options.locale)
    ? '该技能已通过基础审查并显示紧凑信任信号。'
    : 'This reviewed skill shows compact trust signals for the marketplace.';

  return { title, badges };
}

export function buildMarketplaceDetailTrust(
  skill: UnifiedSkill,
  options: { locale: string; routePath?: string; now?: Date },
): MarketplaceDetailTrust {
  const locale = options.locale;
  const admission = getMarketplaceAdmission(skill);
  const rows: MarketplaceDetailTrustRow[] = [
    { label: isZhLocale(locale) ? '安全等级' : 'Safety level', value: skill.securityLevel || 'Unknown' },
    { label: isZhLocale(locale) ? '来源等级' : 'Source trust', value: skill.sourceTrust || 'Unknown' },
    { label: isZhLocale(locale) ? '审核状态' : 'Review status', value: localizedReviewStatus(admission, locale) },
    { label: isZhLocale(locale) ? '风险信号' : 'Risk flags', value: localizedRiskSummary(skill.riskFlags, locale) },
    {
      label: isZhLocale(locale) ? '最后审查' : 'Last audited',
      value: skill.lastAuditedAt || (options.now || new Date()).toISOString(),
    },
  ];

  return {
    reviewStatus: admission.admitted ? 'admitted' : 'quarantined',
    rows,
    whyListed: localizedWhyListed(skill, locale),
    sourceRepository: `${skill.owner}/${skill.repo}`,
    installPath: installPathForSkill(skill, options.routePath),
  };
}

export function isMarketplaceMetadataAdmitted(
  data: Record<string, unknown>,
  options?: { requireExplicitAdmission?: boolean },
): boolean {
  if (options?.requireExplicitAdmission) {
    const hasRequiredFields =
      'securityLevel' in data && 'sourceTrust' in data && 'isTrustedRankingEligible' in data && 'riskFlags' in data;
    if (!hasRequiredFields) return false;
  }

  const securityLevel = (data.securityLevel as SecurityLevel | undefined) || 'A';
  const sourceTrust = (data.sourceTrust as SourceTrustLevel | undefined) || 'T3';
  const riskFlags = Array.isArray(data.riskFlags) ? (data.riskFlags as RiskFlag[]) : [];
  const isTrustedRankingEligible = data.isTrustedRankingEligible as UnifiedSkill['isTrustedRankingEligible'];

  if (securityLevel === 'D') return false;
  if (sourceTrust === 'T3') return false;
  if (hasBlockerRisk(riskFlags)) return false;
  if (isFalseyRankingEligibility(isTrustedRankingEligible)) return false;
  return true;
}
