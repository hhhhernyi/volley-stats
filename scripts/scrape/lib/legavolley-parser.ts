/**
 * legavolley-parser.ts — parsing for legavolley.it official stats pages.
 *
 * Verified against cached HTML on 2026-07-04
 * (data/landing/legavolley/2024-2025/MO.html).
 *
 * The team stats table (TipoStat=1.1) has a fixed 24-column layout:
 *   0  Atleta ("Cognome Nome")     12 RICEZIONE Neg.
 *   1  Part. Gioc.                 13 RICEZIONE Prf.
 *   2  Set Gioc.                   14 RICEZIONE Prf. %
 *   3  PUNTI Tot                   15 RICEZIONE Effic.
 *   4  PUNTI BP                    16 ATTACCO Tot
 *   5  BATTUTA Tot                 17 ATTACCO Err.
 *   6  BATTUTA Ace                 18 ATTACCO Murati
 *   7  BATTUTA Err.                19 ATTACCO Prf. (= kills)
 *   8  BATTUTA Ace per Set         20 ATTACCO Prf. %
 *   9  BATTUTA Effic.              21 ATTACCO Effic.
 *   10 RICEZIONE Tot               22 MURO Prf. (= winning blocks)
 *   11 RICEZIONE Err.              23 Punti per Set
 * Empty cells are '&nbsp;'; decimals use Italian commas.
 */

import * as cheerio from 'cheerio'
import type { LegaPlayerRow } from './types.js'

/** '&nbsp;'/'-'/'' → 0; '0,53' → 0.53 */
function parseCell(text: string | undefined): number {
  if (!text) return 0
  const t = text.replace(/ /g, '').trim()
  if (t === '' || t === '-') return 0
  const n = parseFloat(t.replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// ---------------------------------------------------------------------------
// Team codes (Squadra dropdown)
// ---------------------------------------------------------------------------

export interface LegaTeamOption {
  /** Query param value, e.g. 'MO', 'MI-POWER', 'CIS-VOLLEY' */
  code: string
  /** Display label, e.g. 'Modena', 'Milano', 'Cisterna' */
  label: string
}

/**
 * The page has several unnamed <select>s (stat type, serie, fase, squadra…).
 * The team dropdown is the one whose option values are letter-based codes
 * rather than numbers.
 */
export function parseTeamCodes(html: string): LegaTeamOption[] {
  const $ = cheerio.load(html)
  let best: LegaTeamOption[] = []

  $('select').each((_, sel) => {
    const opts: LegaTeamOption[] = []
    $(sel).find('option').each((_, opt) => {
      const code = ($(opt).attr('value') ?? '').trim()
      const label = $(opt).text().trim()
      if (/^[A-Z][A-Z0-9-]*$/.test(code) && label.length >= 2) {
        opts.push({ code, label })
      }
    })
    if (opts.length > best.length) best = opts
  })

  return best
}

// ---------------------------------------------------------------------------
// Team stats table (TipoStat=1.1)
// ---------------------------------------------------------------------------

export function parseTeamStatsTable(html: string): LegaPlayerRow[] {
  const $ = cheerio.load(html)
  const rows: LegaPlayerRow[] = []

  // The stats table is the one containing OddRow/EvenRow data cells
  const table = $('table')
    .filter((_, t) => $(t).find('td.OddRow, td.EvenRow').length > 0)
    .first()
  if (table.length === 0) return rows

  table.find('tr').each((_, tr) => {
    const cells = $(tr).find('td').toArray().map((td) => $(td).text())
    if (cells.length < 24) return // header or malformed row

    // 1998/99 only: PUNTI is split Tot/CP/BP (side-out-era "cambio palla"
    // points) — drop the extra CP cell so the fixed indexes below line up.
    if (cells.length === 25) cells.splice(4, 1)

    const name = cells[0].replace(/ /g, ' ').trim()
    // Skip aggregate rows (e.g. team totals) — they have no personal name.
    // 1998/99 totals rows drop the name cell entirely, so the first cell is
    // the squad's athlete count — hence the numeric guard.
    if (!name || /^tot/i.test(name) || /^\d+$/.test(name)) return

    rows.push({
      name,
      matches:       parseCell(cells[1]),
      sets:          parseCell(cells[2]),
      points:        parseCell(cells[3]),
      serveTotal:    parseCell(cells[5]),
      aces:          parseCell(cells[6]),
      serveErrors:   parseCell(cells[7]),
      recTotal:      parseCell(cells[10]),
      recErrors:     parseCell(cells[11]),
      recNegative:   parseCell(cells[12]),
      recPerfect:    parseCell(cells[13]),
      atkTotal:      parseCell(cells[16]),
      atkErrors:     parseCell(cells[17]),
      atkBlocked:    parseCell(cells[18]),
      atkKills:      parseCell(cells[19]),
      blocks:        parseCell(cells[22]),
    })
  })

  return rows
}
