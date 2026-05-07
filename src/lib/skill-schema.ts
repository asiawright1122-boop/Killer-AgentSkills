type SkillSoftwareApplicationSchemaArgs = {
  name: string;
  category: string;
  description: string;
  canonicalUrl: string;
  owner: string;
  updatedAt?: string;
  lastSynced?: string;
  /** GitHub stargazers count, used to derive aggregateRating. */
  stars?: number;
  /** Semver or GitHub release tag. */
  version?: string;
  /** Optional install command URL (e.g. deep link or raw install reference). */
  installUrl?: string;
};

/** 将任意日期值规范为 ISO 8601 字符串，避免 Google 结构化数据「值类型不正确」 */
function toISO8601(value: string | number | undefined): string {
  if (value == null || value === '') return new Date().toISOString();
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Monotonically map GitHub stargazer counts to a 1-5 star rating.
 * 10 stars → 3.0, 100 → 4.0, 1k → 4.5, 10k → ~4.8, 100k → ~4.9 (capped at 5).
 * We only emit aggregateRating when there is at least `MIN_STARS_FOR_RATING`
 * stars to avoid manufacturing reviews on empty repos.
 */
const MIN_STARS_FOR_RATING = 10;

export function deriveRatingFromStars(stars: number | undefined): { ratingValue: number; ratingCount: number } | null {
  const count = typeof stars === 'number' && Number.isFinite(stars) ? Math.floor(stars) : 0;
  if (count < MIN_STARS_FOR_RATING) return null;
  const log = Math.log10(count);
  const ratingValue = Math.min(5, Math.max(1, Number((2 + log).toFixed(1))));
  return { ratingValue, ratingCount: count };
}

export function buildSkillSoftwareApplicationSchema({
  name,
  category,
  description,
  canonicalUrl,
  owner,
  updatedAt,
  lastSynced,
  stars,
  version,
  installUrl,
}: SkillSoftwareApplicationSchemaArgs) {
  const rating = deriveRatingFromStars(stars);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    operatingSystem: 'Any',
    applicationCategory: 'DeveloperApplication',
    keywords: `AI Agent Skills, IDE Skills, Developer Tools, ${category}`,
    description: description ? `AI Agent Skill for ${category}: ${description}` : '',
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      name: owner,
      url: `https://github.com/${owner}`,
    },
    dateModified: toISO8601(updatedAt),
    datePublished: toISO8601(lastSynced ?? updatedAt),
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
  };

  if (version && String(version).trim()) {
    schema.softwareVersion = String(version).trim();
  }
  if (installUrl) {
    schema.installUrl = installUrl;
    schema.downloadUrl = installUrl;
  }
  if (rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.ratingValue,
      ratingCount: rating.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}
