/**
 * Seed script — inserts mock data from seed-data.ts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   (service role key bypasses RLS for seeding)
 *
 * Safe to re-run: upserts by primary key, won't duplicate rows.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  PLAYERS,
  CLUBS,
  COMPETITIONS,
  getAllSeasonStats,
} from '../src/lib/seed-data'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    '❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
  )
  process.exit(1)
}

const supabase = createClient(url, key)

async function upsert<T extends object>(table: string, rows: T[]) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`[${table}] ${error.message}`)
  console.log(`  ✓ ${table}: ${rows.length} rows`)
}

async function main() {
  console.log('🌱  Seeding VolleyStat mock data…\n')

  await upsert('players', PLAYERS)
  await upsert('clubs', CLUBS)
  await upsert('competitions', COMPETITIONS)

  const stats = getAllSeasonStats()
  // Seed in batches to avoid request size limits
  const BATCH = 100
  for (let i = 0; i < stats.length; i += BATCH) {
    const batch = stats.slice(i, i + BATCH)
    const { error } = await supabase
      .from('player_season_stats')
      .upsert(batch, { onConflict: 'player_id,competition_id,season' })
    if (error) throw new Error(`[player_season_stats batch ${i}] ${error.message}`)
  }
  console.log(`  ✓ player_season_stats: ${stats.length} rows`)

  console.log('\n✅  Seed complete.')
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
