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

-- Composite index for search queries: WHERE category = ? ORDER BY quality_score DESC, stars DESC
CREATE INDEX idx_skills_category_rank ON skills(category, quality_score DESC, stars DESC);

-- Setup Full-Text Search (FTS5) table for millisecond search speed
DROP TABLE IF EXISTS skills_fts;
CREATE VIRTUAL TABLE skills_fts USING fts5(
    id UNINDEXED,
    name,
    owner,
    repo,
    category,
    search_text,
    tokenize='unicode61 remove_diacritics 1'
);

-- Triggers to keep FTS index in sync with skills table automatically
-- On INSERT: add entry to FTS
DROP TRIGGER IF EXISTS skills_ai;
CREATE TRIGGER skills_ai AFTER INSERT ON skills BEGIN
    INSERT INTO skills_fts(id, name, owner, repo, category, search_text)
    VALUES (
        new.id,
        new.name,
        new.owner,
        new.repo,
        new.category,
        COALESCE(new.name, '') || ' ' || COALESCE(new.owner, '') || ' ' || COALESCE(new.repo, '') || ' ' || COALESCE(new.category, '')
    );
END;

-- On DELETE: remove entry from FTS
DROP TRIGGER IF EXISTS skills_ad;
CREATE TRIGGER skills_ad AFTER DELETE ON skills BEGIN
    DELETE FROM skills_fts WHERE id = old.id;
END;

-- On UPDATE: replace FTS entry (DELETE + INSERT since FTS5 doesn't support UPDATE)
DROP TRIGGER IF EXISTS skills_au;
CREATE TRIGGER skills_au AFTER UPDATE ON skills BEGIN
    DELETE FROM skills_fts WHERE id = old.id;
    INSERT INTO skills_fts(id, name, owner, repo, category, search_text)
    VALUES (
        new.id,
        new.name,
        new.owner,
        new.repo,
        new.category,
        COALESCE(new.name, '') || ' ' || COALESCE(new.owner, '') || ' ' || COALESCE(new.repo, '') || ' ' || COALESCE(new.category, '')
    );
END;
