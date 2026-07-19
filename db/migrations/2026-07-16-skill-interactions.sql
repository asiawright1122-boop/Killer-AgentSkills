CREATE TABLE IF NOT EXISTS skill_interactions (
  event_date TEXT NOT NULL,
  skill_ref TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  surface TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT '',
  client_version TEXT NOT NULL DEFAULT '',
  actor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (event_date, skill_ref, event_type, source, platform, surface, actor_hash)
);

CREATE INDEX IF NOT EXISTS idx_skill_interactions_date
  ON skill_interactions(event_date DESC);

CREATE INDEX IF NOT EXISTS idx_skill_interactions_skill_date
  ON skill_interactions(skill_ref, event_date DESC);
