# Data sources

What competition data is loaded into the database. Update this table whenever
a new competition or season is scraped/loaded.

| Competition | Type | Seasons | Rows | Source | Loaded |
|---|---|---|---|---|---|
| SuperLega (Italy, men) | domestic_league | 2021/22 · 2022/23 · 2023/24 · 2024/25 | 684 | volleyballworld.com via `scripts/scrape/` | 2026-07-04 |

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

## Known data limitations (SuperLega / volleyballworld.com)

- **`sets_played` is approximate** — sum of sets in matches where the player
  recorded at least one stat; assumes full-match participation (the site has
  no per-set data).
- **`rec_positive` is always 0** — the site publishes only perfect
  ("successful") receptions, so positive-reception % is not meaningful.
- **8 players in 2023/24 skipped** — no position listed anywhere on the site
  (all fringe players with negligible stats).
- `serve_errors` and `assists` are populated; `assist_touches`,
  `involvement`, and `sr_efficiency` are not available and stay null.
