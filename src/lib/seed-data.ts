/**
 * Mock seed data — ported directly from volleydash-demo.html.
 * All counts are computed from target rates using the same helper
 * functions as the prototype, producing numerically identical results.
 *
 * Used by:
 *  - scripts/seed.ts  (Supabase data load)
 *  - The app itself via getAllSeedData() for development without Supabase
 */

import type { Player, Club, Competition, PlayerSeasonStats } from './types'

// ── Static reference data ─────────────────────────────────────────────────────

export const SEASONS: string[] = [
  '2018/19', '2019/20', '2020/21', '2021/22', '2022/23', '2023/24',
]

/** Map season → national-team event that occurred in that window */
export const NT_EVENT: Record<string, string> = {
  '2018/19': 'VNL 2019',
  '2019/20': 'Olympics 2021',
  '2020/21': 'VNL 2021',
  '2021/22': 'VNL 2022',
  '2022/23': 'World Champs 2022',
  '2023/24': 'Olympics 2024',
}

export const POS_LABEL: Record<string, string> = {
  OH: 'Outside hitter',
  OPP: 'Opposite',
  MB: 'Middle blocker',
  S: 'Setter',
  L: 'Libero',
}

// ── Players ───────────────────────────────────────────────────────────────────

export const PLAYERS: Player[] = [
  { id: 1,  name: 'Yuki Ishikawa',      nationality: 'JPN', primary_position: 'OH',  position_group: 'attacker', height_cm: 192, weight_kg: 84, birthday: '1995-12-11', image_url: null },
  { id: 2,  name: 'Tommaso Rinaldi',    nationality: 'ITA', primary_position: 'OH',  position_group: 'attacker', height_cm: 200, weight_kg: 90, birthday: '2002-02-13', image_url: null },
  { id: 3,  name: 'Wassim Ben Tara',    nationality: 'TUN', primary_position: 'OH',  position_group: 'attacker', height_cm: 200, weight_kg: 95, birthday: '1994-12-29', image_url: null },
  { id: 4,  name: 'Daniele Lavia',      nationality: 'ITA', primary_position: 'OH',  position_group: 'attacker', height_cm: 200, weight_kg: 88, birthday: '1999-06-08', image_url: null },
  { id: 5,  name: 'Darlan Souza',       nationality: 'BRA', primary_position: 'OPP', position_group: 'attacker', height_cm: 202, weight_kg: 92, birthday: '2000-08-21', image_url: null },
  { id: 6,  name: 'Kamil Semeniuk',     nationality: 'POL', primary_position: 'OPP', position_group: 'attacker', height_cm: 198, weight_kg: 89, birthday: '1996-04-04', image_url: null },
  { id: 7,  name: 'Yuri Romanò',        nationality: 'ITA', primary_position: 'OPP', position_group: 'attacker', height_cm: 202, weight_kg: 91, birthday: '1997-04-23', image_url: null },
  { id: 8,  name: 'Roberto Russo',      nationality: 'ITA', primary_position: 'MB',  position_group: 'attacker', height_cm: 205, weight_kg: 93, birthday: '1995-08-13', image_url: null },
  { id: 9,  name: 'Jean Patry',         nationality: 'FRA', primary_position: 'MB',  position_group: 'attacker', height_cm: 203, weight_kg: 98, birthday: '1996-06-29', image_url: null },
  { id: 10, name: 'Srećko Lisinac',     nationality: 'SRB', primary_position: 'MB',  position_group: 'attacker', height_cm: 205, weight_kg: 96, birthday: '1992-02-26', image_url: null },
  { id: 11, name: 'Simone Giannelli',   nationality: 'ITA', primary_position: 'S',   position_group: 'setter',   height_cm: 200, weight_kg: 86, birthday: '1996-08-09', image_url: null },
  { id: 12, name: 'Riccardo Sbertoli',  nationality: 'ITA', primary_position: 'S',   position_group: 'setter',   height_cm: 188, weight_kg: 80, birthday: '1998-04-24', image_url: null },
  { id: 13, name: 'Luciano De Cecco',   nationality: 'ARG', primary_position: 'S',   position_group: 'setter',   height_cm: 198, weight_kg: 88, birthday: '1988-06-06', image_url: null },
  { id: 14, name: 'Fabio Balaso',       nationality: 'ITA', primary_position: 'L',   position_group: 'libero',   height_cm: 182, weight_kg: 76, birthday: '1995-07-31', image_url: null },
  { id: 15, name: 'Massimo Colaci',     nationality: 'ITA', primary_position: 'L',   position_group: 'libero',   height_cm: 180, weight_kg: 74, birthday: '1985-08-10', image_url: null },
  { id: 16, name: 'Leonardo Scanferla', nationality: 'ITA', primary_position: 'L',   position_group: 'libero',   height_cm: 181, weight_kg: 75, birthday: '1999-03-15', image_url: null },
]

// ── Clubs ─────────────────────────────────────────────────────────────────────

export const CLUBS: Club[] = [
  { id: 1,  short_name: 'Milano',      full_name: 'Allianz Powervolley Milano',   crest_url: null, brand_color: '#d4122a' },
  { id: 2,  short_name: 'Modena',      full_name: 'Valsa Group Modena',            crest_url: null, brand_color: '#f4c20d' },
  { id: 3,  short_name: 'Verona',      full_name: 'Rana Verona',                   crest_url: null, brand_color: '#1a5fb4' },
  { id: 4,  short_name: 'Trento',      full_name: 'Itas Trentino',                 crest_url: null, brand_color: '#1e88c7' },
  { id: 5,  short_name: 'Piacenza',    full_name: 'Gas Sales Piacenza',            crest_url: null, brand_color: '#e8501f' },
  { id: 6,  short_name: 'Perugia',     full_name: 'Sir Susa Perugia',              crest_url: null, brand_color: '#7b2d8e' },
  { id: 7,  short_name: 'Padova',      full_name: 'Pallavolo Padova',              crest_url: null, brand_color: '#c01c2e' },
  { id: 8,  short_name: 'Siena',       full_name: 'Emma Villas Siena',             crest_url: null, brand_color: '#1d9e75' },
  { id: 9,  short_name: 'Cucine Lube', full_name: 'Cucine Lube Civitanova',        crest_url: null, brand_color: '#9c1d2b' },
  { id: 10, short_name: 'Funvic',      full_name: 'Funvic Taubaté',               crest_url: null, brand_color: '#0d5fae' },
]

export const CLUB_BY_NAME: Record<string, Club> = Object.fromEntries(
  CLUBS.map((c) => [c.short_name, c]),
)

// ── Competitions ──────────────────────────────────────────────────────────────

export const COMPETITIONS: Competition[] = [
  { id: 1, name: 'SuperLega',         competition_type: 'domestic_league', stat_system: 'superlega' },
  { id: 2, name: 'VNL 2019',          competition_type: 'national_team',   stat_system: 'fivb' },
  { id: 3, name: 'Olympics 2021',     competition_type: 'national_team',   stat_system: 'fivb' },
  { id: 4, name: 'VNL 2021',          competition_type: 'national_team',   stat_system: 'fivb' },
  { id: 5, name: 'VNL 2022',          competition_type: 'national_team',   stat_system: 'fivb' },
  { id: 6, name: 'World Champs 2022', competition_type: 'national_team',   stat_system: 'fivb' },
  { id: 7, name: 'Olympics 2024',     competition_type: 'national_team',   stat_system: 'fivb' },
]

/** Season → NT competition id */
const NT_COMP_ID: Record<string, number> = {
  '2018/19': 2,
  '2019/20': 3,
  '2020/21': 4,
  '2021/22': 5,
  '2022/23': 6,
  '2023/24': 7,
}

// ── Count builders (mirrors HTML prototype helpers) ───────────────────────────

interface AttackerRates {
  atkAttSet?: number
  attEff: number
  kill: number
  ptsSet: number
  blkSet: number
  aceSet: number
  digSet: number
  recPos: number
  recPerf: number
  recErrSet: number
  recAttSet?: number
}

interface SetterRates extends AttackerRates {
  assSet: number
  setEff: number
}

interface LiberoRates {
  recPos: number
  recPerf: number
  digSet: number
  recErrSet: number
  involve: number
  srEff: number
}

function attackerCounts(sets: number, r: AttackerRates) {
  const atkAttSet = r.atkAttSet ?? 8.5
  const attempts  = Math.round(sets * atkAttSet)
  const kills     = Math.round(attempts * r.kill)
  const errors    = Math.round(attempts * (r.kill - r.attEff))
  const recAtt    = Math.round(sets * (r.recAttSet ?? 3.0))
  return {
    sets_played:  sets,
    atk_attempts: attempts,
    atk_kills:    kills,
    atk_errors:   Math.max(0, errors),
    total_points: Math.round(sets * r.ptsSet),
    blocks:       Math.round(sets * r.blkSet),
    aces:         Math.round(sets * r.aceSet),
    digs:         Math.round(sets * r.digSet),
    rec_attempts: recAtt,
    rec_positive: Math.round(recAtt * r.recPos),
    rec_perfect:  Math.round(recAtt * r.recPerf),
    rec_errors:   Math.round(sets * r.recErrSet),
    assists:      null as number | null,
    assist_touches: null as number | null,
    involvement:  null as number | null,
    sr_efficiency: null as number | null,
  }
}

function setterCounts(sets: number, r: SetterRates) {
  const base = attackerCounts(sets, { ...r, atkAttSet: 1.2 })
  const assists = Math.round(sets * r.assSet)
  const assTouches = Math.round(assists / Math.max(0.01, r.setEff))
  return { ...base, assists, assist_touches: assTouches }
}

function liberoCounts(sets: number, r: LiberoRates) {
  const recAtt = Math.round(sets * 4.2)
  return {
    sets_played:    sets,
    atk_attempts:   0, atk_kills: 0, atk_errors: 0,
    total_points:   0, blocks: 0, aces: 0,
    digs:           Math.round(sets * r.digSet),
    rec_attempts:   recAtt,
    rec_positive:   Math.round(recAtt * r.recPos),
    rec_perfect:    Math.round(recAtt * r.recPerf),
    rec_errors:     Math.round(sets * r.recErrSet),
    assists:        null as number | null,
    assist_touches: null as number | null,
    involvement:    r.involve,
    sr_efficiency:  r.srEff,
  }
}

// ── Row builder ───────────────────────────────────────────────────────────────

let _id = 1

function makeRow(
  playerId: number,
  season: string,
  competitionId: number,
  clubId: number | null,
  counts: ReturnType<typeof attackerCounts>,
  positionPlayed: string,
): PlayerSeasonStats {
  return {
    id:              _id++,
    player_id:       playerId,
    competition_id:  competitionId,
    club_id:         clubId,
    season,
    position_played: positionPlayed as PlayerSeasonStats['position_played'],
    ...counts,
    serve_errors:    null,
  }
}

// ── Per-player data (ported from HTML prototype) ──────────────────────────────

function buildIshikawaRows(): PlayerSeasonStats[] {
  const clubRates: Record<string, { club: string } & AttackerRates> = {
    '2018/19': { club: 'Siena',  attEff: .441, kill: .43, ptsSet: 3.5, blkSet: .34, aceSet: .29, recPos: .54, recPerf: .30, digSet: 1.6, recErrSet: .24, recAttSet: 3.4 },
    '2019/20': { club: 'Padova', attEff: .468, kill: .45, ptsSet: 3.7, blkSet: .37, aceSet: .31, recPos: .57, recPerf: .33, digSet: 1.7, recErrSet: .21, recAttSet: 3.4 },
    '2020/21': { club: 'Padova', attEff: .482, kill: .46, ptsSet: 3.9, blkSet: .39, aceSet: .33, recPos: .59, recPerf: .35, digSet: 1.8, recErrSet: .20, recAttSet: 3.4 },
    '2021/22': { club: 'Milano', attEff: .497, kill: .48, ptsSet: 4.0, blkSet: .40, aceSet: .33, recPos: .60, recPerf: .36, digSet: 1.9, recErrSet: .19, recAttSet: 3.4 },
    '2022/23': { club: 'Milano', attEff: .505, kill: .48, ptsSet: 4.1, blkSet: .41, aceSet: .34, recPos: .61, recPerf: .37, digSet: 1.9, recErrSet: .18, recAttSet: 3.4 },
    '2023/24': { club: 'Milano', attEff: .512, kill: .49, ptsSet: 4.2, blkSet: .42, aceSet: .34, recPos: .61, recPerf: .38, digSet: 1.9, recErrSet: .18, recAttSet: 3.4 },
  }
  const ntRates: Record<string, AttackerRates & { sets: number }> = {
    '2018/19': { sets: 20, attEff: .421, kill: .43, ptsSet: 3.3, blkSet: .32, aceSet: .28, recPos: .53, recPerf: .30, digSet: 1.7, recErrSet: .23, recAttSet: 3.8 },
    '2019/20': { sets: 24, attEff: .430, kill: .44, ptsSet: 3.4, blkSet: .33, aceSet: .30, recPos: .55, recPerf: .31, digSet: 1.8, recErrSet: .22, recAttSet: 3.8 },
    '2021/22': { sets: 20, attEff: .455, kill: .45, ptsSet: 3.6, blkSet: .34, aceSet: .33, recPos: .57, recPerf: .32, digSet: 1.9, recErrSet: .20, recAttSet: 3.8 },
    '2022/23': { sets: 18, attEff: .448, kill: .45, ptsSet: 3.7, blkSet: .31, aceSet: .34, recPos: .56, recPerf: .30, digSet: 2.0, recErrSet: .21, recAttSet: 3.9 },
    '2023/24': { sets: 22, attEff: .462, kill: .46, ptsSet: 3.8, blkSet: .35, aceSet: .32, recPos: .58, recPerf: .33, digSet: 1.9, recErrSet: .19, recAttSet: 3.8 },
  }

  const rows: PlayerSeasonStats[] = []
  const setsByClubSeason: Record<string, number> = {
    '2018/19': 92, '2019/20': 96, '2020/21': 98, '2021/22': 100, '2022/23': 102, '2023/24': 98,
  }

  for (const season of SEASONS) {
    const cr = clubRates[season]
    const club = CLUB_BY_NAME[cr.club]
    rows.push(makeRow(1, season, 1, club.id, attackerCounts(setsByClubSeason[season], cr), 'OH'))

    const nr = ntRates[season]
    if (nr) {
      rows.push(makeRow(1, season, NT_COMP_ID[season], null, attackerCounts(nr.sets, nr), 'OH'))
    }
  }
  return rows
}

function buildDarlanRows(): PlayerSeasonStats[] {
  const clubRates: Record<string, { club: string; sets: number } & AttackerRates> = {
    '2018/19': { club: 'Funvic',      sets: 80, attEff: .452, kill: .46, ptsSet: 4.7, blkSet: .42, aceSet: .40, recPos: .13, recPerf: .05, digSet: .9, recErrSet: .06, recAttSet: .6 },
    '2019/20': { club: 'Funvic',      sets: 84, attEff: .471, kill: .47, ptsSet: 5.0, blkSet: .46, aceSet: .43, recPos: .12, recPerf: .04, digSet: .9, recErrSet: .05, recAttSet: .6 },
    '2020/21': { club: 'Cucine Lube', sets: 90, attEff: .498, kill: .50, ptsSet: 5.4, blkSet: .52, aceSet: .48, recPos: .12, recPerf: .04, digSet: .8, recErrSet: .05, recAttSet: .6 },
    '2021/22': { club: 'Cucine Lube', sets: 94, attEff: .501, kill: .50, ptsSet: 5.5, blkSet: .53, aceSet: .47, recPos: .11, recPerf: .04, digSet: .8, recErrSet: .05, recAttSet: .6 },
    '2022/23': { club: 'Piacenza',    sets: 96, attEff: .494, kill: .50, ptsSet: 5.3, blkSet: .51, aceSet: .46, recPos: .12, recPerf: .04, digSet: .9, recErrSet: .05, recAttSet: .6 },
    '2023/24': { club: 'Piacenza',    sets: 92, attEff: .488, kill: .49, ptsSet: 5.2, blkSet: .49, aceSet: .44, recPos: .12, recPerf: .04, digSet: .9, recErrSet: .05, recAttSet: .6 },
  }
  const ntRates: Record<string, AttackerRates & { sets: number }> = {
    '2019/20': { sets: 22, attEff: .460, kill: .47, ptsSet: 5.1, blkSet: .44, aceSet: .42, recPos: .10, recPerf: .03, digSet: .8, recErrSet: .05, recAttSet: .7 },
    '2021/22': { sets: 20, attEff: .485, kill: .49, ptsSet: 5.6, blkSet: .50, aceSet: .45, recPos: .11, recPerf: .04, digSet: .8, recErrSet: .05, recAttSet: .7 },
    '2022/23': { sets: 18, attEff: .478, kill: .49, ptsSet: 5.4, blkSet: .48, aceSet: .44, recPos: .10, recPerf: .03, digSet: .9, recErrSet: .05, recAttSet: .7 },
    '2023/24': { sets: 24, attEff: .470, kill: .48, ptsSet: 5.3, blkSet: .47, aceSet: .43, recPos: .11, recPerf: .04, digSet: .9, recErrSet: .05, recAttSet: .7 },
  }

  const rows: PlayerSeasonStats[] = []
  for (const season of SEASONS) {
    const cr = clubRates[season]
    const club = CLUB_BY_NAME[cr.club]
    rows.push(makeRow(5, season, 1, club.id, attackerCounts(cr.sets, cr), 'OPP'))
    const nr = ntRates[season]
    if (nr) {
      rows.push(makeRow(5, season, NT_COMP_ID[season], null, attackerCounts(nr.sets, nr), 'OPP'))
    }
  }
  return rows
}

// ── Anchor rates for remaining players (same across seasons, decayed) ─────────

type AnchorEntry =
  | ({ grp: 'attacker'; club: string } & AttackerRates)
  | ({ grp: 'setter';   club: string } & SetterRates)
  | ({ grp: 'libero';   club: string } & LiberoRates)

const ANCHOR: Record<number, AnchorEntry> = {
  2:  { grp: 'attacker', club: 'Modena',  attEff: .466, kill: .45, ptsSet: 3.8, blkSet: .39, aceSet: .41, recPos: .55, recPerf: .31, digSet: 1.6, recErrSet: .22, recAttSet: 3.3 },
  3:  { grp: 'attacker', club: 'Verona',  attEff: .438, kill: .44, ptsSet: 4.6, blkSet: .31, aceSet: .52, recPos: .48, recPerf: .24, digSet: 1.4, recErrSet: .29, recAttSet: 3.3 },
  4:  { grp: 'attacker', club: 'Trento',  attEff: .488, kill: .47, ptsSet: 4.0, blkSet: .44, aceSet: .37, recPos: .64, recPerf: .41, digSet: 2.1, recErrSet: .15, recAttSet: 3.5 },
  6:  { grp: 'attacker', club: 'Perugia', attEff: .521, kill: .51, ptsSet: 5.0, blkSet: .55, aceSet: .39, recPos: .14, recPerf: .05, digSet: .8,  recErrSet: .06, recAttSet: .6  },
  7:  { grp: 'attacker', club: 'Piacenza',attEff: .476, kill: .48, ptsSet: 5.6, blkSet: .43, aceSet: .34, recPos: .09, recPerf: .03, digSet: .7,  recErrSet: .04, recAttSet: .5  },
  8:  { grp: 'attacker', club: 'Milano',  attEff: .612, kill: .62, ptsSet: 2.4, blkSet: .92, aceSet: .21, recPos: .05, recPerf: .01, digSet: .4,  recErrSet: .02, recAttSet: .2, atkAttSet: 3.6 },
  9:  { grp: 'attacker', club: 'Trento',  attEff: .588, kill: .59, ptsSet: 2.1, blkSet: .84, aceSet: .18, recPos: .04, recPerf: .01, digSet: .3,  recErrSet: .02, recAttSet: .2, atkAttSet: 3.4 },
  10: { grp: 'attacker', club: 'Trento',  attEff: .641, kill: .65, ptsSet: 2.6, blkSet: 1.04, aceSet: .24, recPos: .06, recPerf: .02, digSet: .5, recErrSet: .03, recAttSet: .2, atkAttSet: 3.8 },
  11: { grp: 'setter',   club: 'Perugia', assSet: 9.4, setEff: .54, attEff: .30, kill: .30, ptsSet: .6, blkSet: .58, aceSet: .31, recPos: .10, recPerf: .03, digSet: 1.5, recErrSet: .10, recAttSet: .9 },
  12: { grp: 'setter',   club: 'Milano',  assSet: 8.9, setEff: .49, attEff: .25, kill: .25, ptsSet: .5, blkSet: .46, aceSet: .27, recPos: .09, recPerf: .02, digSet: 1.7, recErrSet: .12, recAttSet: 1.0 },
  13: { grp: 'setter',   club: 'Modena',  assSet: 9.7, setEff: .57, attEff: .28, kill: .28, ptsSet: .4, blkSet: .41, aceSet: .19, recPos: .08, recPerf: .02, digSet: 1.4, recErrSet: .11, recAttSet: .8 },
  14: { grp: 'libero',   club: 'Trento',  recPos: .72, recPerf: .51, digSet: 3.4, recErrSet: .08, involve: .88, srEff: .55 },
  15: { grp: 'libero',   club: 'Milano',  recPos: .66, recPerf: .44, digSet: 3.0, recErrSet: .11, involve: .81, srEff: .48 },
  16: { grp: 'libero',   club: 'Piacenza',recPos: .69, recPerf: .47, digSet: 3.7, recErrSet: .09, involve: .85, srEff: .52 },
}

/** Simple linear decay applied to each numeric rate as we step backward in time */
function decayRate(v: number, idx: number, key: string): number {
  const age = 5 - idx // idx 5 = current, 0 = oldest
  if (key === 'recErrSet') return parseFloat((v * (1 + age * 0.02)).toFixed(3))
  return Math.max(0, parseFloat((v * (1 - age * 0.018)).toFixed(3)))
}

function buildAnchorRows(): PlayerSeasonStats[] {
  const rows: PlayerSeasonStats[] = []

  for (const [pidStr, anchor] of Object.entries(ANCHOR)) {
    const pid = Number(pidStr)
    const player = PLAYERS.find((p) => p.id === pid)!
    const club = CLUB_BY_NAME[anchor.club]

    SEASONS.forEach((season, i) => {
      // Apply decay to all numeric rates
      const r: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(anchor)) {
        if (k === 'grp' || k === 'club') continue
        r[k] = typeof v === 'number' ? decayRate(v, i, k) : v
      }

      const sets = 88 + i * 2

      let counts: ReturnType<typeof attackerCounts>
      if (anchor.grp === 'setter') {
        counts = setterCounts(sets, r as unknown as SetterRates)
      } else if (anchor.grp === 'libero') {
        counts = liberoCounts(sets, r as unknown as LiberoRates)
      } else {
        counts = attackerCounts(sets, r as unknown as AttackerRates)
      }

      rows.push(makeRow(pid, season, 1, club.id, counts, player.primary_position))
    })
  }

  return rows
}

// ── Public API ────────────────────────────────────────────────────────────────

let _cachedStats: PlayerSeasonStats[] | null = null

export function getAllSeasonStats(): PlayerSeasonStats[] {
  if (_cachedStats) return _cachedStats
  _cachedStats = [
    ...buildIshikawaRows(),
    ...buildDarlanRows(),
    ...buildAnchorRows(),
  ]
  return _cachedStats
}

/** Map competition_id → competition_type string */
export function getCompetitionTypeMap(): Map<number, string> {
  return new Map(COMPETITIONS.map((c) => [c.id, c.competition_type]))
}

/** Map club_id → Club */
export function getClubMap(): Map<number, Club> {
  return new Map(CLUBS.map((c) => [c.id, c]))
}

/** Returns the name of the NT event for a given player/season if NT data exists */
export function getNtEventForSeason(
  playerId: number,
  season: string,
  stats: PlayerSeasonStats[],
): string | null {
  const hasNt = stats.some(
    (r) => r.player_id === playerId && r.season === season && r.competition_id !== 1,
  )
  return hasNt ? (NT_EVENT[season] ?? null) : null
}

/** Returns the club short_name for a player/season from the domestic league row */
export function getClubForSeason(
  playerId: number,
  season: string,
  stats: PlayerSeasonStats[],
  clubMap: Map<number, Club>,
): Club | null {
  const row = stats.find((r) => r.player_id === playerId && r.season === season && r.competition_id === 1)
  if (!row || !row.club_id) return null
  return clubMap.get(row.club_id) ?? null
}

/** Returns available seasons for a player (seasons they have at least one row) */
export function seasonsForPlayer(playerId: number, stats: PlayerSeasonStats[]): string[] {
  return SEASONS.filter((s) => stats.some((r) => r.player_id === playerId && r.season === s))
}
