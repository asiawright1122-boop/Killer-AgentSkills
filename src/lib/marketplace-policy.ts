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
  | 'missing_install_path'
  | 'unstructured_source';

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
  title: string;
  badges: MarketplaceBadge[];
}

export interface MarketplaceDetailTrustRow {
  label: string;
  value: string;
}

export interface MarketplaceDetailTrust {
  reviewStatus: 'admitted' | 'quarantined';
  sourceKind: SourceKind;
  sourceRepository: string;
  installPath: string;
  whyListed: string;
  rows: MarketplaceDetailTrustRow[];
  badges: MarketplaceBadge[];
  riskLabels: string[];
  quarantineReasons: MarketplaceQuarantineReasonCode[];
}

const OFFICIAL_REPO_KEYS = new Set(Object.values(OFFICIAL_REPOS).map((repo) => `${repo.owner}/${repo.repo}`));

const RECENTLY_UPDATED_DAYS = 30;

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
    description.trim() ||
    (skill.filePath || '').trim() ||
    (skill.skillMd?.name || '').trim() ||
    (skill.skillMd?.description || '').trim() ||
    (skill.skillMd?.bodyPreview || '').trim() ||
    (skill.skillMd?.body || '').trim(),
  );
}

function badgeTone(id: string): MarketplaceBadge['tone'] {
  if (id === 'reviewed' || id === 'recent') {
    return 'positive';
  }

  if (id === 'requires_token' || id === 'external_network' || id === 'file_write') {
    return 'warning';
  }

  return 'neutral';
}

function localizedBadge(
  id: 'official' | 'community' | 'reviewed' | 'requires_token' | 'external_network' | 'file_write' | 'recent',
  locale: string,
): MarketplaceBadge {
  const zh = isZhLocale(locale);
  const labels: Record<typeof id, string> = {
    official: zh ? '官方' : 'Official',
    community: zh ? '社区' : 'Community',
    reviewed: zh ? '已审查' : 'Reviewed',
    requires_token: zh ? 'Token' : 'Token',
    external_network: zh ? '联网' : 'Network',
    file_write: zh ? '写文件' : 'File write',
    recent: zh ? '最近更新' : 'Recently updated',
  };
  return { id, label: labels[id], tone: badgeTone(id) };
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

function localizedRiskLabels(flags: RiskFlag[] | undefined, locale: string): string[] {
  if (!flags || flags.length === 0) {
    return [];
  }

  const zh = isZhLocale(locale);
  return flags
    .map((flag) => DETAIL_RISK_LABELS[flag.code]?.[zh ? 'zh' : 'en'] || flag.label)
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function localizedReviewStatus(admission: MarketplaceAdmission, locale: string): string {
  if (isZhLocale(locale)) {
    return admission.admitted ? '已准入' : '已隔离';
  }
  return admission.admitted ? 'Admitted' : 'Quarantined';
}

function localizedWhyListed(skill: UnifiedSkill, admission: MarketplaceAdmission, locale: string): string {
  const zh = isZhLocale(locale);
  const sourceTrust = skill.sourceTrust || 'Unknown';
  const sourceKind = getSkillSourceKind(skill);
  if (!admission.admitted) {
    if (zh) {
      return `该技能因未通过基础审查而被隔离：来源等级 ${sourceTrust}，来源类型为${sourceKind === 'official' ? '官方' : '社区'}。`;
    }
    return `This skill is quarantined because it did not pass baseline review. Source trust: ${sourceTrust}. Source kind: ${sourceKind}.`;
  }
  if (zh) {
    return `因通过基础审查而展示：来源等级 ${sourceTrust}，来源类型为${sourceKind === 'official' ? '官方' : '社区'}。`;
  }
  return `Listed because it passed baseline review with source trust ${sourceTrust} from a ${sourceKind} source.`;
}

function sourceRepositoryForSkill(skill: UnifiedSkill): string {
  const owner = (skill.owner || '').trim();
  const repo = (skill.repo || '').trim();

  return owner && repo ? `${owner}/${repo}` : '';
}

function installPathForSkill(skill: UnifiedSkill, routePath?: string): string {
  const normalizedRoutePath = (routePath || '').trim();
  if (normalizedRoutePath) {
    return normalizedRoutePath;
  }

  const sourceRepository = sourceRepositoryForSkill(skill);
  if (sourceRepository) {
    return sourceRepository;
  }

  const filePath = (skill.filePath || '').trim();
  if (filePath) {
    return filePath;
  }

  const id = (skill.id || '').trim();
  if (id) {
    return id;
  }

  return '';
}

function intrinsicInstallPathForSkill(skill: UnifiedSkill): string {
  return installPathForSkill(skill);
}

function hasInstallPath(skill: UnifiedSkill): boolean {
  return intrinsicInstallPathForSkill(skill) !== '';
}

function lastReviewedValue(skill: UnifiedSkill, locale: string): string {
  const lastAuditedAt = (skill.lastAuditedAt || '').trim();
  if (lastAuditedAt) {
    return lastAuditedAt;
  }

  const updatedAt = (skill.updatedAt || '').trim();
  if (updatedAt) {
    return updatedAt;
  }

  return isZhLocale(locale) ? '未知' : 'Unknown';
}

function buildMarketplaceBadges(skill: UnifiedSkill, locale: string, now: Date, admitted: boolean): MarketplaceBadge[] {
  const badges: MarketplaceBadge[] = [localizedBadge(getSkillSourceKind(skill), locale)];

  if (admitted) {
    badges.push(localizedBadge('reviewed', locale));
  }

  for (const flag of skill.riskFlags || []) {
    if (flag.code === 'requires_token' || flag.code === 'external_network' || flag.code === 'file_write') {
      if (!badges.some((badge) => badge.id === flag.code)) {
        badges.push(localizedBadge(flag.code, locale));
      }
    }
  }

  if (now.getTime() - dateSortValue(skill.updatedAt) <= RECENTLY_UPDATED_DAYS * 86_400_000) {
    badges.push(localizedBadge('recent', locale));
  }

  return badges;
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
  if (skill.source === 'verified' || OFFICIAL_REPO_KEYS.has(repoKey)) {
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

  if (skill.sourceTrust !== 'T1' && skill.sourceTrust !== 'T2') {
    reasons.push('source_trust_t3');
  }

  if (!hasInstallPath(skill)) {
    reasons.push('missing_install_path');
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
  const admission = getMarketplaceAdmission(skill);
  const sourceKind = getSkillSourceKind(skill);
  const badges = buildMarketplaceBadges(skill, options.locale, now, admission.admitted);

  const title = isZhLocale(options.locale)
    ? admission.admitted
      ? '该技能已通过基础审查并显示紧凑信任信号。'
      : '该技能显示来源与风险信号，但尚未通过市场准入。'
    : admission.admitted
      ? 'This reviewed skill shows compact trust signals for the marketplace.'
      : 'This skill shows source and risk signals but is not admitted to the marketplace.';

  return { sourceKind, admitted: admission.admitted, title, badges };
}

export function buildMarketplaceDetailTrust(
  skill: UnifiedSkill,
  options: { locale: string; routePath?: string; now?: Date },
): MarketplaceDetailTrust {
  const locale = options.locale;
  const now = options.now || new Date();
  const admission = getMarketplaceAdmission(skill);
  const sourceKind = getSkillSourceKind(skill);
  const rows: MarketplaceDetailTrustRow[] = [
    { label: isZhLocale(locale) ? '安全等级' : 'Safety level', value: skill.securityLevel || 'Unknown' },
    { label: isZhLocale(locale) ? '来源等级' : 'Source trust', value: skill.sourceTrust || 'Unknown' },
    { label: isZhLocale(locale) ? '审核状态' : 'Review status', value: localizedReviewStatus(admission, locale) },
    { label: isZhLocale(locale) ? '风险信号' : 'Risk flags', value: localizedRiskSummary(skill.riskFlags, locale) },
    {
      label: isZhLocale(locale) ? '最后审查' : 'Last audited',
      value: lastReviewedValue(skill, locale),
    },
  ];

  return {
    reviewStatus: admission.admitted ? 'admitted' : 'quarantined',
    sourceKind,
    sourceRepository: sourceRepositoryForSkill(skill),
    installPath: admission.reasons.includes('missing_install_path')
      ? ''
      : installPathForSkill(skill, options.routePath),
    whyListed: localizedWhyListed(skill, admission, locale),
    rows,
    badges: buildMarketplaceBadges(skill, locale, now, admission.admitted),
    riskLabels: localizedRiskLabels(skill.riskFlags, locale),
    quarantineReasons: [...admission.reasons],
  };
}

export function isMarketplaceMetadataAdmitted(
  data: Record<string, unknown>,
  options?: { requireExplicitAdmission?: boolean },
): boolean {
  if (options?.requireExplicitAdmission) {
    const hasRequiredFields = 'securityLevel' in data && 'sourceTrust' in data && 'isTrustedRankingEligible' in data;
    if (!hasRequiredFields) return false;
  }

  const securityLevel = (data.securityLevel as SecurityLevel | undefined) || 'A';
  const sourceTrust = (data.sourceTrust as SourceTrustLevel | undefined) || 'T3';
  const riskFlags = Array.isArray(data.riskFlags) ? (data.riskFlags as RiskFlag[]) : [];
  const isTrustedRankingEligible = data.isTrustedRankingEligible as UnifiedSkill['isTrustedRankingEligible'];

  if (securityLevel === 'D') return false;
  if (sourceTrust !== 'T1' && sourceTrust !== 'T2') return false;
  if (hasBlockerRisk(riskFlags)) return false;
  if (isFalseyRankingEligibility(isTrustedRankingEligible)) return false;
  return true;
}
