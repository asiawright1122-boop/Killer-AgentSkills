import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query) {
        return new Response(JSON.stringify({ results: [] }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400
        });
    }

    try {
        const env = locals.runtime.env;

        // Guard: AI and Vectorize bindings are only available in Cloudflare Workers runtime
        if (!env?.AI || !env?.VECTORIZE) {
            return new Response(JSON.stringify({
                results: [],
                error: "Semantic search is only available in production (Cloudflare Workers)."
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200 // Return 200 so the UI shows "no results" instead of crashing
            });
        }

        // 1. Vectorize the Semantic Query
        const modelResp = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
            text: [query]
        });

        // Ai binding returns { shape: [...], data: [...] } for embeddings
        const vector = (modelResp as any).data[0];

        // 2. Query the Vector Database
        const vectorizeResp = await env.VECTORIZE.query(vector, {
            topK: 10,
            returnMetadata: "all"
        });

        // 3. Return Vectorize metadata directly for maximum speed
        const results = vectorizeResp.matches.map(match => ({
            id: match.id,
            score: match.score,
            owner: match.metadata?.owner,
            repo: match.metadata?.repo,
            name: match.metadata?.name,
            stars: match.metadata?.stars,
            category: match.metadata?.category,
            source: match.metadata?.source
        }));

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        return new Response(JSON.stringify({ results }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60' // Cache semantic queries for 1min
            }
        });

    } catch (e: any) {
        console.error("Vector Search Error:", e);
        return new Response(JSON.stringify({ error: e.message || "Internal Server Error" }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
};
