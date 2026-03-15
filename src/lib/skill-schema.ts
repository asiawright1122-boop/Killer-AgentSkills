type SkillSoftwareApplicationSchemaArgs = {
  name: string;
  category: string;
  description: string;
  canonicalUrl: string;
  owner: string;
  updatedAt?: string;
  lastSynced?: string;
};

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
    keywords: `AI Agent, MCP Server, Claude, Skill, Developer Tools, ${category}`,
    description: description ? `AI Agent Skill: ${description}` : '',
    url: canonicalUrl,
    author: {
      '@type': 'Organization',
      name: owner,
      url: `https://github.com/${owner}`,
    },
    dateModified: updatedAt || new Date().toISOString(),
    datePublished: lastSynced || updatedAt || new Date().toISOString(),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    },
  };
}
