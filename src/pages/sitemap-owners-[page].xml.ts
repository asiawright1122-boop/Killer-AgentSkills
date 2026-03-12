import type { APIRoute } from 'astro';

export const prerender = false;

// Deprecated sitemap: owner-level URLs are not real pages and should not be crawled.
export const GET: APIRoute = async () => {
  return new Response('Gone', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
};
