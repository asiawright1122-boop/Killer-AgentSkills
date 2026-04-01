const DEFAULT_SITE_URL = 'https://killer-skills.com';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function stripTrailingSlash(url: string): string {
  if (url === DEFAULT_SITE_URL || url === `${DEFAULT_SITE_URL}/`) {
    return DEFAULT_SITE_URL;
  }

  return url.replace(/\/+$/, '');
}

function toAbsoluteUrl(href: string, siteUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return stripTrailingSlash(href);
  }

  return stripTrailingSlash(`${siteUrl}${href.startsWith('/') ? href : `/${href}`}`);
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  options: {
    currentUrl?: string;
    siteUrl?: string;
  } = {},
) {
  const siteUrl = stripTrailingSlash(options.siteUrl ?? DEFAULT_SITE_URL);

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: toAbsoluteUrl(item.href ?? options.currentUrl ?? '/', siteUrl),
    })),
  };
}

export function buildBreadcrumbTrail(
  items: BreadcrumbItem[],
  options: {
    currentUrl?: string;
    siteUrl?: string;
  } = {},
) {
  return {
    items,
    jsonLd: buildBreadcrumbJsonLd(items, options),
  };
}
