/**
 * Data-shape helpers derived from DB rows.
 * Everything here is pure and client-safe — no Supabase imports.
 *
 * These replace the lookup utilities that used to live in seed-data.ts;
 * they take the fetched rows as arguments instead of reading module
 * constants, so the app works against whatever the database holds.
 */

import type { Player, Club, Competition, PlayerSeasonStats } from './types'

// ── Labels ────────────────────────────────────────────────────────────────────

export const POS_LABEL: Record<string, string> = {
  OH: 'Outside hitter',
  OPP: 'Opposite',
  MB: 'Middle blocker',
  S: 'Setter',
  L: 'Libero',
}

/** Short badge text per competition type (source checkboxes) */
export const COMP_TYPE_LABEL: Record<string, string> = {
  domestic_league: 'league',
  national_team: 'national team',
  continental_club: 'continental',
}

// ── Seasons ───────────────────────────────────────────────────────────────────

/**
 * Distinct seasons present in the stats, ascending.
 * Season strings ('2021/22') sort correctly lexicographically.
 */
export function distinctSeasons(stats: PlayerSeasonStats[]): string[] {
  return [...new Set(stats.map((r) => r.season))].sort()
}

/** Seasons a player has at least one row for, ascending */
export function seasonsForPlayer(playerId: number, stats: PlayerSeasonStats[]): string[] {
  return [...new Set(stats.filter((r) => r.player_id === playerId).map((r) => r.season))].sort()
}

// ── Competitions ──────────────────────────────────────────────────────────────

/** Map competition_id → Competition */
export function getCompetitionMap(competitions: Competition[]): Map<number, Competition> {
  return new Map(competitions.map((c) => [c.id, c]))
}

/**
 * Competitions that actually have stats rows — drives the source checkboxes.
 * Ordered: leagues first, then by name.
 */
export function competitionsInData(
  competitions: Competition[],
  stats: PlayerSeasonStats[],
): Competition[] {
  const present = new Set(stats.map((r) => r.competition_id))
  return competitions
    .filter((c) => present.has(c.id))
    .sort((a, b) =>
      a.competition_type === b.competition_type
        ? a.name.localeCompare(b.name)
        : a.competition_type === 'domestic_league' ? -1
        : b.competition_type === 'domestic_league' ? 1 : 0,
    )
}

/** IDs of domestic-league competitions — the stable percentile/leaderboard cohort */
export function leagueCompetitionIds(competitions: Competition[]): Set<number> {
  return new Set(
    competitions.filter((c) => c.competition_type === 'domestic_league').map((c) => c.id),
  )
}

// ── Clubs ─────────────────────────────────────────────────────────────────────

/** Map club_id → Club */
export function getClubMap(clubs: Club[]): Map<number, Club> {
  return new Map(clubs.map((c) => [c.id, c]))
}

/** The club a player played for in a season (from any row with a club_id) */
export function getClubForSeason(
  playerId: number,
  season: string,
  stats: PlayerSeasonStats[],
  clubMap: Map<number, Club>,
): Club | null {
  const row = stats.find(
    (r) => r.player_id === playerId && r.season === season && r.club_id != null,
  )
  if (!row || row.club_id == null) return null
  return clubMap.get(row.club_id) ?? null
}

/**
 * Names of non-league competitions the player has rows for in a season
 * (shown as the event badge next to the player's country).
 */
export function getNtEventForSeason(
  playerId: number,
  season: string,
  stats: PlayerSeasonStats[],
  competitions: Competition[],
): string | null {
  const compMap = getCompetitionMap(competitions)
  const names = [...new Set(
    stats
      .filter((r) => r.player_id === playerId && r.season === season)
      .map((r) => compMap.get(r.competition_id))
      .filter((c): c is Competition => c != null && c.competition_type !== 'domestic_league')
      .map((c) => c.name),
  )]
  return names.length > 0 ? names.join(' · ') : null
}

// ── Nationality ───────────────────────────────────────────────────────────────

/** Legacy 3-letter codes (pre-scraper rows); 2-letter ISO codes are computed */
const NAT_INFO_3: Record<string, { full: string; flag: string }> = {
  JPN: { full: 'Japan',     flag: '🇯🇵' },
  ITA: { full: 'Italy',     flag: '🇮🇹' },
  BRA: { full: 'Brazil',    flag: '🇧🇷' },
  POL: { full: 'Poland',    flag: '🇵🇱' },
  TUN: { full: 'Tunisia',   flag: '🇹🇳' },
  FRA: { full: 'France',    flag: '🇫🇷' },
  SRB: { full: 'Serbia',    flag: '🇷🇸' },
  ARG: { full: 'Argentina', flag: '🇦🇷' },
}

/** Country name + flag emoji from a 2-letter ISO code (or legacy 3-letter) */
export function natInfo(code: string | null | undefined): { full: string; flag: string } {
  if (!code) return { full: 'Unknown', flag: '🌐' }
  const cc = code.trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(cc)) {
    const flag = String.fromCodePoint(
      ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
    )
    let full = cc
    try {
      full = new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) ?? cc
    } catch {
      // unknown region code — fall back to the raw code
    }
    return { full, flag }
  }
  return NAT_INFO_3[cc] ?? { full: cc, flag: '🌐' }
}
