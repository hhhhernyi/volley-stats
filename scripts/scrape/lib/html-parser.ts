/**
 * html-parser.ts — all cheerio parsing logic.
 *
 * Selectors verified against downloaded HTML on 2026-07-04
 * (data/landing/superlega/2024-2025/players/206635.html and others).
 *
 * Player page layout ("Player Competition Statistics" section):
 *   - 7 tables, all `table.vbw-tournament-player-statistic-table`, one per
 *     stat category. Categories are identified by a distinctive <td> class:
 *       scoring   → td.points (+ attacks/blocks/serves breakdown)
 *       attack    → td.shots        (kills=attacks, errors=faults, TA=total-attempts)
 *       block     → td.stuff-blocks (errors=faults, rebounds)
 *       serve     → td.serve-points (errors=faults, hits, TA=total-attempts)
 *       reception → td.serve-receptions (perfect=excellents, errors=faults, TA=total-attempts)
 *       dig       → td.great-save   (errors=faults, receptions)
 *       set       → td.running-sets (assists, errors=faults, still-sets)
 *   - One row per match: `tr.vbw-o-table__row--scorer` with data-match-no,
 *     which joins to the live-matches API for set scores.
 *   - Bio: `.vbw-player-name`, and `.vbw-player-bio-head` / `.vbw-player-bio-text`
 *     pairs (Position, Nationality, Age, Birth date, Height). Abbreviated
 *     values (e.g. "OH", "IT") appear as a second bio-text in the same block.
 */

import * as cheerio from 'cheerio'
import type { RawMatchRow } from './types.js'

// ---------------------------------------------------------------------------
// Position normalisation → DB position_enum ('OH' | 'OPP' | 'MB' | 'S' | 'L')
// ---------------------------------------------------------------------------

const POSITION_MAP: Record<string, string> = {
  'outside hitter':   'OH',
  'wing spiker':      'OH',
  'opposite':         'OPP',
  'opposite spiker':  'OPP',
  'universal':        'OPP',
  'middle blocker':   'MB',
  'setter':           'S',
  'libero':           'L',
  'oh':  'OH',
  'op':  'OPP',
  'opp': 'OPP',
  'o':   'OPP',
  'u':   'OPP',
  'mb':  'MB',
  's':   'S',
  'l':   'L',
}

export function normalisePosition(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.toLowerCase().trim()
  return POSITION_MAP[key] ?? null
}

// ---------------------------------------------------------------------------
// Number parsing helper
// ---------------------------------------------------------------------------

/** Parse a cell value — returns 0 for '-' or empty, null if not a number */
function parseCell(text: string | undefined): number | null {
  if (text === undefined) return null
  const t = text.trim()
  if (t === '-' || t === '' || t === 'N/A') return 0
  const n = parseFloat(t.replace(',', '.'))
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Team list page
// ---------------------------------------------------------------------------

export interface ParsedTeam {
  volleyballworld_id: number
  name: string
}

export function parseTeamsPage(html: string): ParsedTeam[] {
  const $ = cheerio.load(html)
  const teams: ParsedTeam[] = []
  const seen = new Set<number>()

  // e.g. <a href=".../teams/7314/schedule/" alt="Allianz Milano">
  //        <div class="vbw-mu__team__name">Allianz Milano</div>
  //        <div class="vbw-mu__team__name vbw-mu__team__name--abbr">MIL</div>
  //      </a>
  // Plain .text() would concatenate name + abbr ("Allianz MilanoMIL").
  $('a[href*="/teams/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/\/teams\/(\d+)\//)
    if (!m) return
    const id = parseInt(m[1], 10)
    if (seen.has(id)) return
    seen.add(id)

    const name =
      $(el).find('.vbw-mu__team__name').not('.vbw-mu__team__name--abbr').first().text().trim() ||
      $(el).attr('alt') ||
      $(el).attr('title') ||
      $(el).attr('aria-label') ||
      $(el).text().trim()

    if (name) teams.push({ volleyballworld_id: id, name })
  })

  return teams
}

// ---------------------------------------------------------------------------
// Roster page
// ---------------------------------------------------------------------------

export interface ParsedPlayerStub {
  volleyballworld_id: number
  name: string
  teamVolleyballworldId: number
}

export function parseRosterPage(html: string, teamId: number): ParsedPlayerStub[] {
  const $ = cheerio.load(html)
  const players: ParsedPlayerStub[] = []
  const seen = new Set<number>()

  $('a[href*="/players/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/\/players\/(\d+)/)
    if (!m) return
    const id = parseInt(m[1], 10)
    if (seen.has(id)) return
    seen.add(id)

    const name =
      $(el).attr('title') ??
      $(el).attr('aria-label') ??
      $(el).text().trim()

    if (name) {
      players.push({ volleyballworld_id: id, name, teamVolleyballworldId: teamId })
    }
  })

  return players
}

// ---------------------------------------------------------------------------
// Schedule page → tournament number
// ---------------------------------------------------------------------------

/**
 * Extract the live-API tournament number from a schedule page.
 * The page embeds e.g. ".../api/v1/live/matches/bytournaments/1524;1524".
 */
export function extractTournamentNo(html: string): number | null {
  const m = html.match(/bytournaments\/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// ---------------------------------------------------------------------------
// Player page
// ---------------------------------------------------------------------------

export interface ParsedPlayerInfo {
  name: string
  position: string | null
  nationality: string | null
  height_cm: number | null
  date_of_birth: string | null
}

export interface ParsedPlayerPage {
  info: ParsedPlayerInfo
  /** One merged row per match; empty if the page has no stat tables */
  matchRows: RawMatchRow[]
  warnings: string[]
}

/** Convert site date "17/04/1998" → ISO "1998-04-17" */
function toIsoDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Read `.vbw-player-bio-head` → `.vbw-player-bio-text` pairs into a map */
function parseBio($: cheerio.CheerioAPI): Record<string, string[]> {
  const bio: Record<string, string[]> = {}
  $('.vbw-player-bio-head').each((_, headEl) => {
    const label = $(headEl).text().trim().toLowerCase()
    if (!label) return
    // Values are sibling .vbw-player-bio-text nodes within the same block
    const values = $(headEl)
      .parent()
      .find('.vbw-player-bio-text')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
    if (values.length && !bio[label]) bio[label] = values
  })
  return bio
}

/** Per-category mapping: distinctive td class → which RawMatchRow fields to fill */
interface CategorySpec {
  /** td class that uniquely identifies the category's table */
  marker: string
  /** cell class → RawMatchRow field */
  cells: Record<string, keyof Omit<RawMatchRow, 'matchNo'>>
}

const CATEGORIES: CategorySpec[] = [
  { marker: 'shots',            cells: { 'attacks': 'atkKills', 'faults': 'atkErrors', 'total-attempts': 'atkAttempts' } },
  { marker: 'stuff-blocks',     cells: { 'stuff-blocks': 'blocks' } },
  { marker: 'serve-points',     cells: { 'serve-points': 'aces', 'faults': 'serveErrors' } },
  { marker: 'serve-receptions', cells: { 'excellents': 'recPerfect', 'faults': 'recErrors', 'total-attempts': 'recAttempts' } },
  { marker: 'great-save',       cells: { 'great-save': 'digs' } },
  { marker: 'running-sets',     cells: { 'running-sets': 'assists' } },
]

function emptyRow(matchNo: number): RawMatchRow {
  return {
    matchNo,
    atkAttempts: 0, atkKills: 0, atkErrors: 0,
    totalPoints: 0, aces: 0, serveErrors: 0,
    blocks: 0, digs: 0,
    recAttempts: 0, recPerfect: 0, recErrors: 0,
    assists: 0,
  }
}

export function parsePlayerPage(html: string): ParsedPlayerPage {
  const $ = cheerio.load(html)
  const warnings: string[] = []

  // ── 1. Player bio ─────────────────────────────────────────────────────────
  const bio = parseBio($)

  const name =
    $('.vbw-player-name').first().text().trim() ||
    $('h1').first().text().trim()

  // Prefer the abbreviated second value ("OH", "IT") when present
  const positionRaw    = bio['position']?.[1] ?? bio['position']?.[0] ?? null
  const nationalityRaw = bio['nationality']?.[1] ?? bio['nationality']?.[0] ?? null
  const heightRaw      = bio['height']?.[0] ?? null
  const birthRaw       = bio['birth date']?.[0] ?? null

  const position = normalisePosition(positionRaw)
  if (positionRaw && !position) {
    warnings.push(`Unrecognised position "${positionRaw}"`)
  }

  const info: ParsedPlayerInfo = {
    name,
    position,
    nationality: nationalityRaw,
    height_cm: heightRaw ? parseInt(heightRaw, 10) || null : null,
    date_of_birth: birthRaw ? toIsoDate(birthRaw) : null,
  }

  // ── 2. Stat tables, merged per match ──────────────────────────────────────
  const rowsByMatch = new Map<number, RawMatchRow>()

  const getRow = (matchNo: number): RawMatchRow => {
    let row = rowsByMatch.get(matchNo)
    if (!row) {
      row = emptyRow(matchNo)
      rowsByMatch.set(matchNo, row)
    }
    return row
  }

  const tables = $('table.vbw-tournament-player-statistic-table')

  tables.each((_, tableEl) => {
    const $table = $(tableEl)
    const dataRows = $table.find('tr.vbw-o-table__row--scorer')
    if (dataRows.length === 0) return

    // Identify category by distinctive cell class
    const category = CATEGORIES.find((c) => $table.find(`td.${c.marker}`).length > 0)

    dataRows.each((_, rowEl) => {
      const $row = $(rowEl)
      const matchNoRaw = $row.attr('data-match-no')
      if (!matchNoRaw) return
      const matchNo = parseInt(matchNoRaw, 10)
      if (isNaN(matchNo)) return

      const row = getRow(matchNo)

      if (category) {
        for (const [cellClass, field] of Object.entries(category.cells)) {
          const v = parseCell($row.find(`td.${cellClass}`).first().text())
          if (v !== null) row[field] = v
        }
      } else if ($row.find('td.points').length > 0) {
        // Scoring table: total points per match (its attacks/blocks/serves
        // columns are point breakdowns, not attempt counts — ignored)
        const v = parseCell($row.find('td.points').first().text())
        if (v !== null) row.totalPoints = v
      }
    })
  })

  if (tables.length === 0) {
    warnings.push('No stat tables found on player page')
  }

  return { info, matchRows: [...rowsByMatch.values()], warnings }
}
