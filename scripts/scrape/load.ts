/**
 * load.ts — Phase 3: upsert parsed.json data into Supabase.
 *
 * Uses service role key (bypasses RLS) via SUPABASE_SERVICE_ROLE_KEY.
 * Upserts in 100-row batches ON CONFLICT (player_id, competition_id, season).
 * Real data overwrites any existing mock rows automatically.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: ['.env.local', '.env'] })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  SEASONS, COMPETITION_ID,
  parsedJsonPath,
  type SeasonConfig,
} from './lib/constants.js'
import { readJson } from './lib/http-client.js'
import { resolveClub, resolvePlayer, type ScrapedClubInfo } from './lib/player-mapper.js'
import type { ParsedPlayerSeason } from './lib/types.js'

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
      'SUPABASE_SERVICE_ROLE_KEY are set in .env.local',
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Competition row (FK target) — must exist before stats upsert
// ---------------------------------------------------------------------------

async function ensureCompetition(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('competitions')
    .upsert(
      { id: COMPETITION_ID, name: 'SuperLega', competition_type: 'domestic_league', stat_system: 'superlega' },
      { onConflict: 'id' },
    )
  if (error) {
    throw new Error(`Failed to ensure competition row: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Batch upsert
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100

async function upsertBatch(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('player_season_stats')
      .upsert(batch, { onConflict: 'player_id,competition_id,season' })

    if (error) {
      throw new Error(`Upsert batch failed: ${error.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Load one season
// ---------------------------------------------------------------------------

export async function loadSeason(
  supabase: SupabaseClient,
  season: SeasonConfig,
  dryRun: boolean,
): Promise<void> {
  const { urlSlug, dbSeason } = season
  const legaOnly = season.source === 'lega-only'
  console.log(`\n── Loading ${urlSlug}${legaOnly ? ' (lega-only)' : ''} ──`)

  const parsed = await readJson<ParsedPlayerSeason[]>(parsedJsonPath(urlSlug))
  console.log(`  ${parsed.length} players to load`)

  if (parsed.length === 0) {
    console.log('  Nothing to load — run parse phase first')
    return
  }

  // Pre-resolve clubs (deduplicate by team name — lega-only teams have no vw id)
  const clubMap = new Map<string, number>()  // teamName → db id

  for (const entry of parsed) {
    if (clubMap.has(entry.teamName)) continue
    const scraped: ScrapedClubInfo = {
      volleyballworld_id: entry.teamVolleyballworldId,
      name: entry.teamName,
    }

    if (dryRun) {
      console.log(`  [dry-run] Would resolve club "${scraped.name}" (vwid=${scraped.volleyballworld_id})`)
      clubMap.set(entry.teamName, -1)
    } else {
      const dbId = await resolveClub(supabase, scraped)
      clubMap.set(entry.teamName, dbId)
    }
  }

  // Build and upsert rows
  const statsRows: Record<string, unknown>[] = []
  let skipped = 0

  for (const entry of parsed) {
    const clubId = clubMap.get(entry.teamName)
    if (clubId === undefined) {
      console.warn(`  Skipping player ${entry.player.name} — no club mapping`)
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  [dry-run] Would resolve player "${entry.player.name}" (${entry.player.position ?? '?'}, ${entry.stats.sets_played} sets)`)
      continue
    }

    let playerId: number
    try {
      playerId = await resolvePlayer(supabase, entry.player)
    } catch (err) {
      console.warn(`  Skipping player ${entry.player.name} — ${err instanceof Error ? err.message : err}`)
      skipped++
      continue
    }

    // If the site page for this season lacks a position, fall back to the
    // player's primary_position from another loaded season. For lega-only
    // seasons (no positions published at all) a null is stored as-is.
    let position = entry.player.position
    if (!position) {
      const { data } = await supabase
        .from('players')
        .select('primary_position')
        .eq('id', playerId)
        .maybeSingle()
      position = (data?.primary_position as string | undefined) ?? null
      if (position && !legaOnly) {
        console.log(`  Position for ${entry.player.name} taken from players table: ${position}`)
      }
    }
    if (!position && !legaOnly) {
      console.warn(`  Skipping player ${entry.player.name} — no position on site`)
      skipped++
      continue
    }

    statsRows.push({
      player_id:       playerId,
      competition_id:  COMPETITION_ID,
      club_id:         clubId < 0 ? null : clubId,
      season:          dbSeason,
      position_played: position, // null allowed for lega-only seasons

      sets_played:    entry.stats.sets_played,
      atk_attempts:   entry.stats.atk_attempts,
      atk_kills:      entry.stats.atk_kills,
      atk_errors:     entry.stats.atk_errors,
      total_points:   entry.stats.total_points,
      aces:           entry.stats.aces,
      serve_errors:   entry.stats.serve_errors,
      blocks:         entry.stats.blocks,
      digs:           entry.stats.digs,
      rec_attempts:   entry.stats.rec_attempts,
      rec_positive:   entry.stats.rec_positive,
      rec_perfect:    entry.stats.rec_perfect,
      rec_errors:     entry.stats.rec_errors,
      assists:        entry.stats.assists,
      assist_touches: null,
      involvement:    null,
      sr_efficiency:  null,
    })
  }

  if (!dryRun) {
    await upsertBatch(supabase, statsRows)
    console.log(`  ✓ ${urlSlug}: loaded ${statsRows.length} rows (${skipped} skipped)`)
  } else {
    console.log(`  [dry-run] ${parsed.length - skipped} players would be loaded (${skipped} skipped)`)
  }
}

// ---------------------------------------------------------------------------
// Load all seasons
// ---------------------------------------------------------------------------

export async function loadAll(options: {
  seasonSlug?: string
  dryRun?: boolean
}): Promise<void> {
  const supabase = getSupabaseAdmin()

  if (!options.dryRun) {
    await ensureCompetition(supabase)
  }

  const targets = options.seasonSlug
    ? SEASONS.filter((s) => s.urlSlug === options.seasonSlug)
    : SEASONS

  if (targets.length === 0) {
    throw new Error(`No season found matching slug: ${options.seasonSlug}`)
  }

  for (const season of targets) {
    await loadSeason(supabase, season, options.dryRun ?? false)
  }
}
