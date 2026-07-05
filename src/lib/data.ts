/**
 * data.ts — server-side Supabase reads for the app pages.
 *
 * Fetches whole tables: the client components need the full stats pool for
 * aggregation and percentile cohorts. Every table is paged — players and
 * stats both exceed PostgREST's 1000-row max-rows cap (28 seasons loaded).
 */

import { createClient } from '@/lib/supabase/server'
import type { Player, Club, Competition, PlayerSeasonStats } from './types'

const PAGE_SIZE = 1000

/** Fetch a whole table in pages — PostgREST caps responses at max-rows (1000) */
async function fetchAllPaged<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  orderBy: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    // secondary id sort keeps page boundaries stable when orderBy has ties
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to load ${table}: ${error.message}`)
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

export interface AppData {
  players: Player[]
  clubs: Club[]
  competitions: Competition[]
  allStats: PlayerSeasonStats[]
}

export async function getAppData(): Promise<AppData> {
  const supabase = await createClient()

  const [players, clubs, competitions, allStats] = await Promise.all([
    fetchAllPaged<Player>(supabase, 'players', 'name'),
    fetchAllPaged<Club>(supabase, 'clubs', 'short_name'),
    fetchAllPaged<Competition>(supabase, 'competitions', 'id'),
    fetchAllPaged<PlayerSeasonStats>(supabase, 'player_season_stats', 'id'),
  ])

  return { players, clubs, competitions, allStats }
}
