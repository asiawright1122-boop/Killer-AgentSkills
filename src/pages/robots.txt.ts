import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site-config';

export const prerender = false;

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /favorites
Disallow: /history
Disallow: /*/favorites
Disallow: /*/history
# Block crawling of source-code file paths (not real pages)
Disallow: /*.md$
Disallow: /*.ts$
Disallow: /*.js$
Disallow: /*.py$
Disallow: /*.json$
Disallow: /*.go$
Disallow: /*.yaml$
Disallow: /.cursor/
Disallow: /04-Initiatives/
Disallow: /ORCHESTRATION.md

# Search result/listing parameter pages are controlled by noindex headers/meta.
# Keep crawl allowed so bots can receive canonical + noindex signals.
# Block legacy tag parameter (use ?topic= instead)
Disallow: /*?tag=
# Block deep nested skill sub-paths (crawl traps)
Disallow: /*/skills/*/*/*/*/

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
Host: ${SITE_URL}

# AI/LLM Crawler Information
# See https://llmstxt.org/
LLMs-Txt: ${SITE_URL}/llms.txt
LLMs-Full-Txt: ${SITE_URL}/llms-full.txt`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};
