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
    security_level TEXT,
    source_trust TEXT,
    rank_score INTEGER,
    last_audited_at TEXT,
    updated_at TEXT,
    last_synced TEXT,
    content_hash TEXT,
    data_json TEXT
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_stars ON skills(stars DESC);
CREATE INDEX idx_skills_quality ON skills(quality_score DESC);
CREATE INDEX idx_skills_rank_score ON skills(rank_score DESC);
CREATE INDEX idx_skills_security_level ON skills(security_level);
CREATE INDEX idx_skills_source_trust ON skills(source_trust);
CREATE INDEX idx_skills_trusted_rank ON skills(source_trust, security_level, rank_score DESC);
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

-- GSC Coverage Drilldown table for Q2 strategic automation
CREATE TABLE IF NOT EXISTS gsc_coverage_drilldown (
    url TEXT PRIMARY KEY,
    status TEXT,
    reason TEXT,
    last_crawled TEXT,
    ingested_at TEXT
);

-- GSC URL Inspection results for FRESH-01 automated freshness pipeline
CREATE TABLE IF NOT EXISTS gsc_url_inspection (
    url TEXT PRIMARY KEY,
    verdict TEXT,
    coverage_state TEXT,
    indexing_state TEXT,
    last_crawl_time TEXT,
    page_fetch_state TEXT,
    google_canonical TEXT,
    robots_txt_state TEXT,
    cluster TEXT,
    inspected_at TEXT,
    ingested_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_gsc_url_inspection_verdict ON gsc_url_inspection(verdict);
CREATE INDEX IF NOT EXISTS idx_gsc_url_inspection_cluster ON gsc_url_inspection(cluster);
