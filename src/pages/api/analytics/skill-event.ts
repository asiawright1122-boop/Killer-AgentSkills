import type { APIRoute } from 'astro';
import {
  createDailyActorHash,
  isTelemetryCrawler,
  validateSkillInteractionPayload,
} from '../../../lib/skill-interaction-events';
import { recordSkillInteraction } from '../../../lib/skill-interaction-store';
import { checkRateLimit, createRateLimiter, getClientIP } from '../../../lib/rate-limit';
import { getRuntimeEnv } from '../../../lib/runtime-env';
import type { Env } from '../../../lib/kv';

export const prerender = false;

const fallbackLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const responseHeaders = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

export const POST: APIRoute = async ({ request, locals }) => {
  const userAgent = request.headers.get('user-agent') || '';
  if (isTelemetryCrawler(userAgent)) {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return new Response(null, { status: 400, headers: responseHeaders });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 2048) {
    return new Response(null, { status: 400, headers: responseHeaders });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response(null, { status: 400, headers: responseHeaders });
  }

  const event = validateSkillInteractionPayload(raw);
  if (!event) {
    return new Response(null, { status: 400, headers: responseHeaders });
  }

  const env = await getRuntimeEnv<Env>(locals);
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(
    env?.SKILLS_CACHE,
    { bucket: 'skill-event', key: ip, max: 60, periodSec: 60 },
    fallbackLimiter,
  );
  if (!allowed) {
    return new Response(null, {
      status: 429,
      headers: { ...responseHeaders, 'Retry-After': '60' },
    });
  }

  if (!env?.DB || !env.ANALYTICS_HASH_SALT) {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  const eventDate = new Date().toISOString().slice(0, 10);
  const actorHash = await createDailyActorHash({
    salt: env.ANALYTICS_HASH_SALT,
    eventDate,
    ip,
    userAgent,
  });
  await recordSkillInteraction(env.DB, { ...event, eventDate, actorHash });

  return new Response(null, { status: 204, headers: responseHeaders });
};
