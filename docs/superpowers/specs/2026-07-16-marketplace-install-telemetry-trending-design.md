# Marketplace Install Telemetry And Trending Design

Date: 2026-07-16
Status: Approved for implementation planning

## Context

Killer-Skills already has a reviewed marketplace catalog, install decision panels, a universal CLI command, platform badges, Popular and Latest rankings, and a shared marketplace admission policy. Competitor research showed that the missing product signal is not catalog functionality. It is observable evidence of real use:

- Successful CLI installations are recorded only in a local CLI stats file.
- Website command copies are not recorded as install intent.
- Popular ranking uses rank score, quality score, and GitHub stars, but not product usage.
- The public directory and category copy describes internal filtering and migration structure instead of the user-facing promise.
- The detail install panel advertises broad compatibility but does not provide platform-specific commands.

This project adds privacy-preserving successful-install telemetry, website install-intent telemetry, a Trending ranking, platform-specific install commands, and clearer existing-route copy without expanding the indexable URL inventory.

## Goals

1. Count successful CLI installations separately from website installation intent.
2. Build a seven-day Trending ranking led by successful CLI installations.
3. Preserve user privacy and provide explicit CLI telemetry opt-out controls.
4. Add Auto-detect, Claude Code, Codex, and Cursor installation choices to skill detail pages.
5. Reposition the existing Skills and Categories routes around reviewed, installable, multi-platform skills.
6. Fail open when analytics storage or queries are unavailable so telemetry cannot cause public-page errors.
7. Keep daily GitHub skill harvesting enabled and leave sitemap/indexability policy unchanged.

## Non-Goals

- Do not claim that a website button click or command copy is a completed installation.
- Do not publish all-time unique-user counts from daily anonymous identifiers.
- Do not add a large platform/topic URL matrix in this project.
- Do not alter marketplace admission rules or expose quarantined skills.
- Do not require telemetry for CLI installation to succeed.
- Do not store local paths, credentials, repository contents, IP addresses, or stable device identifiers.
- Do not replace Google Analytics or the existing server-side directory-view event.

## Public Measurement Vocabulary

The product must keep these terms distinct:

| Term | Meaning | Public use |
| --- | --- | --- |
| Successful install | The CLI finished writing at least one target IDE installation | May be displayed as `7d installs` |
| Install action | A website visitor copied an install command or used an install CTA | May be displayed as `7d install actions` |
| Directory view | A skill detail page was requested | Internal analytics only in this project |

Website actions must never be labeled as installs. Successful-install counts are daily unique estimates, not all-time unique users.

## Event Model

### Accepted Events

The ingestion endpoint accepts only these event types:

| Event | Source | Meaning |
| --- | --- | --- |
| `cli_install` | CLI | A skill was successfully written to one or more IDE targets |
| `command_copy` | Web | The universal or card install command was copied |
| `platform_copy` | Web | A platform-specific install command was copied |

Common fields:

- `skillRef`: canonical `owner/repo` or `owner/repo/sub-skill` reference.
- `eventType`: one of the accepted event names.
- `source`: `cli` or `web`, derived and validated by the server.
- `platform`: `auto`, `claude`, `codex`, `cursor`, `multi`, or an empty value when not applicable.
- `surface`: `cli`, `detail`, or `card`.
- `locale`: supported locale for web events; empty for CLI events.
- `clientVersion`: CLI version for CLI events; omitted for web events.

No event accepts arbitrary metadata.

### CLI Reporting

The CLI reports `cli_install` only after the install command has produced at least one successful target in `result.installed`. The report is best effort and must not delay, fail, or change the installation result.

The CLI does not report when any of these are true:

- `DO_NOT_TRACK` is set to a truthy value.
- `KILLER_SKILLS_TELEMETRY=0`, `false`, `off`, or `no`.
- `KILLER_SKILLS_TEST` is set.
- The source is a local filesystem path, because it cannot be mapped safely to a public catalog reference.

For GitHub and website-registry installs, the installer carries the canonical skill reference in `InstallResult` instead of reconstructing it from the display name. Multi-IDE installs produce one event with platform `multi`, not one event per target.

### Web Reporting

The global install click handlers report only after a clipboard write succeeds. The browser uses `navigator.sendBeacon` when available and a `fetch` request with `keepalive: true` as fallback. Reporting is fire and forget; failures are silent and never change the copy interaction.

Each install control carries explicit data attributes for `skillRef`, `surface`, and `platform`. Event code must not parse a skill reference back out of the visible command string.

## Privacy And Deduplication

The ingestion endpoint derives a daily actor digest using an HMAC secret:

```text
HMAC_SHA256(ANALYTICS_HASH_SALT, eventDate + clientIP + normalizedUserAgentFamily)
```

Properties:

- The raw IP and full user agent are never stored.
- The event date makes the digest unlinkable across days.
- A secret HMAC prevents offline reversal of common IP values.
- The digest exists only to deduplicate repeated same-day events.

The endpoint excludes known crawler user agents. It also applies the existing KV-backed rate limiter by client IP before creating the digest. Rate limiting is an abuse control, not a measurement identity.

The privacy page must state that anonymous daily interaction counts are used for marketplace rankings and that CLI users can opt out with `DO_NOT_TRACK=1` or `KILLER_SKILLS_TELEMETRY=0`.

## Storage Design

Add a forward-only D1 migration that creates an independent table:

```sql
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
  PRIMARY KEY (
    event_date,
    skill_ref,
    event_type,
    source,
    platform,
    surface,
    actor_hash
  )
);

CREATE INDEX IF NOT EXISTS idx_skill_interactions_date
  ON skill_interactions(event_date DESC);

CREATE INDEX IF NOT EXISTS idx_skill_interactions_skill_date
  ON skill_interactions(skill_ref, event_date DESC);
```

`INSERT OR IGNORE` provides same-day deduplication. The table is separate from `skills`, so telemetry reads and writes never increase skill catalog payload size or require loading governance records.

Records older than 35 days are deleted by a bounded cleanup operation. Cleanup runs outside the public read path, preferably from the existing daily workflow or a small scheduled maintenance command. The event endpoint must not perform an unbounded delete.

## API Design

Create `POST /api/analytics/skill-event`.

Validation rules:

- Request body has a small fixed byte limit.
- `Content-Type` must be JSON or the `sendBeacon`-compatible accepted format.
- Event type, source relationship, platform, surface, locale, and client version are allowlisted.
- `skillRef` is normalized, length-limited, and restricted to safe path segments.
- Crawler events return `204` without storage.
- Valid duplicate events return `204`.
- Invalid payloads return `400`; rate-limit failures return `429`.
- Missing D1 bindings or write failures are logged and return `204`, preserving the user action.

The API response always includes `X-Robots-Tag: noindex, nofollow` and no event data.

## Trending Data Access

Add a small server-side analytics module that queries the last seven and thirty days and returns metrics keyed by canonical skill reference:

- `cliInstalls7d`
- `cliInstalls30d`
- `installActions7d`
- `installActions30d`
- `trendScore`

The query reads only `skill_interactions`, groups by `skill_ref`, and has a short in-isolate cache. If the table or D1 binding is unavailable, it returns an empty map.

The marketplace loader enriches only the already bounded public skill list. Analytics must not trigger a full skill-catalog read.

## Trending Ranking

Add `trending` as a ranking mode on the existing Rankings route:

```text
/[locale]/popular?rank=trending
```

This parameterized view remains `noindex, follow`, consistent with existing ranking filters. It does not create a new sitemap URL.

The score uses recent daily-unique events:

```text
trendScore =
  cli installs from days 0-1 * 12 +
  cli installs from days 2-3 * 8 +
  cli installs from days 4-6 * 5 +
  platform copies from days 0-6 * 2 +
  command copies from days 0-6 * 1
```

Ordering is:

1. `trendScore` descending.
2. Seven-day successful installs descending.
3. Existing Popular comparator as the final tie-break.

Only skills admitted by the shared marketplace policy are eligible. When no skill has analytics data, Trending falls back exactly to Popular ordering and displays a neutral message that recent activity is still accumulating. Missing analytics can never remove skills from the public catalog.

Skill cards in Trending may show `7d installs` when the value is nonzero. Website install-action counts remain secondary and must not visually impersonate install counts.

## Platform-Specific Install UI

The detail install component exposes four modes:

- Auto-detect: `npx killer-skills add <skillRef>`
- Claude Code: `npx killer-skills add <skillRef> --ide claude`
- Codex: `npx killer-skills add <skillRef> --ide codex`
- Cursor: `npx killer-skills add <skillRef> --ide cursor`

The modes use an accessible segmented control or tabs. Selecting a mode updates the visible command without moving the panel. Copy actions report the selected platform. Cursor and Windsurf URI deep links are removed from the primary decision path because a custom-scheme launch does not itself install the skill and does not cover the target platforms consistently.

The existing universal command remains the default. The component remains usable without JavaScript: the auto-detect command is server-rendered and copyable.

## Existing Route Copy

### Skills Directory

The English route should lead with:

- H1: `Reviewed AI Agent Skills Directory`
- Description: `Find and install reviewed skills for Claude Code, Codex, Cursor, and other compatible agents.`

The Chinese route should communicate the same promise naturally. Metadata should include reviewed/installable intent and the three primary platforms without using an unstable catalog count.

Remove public copy that says rankings, occupations, and categories resolve into the same filtering logic. Replace it with task-oriented comparison copy.

### Categories

The Categories index becomes a capability discovery page rather than a legacy-route explanation:

- H1: `AI Agent Skill Categories`
- Description: explain browsing by development, testing, data, design, security, automation, and related capabilities.
- Category cards link to the existing dedicated category routes, not query-parameter filters.

Remove all references to legacy URLs, old categories, migration behavior, and recommended alternatives to the page itself.

## Failure And Performance Boundaries

- Telemetry submission is never awaited by a public interaction.
- CLI telemetry uses a short timeout and catches every network error.
- Analytics queries fail to an empty map.
- Trending fails to Popular ordering.
- The event table is not joined into the core `skills` listing query.
- No middleware route needs analytics data.
- Crawlers do not generate interaction events.
- Existing cache and crawler-capsule behavior remains unchanged.

## Testing

### Unit And API Tests

- Event payload validation and allowlists.
- Crawler exclusion.
- D1 unavailable and D1 write-failure behavior.
- Daily actor HMAC stability within one day and change across days.
- Duplicate insertion behavior.
- Rate limiting.
- Trending score decay and tie-break behavior.
- Empty analytics fallback to Popular.
- Marketplace admission is still applied before Trending.
- CLI opt-out environment variables.
- CLI successful-install reporting and local-install exclusion.

### Public Surface Tests

- Skills and Categories titles, descriptions, H1s, and links.
- Absence of legacy/internal architecture phrasing.
- Four installation modes and exact commands.
- Auto-detect command remains available without client JavaScript.
- Copy controls expose event metadata.
- Privacy copy names telemetry and opt-out controls.

### End-To-End Checks

- Desktop and mobile install mode switching.
- Clipboard success still works when telemetry returns `204`, `429`, or fails.
- Trending renders with data and without data.
- No horizontal overflow at 390px and 1280px.
- Core public routes and a skill detail return `200` to human and crawler user agents.

## Deployment

1. Add and test the forward-only D1 migration.
2. Add `ANALYTICS_HASH_SALT` as a Cloudflare secret.
3. Apply the migration remotely before deploying code that writes events.
4. Deploy the website/Worker with fail-open event ingestion and empty-map reads.
5. Verify duplicate, crawler, invalid, and valid event behavior in production.
6. Publish a CLI patch release containing successful-install reporting.
7. Confirm a CLI installation appears in the seven-day query without exposing raw actor data.
8. Verify Trending, Popular, Latest, Skills, Categories, and a detail page.

The website may deploy before the CLI release because zero-event and missing-table paths are explicitly supported. The migration must still precede enabling public writes.

## Acceptance Criteria

1. Successful CLI installs and website install actions are stored and reported as separate metrics.
2. CLI telemetry can be disabled with either supported environment variable.
3. No raw IP, full user agent, local path, credential, or stable device identifier is stored.
4. Trending is driven primarily by recent successful CLI installs and falls back to Popular when empty.
5. Analytics failures cannot break installation, clipboard actions, rankings, or crawler responses.
6. Skill detail pages offer Auto-detect, Claude Code, Codex, and Cursor commands.
7. Skills and Categories pages communicate reviewed, installable, multi-platform value without internal migration copy.
8. No new bulk indexable routes or sitemap entries are created.
9. Daily GitHub skill harvesting remains enabled.
