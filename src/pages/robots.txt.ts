import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://killer-skills.com/sitemap.xml`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};
