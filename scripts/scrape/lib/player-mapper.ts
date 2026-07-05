/**
 * player-mapper.ts — resolves scraped player/club names to Supabase row IDs.
 *
 * 3-step lookup pattern (see plan §player-mapper):
 *   1. SELECT by volleyballworld_id  → fast path on re-scrapes
 *   2. SELECT all → normalized name match → UPDATE volleyballworld_id
 *   3. INSERT new row → return new id
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { CLUB_NAME_OVERRIDES, CLUB_SHORT_NAMES } from './constants.js'

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a name for fuzzy matching:
 * - Lowercase
 * - Strip diacritics (NFD decompose + remove combining marks)
 * - Replace hyphens/apostrophes with spaces
 * - Collapse whitespace
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritics
    .toLowerCase()
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sorted normalized name tokens: "Anzani Simone" and "Simone Anzani" → same key */
export function nameKey(name: string): string {
  return normalizeName(name).split(' ').sort().join(' ')
}

// ---------------------------------------------------------------------------
// Position → position_group (position itself is already the DB enum value)
// ---------------------------------------------------------------------------

const POSITION_TO_GROUP: Record<string, string> = {
  'OH':  'attacker',
  'OPP': 'attacker',
  'MB':  'attacker',
  'S':   'setter',
  'L':   'libero',
}

export function positionGroup(pos: string | null): string | null {
  if (!pos) return null
  return POSITION_TO_GROUP[pos.toUpperCase().trim()] ?? null
}

// ---------------------------------------------------------------------------
// resolveClub
// ---------------------------------------------------------------------------

export interface ScrapedClubInfo {
  /** null for clubs seen only in lega-only seasons (no vw coverage) */
  volleyballworld_id: number | null
  name: string
}

/** Short display name: explicit override or last word of the full name */
function shortNameFor(fullName: string): string {
  return CLUB_SHORT_NAMES[fullName] ?? fullName.split(/\s+/).slice(-1)[0]
}

export async function resolveClub(
  supabase: SupabaseClient,
  scraped: ScrapedClubInfo,
): Promise<number> {
  // Apply name overrides first
  const canonicalName = CLUB_NAME_OVERRIDES[scraped.name] ?? scraped.name

  // Step 1: lookup by external ID
  if (scraped.volleyballworld_id != null) {
    const { data: byId } = await supabase
      .from('clubs')
      .select('id')
      .eq('volleyballworld_id', scraped.volleyballworld_id)
      .maybeSingle()

    if (byId) return byId.id
  }

  // Step 2: lookup by normalized name (full or short)
  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, short_name, full_name, volleyballworld_id')

  const targetNorm = normalizeName(canonicalName)
  const match = (allClubs ?? []).find(
    (c: { id: number; short_name: string; full_name: string; volleyballworld_id: number | null }) =>
      normalizeName(c.full_name) === targetNorm || normalizeName(c.short_name) === targetNorm,
  )

  if (match) {
    // Update external ID for fast future lookups
    if (!match.volleyballworld_id && scraped.volleyballworld_id != null) {
      await supabase
        .from('clubs')
        .update({ volleyballworld_id: scraped.volleyballworld_id })
        .eq('id', match.id)
    }
    return match.id
  }

  // Step 3: insert new club
  const { data: inserted, error } = await supabase
    .from('clubs')
    .insert({
      short_name:         shortNameFor(canonicalName),
      full_name:          canonicalName,
      volleyballworld_id: scraped.volleyballworld_id,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert club "${canonicalName}": ${error?.message}`)
  }

  console.log(`    [club] Inserted "${canonicalName}" (vwid=${scraped.volleyballworld_id})`)
  return inserted.id
}

// ---------------------------------------------------------------------------
// resolvePlayer
// ---------------------------------------------------------------------------

interface PlayerRow {
  id: number
  name: string
  volleyballworld_id: number | null
}

/**
 * In-memory players list for name matching. Cached for the process lifetime
 * (the loader is the only writer) and paginated past PostgREST's 1000-row
 * response cap — a truncated list would silently create duplicate players.
 */
let playersCache: PlayerRow[] | null = null

async function getAllPlayers(supabase: SupabaseClient): Promise<PlayerRow[]> {
  if (playersCache) return playersCache

  const all: PlayerRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, volleyballworld_id')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Failed to list players: ${error.message}`)
    all.push(...(data ?? []) as PlayerRow[])
    if (!data || data.length < PAGE) break
  }
  playersCache = all
  return all
}

export interface ScrapedPlayerInfo {
  /** null for players seen only in lega-only seasons (no vw coverage) */
  volleyballworld_id: number | null
  name: string
  /** DB position_enum value: 'OH' | 'OPP' | 'MB' | 'S' | 'L' */
  position: string | null
  nationality: string | null
  height_cm: number | null
  date_of_birth: string | null
}

/**
 * Resolve a scraped player to a players.id.
 * Name matching is order-insensitive (sorted-token key) so legavolley's
 * "Anzani Simone" links to the vw-era "Simone Anzani" row.
 */
export async function resolvePlayer(
  supabase: SupabaseClient,
  scraped: ScrapedPlayerInfo,
): Promise<number> {
  // Step 1: lookup by external ID
  if (scraped.volleyballworld_id != null) {
    const { data: byId } = await supabase
      .from('players')
      .select('id')
      .eq('volleyballworld_id', scraped.volleyballworld_id)
      .maybeSingle()

    if (byId) return byId.id
  }

  // Step 2: lookup by normalized name, then by sorted-token key
  const players = await getAllPlayers(supabase)

  const targetNorm = normalizeName(scraped.name)
  const targetKey  = nameKey(scraped.name)
  const match =
    players.find((p) => normalizeName(p.name) === targetNorm) ??
    players.find((p) => nameKey(p.name) === targetKey)

  if (match) {
    if (!match.volleyballworld_id && scraped.volleyballworld_id != null) {
      await supabase
        .from('players')
        .update({ volleyballworld_id: scraped.volleyballworld_id })
        .eq('id', match.id)
      match.volleyballworld_id = scraped.volleyballworld_id
    }
    return match.id
  }

  // Step 3: insert new player (position/group may be null for lega-only rows)
  const { data: inserted, error } = await supabase
    .from('players')
    .insert({
      name:               scraped.name,
      nationality:        scraped.nationality ?? 'UNK',
      primary_position:   scraped.position,
      position_group:     positionGroup(scraped.position),
      height_cm:          scraped.height_cm,
      birthday:           scraped.date_of_birth,
      volleyballworld_id: scraped.volleyballworld_id,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert player "${scraped.name}": ${error?.message}`)
  }

  playersCache?.push({
    id: inserted.id,
    name: scraped.name,
    volleyballworld_id: scraped.volleyballworld_id,
  })
  console.log(`    [player] Inserted "${scraped.name}" (vwid=${scraped.volleyballworld_id})`)
  return inserted.id
}
