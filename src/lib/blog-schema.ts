type BlogSchemaArgs = {
  title: string;
  description: string;
  author: string;
  pubDate: Date | string;
  updatedDate?: Date | string;
  heroImage?: string;
  canonicalUrl: string;
  locale: string;
  wordCount: number;
  tags?: string[];
  category?: string;
};

function toISO8601(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildBlogArticleSchema({
  title,
  description,
  author,
  pubDate,
  updatedDate,
  heroImage,
  canonicalUrl,
  locale,
  wordCount,
  tags = [],
  category,
}: BlogSchemaArgs) {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: {
      '@type': 'Person',
      name: author,
      url: 'https://killer-skills.com/about',
    },
    datePublished: toISO8601(pubDate),
    dateModified: toISO8601(updatedDate || pubDate),
    url: canonicalUrl,
    inLanguage: locale,
    wordCount,
    publisher: {
      '@type': 'Organization',
      name: 'Killer-Skills',
      url: 'https://killer-skills.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://killer-skills.com/og-image.webp',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  };

  if (heroImage) {
    return {
      ...baseSchema,
      image: {
        '@type': 'ImageObject',
        url: heroImage,
        width: 1200,
        height: 630,
      },
    };
  }

  return baseSchema;
}

export function buildBlogBreadcrumbSchema(locale: string, postTitle: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `https://killer-skills.com/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `https://killer-skills.com/${locale}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: postTitle,
        item: canonicalUrl,
      },
    ],
  };
}
