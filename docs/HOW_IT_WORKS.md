# How everything works — from scraping to pixels

End-to-end walkthrough of the data pipeline and the web app. Companion docs:
[DATA_SOURCES.md](DATA_SOURCES.md) (what's loaded), [SCRAPING_TODO.md](SCRAPING_TODO.md)
(what's next).

```
 legavolley.it          en.volleyballworld.com
      │                          │
      ▼  FETCH (npm run scrape:fetch)
 data/landing/…  ←  raw HTML/JSON cached on disk, never re-fetched once finished
      │
      ▼  PARSE (npm run scrape:parse)
 parsed.json per season  ←  clean per-player season totals + warnings
      │
      ▼  LOAD (npm run scrape:load)
 Supabase Postgres  ←  players / clubs / competitions / player_season_stats
      │                 (+ enrich-bios.ts backfills bios from legavolley profiles)
      ▼
 Next.js server components (getAppData)  →  full tables to the browser
      │
      ▼
 Client components: compare radars & stat table, all-stats leaderboard
 (all math — aggregation, rates, percentiles — happens client-side)
```

---

## 1. Scraping (fetch phase)

`scripts/scrape/run.ts` is the CLI; `npm run scrape` runs fetch → parse → load
for every season in `SEASONS` (`scripts/scrape/lib/constants.ts`) — the single
config that drives all three phases. Each entry has a `urlSlug` ('2016-2017',
also the landing-directory name), a `dbSeason` ('2016/17', the DB string), an
`isFinished` flag, and two special markers:

- **`isCurrent`** — volleyballworld serves the season in progress at
  season-less URLs (`…/superlega/teams/`) and only archives it under its slug
  once the next season starts. The URL builders omit the season segment for
  the current season.
- **`source: 'lega-only'`** — seasons before 2021/22, where volleyballworld
  has nothing (its SuperLega archive starts at 2021/22) and legavolley.it is
  the only source (its per-player archive starts at 1998/99).

`fetch.ts` downloads everything into the **landing layer**
(`data/landing/…`, gitignored) via `fetchAndCache` (`lib/http-client.ts`):
if the file exists on disk, the site is never contacted again. Finished
seasons therefore cost zero requests on re-runs. Requests are spaced 1.5 s
apart; legavolley 403s non-browser user agents, so those requests send a
browser UA string.

Per **hybrid** season it fetches: the vw teams list → each team's roster →
each player's stats page, one team's schedule page (to extract the tournament
number) → the live-matches JSON API (set scores per match), then the
legavolley side: a stats index page (to read the team-code dropdown) → one
stats table per team. Per **lega-only** season, only the legavolley part.

## 2. ETL — parse phase (transform)

`parse.ts` reads landing HTML and emits one `parsed.json` per season (plus
`parse-warnings.json`): an array of `ParsedPlayerSeason` records — player
identity/bio, team name, and season stat totals, all raw counts.

**Hybrid seasons** merge two sources per player:

1. `lib/html-parser.ts` parses each vw player page: bio fields and 7 per-match
   stat tables (scoring/attack/block/serve/reception/dig/set), summed into
   season totals. `sets_played` is derived by joining each match row's
   `data-match-no` against the live-matches API's set scores.
2. `applyLegavolleyOverlay` then overwrites everything the official site
   publishes (sets — exact, points, serve, attack, block, reception incl. a
   computed `rec_positive`) because vw's numbers are sometimes inflated.
   Players are matched to legavolley rows per team through three passes of
   name matching (exact sorted-token → token subset → unique shared token —
   legavolley lists names "Cognome Nome"). Only `digs`, `assists`, and bios
   remain vw-sourced; legavolley doesn't publish them.

**lega-only seasons** (`parseLegaOnlySeason`) build records straight from the
legavolley team tables (`lib/legavolley-parser.ts`, fixed 24-column layout;
1998/99's extra side-out-era `PUNTI CP` column is spliced out by row length).
Two-token names are flipped to "Nome Cognome"; 3+-token names keep source
order with a warning. Mid-season transfers (same athlete in two team tables)
are summed into one record. `digs`/`assists` are `null` ("not tracked" —
distinct from 0), and positions/bios start as null.

## 3. ETL — load phase

`load.ts` upserts `parsed.json` into Supabase (service-role key from
`.env.local`) in 100-row batches, keyed `(player_id, competition_id, season)` —
re-running any season is idempotent.

The interesting part is **identity resolution** (`lib/player-mapper.ts`),
which decides whether a scraped name is an existing row or a new one:

- `resolveClub`: external-ID lookup → normalized-name match → insert.
  `CLUB_NAME_OVERRIDES` folds sponsor-era names into one canonical club row
  ("Kioene Padova" → "Pallavolo Padova"); `LEGAVOLLEY_CLUB_OVERRIDES` maps
  legavolley's short dropdown labels ("Lube") to those canonical names.
- `resolvePlayer`: `volleyballworld_id` lookup → exact normalized name →
  **sorted-token name key** ("Anzani Simone" ≡ "Simone Anzani") → insert.
  The token pass is what links a player's lega-only-era rows to his vw-era
  row, so Zaytsev is one player from 2005/06 to 2025/26 with one bio.
  The full players list is paginated past PostgREST's 1000-row cap and
  cached in memory for the run.

**Bio backfill**: `enrich-bios.ts` (fetch/parse/load phases of its own) fixes
the lega-only bio gap. It discovers legavolley profile codes from the
per-season athlete dropdown on the `TipoStat=2.3` stats page, caches
`/player/<COG-NOM-YY>` pages, parses Ruolo/Nascita/Altezza/Naz.Sportiva, and
fills **null fields only** — vw data is never overwritten. It also backfills
null `position_played` on stat rows from the player's primary position.

## 4. The database

Schema (`supabase/migrations/`): `players`, `clubs`, `competitions`, and the
fact table `player_season_stats` — one row per (player, competition, season),
**raw counts only**. Rates are never stored; the core rule (spec §3) is:

> To combine rows, sum the raw numerators and denominators first, then
> divide — never average rates.

That's why a player's club + national-team rows (or any future multi-league
data) blend correctly volume-weighted. Nullability encodes "not tracked":
`digs`/`assists` null ≠ 0, and positions are nullable since migration 003.
`competitions.stat_system` exists to stop cross-system comparisons (NCAA
numbers must never sit in an FIVB cohort).

## 5. Feeding the web app

Each page (`src/app/compare/page.tsx`, `src/app/all-stats/page.tsx`) is an
async **server component** that calls `getAppData()` (`src/lib/data.ts`): it
fetches the four tables from Supabase — paginated in 1000-row pages because
PostgREST caps responses — and passes them as props to a client component.
While that fetch runs, `src/app/loading.tsx` (Next's `loading.js` convention)
shows the spinner.

There is deliberately **no per-interaction backend**: the client gets the full
pool once, and every subsequent player/season/filter change is pure in-browser
computation. The UI is also fully data-driven — season dropdowns, source
checkboxes, and club filters are derived from the loaded rows, so loading a
new season or competition requires zero UI changes.

## 6. The stats engine (`src/lib/stats.ts`)

Everything visual is computed from raw rows at render time:

- **`aggregateStats(rows, playerId, season, includeComps)`** — sums the raw
  counts of the player's rows for that season (filtered by the selected
  competitions, e.g. the compare page's source checkboxes), then derives
  every rate: attack efficiency = (kills − errors)/attempts, points/set,
  reception %, etc. Fields whose source never tracked them come back `null`
  and render as "—" rather than a misleading 0.
- **`computePercentile(value, field, positionGroup, season, …)`** — builds
  the cohort (every same-position-group player's club-league aggregate for
  that season), then ranks: "what share of peers have a lower value?"
  (inverted for lower-is-better stats like reception errors).
- **Performance**: rows are indexed by player once per dataset (WeakMap keyed
  on the array), and cohorts are cached per (group, season, competition
  pool) — without this, one selection change on the compare page cost ~85M
  row scans with 28 seasons loaded.

## 7. Compare page → radar chart

`CompareView` (client) holds the selections: two players, a season each, and
the competition-source checkboxes. For each side it calls `aggregateStats`;
the result feeds three displays:

- **BioCard** — bio fields plus headline numbers; age is computed from
  `birthday` against today's date.
- **RadarChart** (`Chart.js`) — the axes come from `RADAR_CONFIGS`
  (`src/lib/radar-config.ts`), chosen by the player's `position_group`
  (attacker/setter/libero get different axes). The shape is the **raw value
  on a fixed per-axis scale** (`toRadarScore(value / axis.max)`) — not the
  percentile — so a genuinely worse season draws a visibly smaller shape.
  Percentile appears only in the hover tooltip as context. Overlaying both
  players on one chart is offered only when their position groups match
  (same axes). Unknown-position players (a handful of pre-1998-bio holdouts)
  get no radar.
- **StatTable** — one row per stat in `STAT_GROUPS`, showing each player's
  value, the Δ, and each value's season percentile chip.

## 8. All-stats page — filtering and sorting

`AllStatsView` (client) builds the leaderboard entirely in one `useMemo`
chain, recomputed whenever any control changes:

1. **Row building** — for each player passing the position filter, and for
   each *selected* season that player actually played (a prebuilt
   player→seasons index skips the empty combinations), `aggregateStats`
   produces one leaderboard row. Multi-season selections mean one row per
   player-season, tagged with a season chip.
2. **Column set** — `LEAD_COLS_DEFAULT` normally; filtering to exactly
   Libero or Setter swaps in reception- or setting-oriented columns
   (`LEAD_COLS_LIBERO` / `LEAD_COLS_SETTER` in `radar-config.ts`).
3. **Club filter** — matches on the club's `short_name` via a prebuilt
   player-season→club index.
4. **Per-column stat filters** — each visible column has an operator+value
   input (`≥ 2.5` etc.). Percent columns are entered as displayed (50 = 50%)
   and scaled to the stored 0–1 value before comparing. Rows with `null` in
   a filtered column are excluded.
5. **Sorting** — click a header: numeric columns sort by the derived value
   (`null` sorts last via `-Infinity`), the name column alphabetically;
   clicking again flips direction.

Because every step works on the derived `AggregatedStats` objects, filters
and sorts are always consistent with what the cells display.

## 9. Adding data later (cheat sheet)

- **New SuperLega season**: add a `SEASONS` entry (mark it `isCurrent` until
  archived), flip the previous season to `isFinished`, run
  `npm run scrape -- --season <slug>`. New sponsor names may need
  `CLUB_NAME_OVERRIDES` / `CLUB_SHORT_NAMES` entries — parse/load warnings
  will tell you.
- **Bios for new historical players**: `npx tsx scripts/scrape/enrich-bios.ts`.
- **New competition**: see SCRAPING_TODO.md — the app side needs nothing
  beyond a `competitions` row; UI derives everything from data.
