import type { APIRoute } from 'astro';
import type { Env } from '../../../lib/kv';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals.runtime?.env || {}) as Env;

  // Basic Auth Check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }
  const [, credentials] = authHeader.split(' ');
  const decoded = atob(credentials);
  const [username, password] = decoded.split(':');

  if (username !== env.ADMIN_USER || password !== env.ADMIN_PASSWORD) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!env.DB || !env.VECTORIZE || !env.AI) {
    return new Response(JSON.stringify({ error: 'Missing Cloudflare bindings (DB, VECTORIZE, AI)' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Fetch skills from D1 that need vectorizing
    // We fetch a batch of skills (e.g., top 100 or those without vectors if we track it).
    // For simplicity of this admin endpoint, we will fetch 50 skills at a time.
    // Real implementation could use cursor pagination.
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const result = await env.DB.prepare(
      `SELECT id, owner, repo, name, category, COALESCE(description, '') as description, stars, quality_score
       FROM skills 
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();

    const skills = result.results as any[];

    if (skills.length === 0) {
      return new Response(JSON.stringify({ message: 'No more skills to sync', count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const vectorsToUpsert = [];

    // 2. Generate Embeddings using Workers AI
    for (const skill of skills) {
      // Build a rich text document context for the embedding model to understand the core intent
      const semanticContext = `Plugin Name: ${skill.name || skill.repo}
Owner: ${skill.owner}
Category: ${skill.category || 'general'}
Description: ${skill.description || 'A Claude Code skill plugin.'}
`;
      // AI.run format varies based on exact CF adapter version, but typically:
      const embeddingResp: any = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [semanticContext]
      });

      // Check if embeddingResp contains data
      const data = embeddingResp.data;
      const embeddingVector = data 
          ? (Array.isArray(data[0]) ? data[0] : data) // handle both batched and flat returns
          : embeddingResp;
      
      if (!embeddingVector || !Array.isArray(embeddingVector) || typeof embeddingVector[0] !== 'number') {
          console.warn(`Failed to generate embedding for ${skill.id}`);
          continue;
      }

      vectorsToUpsert.push({
        id: skill.id, // e.g. "n8n-io/n8n"
        values: embeddingVector,
        metadata: {
          owner: skill.owner,
          repo: skill.repo,
          name: skill.name || skill.repo,
          category: skill.category || '',
          stars: skill.stars || 0,
          qualityScore: skill.quality_score || 0
        }
      });
    }

    // 3. Upsert to Vectorize index
    // Vectorize supports upserting multiple vectors at once
    if (vectorsToUpsert.length > 0) {
      await env.VECTORIZE.upsert(vectorsToUpsert);
    }

    return new Response(
      JSON.stringify({
        message: 'Sync successful',
        syncedCount: vectorsToUpsert.length,
        nextOffset: offset + limit,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Vectorize Sync Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
