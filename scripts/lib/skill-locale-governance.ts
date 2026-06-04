import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../../src/i18n';
import { getSkillSeoLocaleGovernance } from '../../src/lib/seo-locales';
import { buildLocalizedSkillPath, getSkillRoutePath } from '../../src/lib/skill-route-paths';
import type { SkillCache } from './types';

const MIN_INDEXABLE_SKILL_README_BYTES = 250;
const SITE_URL = 'https://killer-skills.com';
const textEncoder = new TextEncoder();

export type SkillLocaleGovernanceRecord = {
  id: string;
  owner: string;
  repo: string;
  routePath: string;
  updatedAt?: string;
  metadataEligibleLocales: Locale[];
  bodyEligibleLocales: Locale[];
  eligibleLocales: Locale[];
  publishedLocales: Locale[];
  canonicalLocale: Locale;
  detectedBodyLocale: Locale | null;
  suppressedMetadataLocales: Locale[];
};

export type SkillLocaleGovernanceSummary = {
  totalSkills: number;
  totalLocaleVariants: number;
  metadataEligibleVariants: number;
  eligibleVariants: number;
  suppressedMetadataVariants: number;
  skillsWithSuppressedMetadata: number;
  canonicalLocaleCounts: Partial<Record<Locale, number>>;
  detectedBodyLocaleCounts: Record<string, number>;
  eligibleLocaleCounts: Partial<Record<Locale, number>>;
  suppressedMetadataLocaleCounts: Partial<Record<Locale, number>>;
};

export type SkillLocaleGovernanceIndex = {
  generatedAt: string;
  summary: SkillLocaleGovernanceSummary;
  skills: SkillLocaleGovernanceRecord[];
};

function pickPreferredText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const preferred = [record.en, record.zh, ...Object.values(record)];
  for (const candidate of preferred) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return '';
}

export function buildCrawlerVisibleSkillBody(skill: Partial<SkillCache>): string {
  const rawReadmeContent = skill.skillMd?.body || skill.skillMd?.bodyPreview || '';
  const rawReadmeBytes = textEncoder.encode(rawReadmeContent).length;
  if (rawReadmeContent && rawReadmeBytes >= MIN_INDEXABLE_SKILL_README_BYTES) {
    return rawReadmeContent;
  }

  const fallbackDescription =
    pickPreferredText(skill.seo?.description) ||
    pickPreferredText(skill.description) ||
    pickPreferredText(skill.seo?.definition) ||
    '';
  const fallbackReadmeContent = `# ${skill.name || skill.repo || 'Skill'}\n\n${fallbackDescription}`;

  return [rawReadmeContent, fallbackReadmeContent].filter((part) => part && part.trim().length > 0).join('\n\n');
}

function incrementCount<T extends string>(counts: Partial<Record<T, number>>, key: T) {
  counts[key] = (counts[key] || 0) + 1;
}

function incrementLooseCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] || 0) + 1;
}

export function buildSkillLocaleGovernanceRecord(skill: Partial<SkillCache>): SkillLocaleGovernanceRecord | null {
  const owner = typeof skill.owner === 'string' ? skill.owner.trim() : '';
  const repo = typeof skill.repo === 'string' ? skill.repo.trim() : '';
  const id = typeof skill.id === 'string' ? skill.id.trim() : '';
  const routePath = getSkillRoutePath({
    id,
    owner,
    repo,
  });

  if (!owner || !repo || !id || !routePath) {
    return null;
  }

  const governance = getSkillSeoLocaleGovernance(
    {
      title: skill.seo?.title || skill.name || repo,
      description: skill.seo?.description || skill.description || skill.seo?.definition,
      body: buildCrawlerVisibleSkillBody(skill),
    },
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
  );
  const suppressedMetadataLocales = governance.metadataEligibleLocales.filter(
    (locale) => !governance.eligibleLocales.includes(locale),
  );

  return {
    id,
    owner,
    repo,
    routePath,
    updatedAt: skill.updatedAt,
    metadataEligibleLocales: governance.metadataEligibleLocales,
    bodyEligibleLocales: governance.bodyEligibleLocales,
    eligibleLocales: governance.eligibleLocales,
    publishedLocales: governance.publishedLocales,
    canonicalLocale: governance.canonicalLocale,
    detectedBodyLocale: governance.detectedBodyLocale,
    suppressedMetadataLocales,
  };
}

export function buildSkillLocaleGovernanceIndex(
  skills: Array<Partial<SkillCache>>,
  generatedAt = new Date().toISOString(),
): SkillLocaleGovernanceIndex {
  const records = skills
    .map((skill) => buildSkillLocaleGovernanceRecord(skill))
    .filter((record): record is SkillLocaleGovernanceRecord => Boolean(record))
    .sort((a, b) => {
      if (b.suppressedMetadataLocales.length !== a.suppressedMetadataLocales.length) {
        return b.suppressedMetadataLocales.length - a.suppressedMetadataLocales.length;
      }

      return a.id.localeCompare(b.id);
    });

  const summary: SkillLocaleGovernanceSummary = {
    totalSkills: records.length,
    totalLocaleVariants: records.length * SUPPORTED_LOCALES.length,
    metadataEligibleVariants: 0,
    eligibleVariants: 0,
    suppressedMetadataVariants: 0,
    skillsWithSuppressedMetadata: 0,
    canonicalLocaleCounts: {},
    detectedBodyLocaleCounts: {},
    eligibleLocaleCounts: {},
    suppressedMetadataLocaleCounts: {},
  };

  for (const record of records) {
    summary.metadataEligibleVariants += record.metadataEligibleLocales.length;
    summary.eligibleVariants += record.eligibleLocales.length;
    summary.suppressedMetadataVariants += record.suppressedMetadataLocales.length;
    if (record.suppressedMetadataLocales.length > 0) {
      summary.skillsWithSuppressedMetadata += 1;
    }

    incrementCount(summary.canonicalLocaleCounts, record.canonicalLocale);

    for (const locale of record.eligibleLocales) {
      incrementCount(summary.eligibleLocaleCounts, locale);
    }

    for (const locale of record.suppressedMetadataLocales) {
      incrementCount(summary.suppressedMetadataLocaleCounts, locale);
    }

    incrementLooseCount(summary.detectedBodyLocaleCounts, record.detectedBodyLocale || 'unknown');
  }

  return {
    generatedAt,
    summary,
    skills: records,
  };
}

function renderLocaleCountLines(counts: Partial<Record<Locale, number>> | Record<string, number>): string[] {
  return Object.entries(counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]))
    .map(([locale, count]) => `- ${locale}: ${count}`);
}

function buildSuppressedLocaleUrl(record: SkillLocaleGovernanceRecord, locale: Locale): string {
  return `${SITE_URL}${buildLocalizedSkillPath(locale, record.owner, record.routePath)}`;
}

function buildCanonicalLocaleUrl(record: SkillLocaleGovernanceRecord): string {
  return `${SITE_URL}${buildLocalizedSkillPath(record.canonicalLocale, record.owner, record.routePath)}`;
}

export function renderSkillLocaleGovernanceReport(index: SkillLocaleGovernanceIndex, sampleLimit = 20): string {
  const samples = index.skills
    .flatMap((record) =>
      record.suppressedMetadataLocales.map((locale) => ({
        locale,
        suppressedUrl: buildSuppressedLocaleUrl(record, locale),
        canonicalUrl: buildCanonicalLocaleUrl(record),
        detectedBodyLocale: record.detectedBodyLocale || 'unknown',
      })),
    )
    .slice(0, sampleLimit);

  return [
    '# Skill Locale Governance Report',
    '',
    `Generated: ${index.generatedAt}`,
    '',
    '## Summary',
    `- Skills analyzed: ${index.summary.totalSkills}`,
    `- Supported locale variants: ${index.summary.totalLocaleVariants}`,
    `- Metadata-localized variants: ${index.summary.metadataEligibleVariants}`,
    `- Eligible indexable variants: ${index.summary.eligibleVariants}`,
    `- Suppressed metadata variants: ${index.summary.suppressedMetadataVariants}`,
    `- Skills with suppressed metadata locales: ${index.summary.skillsWithSuppressedMetadata}`,
    '',
    '## Canonical Locale Counts',
    ...renderLocaleCountLines(index.summary.canonicalLocaleCounts),
    '',
    '## Detected Body Locale Counts',
    ...renderLocaleCountLines(index.summary.detectedBodyLocaleCounts),
    '',
    '## Eligible Locale Counts',
    ...renderLocaleCountLines(index.summary.eligibleLocaleCounts),
    '',
    '## Suppressed Metadata Locale Counts',
    ...renderLocaleCountLines(index.summary.suppressedMetadataLocaleCounts),
    '',
    '## Sample Suppressed URLs',
    ...(samples.length > 0
      ? samples.map(
          (sample) =>
            `- ${sample.locale}: ${sample.suppressedUrl} -> canonical ${sample.canonicalUrl} (body locale ${sample.detectedBodyLocale})`,
        )
      : ['- none']),
    '',
  ].join('\n');
}
