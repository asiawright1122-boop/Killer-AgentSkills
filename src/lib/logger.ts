/**
 * Lightweight structured logger for Cloudflare Workers.
 * Outputs JSON in production for log aggregation, human-readable in dev.
 *
 * Usage:
 *   import { logger } from './logger';
 *   logger.info('Skill fetched', { owner: 'foo', repo: 'bar', durationMs: 42 });
 *   logger.error('KV read failed', { key, error: e });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  /** ISO timestamp */
  ts: string;
  /** Optional structured context */
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Detect production environment (Cloudflare Workers or NODE_ENV=production) */
function isProduction(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  } catch {
    // In CF Workers, process may not exist — treat as production
    return true;
  }
}

function formatDev(entry: LogEntry): string {
  const { level, msg, ts: _ts, ...ctx } = entry;
  const tag = `[${level.toUpperCase()}]`;
  const ctxStr = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : '';
  return `${tag} ${msg}${ctxStr}`;
}

function createLogger(minLevel: LogLevel = 'debug') {
  const minPriority = LEVEL_PRIORITY[minLevel];
  const prod = isProduction();

  function log(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < minPriority) return;

    const entry: LogEntry = {
      level,
      msg,
      ts: new Date().toISOString(),
      ...context,
    };

    if (prod) {
      // Structured JSON for log aggregation (Cloudflare, Datadog, etc.)
      const output = JSON.stringify(entry);
      if (level === 'error') console.error(output);
      else if (level === 'warn') console.warn(output);
      else console.log(output);
    } else {
      // Human-readable for local dev
      const output = formatDev(entry);
      if (level === 'error') console.error(output);
      else if (level === 'warn') console.warn(output);
      else if (level === 'debug') console.debug(output);
      else console.log(output);
    }
  }

  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  };
}

/** Shared logger instance */
export const logger = createLogger();

/**
 * Generate a short unique request ID (8 chars hex).
 * Lightweight alternative to UUID for tracing.
 */
export function generateRequestId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
