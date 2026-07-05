# VolleyStat

Volleyball player statistics dashboard — 28 seasons of Italian SuperLega
(1998/99–2025/26, 5,000+ player-seasons) scraped from official league
sources, with player comparison radars and a filterable leaderboard.

**How it all fits together:** [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) ·
**What's loaded:** [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) ·
**Roadmap:** [docs/SCRAPING_TODO.md](docs/SCRAPING_TODO.md)

## Stack

- **Next.js 16** (App Router, React server components) + **TypeScript**
- **Supabase (PostgreSQL)** — raw-counts data model; all rates derived at read time
- **Chart.js** via `react-chartjs-2` — position-specific radar charts
- **Tailwind CSS v4** + Base UI / shadcn-style components — themed light/dark UI
- **Node.js ETL scraper** (`tsx` + `cheerio`) — fetch → parse → load pipeline
  against legavolley.it (official stats) and volleyballworld.com (bios, digs/assists)
- **Vercel** deploy target

## Pages

- `/compare` — pick 2 players × seasons: bio cards, stat table with season
  percentiles, position radars (fixed-scale shapes, percentile on hover),
  overlay toggle, club/NT source selector
- `/all-stats` — sortable leaderboard, one row per player-season; filters for
  season/position/club plus per-column numeric filters; columns adapt to the
  selected position group

## Setup

```bash
# 1. Install deps
npm install

# 2. Configure Supabase
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and (for the scraper) SUPABASE_SERVICE_ROLE_KEY

# 3. Run migrations in the Supabase SQL editor, in order:
#    supabase/migrations/001_schema.sql
#    supabase/migrations/002_add_external_ids.sql
#    supabase/migrations/003_lega_only_seasons.sql

# 4. Scrape + load real data (seasons configured in scripts/scrape/lib/constants.ts)
npm run scrape                 # fetch → parse → load, all seasons
npx tsx scripts/scrape/enrich-bios.ts   # backfill historical player bios

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI is fully
data-driven — seasons, competitions, and filters all derive from whatever is
in the database.
