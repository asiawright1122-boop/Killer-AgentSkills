import type { ValidatedSkillInteraction } from './skill-interaction-events';

export interface StoredSkillInteraction extends ValidatedSkillInteraction {
  eventDate: string;
  actorHash: string;
}

export interface SkillInteractionMetrics {
  cliInstalls7d: number;
  cliInstalls30d: number;
  installActions7d: number;
  installActions30d: number;
  trendScore: number;
}

interface SkillInteractionMetricRow {
  skill_ref: string;
  cli_installs_7d: number;
  cli_installs_30d: number;
  install_actions_7d: number;
  install_actions_30d: number;
  trend_score: number;
}

interface CachedMetrics {
  date: string;
  expiresAt: number;
  metrics: Map<string, SkillInteractionMetrics>;
}

const CACHE_TTL_MS = 60_000;
const metricsCache = new WeakMap<object, CachedMetrics>();

const toUtcDate = (date: Date): string => date.toISOString().slice(0, 10);

const daysBefore = (date: Date, days: number): string => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return toUtcDate(result);
};

export async function recordSkillInteraction(
  db: D1Database | undefined,
  event: StoredSkillInteraction,
): Promise<boolean> {
  if (!db) return false;

  try {
    const result = await db
      .prepare(`INSERT OR IGNORE INTO skill_interactions
        (event_date, skill_ref, event_type, source, platform, surface, locale, client_version, actor_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        event.eventDate,
        event.skillRef,
        event.eventType,
        event.source,
        event.platform,
        event.surface,
        event.locale,
        event.clientVersion,
        event.actorHash,
        new Date().toISOString(),
      )
      .run();

    return result.success === true;
  } catch {
    return false;
  }
}

export async function getRecentSkillInteractionMetrics(
  db: D1Database | undefined,
  now = new Date(),
): Promise<Map<string, SkillInteractionMetrics>> {
  if (!db) return new Map();

  const today = toUtcDate(now);
  const cached = metricsCache.get(db as object);
  if (cached?.date === today && cached.expiresAt > Date.now()) {
    return cached.metrics;
  }

  try {
    const result = await db
      .prepare(`SELECT
        skill_ref,
        SUM(CASE WHEN event_type = 'cli_install' AND event_date >= ?5 THEN 1 ELSE 0 END) AS cli_installs_30d,
        SUM(CASE WHEN event_type = 'cli_install' AND event_date >= ?4 THEN 1 ELSE 0 END) AS cli_installs_7d,
        SUM(CASE WHEN event_type IN ('command_copy', 'platform_copy') AND event_date >= ?5 THEN 1 ELSE 0 END) AS install_actions_30d,
        SUM(CASE WHEN event_type IN ('command_copy', 'platform_copy') AND event_date >= ?4 THEN 1 ELSE 0 END) AS install_actions_7d,
        SUM(CASE
          WHEN event_type = 'cli_install' AND event_date >= ?2 THEN 12
          WHEN event_type = 'cli_install' AND event_date >= ?3 THEN 8
          WHEN event_type = 'cli_install' AND event_date >= ?4 THEN 5
          WHEN event_type = 'platform_copy' AND event_date >= ?4 THEN 2
          WHEN event_type = 'command_copy' AND event_date >= ?4 THEN 1
          ELSE 0
        END) AS trend_score
      FROM skill_interactions
      WHERE event_date BETWEEN ?5 AND ?1
      GROUP BY skill_ref`)
      .bind(today, daysBefore(now, 1), daysBefore(now, 3), daysBefore(now, 6), daysBefore(now, 29))
      .all<SkillInteractionMetricRow>();

    if (result.success !== true) return new Map();

    const metrics = new Map<string, SkillInteractionMetrics>();
    for (const row of result.results || []) {
      metrics.set(row.skill_ref, {
        cliInstalls7d: Number(row.cli_installs_7d || 0),
        cliInstalls30d: Number(row.cli_installs_30d || 0),
        installActions7d: Number(row.install_actions_7d || 0),
        installActions30d: Number(row.install_actions_30d || 0),
        trendScore: Number(row.trend_score || 0),
      });
    }

    metricsCache.set(db as object, { date: today, expiresAt: Date.now() + CACHE_TTL_MS, metrics });
    return metrics;
  } catch {
    return new Map();
  }
}
