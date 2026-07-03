import type { RadarConfig, StatGroup } from './types'

// ============================================================
// Radar axis configs — fixed maxima match the HTML prototype's
// RADARS object. Tune here when real data reveals better ceilings.
// ============================================================

export const RADAR_CONFIGS: Record<string, RadarConfig> = {
  attacker: {
    label: 'Attacker radar',
    axes: [
      { key: 'attack_efficiency', name: 'Attack eff',  max: 0.65, fmt: 'pct' },
      { key: 'kill_pct',          name: 'Kill %',      max: 0.70, fmt: 'pct' },
      { key: 'blocks_per_set',    name: 'Block/set',   max: 1.1,  fmt: 'num' },
      { key: 'aces_per_set',      name: 'Ace/set',     max: 0.6,  fmt: 'num' },
      { key: 'reception_positive_pct', name: 'Reception+', max: 0.75, fmt: 'pct' },
      { key: 'points_per_set',    name: 'Points/set',  max: 6,    fmt: 'num' },
    ],
  },
  setter: {
    label: 'Setter radar',
    axes: [
      { key: 'assists_per_set',   name: 'Assists/set', max: 11,   fmt: 'num' },
      { key: 'setting_efficiency',name: 'Set eff',     max: 0.6,  fmt: 'pct' },
      { key: 'digs_per_set',      name: 'Dig/set',     max: 2.2,  fmt: 'num' },
      { key: 'blocks_per_set',    name: 'Block/set',   max: 0.7,  fmt: 'num' },
      { key: 'aces_per_set',      name: 'Ace/set',     max: 0.4,  fmt: 'num' },
      { key: 'reception_positive_pct', name: 'Reception+', max: 0.2, fmt: 'pct' },
    ],
  },
  libero: {
    label: 'Libero radar',
    axes: [
      { key: 'reception_positive_pct',  name: 'Reception+',  max: 0.8, fmt: 'pct' },
      { key: 'reception_perfect_pct',   name: 'Perfect %',   max: 0.6, fmt: 'pct' },
      { key: 'digs_per_set',            name: 'Dig/set',     max: 4,   fmt: 'num' },
      { key: 'reception_errors_per_set',name: 'Few errors',  max: 0.2, fmt: 'num', invert: true },
      { key: 'involvement',             name: 'Involvement', max: 1,   fmt: 'pct' },
      { key: 'sr_efficiency',           name: 'SR eff',      max: 0.7, fmt: 'pct' },
    ],
  },
}

// ============================================================
// Stat table groups — controls what rows appear and in what order
// ============================================================

export const STAT_GROUPS: StatGroup[] = [
  {
    title: 'Attacking',
    rows: [
      { key: 'attack_efficiency', label: 'Attack efficiency',   fmt: 'pct' },
      { key: 'kill_pct',          label: 'Kill %',              fmt: 'pct' },
      { key: 'points_per_set',    label: 'Points / set',        fmt: 'num' },
    ],
  },
  {
    title: 'Serve & block',
    rows: [
      { key: 'aces_per_set',   label: 'Aces / set',   fmt: 'num' },
      { key: 'blocks_per_set', label: 'Blocks / set', fmt: 'num' },
    ],
  },
  {
    title: 'Reception & defense',
    rows: [
      { key: 'reception_positive_pct',  label: 'Reception positive %',   fmt: 'pct' },
      { key: 'reception_perfect_pct',   label: 'Reception perfect %',    fmt: 'pct' },
      { key: 'digs_per_set',            label: 'Digs / set',             fmt: 'num' },
      { key: 'reception_errors_per_set',label: 'Reception errors / set', fmt: 'num', lowGood: true },
    ],
  },
  {
    title: 'Setting',
    rows: [
      { key: 'assists_per_set',    label: 'Assists / set',      fmt: 'num' },
      { key: 'setting_efficiency', label: 'Setting efficiency', fmt: 'pct' },
    ],
  },
]

// ============================================================
// Leaderboard column sets — adapt by position group
// ============================================================

export const LEAD_COLS_DEFAULT = [
  { key: 'points_per_set',          label: 'Pts/set',   fmt: 'num' },
  { key: 'attack_efficiency',        label: 'Att eff',   fmt: 'pct' },
  { key: 'kill_pct',                 label: 'Kill%',     fmt: 'pct' },
  { key: 'blocks_per_set',           label: 'Blk/set',  fmt: 'num' },
  { key: 'aces_per_set',             label: 'Ace/set',  fmt: 'num' },
  { key: 'reception_positive_pct',   label: 'Rec+%',    fmt: 'pct' },
  { key: 'digs_per_set',             label: 'Dig/set',  fmt: 'num' },
] as const

export const LEAD_COLS_LIBERO = [
  { key: 'reception_positive_pct',   label: 'Rec+%',       fmt: 'pct' },
  { key: 'reception_perfect_pct',    label: 'Perfect%',    fmt: 'pct' },
  { key: 'digs_per_set',             label: 'Dig/set',     fmt: 'num' },
  { key: 'reception_errors_per_set', label: 'RecErr/set',  fmt: 'num' },
  { key: 'sr_efficiency',            label: 'SR eff',      fmt: 'pct' },
] as const

export const LEAD_COLS_SETTER = [
  { key: 'assists_per_set',    label: 'Ass/set',  fmt: 'num' },
  { key: 'setting_efficiency', label: 'Set eff',  fmt: 'pct' },
  { key: 'blocks_per_set',     label: 'Blk/set',  fmt: 'num' },
  { key: 'aces_per_set',       label: 'Ace/set',  fmt: 'num' },
  { key: 'digs_per_set',       label: 'Dig/set',  fmt: 'num' },
] as const
