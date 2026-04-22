type SkillSoftwareApplicationSchemaArgs = {
  name: string;
  category: string;
  description: string;
  canonicalUrl: string;
  owner: string;
  updatedAt?: string;
  lastSynced?: string;
};

/** 将任意日期值规范为 ISO 8601 字符串，避免 Google 结构化数据「值类型不正确」 */
function toISO8601(value: string | number | undefined): string {
  if (value == null || value === '') return new Date().toISOString();
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildSkillSoftwareApplicationSchema({
  name,
  category,
  description,
  canonicalUrl,
  owner,
  updatedAt,
  lastSynced,
}: SkillSoftwareApplicationSchemaArgs) {
  return {
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
}
