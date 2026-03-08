import type { APIRoute } from 'astro';

// ═══════════════════════════════════════════════════════════════
// Rate Limiter: Sliding Window Counter (per Worker isolate)
// Protects free-tier Workers AI and Vectorize quotas from abuse.
// Each Cloudflare Worker instance maintains its own counter.
// This is NOT globally distributed, but effective enough for
// blocking simple scrapers and runaway clients at zero cost.
// ═══════════════════════════════════════════════════════════════
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 30; // max 30 queries per IP per minute

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  return false;
}

// Periodic cleanup to prevent memory leak (run every 5 minutes)
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return; // 5 min interval
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

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
  const clientIP =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  cleanupStaleEntries();

  if (isRateLimited(clientIP)) {
    return new Response(
      JSON.stringify({
        results: [],
        error: 'Rate limit exceeded. Please wait a moment before searching again.',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
        status: 429,
      },
    );
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
  } catch (e: any) {
    console.error('Vector Search Error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};
