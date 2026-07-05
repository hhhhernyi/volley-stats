/**
 * types.ts — scraper-internal types.
 * These are NOT the same as src/lib/types.ts (domain types).
 * They represent intermediate data shapes between fetch → parse → load phases.
 */

// ---------------------------------------------------------------------------
// Fetch phase outputs (extracted from HTML structure)
// ---------------------------------------------------------------------------

/** A team entry extracted from the teams-list page */
export interface ScrapedTeam {
  /** volleyballworld.com internal numeric ID */
  volleyballworld_id: number
  /** Team name as shown on the site */
  name: string
}

/** A player stub extracted from a team's roster page */
export interface ScrapedPlayerStub {
  /** volleyballworld.com internal numeric ID */
  volleyballworld_id: number
  /** Full name as shown on the site */
  name: string
  /** The team this player belongs to */
  teamVolleyballworldId: number
}

/** One match from the live-matches API (matches.json) */
export interface ApiMatch {
  /** Match number — joins to data-match-no on player stat rows */
  no: number
  tournamentNo: number
  noTeamA: number
  noTeamB: number
  /** Sets won by team A / team B (e.g. 3 / 1) */
  matchPointsA: number
  matchPointsB: number
  /** 2 = finished with results */
  status: number
  statusLabel: string
}

/**
 * One player row from a legavolley.it team stats table (TipoStat=1.1).
 * Name is "Cognome Nome" (surname first). All values are raw counts except
 * where noted; the site is authoritative for these fields.
 */
export interface LegaPlayerRow {
  name: string
  matches: number
  sets: number
  points: number
  serveTotal: number
  aces: number
  serveErrors: number
  recTotal: number
  recErrors: number
  recNegative: number
  recPerfect: number
  atkTotal: number
  atkErrors: number
  atkBlocked: number
  atkKills: number
  blocks: number
}

// ---------------------------------------------------------------------------
// Parse phase inputs/outputs
// ---------------------------------------------------------------------------

/**
 * One player's per-match stats, merged from the 7 category tables on the
 * player page (scoring, attack, block, serve, reception, dig, set).
 * All rows for the same match share a data-match-no.
 */
export interface RawMatchRow {
  /** Site match number (data-match-no) — joins to ApiMatch.no for set counts */
  matchNo: number
  /** Attack: total attempts (kills + errors + shots) */
  atkAttempts: number
  /** Attack kills/winners */
  atkKills: number
  /** Attack errors */
  atkErrors: number
  /** Total points scored (scoring table) */
  totalPoints: number
  /** Service aces (serve points) */
  aces: number
  /** Service errors */
  serveErrors: number
  /** Block points (stuff blocks) */
  blocks: number
  /** Digs (great saves) */
  digs: number
  /** Reception attempts (total) */
  recAttempts: number
  /** Perfect/excellent receptions ("Successful" on site) */
  recPerfect: number
  /** Reception errors */
  recErrors: number
  /** Successful running sets (assists) */
  assists: number
}

/** One player's full parsed season data (sum of all matches) */
export interface ParsedPlayerSeason {
  season: string                       // '2024/25' — DB format
  /** null for lega-only seasons (no volleyballworld coverage before 2021/22) */
  teamVolleyballworldId: number | null
  /** Team name as scraped from the teams-list page (for club resolution) */
  teamName: string
  player: {
    /** null for players seen only in lega-only seasons */
    volleyballworld_id: number | null
    name: string
    position: string | null            // DB enum value: 'OH' | 'OPP' | 'MB' | 'S' | 'L'
    nationality: string | null         // 2-letter ISO code from site
    height_cm: number | null
    date_of_birth: string | null       // ISO date string or null
  }
  stats: {
    sets_played: number
    atk_attempts: number
    atk_kills: number
    atk_errors: number
    total_points: number
    aces: number
    serve_errors: number | null
    blocks: number
    /** null = not tracked (legavolley publishes no digs for lega-only seasons) */
    digs: number | null
    rec_attempts: number
    /**
     * volleyballworld doesn't publish positive receptions (0 for hybrid
     * seasons); computable from legavolley columns for lega-only seasons.
     */
    rec_positive: number
    rec_perfect: number
    rec_errors: number
    assists: number | null
  }
  /** Warnings accumulated during parsing this player */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Cache manifest (tracks completed fetches)
// ---------------------------------------------------------------------------

export interface SeasonManifest {
  urlSlug: string
  /** ISO timestamp when fetch phase completed successfully; null if not done */
  fetchCompleted: string | null
  /** Total players fetched */
  playerCount: number
}

export interface CacheManifest {
  lastUpdated: string
  seasons: SeasonManifest[]
}
