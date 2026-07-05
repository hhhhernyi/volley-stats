/**
 * enrich-bios.ts — backfill player bios from legavolley.it profile pages.
 *
 * lega-only seasons (1998/99–2020/21) come from stats tables that publish no
 * bios, so those players sit in the DB with null position/birthday/height and
 * 'UNK' nationality. legavolley does publish full bios on player profile
 * pages (/player/BOY-STE-96); the per-season athlete dropdown on any
 * ATLETA-stat page maps names → profile codes.
 *
 * Usage:
 *   npx tsx scripts/scrape/enrich-bios.ts [--phase fetch|parse|load]
 *                                         [--force-refresh] [--dry-run]
 *
 * Only null fields are filled — volleyballworld-sourced data is never
 * overwritten.
 */

import * as cheerio from 'cheerio'
import {
  SEASONS, BROWSER_USER_AGENT, LANDING_ROOT,
  seasonStartYear,
  legavolleyAtletaIndexUrl, legavolleyAtletaIndexPath,
  legavolleyPlayerProfileUrl, legavolleyPlayerProfilePath,
  LEGA_ROLE_TO_POSITION,
} from './lib/constants.js'
import { fetchAndCache, readLanding, writeJson, readJson, fileExists } from './lib/http-client.js'
import { nameKey, positionGroup } from './lib/player-mapper.js'
import { getSupabaseAdmin } from './load.js'

const BIOS_JSON_PATH     = `${LANDING_ROOT}/legavolley/players/bios.json`
const WARNINGS_JSON_PATH = `${LANDING_ROOT}/legavolley/players/bios-warnings.json`

// ---------------------------------------------------------------------------
// Phase 1 — fetch: athlete dropdowns per season → unique profile pages
// ---------------------------------------------------------------------------

interface AtletaOption {
  code: string   // 'BOY-STE-96'
  label: string  // 'Boyer Stephen'
}

/** The athlete dropdown is the select whose option values look like profile codes */
function parseAtletaOptions(html: string): AtletaOption[] {
  const $ = cheerio.load(html)
  let best: AtletaOption[] = []

  $('select').each((_, sel) => {
    const opts: AtletaOption[] = []
    $(sel).find('option').each((_, opt) => {
      const code  = ($(opt).attr('value') ?? '').trim()
      const label = $(opt).text().replace(/\s+/g, ' ').trim()
      if (/^[A-Z]{1,4}-[A-Z]{1,4}-\d{2}$/.test(code) && label.length >= 2) {
        opts.push({ code, label })
      }
    })
    if (opts.length > best.length) best = opts
  })

  return best
}

async function fetchPhase(forceRefresh: boolean): Promise<void> {
  const codes = new Map<string, string>() // code → dropdown label (first seen)

  for (const season of SEASONS) {
    const year = seasonStartYear(season.urlSlug)
    const html = await fetchAndCache(
      legavolleyAtletaIndexUrl(year),
      legavolleyAtletaIndexPath(season.urlSlug),
      forceRefresh,
      BROWSER_USER_AGENT,
    )
    const opts = parseAtletaOptions(html)
    console.log(`  ${season.urlSlug}: ${opts.length} athletes in dropdown`)
    for (const o of opts) {
      if (!codes.has(o.code)) codes.set(o.code, o.label)
    }
  }

  console.log(`\n  ${codes.size} unique profile codes — fetching profiles…`)
  let n = 0
  for (const code of codes.keys()) {
    await fetchAndCache(
      legavolleyPlayerProfileUrl(code),
      legavolleyPlayerProfilePath(code),
      false, // profiles cache forever
      BROWSER_USER_AGENT,
    )
    if (++n % 100 === 0) console.log(`  …${n}/${codes.size}`)
  }
  console.log(`  ✓ ${codes.size} profiles cached`)
}

// ---------------------------------------------------------------------------
// Phase 2 — parse: profile pages → bios.json
// ---------------------------------------------------------------------------

interface Bio {
  code: string
  name: string             // 'Cognome Nome' from the page title
  role: string | null      // raw Ruolo text
  position: string | null  // mapped DB enum or null
  birthday: string | null  // ISO date
  height_cm: number | null
  nationality: string | null
}

function parseProfile(code: string, html: string): { bio: Bio; warnings: string[] } {
  const warnings: string[] = []
  const $ = cheerio.load(html)
  const name = $('title').first().text().split(/[|–-]\s*Lega/i)[0].replace(/\s+/g, ' ').trim()

  const text = $('body').text().replace(/\s+/g, ' ')

  const role   = text.match(/Ruolo\s+([A-Za-zà-ù]+)/)?.[1] ?? null
  const born   = text.match(/Nascita\s+(\d{2})\/(\d{2})\/(\d{4})/)
  const height = text.match(/Altezza\s+(\d{2,3})\s*cm/)?.[1] ?? null
  const nat    = text.match(/Naz\.Sportiva\s+([A-Z]{3})/)?.[1] ?? null

  const position = role ? (LEGA_ROLE_TO_POSITION[role] ?? null) : null
  if (role && !position) warnings.push(`unknown role "${role}"`)
  if (!name) warnings.push('no name in title')
  if (!born) warnings.push('no birth date')

  return {
    bio: {
      code,
      name,
      role,
      position,
      birthday: born ? `${born[3]}-${born[2]}-${born[1]}` : null,
      height_cm: height ? parseInt(height, 10) : null,
      nationality: nat,
    },
    warnings,
  }
}

async function parsePhase(): Promise<void> {
  // Every cached profile under players/ is fair game
  const fs = await import('fs/promises')
  const path = await import('path')
  const dir = path.join(process.cwd(), LANDING_ROOT, 'legavolley', 'players')
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.html'))

  const bios: Bio[] = []
  const allWarnings: { code: string; warnings: string[] }[] = []

  for (const f of files) {
    const code = f.replace('.html', '')
    const html = await readLanding(`${LANDING_ROOT}/legavolley/players/${f}`)
    const { bio, warnings } = parseProfile(code, html)
    bios.push(bio)
    if (warnings.length > 0) allWarnings.push({ code, warnings })
  }

  await writeJson(BIOS_JSON_PATH, bios)
  await writeJson(WARNINGS_JSON_PATH, allWarnings)
  console.log(`  ✓ parsed ${bios.length} profiles (${allWarnings.length} with warnings)`)
}

// ---------------------------------------------------------------------------
// Phase 3 — load: fill null player fields + position_played
// ---------------------------------------------------------------------------

interface DbPlayer {
  id: number
  name: string
  primary_position: string | null
  position_group: string | null
  birthday: string | null
  height_cm: number | null
  nationality: string | null
}

async function loadPhase(dryRun: boolean): Promise<void> {
  if (!(await fileExists(BIOS_JSON_PATH))) {
    throw new Error('bios.json missing — run the parse phase first')
  }
  const bios = await readJson<Bio[]>(BIOS_JSON_PATH)
  const supabase = getSupabaseAdmin()

  // Bios by sorted-token name key; ambiguous keys are unusable
  const bioByKey = new Map<string, Bio | 'ambiguous'>()
  for (const b of bios) {
    if (!b.name) continue
    const k = nameKey(b.name)
    bioByKey.set(k, bioByKey.has(k) ? 'ambiguous' : b)
  }

  // All players, paginated past the 1000-row cap
  const players: DbPlayer[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, primary_position, position_group, birthday, height_cm, nationality')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Failed to list players: ${error.message}`)
    players.push(...(data ?? []) as DbPlayer[])
    if (!data || data.length < PAGE) break
  }

  // Player name keys can collide too (homonyms collapsed at load keep one row,
  // but be defensive)
  const keyCount = new Map<string, number>()
  for (const p of players) {
    const k = nameKey(p.name)
    keyCount.set(k, (keyCount.get(k) ?? 0) + 1)
  }

  let updated = 0, posFilled = 0, unmatched = 0, ambiguous = 0
  const unmatchedNames: string[] = []

  for (const p of players) {
    const needs =
      p.primary_position == null || p.birthday == null ||
      p.height_cm == null || p.nationality === 'UNK'
    if (!needs) continue

    const k = nameKey(p.name)
    if ((keyCount.get(k) ?? 0) > 1) { ambiguous++; continue }
    const bio = bioByKey.get(k)
    if (!bio) { unmatched++; unmatchedNames.push(p.name); continue }
    if (bio === 'ambiguous') { ambiguous++; continue }

    const patch: Record<string, unknown> = {}
    if (p.primary_position == null && bio.position) {
      patch['primary_position'] = bio.position
      patch['position_group']   = positionGroup(bio.position)
    }
    if (p.birthday == null && bio.birthday)      patch['birthday']    = bio.birthday
    if (p.height_cm == null && bio.height_cm)    patch['height_cm']   = bio.height_cm
    if (p.nationality === 'UNK' && bio.nationality) patch['nationality'] = bio.nationality

    if (Object.keys(patch).length === 0) continue

    if (dryRun) {
      if (updated < 10) console.log(`  [dry-run] ${p.name}: ${JSON.stringify(patch)}`)
    } else {
      const { error } = await supabase.from('players').update(patch).eq('id', p.id)
      if (error) { console.warn(`  ⚠ update failed for ${p.name}: ${error.message}`); continue }
    }
    updated++
    if (patch['primary_position']) p.primary_position = patch['primary_position'] as string
  }

  console.log(`  players updated: ${updated} | unmatched: ${unmatched} | ambiguous: ${ambiguous}`)
  if (unmatchedNames.length > 0) {
    console.log(`  sample unmatched: ${unmatchedNames.slice(0, 8).join(', ')}`)
  }

  // Backfill position_played on stats rows (null only) from primary_position —
  // covers both newly enriched players and vw-era players' historical rows.
  const withPos = players.filter((p) => p.primary_position != null)
  console.log(`  backfilling position_played for ${withPos.length} players…`)
  let rowsFilled = 0
  for (const p of withPos) {
    if (dryRun) continue
    const { data, error } = await supabase
      .from('player_season_stats')
      .update({ position_played: p.primary_position })
      .eq('player_id', p.id)
      .is('position_played', null)
      .select('id')
    if (error) { console.warn(`  ⚠ position_played backfill failed for ${p.name}: ${error.message}`); continue }
    const n = (data ?? []).length
    rowsFilled += n
    if (n > 0) posFilled++
  }
  console.log(dryRun
    ? '  [dry-run] position_played backfill skipped'
    : `  ✓ position_played filled on ${rowsFilled} rows across ${posFilled} players`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const phase        = process.argv.includes('--phase')
    ? process.argv[process.argv.indexOf('--phase') + 1]
    : undefined
  const forceRefresh = process.argv.includes('--force-refresh')
  const dryRun       = process.argv.includes('--dry-run')

  if (phase && !['fetch', 'parse', 'load'].includes(phase)) {
    console.error(`Unknown phase "${phase}". Use: fetch | parse | load`)
    process.exit(1)
  }

  if (!phase || phase === 'fetch') {
    console.log('\n══ ENRICH 1: FETCH PROFILES ══')
    await fetchPhase(forceRefresh)
  }
  if (!phase || phase === 'parse') {
    console.log('\n══ ENRICH 2: PARSE PROFILES ══')
    await parsePhase()
  }
  if (!phase || phase === 'load') {
    console.log('\n══ ENRICH 3: LOAD BIOS ══')
    await loadPhase(dryRun)
  }
  console.log('\n✓ Done.')
}

main().catch((err) => {
  console.error('\n✗ enrich-bios error:', err)
  process.exit(1)
})
