DROP TABLE IF EXISTS skills;
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    category TEXT,
    owner TEXT,
    repo TEXT,
    repo_path TEXT,
    name TEXT,
    stars INTEGER,
    forks INTEGER,
    quality_score INTEGER,
    updated_at TEXT,
    last_synced TEXT,
    content_hash TEXT,
    data_json TEXT
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_stars ON skills(stars DESC);
CREATE INDEX idx_skills_quality ON skills(quality_score DESC);
CREATE INDEX idx_skills_updated_at ON skills(updated_at DESC);
CREATE INDEX idx_skills_owner_repo ON skills(owner, repo);
