# Data sources

What competition data is loaded into the database. Update this table whenever
a new competition or season is scraped/loaded. Planned competitions live in
[SCRAPING_TODO.md](SCRAPING_TODO.md).

| Competition | Type | Seasons | Sources | Loaded |
|---|---|---|---|---|
| SuperLega (Italy, men) | domestic_league | 2021/22 · 2022/23 · 2023/24 · 2024/25 | legavolley.it (authoritative) + volleyballworld.com | 2026-07-04 |

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
  have `digs = 0` (unknown).
- A few legavolley players who never appear on volleyballworld rosters are
  skipped entirely (no bio/identity to insert) — logged during parse.
- A few players have no position listed anywhere and are skipped at load
  (`position_played` is NOT NULL).
- `assist_touches`, `involvement`, and `sr_efficiency` are not available from
  either source and stay null.
