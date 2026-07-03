# VolleyStat — Project Specification

> **Handoff brief for Claude Code.** This document is the source of truth for building a volleyball player statistics comparison dashboard. An accompanying HTML file (`volleydash-demo.html`) is a working, throwaway prototype of the intended UI and behavior — treat it as a **visual and interaction reference**, not as production code to copy. All data in the demo is fabricated.

---

## 1. What we're building

A web dashboard for comparing volleyball players' statistics across seasons and positions. Two core pages:

1. **Compare** — select 2 players (each with a chosen season) and view their stats side by side in a table plus position-specific radar charts. Supports comparing two different players, or the same player across two seasons to gauge improvement.
2. **All stats** — a filterable, sortable leaderboard of the full player pool for a given season.

**Primary user:** the project owner — a volleyball fan and stats enthusiast. This is a personal portfolio + personal-analysis project, not a commercial public product. It does not need auth, multi-user support, or monetization.

**Explicit non-goals (out of scope for v1):**
- Per-match or per-set granularity (season aggregates only).
- Career trend line charts (nice future addition; schema should not preclude it, but do not build it).
- User accounts / authentication.
- Real club logos or player photos (use placeholders; see §7).

---

## 2. Tech stack

Build with this stack unless there is a concrete reason to deviate (flag it if so):

- **Framework:** Next.js (App Router), TypeScript.
- **Database:** Supabase (Postgres). Use the Supabase JS client. Prefer server components / server actions for data fetching where sensible.
- **Data fetching/caching (client):** TanStack Query.
- **Charts:** Chart.js (radar type) via `react-chartjs-2`, **or** Recharts — either is acceptable; Chart.js is what the prototype uses and handles the translucent overlay cleanly. Pick one and be consistent.
- **UI/styling:** Tailwind CSS + shadcn/ui.
- **Deployment target:** Vercel (frontend) + Supabase (managed Postgres). Do not hardcode secrets; use env vars.

**Scaffold expectation:** initialize the Next.js app, wire up Supabase client, set up Tailwind + shadcn, create the DB schema (SQL migration), seed it with mock data derived from the prototype so the UI is runnable end-to-end **before** any real scraping exists.

---

## 3. The data model (most important section)

The single most important design decision: **store raw counts (tallies), not derived percentages.** Rates, efficiencies, and per-set numbers are computed at query/display time from summed counts. This is what makes combining club + national-team stats mathematically correct (a volume-weighted blend, never a naive mean of percentages).

### 3.1 Tables

**`players`** — one row per player (bio / identity).
- `id` (pk)
- `name`
- `nationality` (ISO-ish country code, e.g. `JPN`)
- `primary_position` — enum: `OH` (outside), `OPP` (opposite), `MB` (middle blocker), `S` (setter), `L` (libero)
- `position_group` — enum: `attacker` | `setter` | `libero`. Derived from position (OH/OPP/MB → attacker). Drives which radar applies.
- `height_cm` (int, nullable)
- `weight_kg` (int, nullable)
- `birthday` (date, nullable)
- `image_url` (text, nullable) — for future player photos; default null → UI shows initials avatar.

**`clubs`** — one row per club.
- `id` (pk)
- `short_name` (e.g. `Milano`)
- `full_name` (e.g. `Allianz Powervolley Milano`)
- `crest_url` (text, nullable) — future real logo; default null → UI shows monogram badge.
- `brand_color` (text, nullable) — hex, used for the monogram badge background.

**`competitions`** — one row per competition (a league or a tournament).
- `id` (pk)
- `name` (e.g. `SuperLega`, `Olympics 2024`, `VNL 2023`)
- `competition_type` — enum: `domestic_league` | `national_team` | `continental_club`. **First-class dimension.** Used to group and to gate nonsensical comparisons (e.g. a 6-match Olympics vs a 100-set league season).
- `stat_system` — enum: `fivb` | `superlega` | `plusliga` | `ncaa` | ... . **Critical for future expansion.** Different systems (esp. NCAA) track incompatible stats; never silently compare across systems. For v1 (SuperLega only) this is `superlega`, but the column must exist from day one.

**`player_season_stats`** — the fact table. **One row per (player, competition, season).** Holds RAW COUNTS.
- `id` (pk)
- `player_id` (fk → players)
- `competition_id` (fk → competitions)
- `club_id` (fk → clubs, nullable — null for national-team rows)
- `season` (text, e.g. `2023/24`)
- `position_played` — enum like primary_position (a player *can* play a different position in a given competition; usually equals primary_position)
- `sets_played` (int) — **sample size. Store and surface this everywhere.**
- **Attacking counts:** `atk_attempts`, `atk_kills`, `atk_errors`
- **Scoring:** `total_points`
- **Serve:** `aces`, `serve_errors` (optional)
- **Block:** `blocks`
- **Defense:** `digs`
- **Reception counts:** `rec_attempts`, `rec_positive`, `rec_perfect`, `rec_errors`
- **Setting (setters):** `assists`, `assist_touches` (denominator for setting efficiency), nullable for non-setters
- **Libero involvement (optional, libero only):** `involvement` (0–1), `sr_efficiency` (0–1) — these are already rates; if raw counts aren't available for them, storing the rate is an acceptable exception (document it).

> Unique constraint on `(player_id, competition_id, season)`.

### 3.2 Derived rates (compute in a SQL view or query layer, from summed counts)

Given a set of fact rows (filtered by chosen sources — see §4.2), **sum the counts first, then derive:**

- `attack_efficiency = (atk_kills − atk_errors) / atk_attempts`
- `kill_pct = atk_kills / atk_attempts`
- `points_per_set = total_points / sets_played`
- `blocks_per_set = blocks / sets_played`
- `aces_per_set = aces / sets_played`
- `digs_per_set = digs / sets_played`
- `reception_positive_pct = rec_positive / rec_attempts`
- `reception_perfect_pct = rec_perfect / rec_attempts`
- `reception_errors_per_set = rec_errors / sets_played`
- `assists_per_set = assists / sets_played`
- `setting_efficiency = assists / assist_touches`

**Never average two percentages.** To combine club + NT, sum their raw counts and re-derive. A materialized view `player_season_derived` (partitioned by player/competition/season) is a reasonable implementation; combining across competitions happens at query time based on user selection.

### 3.3 Percentiles (context, not the source of truth)

Percentiles rank a player against **same-position-group peers within the same season**, using the club-league pool as the stable cohort. Compute per-field:
- For normal stats: `pct = share of peers with a lower value`.
- For **lower-is-better stats** (e.g. `reception_errors_per_set`): **invert** — fewer errors → higher percentile. Getting this wrong rewards the worst passer; watch for it.

Percentile is **contextual annotation** shown as a second number (in the table, and on radar hover). It is **not** what drives the radar shape (see §5). Rationale below in §6.

---

## 4. Compare page — behavior

### 4.1 Selection
- Two player slots. Each slot: optional position filter + optional club filter to narrow the dropdown, then a player dropdown, then a **season dropdown** (populated with seasons that player has data for).
- Default the page to a meaningful example (e.g. same player, earliest vs latest season) so it's never empty.

### 4.2 Club / country source checkboxes
- Two independent checkboxes: **Club** (league) and **Country** (national-team competitions).
- Both ticked → combined (volume-weighted from summed counts).
- One ticked → that source only.
- Neither ticked → treat as "all" and show a hint to pick at least one (never render empty).
- Always display **sets_played** for each player given the current source selection (sample-size transparency).

### 4.3 Info board (per player)
Small bio card showing: initials avatar (or `image_url` if present), name, position label, height, weight, birthday, computed age, club (full name + monogram crest / `crest_url`), and country (flag + name, with the specific national-team event for that season if one exists).

### 4.4 Stat table
- Grouped rows (Attacking / Serve & block / Reception & defense / Setting).
- Columns: one per player-season.
- Each cell: **raw value + percentile pill**. Percentile pill color-coded by tier.
- Stats a position doesn't have → render `—` (em dash), never `0`. (A libero has no attack efficiency; showing 0 is misleading.)
- **Self-comparison mode** (same player, two seasons): add a **Δ** on the later season's cell showing raw change, colored green (improvement) / red (decline), with lower-is-better stats inverted.

### 4.5 Overlay gating
- Each player always gets their own radar shown.
- If both players share a `position_group`, enable an **"Overlay on one chart"** toggle that renders both shapes on a single radar.
- If position groups differ, **disable** the toggle with an explanatory note (their axes differ; overlaying would compare unlike things).

---

## 5. Radar charts — the rules

Three position-group radars, each with 6 axes. **Axes differ per group** — this is intentional and is why cross-group overlay is disabled.

**The shape is driven by the RAW value mapped onto a FIXED per-axis scale (0 → axis max → 0–100).** Not by percentile. This ensures a genuinely worse season produces a visibly smaller shape (see §6). On **hover**, show the raw value AND that season's percentile as a second number.

Handle **lower-is-better** axes (e.g. libero reception errors) by inverting when mapping to the 0–100 shape.

### Attacker radar (OH / OPP / MB)
`Attack efficiency` · `Kill %` · `Blocks/set` · `Aces/set` · `Reception+ %` · `Points/set`

### Setter radar
`Assists/set` · `Setting efficiency` · `Digs/set` · `Blocks/set` · `Aces/set` · `Reception+ %`

### Libero radar
`Reception+ %` · `Reception perfect %` · `Digs/set` · `Few errors (inverted)` · `Involvement` · `SR efficiency`

Per-axis fixed maxima should be sensible historical ceilings (see the `RADARS` object in the prototype for concrete starting values — e.g. attack efficiency maps on 0–65%, points/set on 0–6). These can be tuned later; keep them in one config object.

---

## 6. Why raw-shape + percentile-annotation (design rationale)

Do not "simplify" this away — it's a deliberate correctness decision.

Percentile measures **relative standing**; raw/rate stats measure **actual performance**. They can move in opposite directions. Example: a player scores 30 goals and finishes 2nd (someone scored 31); next season scores 20 but finishes 1st (the field weakened). Rank improved; performance declined. If the radar were percentile-driven, the shape would *grow* while the player got *worse* — a lie. So:
- **Raw value (on a fixed scale) drives the radar shape** → honest "did they improve".
- **Percentile rides along as a second number** → honest "how did they rank that season".
- The stat table shows both, plus a raw **Δ** in self-comparison mode.

Efficiency/percentage stats (attack eff, kill %, reception %) are already self-normalizing (50% is 50% in any season), so they go on the radar at natural scale for free. Only counting stats (points/set, blocks/set…) need the fixed-scale mapping.

---

## 7. Assets & legal notes

- **Player photos:** don't scrape. `image_url` defaults null → initials avatar. Real photos added manually later for marquee players only.
- **Club logos:** trademarked. Use monogram badges (colored square with initials from `brand_color`) as placeholder. `crest_url` reserved for future manual population.
- **Country flags:** public domain — fine to use freely (unicode flag emoji is acceptable for v1).

---

## 8. All-stats page — behavior

- Filters: season, position, club, nationality.
- Sortable by any stat column (click header toggles asc/desc).
- **Position-adaptive columns:** default columns are attack-oriented; when filtered to **Libero**, swap to reception/digs columns; when filtered to **Setter**, show assists/setting-efficiency columns. Driven by `position_group`.
- Show a result count and the active season.
- Uses club-league stats for the pool (national-team merging is a Compare-page concern).

---

## 9. Theming

- Light/dark mode toggle in the header, persisted for the session (in-memory is fine; do not use localStorage in a way that breaks SSR — a cookie or a simple client provider is acceptable).
- Full light palette, not just an inversion. See the prototype's two `:root[data-theme=...]` blocks for concrete color values.
- **Chart.js caveat:** Chart.js cannot read CSS variables. Grid/label/text colors must be passed explicitly and the charts re-rendered on theme change. The prototype does this — replicate it.

---

## 10. Data sourcing (context for later; NOT part of scaffold)

Real data will come from web scraping, added league by league. **This is a separate phase — do not build scrapers during scaffold.** Seed with mock data instead. Context so the schema is built right:

- **Phase 0 (first real data):** SuperLega (Italian league). Investigation pending: check whether the Lega Volley stats site exposes a hidden JSON API (browser DevTools → Network → Fetch/XHR) or requires HTML parsing. Scraper design depends on this.
- **ETL pattern to follow later:** scrape → save **raw response to disk (landing layer)** → parse into clean rows → load into `player_season_stats`. Separate fetching from parsing. Be polite (User-Agent, rate-limit, cache finished seasons).
- **Future sources & the catch:** PlusLiga (Poland, cleanest), FIVB (VNL/Olympics/Worlds — same stat family, so `stat_system=fivb` is comparable to European leagues), Turkish league, Japan SV.League (likely needs a headless browser like Playwright), and **NCAA last, fenced off** (different `stat_system` — kills/hitting% not directly comparable to FIVB attack efficiency; never silently compare).
- National-team sample sizes are much smaller than league seasons — this is exactly why `sets_played` is surfaced everywhere and why combining uses weighted counts.

---

## 11. Suggested build order for scaffold

1. Next.js + TypeScript + Tailwind + shadcn init; Supabase client wired via env vars.
2. SQL migration for the schema in §3 (tables + enums + constraints + a derived view).
3. A **seed script** that inserts mock data (port the players, clubs, competitions, and fabricated season rows from the prototype's data objects — enough to exercise all positions, multiple seasons, and at least two players with national-team rows so the club/country checkboxes are demonstrable).
4. **All-stats page** first (simplest; proves the data layer and derived rates).
5. **Compare page**: selection → info board → source checkboxes (weighted combine) → stat table (raw + percentile + Δ) → position radars → overlay gating.
6. Light/dark theme.
7. Polish: loading states, empty/error states, responsive layout (prototype is responsive at ~760px breakpoints).

Deliver a runnable app on mock data. Scrapers come afterward as a separate task.

---

## 12. Reference file

`volleydash-demo.html` accompanies this spec. It is a single-file prototype containing the exact intended layout, the mock data shapes, the `RADARS` axis config with fixed maxima, the weighted-aggregate logic (`aggregate()` function), the percentile logic (`pctRank()`), and the theme color values. **Use it as the reference for UI and for the math; do not ship it.** Reimplement its logic cleanly in the Next.js/TypeScript codebase.
