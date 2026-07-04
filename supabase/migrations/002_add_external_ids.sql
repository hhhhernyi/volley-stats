-- Migration 002: Add external IDs to players and clubs
-- Run in Supabase SQL editor before the first scrape.
-- Backward-compatible: existing rows get NULL; nothing breaks.

ALTER TABLE players ADD COLUMN IF NOT EXISTS volleyballworld_id INTEGER UNIQUE;
ALTER TABLE clubs   ADD COLUMN IF NOT EXISTS volleyballworld_id INTEGER UNIQUE;

CREATE INDEX IF NOT EXISTS idx_players_vwid ON players (volleyballworld_id);
CREATE INDEX IF NOT EXISTS idx_clubs_vwid   ON clubs   (volleyballworld_id);
