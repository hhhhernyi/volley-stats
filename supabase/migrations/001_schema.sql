-- VolleyStat schema — migration 001
-- Store RAW COUNTS; derive rates in the view and query layer.
-- See spec §3 for rationale.

-- ── Enums ──────────────────────────────────────────────────────────────────────

CREATE TYPE position_enum AS ENUM ('OH', 'OPP', 'MB', 'S', 'L');
CREATE TYPE position_group_enum AS ENUM ('attacker', 'setter', 'libero');
CREATE TYPE competition_type_enum AS ENUM ('domestic_league', 'national_team', 'continental_club');
CREATE TYPE stat_system_enum AS ENUM ('fivb', 'superlega', 'plusliga', 'ncaa');

-- ── players ────────────────────────────────────────────────────────────────────

CREATE TABLE players (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  nationality      TEXT NOT NULL,               -- ISO-ish code, e.g. 'JPN'
  primary_position position_enum NOT NULL,
  position_group   position_group_enum NOT NULL, -- derived from primary_position
  height_cm        INTEGER,
  weight_kg        INTEGER,
  birthday         DATE,
  image_url        TEXT                          -- null → UI shows initials avatar
);

-- ── clubs ──────────────────────────────────────────────────────────────────────

CREATE TABLE clubs (
  id          SERIAL PRIMARY KEY,
  short_name  TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  crest_url   TEXT,                             -- null → monogram badge
  brand_color TEXT                              -- hex, used for badge background
);

-- ── competitions ───────────────────────────────────────────────────────────────

CREATE TABLE competitions (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  competition_type competition_type_enum NOT NULL,
  -- CRITICAL: gates cross-system stat comparisons (NCAA ≠ FIVB)
  stat_system      stat_system_enum NOT NULL
);

-- ── player_season_stats (the fact table) ───────────────────────────────────────
-- One row per (player, competition, season).
-- ALL counts are raw tallies; rates are NEVER stored here.

CREATE TABLE player_season_stats (
  id               SERIAL PRIMARY KEY,
  player_id        INTEGER NOT NULL REFERENCES players(id),
  competition_id   INTEGER NOT NULL REFERENCES competitions(id),
  club_id          INTEGER REFERENCES clubs(id),   -- null for national-team rows
  season           TEXT NOT NULL,                   -- e.g. '2023/24'
  position_played  position_enum NOT NULL,

  -- Sample size — surfaced everywhere (see spec §3.1)
  sets_played      INTEGER NOT NULL CHECK (sets_played > 0),

  -- Attacking
  atk_attempts     INTEGER NOT NULL DEFAULT 0,
  atk_kills        INTEGER NOT NULL DEFAULT 0,
  atk_errors       INTEGER NOT NULL DEFAULT 0,
  total_points     INTEGER NOT NULL DEFAULT 0,

  -- Serve
  aces             INTEGER NOT NULL DEFAULT 0,
  serve_errors     INTEGER,                          -- optional; not all systems track

  -- Block
  blocks           INTEGER NOT NULL DEFAULT 0,

  -- Defense
  digs             INTEGER NOT NULL DEFAULT 0,

  -- Reception
  rec_attempts     INTEGER NOT NULL DEFAULT 0,
  rec_positive     INTEGER NOT NULL DEFAULT 0,
  rec_perfect      INTEGER NOT NULL DEFAULT 0,
  rec_errors       INTEGER NOT NULL DEFAULT 0,

  -- Setting (nullable for non-setters)
  assists          INTEGER,
  assist_touches   INTEGER,                          -- denominator for setting efficiency

  -- Libero involvement (already rates — stored as exception; see spec §3.1)
  involvement      NUMERIC(5,4),                     -- 0–1
  sr_efficiency    NUMERIC(5,4),                     -- 0–1

  UNIQUE (player_id, competition_id, season)
);

-- Indexes for common query patterns
CREATE INDEX idx_pss_player   ON player_season_stats (player_id);
CREATE INDEX idx_pss_season   ON player_season_stats (season);
CREATE INDEX idx_pss_club     ON player_season_stats (club_id);

-- ── player_season_derived (view) ───────────────────────────────────────────────
-- Computes all derived rates from raw counts.
-- For combining multiple rows (e.g. club + NT), sum the raw counts in your
-- query FIRST, then apply these formulas — do NOT average the derived columns.

CREATE VIEW player_season_derived AS
SELECT
  pss.*,

  -- Attacking
  CASE WHEN atk_attempts > 0
       THEN (atk_kills::NUMERIC - atk_errors) / atk_attempts END AS attack_efficiency,
  CASE WHEN atk_attempts > 0
       THEN atk_kills::NUMERIC / atk_attempts END                  AS kill_pct,

  -- Per-set scoring
  CASE WHEN sets_played > 0
       THEN total_points::NUMERIC / sets_played END                AS points_per_set,
  CASE WHEN sets_played > 0
       THEN blocks::NUMERIC / sets_played END                      AS blocks_per_set,
  CASE WHEN sets_played > 0
       THEN aces::NUMERIC / sets_played END                        AS aces_per_set,
  CASE WHEN sets_played > 0
       THEN digs::NUMERIC / sets_played END                        AS digs_per_set,

  -- Reception
  CASE WHEN rec_attempts > 0
       THEN rec_positive::NUMERIC / rec_attempts END               AS reception_positive_pct,
  CASE WHEN rec_attempts > 0
       THEN rec_perfect::NUMERIC / rec_attempts END                AS reception_perfect_pct,
  CASE WHEN sets_played > 0
       THEN rec_errors::NUMERIC / sets_played END                  AS reception_errors_per_set,

  -- Setting
  CASE WHEN sets_played > 0 AND assists > 0
       THEN assists::NUMERIC / sets_played END                     AS assists_per_set,
  CASE WHEN assist_touches > 0
       THEN assists::NUMERIC / assist_touches END                  AS setting_efficiency

FROM player_season_stats pss;
