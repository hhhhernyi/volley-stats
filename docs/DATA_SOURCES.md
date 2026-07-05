# Data sources

What competition data is loaded into the database. Update this table whenever
a new competition or season is scraped/loaded. Planned competitions live in
[SCRAPING_TODO.md](SCRAPING_TODO.md).

**Coverage: SuperLega (Italy, men) — every season from 1998/99 through
2025/26, 28 in total.** That is the full extent of per-player data published
online: legavolley's archive starts at 1998/99 (rally-scoring era) and
volleyballworld starts at 2021/22.

| Competition | Type | Seasons | Sources | Loaded |
|---|---|---|---|---|
| SuperLega (Italy, men) | domestic_league | 2021/22 – 2025/26 (hybrid, 5 seasons) | legavolley.it (authoritative) + volleyballworld.com | 2026-07-05 |
| SuperLega (Italy, men) | domestic_league | 1998/99 – 2020/21 (lega-only, 23 seasons) | legavolley.it only (bios via player profiles) | 2026-07-05 |

## Two season classes

- **Hybrid (2021/22 onward)** — volleyballworld + legavolley overlay, described
  below. volleyballworld has no SuperLega before 2021/22 (verified: the
  2020-2021 season URL 404s), so this class cannot extend further back.
- **lega-only (1998/99 – 2020/21)** — built from legavolley.it stats tables
  alone (`source: 'lega-only'` in `SEASONS`). Names + counting stats; **no
  digs or assists** (null). `sets_played` is exact and `rec_positive` is real
  (Tot − Err − Neg). legavolley has no per-player data before 1998/99. The
  1998/99 table has an extra side-out-era `PUNTI CP` column, handled by row
  length in `legavolley-parser.ts`.
  **Bios (position, birthday, height, nationality) are backfilled** by
  `scripts/scrape/enrich-bios.ts` from legavolley player profile pages
  (`/player/<COG-NOM-YY>`), discovered via the per-season athlete dropdown on
  the `TipoStat=2.3` stats page. Fills null fields only; ~94% matched
  (2026-07-05: nulls 1,138 → 65 — the residue is dropdown/stats-table name
  mismatches, typically extra middle names).
  Players spanning both eras are linked by order-insensitive name matching
  (legavolley lists "Cognome Nome") and keep their vw-era bio; lega-only-era
  players get name-only rows (two-token names flipped to "Nome Cognome";
  3+-token names kept in source order and warned).

## Hybrid source model

Stats come from two sites, merged per player-season in the parse phase:

- **legavolley.it (official)** — authoritative for everything it publishes:
  `sets_played` (real, not approximated), `total_points`, `aces`,
  `serve_errors`, `atk_attempts`/`atk_errors`/`atk_kills`, `blocks`,
  `rec_attempts`/`rec_errors`/`rec_perfect`, and `rec_positive`
  (computed as reception **Tot − Err − Neg**, i.e. positive-or-better).
  Fetched per team per season (`TipoStat=1.1`, `Fase=3` = regular season +
  playoffs, browser user-agent required).
- **volleyballworld.com** — supplies what the official site doesn't publish:
  `digs` and `assists`, plus player bio (position, nationality, height,
  birthday), stable cross-season identity (`volleyballworld_id`), and rosters.

Players are matched between the two sites by normalized name within the same
team (legavolley lists "Surname Firstname"); the parse phase logs a per-season
match rate and per-player warnings for anything unmatched.

## How data gets in

The only pipeline that writes stats is the scraper:

```
npm run scrape                 # fetch + parse + load, all configured seasons
npm run scrape:fetch|parse|load  -- --season 2024-2025   # one phase / season
```

Seasons are configured in `scripts/scrape/lib/constants.ts` (`SEASONS`).
The load phase upserts by `(player_id, competition_id, season)`, so re-running
is safe. Clubs and players are matched across seasons by `volleyballworld_id`
with a normalized-name fallback.

The app reads whatever is in the database — competitions, seasons, and the
source checkboxes on the Compare page are all derived from the loaded rows,
so adding a new competition requires no UI changes.

## Known data limitations

- **Unmatched players fall back to volleyballworld numbers** (approximated
  sets, no positive reception) — see `parse-warnings.json` per season; a
  handful per season.
- **`digs` and `assists` are volleyballworld-sourced** (official site doesn't
  publish them). Players recovered from legavolley alone (no vw stats rows)
  have `digs = 0` (unknown). In lega-only seasons `digs` is NULL ("not
  tracked", surfaced as — in the app), never 0.
- A few legavolley players who never appear on volleyballworld rosters are
  skipped entirely (no bio/identity to insert) — logged during parse
  (hybrid seasons only; lega-only seasons load everyone with sets > 0).
- In hybrid seasons a few players have no position listed anywhere and are
  skipped at load; lega-only rows load with `position_played = NULL`
  (migration 003) and are excluded from position-filtered views/percentiles.
- **Name-based identity has limits**: two different players with identical
  normalized names collapse into one `players` row, and mid-season transfers
  in lega-only seasons are summed into one row under the club with more sets.
- Current-season volleyballworld URLs are season-less (`isCurrent` in
  `SEASONS`); a season is archived under its `/2025-2026/`-style slug only
  after the next one starts.
- `assist_touches`, `involvement`, and `sr_efficiency` are not available from
  either source and stay null.
