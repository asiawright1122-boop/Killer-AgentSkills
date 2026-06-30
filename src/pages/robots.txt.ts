import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';

export const prerender = false;

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /admin/

# Search result/listing parameter pages are controlled by noindex headers/meta.
# Keep crawl allowed so bots can receive canonical + noindex signals.
# Favorites and history pages are also crawlable so engines can observe page-level noindex.
# API endpoints are controlled by X-Robots-Tag: noindex, nofollow.
# Keep crawl allowed so engines can observe the directive and drop historical API URLs.
# Invalid source-file and deep skill paths are allowed to crawl so bots can see cached 301/404/410 responses.
# Sandbox execution pages are controlled with page-level noindex headers/meta.
# Keep crawl allowed so Google can observe the noindex signal.
#
# Parameterised filter/tracking variants below are explicit crawl-budget guards.
# We block only narrow permutations (sort/order/utm tracking) that have no
# unique indexable content; canonical listing pages and ?q= search queries
# remain crawlable so the noindex/canonical directives above still apply.
Disallow: /*?*sort=
Disallow: /*?*order=
Disallow: /*?*ref=
Disallow: /*?*utm_

# Googlebot specific — no crawl-delay for maximum indexing speed
User-agent: Googlebot
Allow: /

# Bingbot
User-agent: Bingbot
Allow: /

# AI Search Engine Crawlers — explicitly allowed for GEO
User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: cohere-ai
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-skills.xml
Sitemap: ${SITE_URL}/sitemap-docs.xml
Sitemap: ${SITE_URL}/sitemap-blog.xml
Sitemap: ${SITE_URL}/sitemap-static.xml
Sitemap: ${SITE_URL}/sitemap-collections.xml`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};
