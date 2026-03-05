import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /favorites
Disallow: /history

# Googlebot specific
User-agent: Googlebot
Allow: /

Sitemap: https://killer-skills.com/sitemap.xml
Host: https://killer-skills.com

# AI/LLM Crawler Information
# See https://llmstxt.org/
LLMs-Txt: https://killer-skills.com/llms.txt`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};
