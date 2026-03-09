import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /favorites
Disallow: /history
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

# Block search result pages — dynamic, thin content
Disallow: /*?query=
Disallow: /*?q=
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

Sitemap: https://killer-skills.com/sitemap.xml
Host: https://killer-skills.com

# AI/LLM Crawler Information
# See https://llmstxt.org/
LLMs-Txt: https://killer-skills.com/llms.txt
LLMs-Full-Txt: https://killer-skills.com/llms-full.txt`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};
