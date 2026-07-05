-- Migration 003: allow lega-only historical seasons (1998/99–2020/21)
-- legavolley.it stats tables carry names + counting stats only: no positions,
-- bios, digs, or assists. Run in Supabase SQL editor before loading them.
-- Backward-compatible: existing rows keep their values; the app treats
-- NULL digs as "not tracked" (like assists), not 0.

ALTER TABLE players            ALTER COLUMN primary_position DROP NOT NULL;
ALTER TABLE players            ALTER COLUMN position_group   DROP NOT NULL;
ALTER TABLE player_season_stats ALTER COLUMN position_played DROP NOT NULL;
ALTER TABLE player_season_stats ALTER COLUMN digs            DROP NOT NULL;
ALTER TABLE player_season_stats ALTER COLUMN digs            DROP DEFAULT;