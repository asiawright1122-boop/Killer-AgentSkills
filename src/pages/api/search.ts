import type { APIRoute } from 'astro';
import { createRateLimiter, getClientIP, rateLimitResponse } from '../../lib/rate-limit';

// Protects free-tier Workers AI and Vectorize quotas from abuse.
const searchLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Truncate excessively long queries to prevent abuse
  const sanitizedQuery = query.trim().slice(0, 200);

  // ── Rate Limit Check ──
  const clientIP = getClientIP(request);
  if (searchLimiter.isLimited(clientIP)) {
    return rateLimitResponse();
  }

  try {
    const env = locals.runtime.env;

    // Guard: AI and Vectorize bindings are only available in Cloudflare Workers runtime
    if (!env?.AI || !env?.VECTORIZE) {
      return new Response(
        JSON.stringify({
          results: [],
          error: 'Semantic search is only available in production (Cloudflare Workers).',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    // 1. Vectorize the Semantic Query
    const modelResp = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text: [sanitizedQuery],
    });

    // Ai binding returns { shape: [...], data: [...] } for embeddings
    const vector = (modelResp as any).data[0];

    // 2. Query the Vector Database
    const vectorizeResp = await env.VECTORIZE.query(vector, {
      topK: 10,
      returnMetadata: 'all',
    });

    // 3. Return Vectorize metadata directly for maximum speed
    const results = vectorizeResp.matches.map((match) => ({
      id: match.id,
      score: match.score,
      owner: match.metadata?.owner,
      repo: match.metadata?.repo,
      name: match.metadata?.name,
      stars: match.metadata?.stars,
      category: match.metadata?.category,
      source: match.metadata?.source,
    }));

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return new Response(JSON.stringify({ results }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    console.error('Vector Search Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal Server Error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};
