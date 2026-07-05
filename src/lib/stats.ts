/**
 * Core stats logic — aggregation and percentile.
 *
 * Design rationale (from spec §3.2 / §6):
 * - STORE raw counts; DERIVE rates by summing counts first, then dividing.
 * - Combining club + national-team rows is volume-weighted automatically
 *   because we sum the raw numerators and denominators — never average rates.
 * - Radar shape is driven by the raw/rate value on a FIXED scale, not by
 *   percentile, so a genuinely worse season produces a visibly smaller shape.
 * - Percentile is contextual annotation: rank within same position-group peers
 *   using the club-league cohort as the stable reference pool.
 */

import type {
  PlayerSeasonStats,
  AggregatedStats,
  StatKey,
  Player,
} from './types'

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Sum raw counts from one or more player_season_stats rows, then derive rates.
 * Returns null if no matching rows exist.
 *
 * `includeComps` selects which competitions feed the numbers (the source
 * checkboxes). With `fallbackToAll` (the compare view), an empty selection or
 * a selection that matches nothing falls back to every row for the
 * player/season; percentile cohorts pass false so the cohort stays strict.
 */
export function aggregateStats(
  rows: PlayerSeasonStats[],
  playerId: number,
  season: string,
  includeComps: ReadonlySet<number>,
  fallbackToAll = true,
): AggregatedStats | null {
  const filtered = rows.filter(
    (r) =>
      r.player_id === playerId &&
      r.season === season &&
      includeComps.has(r.competition_id),
  )

  const effective = filtered.length > 0 || !fallbackToAll
    ? filtered
    : rows.filter((r) => r.player_id === playerId && r.season === season)

  if (effective.length === 0) return null

  // Sum raw counts
  const sum = {
    sets_played: 0,
    atk_attempts: 0, atk_kills: 0, atk_errors: 0,
    total_points: 0,
    aces: 0, blocks: 0, digs: 0,
    rec_attempts: 0, rec_positive: 0, rec_perfect: 0, rec_errors: 0,
    assists: 0, assist_touches: 0,
  }

  // digs are null (not tracked) in lega-only seasons — a 0-rate would lie
  const digsTracked = effective.some((r) => r.digs != null)

  for (const r of effective) {
    sum.sets_played    += r.sets_played
    sum.atk_attempts   += r.atk_attempts
    sum.atk_kills      += r.atk_kills
    sum.atk_errors     += r.atk_errors
    sum.total_points   += r.total_points
    sum.aces           += r.aces
    sum.blocks         += r.blocks
    sum.digs           += r.digs ?? 0
    sum.rec_attempts   += r.rec_attempts
    sum.rec_positive   += r.rec_positive
    sum.rec_perfect    += r.rec_perfect
    sum.rec_errors     += r.rec_errors
    sum.assists        += (r.assists ?? 0)
    sum.assist_touches += (r.assist_touches ?? 0)
  }

  // Libero rates stored directly — volume-weighted average across rows
  const totalSets = effective.reduce((t, r) => t + r.sets_played, 0)
  const liberoWeighted = (key: 'involvement' | 'sr_efficiency') => {
    if (!effective.some((r) => r[key] != null)) return null
    return effective.reduce((t, r) => t + (r[key] ?? 0) * r.sets_played, 0) / Math.max(1, totalSets)
  }

  const div = (n: number, d: number) => (d > 0 ? n / d : null)

  const competition_ids = [...new Set(effective.map((r) => r.competition_id))].sort()

  return {
    player_id: playerId,
    season,
    sets_played: sum.sets_played,
    // Derived from summed counts (correct weighted blend)
    attack_efficiency:        div(sum.atk_kills - sum.atk_errors, sum.atk_attempts),
    kill_pct:                 div(sum.atk_kills, sum.atk_attempts),
    points_per_set:           div(sum.total_points, sum.sets_played),
    blocks_per_set:           div(sum.blocks, sum.sets_played),
    aces_per_set:             div(sum.aces, sum.sets_played),
    digs_per_set:             digsTracked ? div(sum.digs, sum.sets_played) : null,
    // volleyballworld.com doesn't publish positive receptions (rec_positive
    // is stored 0 — see docs/DATA_SOURCES.md), so a zero here means "not
    // tracked", not "0%". Report unavailable instead of a misleading 0%.
    reception_positive_pct:   sum.rec_positive > 0 ? div(sum.rec_positive, sum.rec_attempts) : null,
    reception_perfect_pct:    div(sum.rec_perfect, sum.rec_attempts),
    reception_errors_per_set: div(sum.rec_errors, sum.sets_played),
    assists_per_set:          sum.assists > 0 ? div(sum.assists, sum.sets_played) : null,
    setting_efficiency:       div(sum.assists, sum.assist_touches),
    involvement:              liberoWeighted('involvement'),
    sr_efficiency:            liberoWeighted('sr_efficiency'),
    competition_ids,
  }
}

// ── Percentile ────────────────────────────────────────────────────────────────

/**
 * Compute the percentile rank of `value` among the club-only aggregates for
 * all players of the same position_group in the given season.
 *
 * "How many peers in the same cohort have a LOWER value?" (0–100)
 * For lower-is-better stats, the inversion is handled by the caller
 * passing `invert: true`.
 */
export function computePercentile(
  value: number | null | undefined,
  field: StatKey,
  /** null (position unknown, lega-only era players) → no cohort, no percentile */
  playerGroup: string | null,
  season: string,
  allRows: PlayerSeasonStats[],
  allPlayers: Player[],
  /** Domestic-league competition ids — the stable reference pool */
  leagueCompIds: ReadonlySet<number>,
  invert = false,
): number | null {
  if (value == null || playerGroup == null) return null

  // Build the cohort: club-only aggregate for every player in the same group
  const peers = allPlayers
    .filter((p) => p.position_group === playerGroup)
    .map((p) =>
      aggregateStats(allRows, p.id, season, leagueCompIds, false),
    )
    .filter((d): d is AggregatedStats => d != null && d[field] != null)

  if (peers.length < 2) return null

  const below = peers.filter((d) =>
    invert ? (d[field] as number) > value : (d[field] as number) < value,
  ).length

  return Math.round((below / (peers.length - 1)) * 100)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtVal(v: number | null | undefined, fmt: 'pct' | 'num' | 'int'): string {
  if (v == null) return '—'
  if (fmt === 'pct') return (v * 100).toFixed(0) + '%'
  if (fmt === 'int') return Math.round(v).toString()
  return v.toFixed(v < 1 ? 2 : 1)
}

export function fmtDob(dob: string): string {
  const d = new Date(dob)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function computeAge(dob: string, referenceDate = new Date()): number {
  const d = new Date(dob)
  let age = referenceDate.getFullYear() - d.getFullYear()
  if (referenceDate < new Date(referenceDate.getFullYear(), d.getMonth(), d.getDate())) age--
  return age
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function lastName(name: string): string {
  return name.split(' ').slice(-1)[0]
}

// ── Radar helpers ─────────────────────────────────────────────────────────────

/**
 * Map a raw value to a 0–100 radar score using the axis fixed max.
 * Inverted axes (lower-is-better) are flipped: 0 raw → 100 score.
 */
export function toRadarScore(value: number | null | undefined, max: number, invert = false): number {
  if (value == null) return 0
  const pct = Math.max(0, Math.min(1, value / max))
  return Math.round((invert ? 1 - pct : pct) * 100)
}

// ── Percentile pill colors ────────────────────────────────────────────────────

export function pctBg(p: number | null): string {
  if (p == null) return 'transparent'
  if (p >= 80) return 'rgba(29,158,117,.22)'
  if (p >= 60) return 'rgba(29,158,117,.13)'
  if (p >= 40) return 'rgba(139,151,167,.13)'
  if (p >= 20) return 'rgba(186,117,23,.16)'
  return 'rgba(226,72,63,.16)'
}

export function pctText(p: number | null): string {
  if (p == null) return 'var(--text-faint)'
  if (p >= 60) return '#178c66'
  if (p >= 40) return '#8b97a7'
  if (p >= 20) return '#9c6213'
  return '#cf3d34'
}

// ── Season ordering ───────────────────────────────────────────────────────────

export function seasonIndex(season: string, allSeasons: string[]): number {
  return allSeasons.indexOf(season)
}
