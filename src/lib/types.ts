// ============================================================
// Domain types — mirrors the Supabase schema exactly
// ============================================================

export type Position = 'OH' | 'OPP' | 'MB' | 'S' | 'L'
export type PositionGroup = 'attacker' | 'setter' | 'libero'
export type CompetitionType = 'domestic_league' | 'national_team' | 'continental_club'
export type StatSystem = 'fivb' | 'superlega' | 'plusliga' | 'ncaa'

export interface Player {
  id: number
  name: string
  nationality: string
  primary_position: Position
  position_group: PositionGroup
  height_cm: number | null
  weight_kg: number | null
  birthday: string | null
  image_url: string | null
}

export interface Club {
  id: number
  short_name: string
  full_name: string
  crest_url: string | null
  brand_color: string | null
}

export interface Competition {
  id: number
  name: string
  competition_type: CompetitionType
  stat_system: StatSystem
}

/** One row in player_season_stats — all raw counts, never derived rates */
export interface PlayerSeasonStats {
  id: number
  player_id: number
  competition_id: number
  club_id: number | null
  season: string
  position_played: Position
  sets_played: number
  // Attacking
  atk_attempts: number
  atk_kills: number
  atk_errors: number
  total_points: number
  // Serve
  aces: number
  serve_errors: number | null
  // Block
  blocks: number
  // Defense
  digs: number
  // Reception
  rec_attempts: number
  rec_positive: number
  rec_perfect: number
  rec_errors: number
  // Setting (nullable for non-setters)
  assists: number | null
  assist_touches: number | null
  // Libero (already rates — stored as exception; see spec §3.1)
  involvement: number | null
  sr_efficiency: number | null
}

// ============================================================
// Aggregated / derived stats — computed from summed raw counts
// ============================================================

export type StatKey =
  | 'attack_efficiency'
  | 'kill_pct'
  | 'points_per_set'
  | 'blocks_per_set'
  | 'aces_per_set'
  | 'digs_per_set'
  | 'reception_positive_pct'
  | 'reception_perfect_pct'
  | 'reception_errors_per_set'
  | 'assists_per_set'
  | 'setting_efficiency'
  | 'involvement'
  | 'sr_efficiency'

export interface AggregatedStats {
  player_id: number
  season: string
  sets_played: number
  // Attacking
  attack_efficiency: number | null
  kill_pct: number | null
  points_per_set: number | null
  // Serve & block
  blocks_per_set: number | null
  aces_per_set: number | null
  // Reception & defense
  reception_positive_pct: number | null
  reception_perfect_pct: number | null
  digs_per_set: number | null
  reception_errors_per_set: number | null
  // Setting
  assists_per_set: number | null
  setting_efficiency: number | null
  // Libero
  involvement: number | null
  sr_efficiency: number | null
  // Meta: competitions whose rows fed this aggregate
  competition_ids: number[]
}

// ============================================================
// Stat group / table definitions
// ============================================================

export interface StatRow {
  key: StatKey
  label: string
  fmt: 'pct' | 'num'
  /** lower values = better performance (e.g. reception errors) */
  lowGood?: boolean
}

export interface StatGroup {
  title: string
  rows: StatRow[]
}

// ============================================================
// Radar axis definition
// ============================================================

export interface RadarAxis {
  key: StatKey
  name: string
  /** Fixed ceiling for mapping raw value → 0–100 shape */
  max: number
  fmt: 'pct' | 'num'
  /** lower is better → invert when mapping to radar */
  invert?: boolean
}

export interface RadarConfig {
  label: string
  axes: RadarAxis[]
}

// ============================================================
// Leaderboard column definitions
// ============================================================

export interface LeadColumn {
  key: StatKey | 'name'
  label: string
  fmt?: 'pct' | 'num' | 'int'
}
