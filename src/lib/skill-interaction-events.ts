export type SkillInteractionEventType = 'cli_install' | 'command_copy' | 'platform_copy';
export type SkillInteractionPlatform = '' | 'auto' | 'claude' | 'codex' | 'cursor' | 'multi';
export type SkillInteractionSurface = 'cli' | 'detail' | 'card';

export interface ValidatedSkillInteraction {
  eventType: SkillInteractionEventType;
  skillRef: string;
  source: 'cli' | 'web';
  platform: SkillInteractionPlatform;
  surface: SkillInteractionSurface;
  locale: string;
  clientVersion: string;
}

const SAFE_SKILL_REF = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?$/;
const EVENT_TYPES = new Set<SkillInteractionEventType>(['cli_install', 'command_copy', 'platform_copy']);
const PLATFORMS = new Set<SkillInteractionPlatform>(['', 'auto', 'claude', 'codex', 'cursor', 'multi']);
const SURFACES = new Set<SkillInteractionSurface>(['cli', 'detail', 'card']);
const LOCALES = new Set(['', 'en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'ru', 'ar']);

export function validateSkillInteractionPayload(input: unknown): ValidatedSkillInteraction | null {
  if (!input || typeof input !== 'object') return null;

  const value = input as Record<string, unknown>;
  const eventType = String(value.eventType || '') as SkillInteractionEventType;
  const skillRef = String(value.skillRef || '').trim().replace(/^\/+|\/+$/g, '');
  const platform = String(value.platform || '') as SkillInteractionPlatform;
  const surface = String(value.surface || '') as SkillInteractionSurface;
  const locale = String(value.locale || '');
  const clientVersion = String(value.clientVersion || '').slice(0, 32);

  if (!EVENT_TYPES.has(eventType)) return null;
  if (skillRef.length > 180 || skillRef.includes('..') || !SAFE_SKILL_REF.test(skillRef)) return null;
  if (!PLATFORMS.has(platform) || !SURFACES.has(surface) || !LOCALES.has(locale)) return null;

  const source = eventType === 'cli_install' ? 'cli' : 'web';
  if (source === 'cli' && surface !== 'cli') return null;
  if (source === 'web' && surface === 'cli') return null;
  if (eventType === 'platform_copy' && !['auto', 'claude', 'codex', 'cursor'].includes(platform)) return null;

  return { eventType, skillRef, source, platform, surface, locale, clientVersion };
}

export function isTelemetryCrawler(userAgent: string): boolean {
  return /(googlebot|bingbot|baiduspider|yandexbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|bytespider|killer-skills-warmup-bot)/i.test(
    userAgent,
  );
}

export async function createDailyActorHash(options: {
  salt: string;
  eventDate: string;
  ip: string;
  userAgent: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(options.salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const userAgentFamily = options.userAgent.toLowerCase().replace(/\d+(?:\.\d+)*/g, '#').slice(0, 80);
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${options.eventDate}|${options.ip}|${userAgentFamily}`),
  );

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
