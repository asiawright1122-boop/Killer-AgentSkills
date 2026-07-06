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

function addFlag(flags: RiskFlag[], code: RiskFlagCode, severity: RiskFlag['severity'], label: string): void {
  if (!flags.some((flag) => flag.code === code)) {
    flags.push({ code, severity, label });
  }
}

function sourceTrustFor(
  input: SkillTrustInput,
  text: string,
): {
  level: SourceTrustLevel;
  score: number;
  reason: string;
} {
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
  if (flags.length === 0) {
    return `${level} security: no obvious token, network, destructive shell, or thin-source risk detected.`;
  }

  const labels = flags
    .slice()
    .sort((a, b) => {
      const severityOrder = { blocker: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    })
    .slice(0, 3)
    .map((flag) => flag.label)
    .join(', ');

  return `${level} security: ${labels}.`;
}

function securityScoreAdjustments(
  input: SkillTrustInput,
  text: string,
  now: Date,
): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  let score = 100;
  const hasStructuredSkill = Boolean(input.skillMd?.name || input.skillMd?.description || input.skillMd?.bodyPreview);
  const sourceBytes = new TextEncoder().encode(text).length;
  const ageDays = daysSince(input.updatedAt || input.lastSynced, now);

  if (!hasStructuredSkill) {
    score -= 18;
    addFlag(flags, 'unstructured_skill', 'warning', 'unstructured skill metadata');
  }

  if (sourceBytes < 220) {
    score -= 18;
    addFlag(flags, 'thin_source', 'warning', 'thin source material');
  }

  if (ageDays > 365) {
    score -= 15;
    addFlag(flags, 'stale_source', 'warning', 'stale source');
  }

  if (/\b(api[_-]?key|token|oauth|secret|env var|environment variable)\b/i.test(text)) {
    score -= 8;
    addFlag(flags, 'requires_token', 'info', 'credential required');
  }

  if (/\bhttps?:\/\/|webhook|gateway|external api|remote endpoint\b/i.test(text)) {
    score -= 10;
    addFlag(flags, 'external_network', 'warning', 'external network call');
  }

  if (/\brm\s+-rf\b|\bdelete all\b|\bformat disk\b|\bwipe\b/i.test(text)) {
    score -= 80;
    addFlag(flags, 'destructive_shell', 'blocker', 'destructive shell pattern');
  }

  if (/(~\/\.ssh|private key|exfiltrat|upload.*secret|steal|credential capture)/i.test(text)) {
    score -= 80;
    addFlag(flags, 'credential_capture', 'blocker', 'credential capture pattern');
  }

  if (/(\.claude\/|\.cursor\/|\.windsurf\/|copilot-instructions|write file|file system)/i.test(text)) {
    score -= 4;
    addFlag(flags, 'file_write', 'info', 'local file write');
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), flags };
}

export function assessSkillTrust(input: SkillTrustInput, now: Date = new Date()): SkillTrustProfile {
  const text = bodyText(input);
  const { score: securityScore, flags } = securityScoreAdjustments(input, text, now);
  const hasStructuredSkill = Boolean(input.skillMd?.name || input.skillMd?.description || input.skillMd?.bodyPreview);
  const ageDays = daysSince(input.updatedAt || input.lastSynced, now);
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
