import type { APIRoute } from 'astro';
import { getSkillsFromKV, type Env } from '../../../lib/kv';
import type { UnifiedSkill } from '../../../lib/skills';

export const prerender = false;

/**
 * GET /api/admin/skills
 *
 * Returns all skills for admin management (includes submissions).
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;
    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const category = url.searchParams.get('category');

    let skills: UnifiedSkill[] = [];
    if (env) {
      const raw = await getSkillsFromKV(env);
      skills = raw as UnifiedSkill[];
    }

    if (source) {
      skills = skills.filter((s) => s.source === source);
    }
    if (category) {
      skills = skills.filter((s) => s.category === category);
    }

    return new Response(
      JSON.stringify({ skills, total: skills.length }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Admin skills API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch skills' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST /api/admin/skills
 *
 * Admin skill management: approve, reject, update, delete.
 * Body: { action: 'approve' | 'reject' | 'update' | 'delete', skillId: string, data?: any }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env | undefined;
    const body = (await request.json()) as {
      action: string;
      skillId: string;
      data?: any;
    };

    const { action, skillId, data } = body;

    if (!action || !skillId) {
      return new Response(
        JSON.stringify({ error: 'Missing action or skillId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!env?.SKILLS_CACHE) {
      return new Response(
        JSON.stringify({ error: 'KV not available' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'approve': {
        // Move submission to approved skills
        const submission = await env.SKILLS_CACHE.get(`submission:${skillId}`, 'json');
        if (submission) {
          await env.SKILLS_CACHE.put(`skill:${skillId}`, JSON.stringify(submission), {
            expirationTtl: 31536000,
          });
          await env.SKILLS_CACHE.delete(`submission:${skillId}`);
        }
        return new Response(
          JSON.stringify({ success: true, message: `Skill ${skillId} approved` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'reject':
      case 'delete': {
        await env.SKILLS_CACHE.delete(`submission:${skillId}`);
        await env.SKILLS_CACHE.delete(`skill:${skillId}`);
        return new Response(
          JSON.stringify({ success: true, message: `Skill ${skillId} ${action}ed` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!data) {
          return new Response(
            JSON.stringify({ error: 'Missing data for update' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const existing = await env.SKILLS_CACHE.get(`skill:${skillId}`, 'json');
        const updated = { ...(existing || {}), ...data, updatedAt: new Date().toISOString() };
        await env.SKILLS_CACHE.put(`skill:${skillId}`, JSON.stringify(updated), {
          expirationTtl: 31536000,
        });
        return new Response(
          JSON.stringify({ success: true, message: `Skill ${skillId} updated` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin skills POST error:', error);
    return new Response(
      JSON.stringify({ error: 'Admin operation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
