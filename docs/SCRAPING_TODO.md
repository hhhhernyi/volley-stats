# Scraping roadmap

Competitions to add, in priority order. See `docs/DATA_SOURCES.md` for what's
already loaded (SuperLega men, all 28 seasons 1998/99–2025/26) and how the
current pipeline works. Check items off and move them into DATA_SOURCES.md as
they land.

## Priority list

| # | Competition | Status | Likely source(s) |
|---|---|---|---|
| 1 | SV.League men (Japan) | todo | svleague.jp (official); volleyballworld covered V.League in some seasons |
| 2 | PlusLiga men (Poland) | todo | plusliga.pl (official, rich per-player stats) |
| 3 | Efeler Ligi men (Turkey) | todo | tvf.org.tr (official); club sites vary |
| 4 | VNL men + women | todo | en.volleyballworld.com — same page family as SuperLega scraper |
| 5 | World Championship men + women | todo | en.volleyballworld.com — same page family |
| 6 | Olympics men + women | todo | volleyballworld / olympics.com |
| 7 | NCAA men (USA) | todo | stats.ncaa.org |
| 8 | SV.League women (Japan) | todo | svleague.jp |
| 9 | LOVB / PVF women (USA) | todo | league sites (landscape still shifting) |

## Notes per competition

- **volleyballworld competitions (4, 5, 6)** are the cheapest wins: the
  existing `scripts/scrape/` fetch/parse code targets volleyballworld's
  `vbw-*` markup and live-matches API, so VNL/Worlds/possibly Olympics
  should mostly be a matter of new `SEASONS`-style config (different
  competition slug + tournament numbers) plus a `competitions` row per event
  (they are `national_team` type — the compare page's source checkboxes
  already handle new competitions automatically).
- **PlusLiga (2)**: official site publishes detailed per-player season stats
  (server-rendered); `stat_system: 'plusliga'` already exists in the enum.
- **SV.League (1, 8)**: new site to reverse-engineer; check whether stats are
  server-rendered or behind an API. Japanese-language headers.
- **Efeler Ligi (3)**: TVF site structure unknown; may have the weakest
  published stats of the list.
- **NCAA (7)**: `stat_system: 'ncaa'` exists in the enum. Remember the spec
  rule: NCAA stats must never be compared cross-system with FIVB-system
  numbers (competitions.stat_system gates this).

## Schema / app prerequisites to sort out before or while adding these

- **Gender**: nothing in the schema distinguishes men's from women's
  competitions. Add a `gender` column to `competitions` (or encode it in the
  name, e.g. "VNL 2025 (W)") and decide how the UI separates the pools —
  probably a top-level filter so leaderboards/percentiles never mix genders.
- **stat_system enum** currently has `('fivb','superlega','plusliga','ncaa')`.
  Japanese and Turkish leagues need either new enum values (migration) or a
  documented decision to file them under an existing system.
- **Player identity across sources**: the current pipeline keys players on
  `volleyballworld_id` with name fallback. Non-volleyballworld leagues (SV,
  PlusLiga, Turkey, NCAA) need their own external-id columns or a generic
  `player_external_ids` table to keep re-scrapes idempotent.
- **Percentile cohorts**: `computePercentile` pools all domestic-league rows
  for a season. With multiple leagues loaded, cohorts should probably be
  per-competition (and per-gender) — revisit `src/lib/stats.ts` when league
  #2 lands.
- **Seasons format**: national-team events are calendar-year ('2025'), not
  split-year ('2024/25') — the season strings and their sorting already
  handle plain strings, but the compare-page season pickers assume every
  player-season pairs with one string; verify nothing assumes the `YYYY/YY`
  shape.
