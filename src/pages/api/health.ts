import type { APIRoute } from 'astro';
import { jsonResponse } from '../../lib/api-utils';
import type { Env } from '../../lib/kv';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const startTime = Date.now();
  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  const env = (locals as any).runtime?.env as Env | undefined;

  // Check KV availability
  try {
    if (env?.SKILLS_CACHE) {
      const kvStart = Date.now();
      await env.SKILLS_CACHE.get('__health_check__');
      checks.kv = { status: 'ok', latencyMs: Date.now() - kvStart };
    } else {
      checks.kv = { status: 'unavailable' };
    }
  } catch (_e) {
    checks.kv = { status: 'error' };
  }

  // Check D1 availability
  try {
    if (env?.DB) {
      const dbStart = Date.now();
      await env.DB.prepare('SELECT 1').first();
      checks.d1 = { status: 'ok', latencyMs: Date.now() - dbStart };
    } else {
      checks.d1 = { status: 'unavailable' };
    }
  } catch (_e) {
    checks.d1 = { status: 'error' };
  }

  const allOk = Object.values(checks).every((c) => c.status !== 'error');

  return jsonResponse(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime?.() ?? null,
      latencyMs: Date.now() - startTime,
      checks,
    },
    allOk ? 200 : 503,
    {
      'Cache-Control': 'no-store',
    },
  );
};
