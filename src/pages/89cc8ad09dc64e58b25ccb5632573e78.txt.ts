import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
    const body = `89cc8ad09dc64e58b25ccb5632573e78`;

    return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
    });
};
