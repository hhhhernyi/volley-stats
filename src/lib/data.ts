/**
 * data.ts — server-side Supabase reads for the app pages.
 *
 * Fetches whole tables: the dataset is small (hundreds of rows) and the
 * client components need the full stats pool anyway for aggregation and
 * percentile cohorts. Stats are paged to stay under PostgREST's max-rows
 * cap as more competitions/seasons are added.
 */

import { createClient } from '@/lib/supabase/server'
import type { Player, Club, Competition, PlayerSeasonStats } from './types'

const STATS_PAGE_SIZE = 1000

export interface AppData {
  players: Player[]
  clubs: Club[]
  competitions: Competition[]
  allStats: PlayerSeasonStats[]
}

export async function getAppData(): Promise<AppData> {
  const supabase = await createClient()

  const [playersRes, clubsRes, competitionsRes] = await Promise.all([
    supabase.from('players').select('*').order('name'),
    supabase.from('clubs').select('*').order('short_name'),
    supabase.from('competitions').select('*').order('id'),
  ])

  for (const [name, res] of [
    ['players', playersRes],
    ['clubs', clubsRes],
    ['competitions', competitionsRes],
  ] as const) {
    if (res.error) throw new Error(`Failed to load ${name}: ${res.error.message}`)
  }

  const allStats: PlayerSeasonStats[] = []
  for (let from = 0; ; from += STATS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('player_season_stats')
      .select('*')
      .order('id')
      .range(from, from + STATS_PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to load player_season_stats: ${error.message}`)
    allStats.push(...(data as PlayerSeasonStats[]))
    if (data.length < STATS_PAGE_SIZE) break
  }

  return {
    players: playersRes.data as Player[],
    clubs: clubsRes.data as Club[],
    competitions: competitionsRes.data as Competition[],
    allStats,
  }
}
