/**
 * parse.ts — Phase 2: read landing HTML → emit parsed.json + parse-warnings.json.
 *
 * Must be run after fetch phase completes.
 * Output consumed by load phase.
 *
 * sets_played: the player page has no per-match set scores, so we join each
 * stat row's data-match-no against matches.json (live-matches API) and sum
 * the sets of every match the player appeared in. This assumes the player
 * was on court for all sets of those matches — the site publishes no
 * per-set participation, so this is the best available approximation.
 */

import fs from 'fs/promises'
import path from 'path'
import {
  SEASONS,
  LANDING_ROOT, COMPETITION_SLUG,
  teamsListPath, teamRosterPath, playerHtmlPath,
  parsedJsonPath, warningsJsonPath, matchesJsonPath,
  legavolleyIndexPath, legavolleyTeamStatsPath,
  LEGAVOLLEY_CLUB_OVERRIDES,
  type SeasonConfig,
} from './lib/constants.js'
import { readLanding, readJson, writeJson, fileExists } from './lib/http-client.js'
import {
  parseTeamsPage, parseRosterPage, parsePlayerPage,
  type ParsedTeam,
} from './lib/html-parser.js'
import { parseTeamCodes, parseTeamStatsTable } from './lib/legavolley-parser.js'
import { normalizeName, nameKey } from './lib/player-mapper.js'
import type { ApiMatch, LegaPlayerRow, ParsedPlayerSeason } from './lib/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** List all numeric player IDs from the players/ directory under a season */
async function listPlayerFiles(season: string): Promise<number[]> {
  const dir = path.join(process.cwd(), LANDING_ROOT, COMPETITION_SLUG, season, 'players')
  try {
    const entries = await fs.readdir(dir)
    return entries
      .filter((e) => e.endsWith('.html'))
      .map((e) => parseInt(e.replace('.html', ''), 10))
      .filter((n) => !isNaN(n))
  } catch {
    return []
  }
}

/** Find which team a player belongs to by scanning roster files */
async function buildPlayerTeamMap(
  season: string,
  teams: ParsedTeam[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>()

  for (const team of teams) {
    const rosterPath = teamRosterPath(season, team.volleyballworld_id)
    if (!(await fileExists(rosterPath))) continue

    const html = await readLanding(rosterPath)
    const stubs = parseRosterPage(html, team.volleyballworld_id)
    for (const s of stubs) {
      map.set(s.volleyballworld_id, team.volleyballworld_id)
    }
  }

  return map
}

/**
 * Build matchNo → sets-in-match from matches.json.
 * Only finished matches with a valid volleyball score (3-0/3-1/3-2) count.
 */
async function buildMatchSetsMap(season: string): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  if (!(await fileExists(matchesJsonPath(season)))) return map

  const matches = await readJson<ApiMatch[]>(matchesJsonPath(season))
  for (const m of matches) {
    const total = (m.matchPointsA ?? 0) + (m.matchPointsB ?? 0)
    if (total >= 3 && total <= 5) map.set(m.no, total)
  }
  return map
}

// ---------------------------------------------------------------------------
// legavolley.it overlay — official numbers override volleyballworld's
// ---------------------------------------------------------------------------

/** True if every token of the shorter name appears in the longer one */
function tokensSubset(a: string, b: string): boolean {
  const ta = normalizeName(a).split(' ')
  const tb = normalizeName(b).split(' ')
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  return small.length > 0 && small.every((t) => big.includes(t))
}

/** Read all cached legavolley team tables for a season, keyed by team label */
async function loadLegaTeams(urlSlug: string): Promise<Map<string, LegaPlayerRow[]>> {
  const byLabel = new Map<string, LegaPlayerRow[]>()
  const indexPath = legavolleyIndexPath(urlSlug)
  if (!(await fileExists(indexPath))) return byLabel

  const teams = parseTeamCodes(await readLanding(indexPath))
  for (const team of teams) {
    const p = legavolleyTeamStatsPath(urlSlug, team.code)
    if (!(await fileExists(p))) continue
    byLabel.set(team.label, parseTeamStatsTable(await readLanding(p)))
  }
  return byLabel
}

/** Resolve a legavolley team label ("Modena") to a scraped vw team name */
function resolveLegaTeam(label: string, teamNames: string[]): string | null {
  // Every token of the label appears in the team name, in any order
  // ("Cisterna Top Volley" → "Top Volley Cisterna")
  const byTokens = (candidate: string): string | undefined => {
    const tokens = normalizeName(candidate).split(' ')
    return teamNames.find((n) => {
      const nameTokens = normalizeName(n).split(' ')
      return tokens.every((t) => nameTokens.includes(t))
    })
  }

  const direct =
    teamNames.find((n) => normalizeName(n).includes(normalizeName(label))) ??
    byTokens(label)
  if (direct) return direct

  const canonical = LEGAVOLLEY_CLUB_OVERRIDES[label]
  if (canonical) {
    const canonNorm = normalizeName(canonical)
    return teamNames.find(
      (n) => normalizeName(n).includes(canonNorm) || canonNorm.includes(normalizeName(n)),
    ) ?? byTokens(canonical) ?? null
  }
  return null
}

/**
 * A volleyballworld player skipped for having no stats rows — kept around so
 * a legavolley row (the site records marginal appearances vw misses) can
 * resurrect them with official numbers plus vw bio/identity.
 */
interface BenchCandidate {
  playerId: number
  teamVolleyballworldId: number
  teamName: string
  info: {
    name: string
    position: string | null
    nationality: string | null
    height_cm: number | null
    date_of_birth: string | null
  }
}

/**
 * Overwrite each player's stats with the official legavolley values where
 * published (sets, points, serve, attack, block, reception). digs/assists
 * stay from volleyballworld — legavolley doesn't publish them.
 * rec_positive = reception total − errors − negatives (positive-or-better).
 */
async function applyLegavolleyOverlay(
  urlSlug: string,
  dbSeason: string,
  results: ParsedPlayerSeason[],
  allWarnings: { playerId: number; warnings: string[] }[],
  bench: BenchCandidate[],
): Promise<void> {
  const legaTeams = await loadLegaTeams(urlSlug)
  if (legaTeams.size === 0) {
    console.warn('  ⚠ No legavolley data cached — re-run fetch phase; keeping volleyballworld numbers')
    return
  }

  // Group legavolley rows by resolved vw team name
  const teamNames = [...new Set(results.map((r) => r.teamName))]
  const legaByTeam = new Map<string, LegaPlayerRow[]>()
  for (const [label, rows] of legaTeams) {
    const teamName = resolveLegaTeam(label, teamNames)
    if (!teamName) {
      console.warn(`  ⚠ legavolley team "${label}" matched no scraped team — rows skipped`)
      continue
    }
    legaByTeam.set(teamName, rows)
  }

  let matched = 0
  const usedRows = new Set<LegaPlayerRow>()

  const applyRow = (entry: ParsedPlayerSeason, row: LegaPlayerRow): void => {
    usedRows.add(row)
    if (row.sets <= 0) {
      entry.warnings.push('legavolley row has 0 sets — volleyballworld numbers kept')
      return
    }
    matched++
    entry.stats.sets_played  = row.sets
    entry.stats.total_points = row.points
    entry.stats.aces         = row.aces
    entry.stats.serve_errors = row.serveErrors
    entry.stats.atk_attempts = row.atkTotal
    entry.stats.atk_errors   = row.atkErrors
    entry.stats.atk_kills    = row.atkKills
    entry.stats.blocks       = row.blocks
    entry.stats.rec_attempts = row.recTotal
    entry.stats.rec_errors   = row.recErrors
    entry.stats.rec_perfect  = row.recPerfect
    entry.stats.rec_positive = Math.max(0, row.recTotal - row.recErrors - row.recNegative)
  }

  // Match team by team, in three passes of decreasing strictness
  for (const teamName of teamNames) {
    const entries = results.filter((r) => r.teamName === teamName)
    const rows = legaByTeam.get(teamName)
    if (!rows) {
      for (const entry of entries) {
        entry.warnings.push('no legavolley data for team — volleyballworld numbers kept')
      }
      continue
    }

    const unmatchedEntries = new Set(entries)
    const unusedRows = new Set(rows)

    const pair = (entry: ParsedPlayerSeason, row: LegaPlayerRow) => {
      unmatchedEntries.delete(entry)
      unusedRows.delete(row)
      applyRow(entry, row)
    }

    // Pass 1: identical sorted-token names ("Anzani Simone" = "Simone Anzani")
    for (const entry of [...unmatchedEntries]) {
      const key = nameKey(entry.player.name)
      const row = [...unusedRows].find((r) => nameKey(r.name) === key)
      if (row) pair(entry, row)
    }

    // Pass 2: one name's tokens are a subset of the other's (extra middle names)
    for (const entry of [...unmatchedEntries]) {
      const row = [...unusedRows].find((r) => tokensSubset(r.name, entry.player.name))
      if (row) pair(entry, row)
    }

    // Pass 3: unique shared long token — handles nicknames and joined names
    // ("Davyskiba Vlad" ↔ "Uladzislau Davyskiba", "Lee Woo-Jin" ↔ "Woojin Lee").
    // Only pair when the shared-token relation is unique in BOTH directions.
    for (const entry of [...unmatchedEntries]) {
      const entryTokens = normalizeName(entry.player.name).split(' ').filter((t) => t.length >= 3)
      const shares = (row: LegaPlayerRow) => {
        const rowTokens = normalizeName(row.name).split(' ')
        return entryTokens.some((t) => rowTokens.includes(t))
      }
      const candidates = [...unusedRows].filter(shares)
      if (candidates.length !== 1) continue
      const row = candidates[0]
      const rowTokens = normalizeName(row.name).split(' ').filter((t) => t.length >= 3)
      const reverse = [...unmatchedEntries].filter((e) => {
        const eTokens = normalizeName(e.player.name).split(' ')
        return rowTokens.some((t) => eTokens.includes(t))
      })
      if (reverse.length === 1 && reverse[0] === entry) pair(entry, row)
    }

    for (const entry of unmatchedEntries) {
      entry.warnings.push('no legavolley match — volleyballworld numbers kept')
      allWarnings.push({
        playerId: entry.player.volleyballworld_id ?? 0,
        warnings: [`"${entry.player.name}" has no legavolley match — volleyballworld numbers kept`],
      })
    }

    // Pass 4: resurrect vw-roster players who have official stats but no
    // vw stat rows (marginal appearances vw doesn't record)
    const teamBench = bench.filter((b) => b.teamName === teamName)
    for (const row of [...unusedRows]) {
      if (row.sets <= 0) continue
      const key = nameKey(row.name)
      const cand =
        teamBench.find((b) => nameKey(b.info.name) === key) ??
        teamBench.find((b) => tokensSubset(row.name, b.info.name))
      if (!cand || results.some((r) => r.player.volleyballworld_id === cand.playerId)) {
        console.warn(`  ⚠ legavolley player "${row.name}" (${teamName}) has no volleyballworld counterpart — skipped`)
        continue
      }
      unusedRows.delete(row)
      const entry: ParsedPlayerSeason = {
        season: dbSeason,
        teamVolleyballworldId: cand.teamVolleyballworldId,
        teamName,
        player: { volleyballworld_id: cand.playerId, ...cand.info },
        stats: {
          sets_played: 0, atk_attempts: 0, atk_kills: 0, atk_errors: 0,
          total_points: 0, aces: 0, serve_errors: 0, blocks: 0,
          digs: 0, // not published by legavolley; vw had nothing
          rec_attempts: 0, rec_positive: 0, rec_perfect: 0, rec_errors: 0,
          assists: null,
        },
        warnings: ['recovered from legavolley — volleyballworld had no stats rows (digs unknown)'],
      }
      applyRow(entry, row)
      results.push(entry)
      allWarnings.push({ playerId: cand.playerId, warnings: entry.warnings })
    }
  }

  console.log(`  legavolley matched ${matched}/${results.length} players`)
}

// ---------------------------------------------------------------------------
// lega-only seasons (pre-2021/22) — legavolley tables are the sole source
// ---------------------------------------------------------------------------

/**
 * legavolley lists names "Cognome Nome". Flip unambiguous two-token names to
 * the vw-style "Nome Cognome"; with 3+ tokens the surname/given split is
 * ambiguous, so keep the source order and warn (manual overrides can follow).
 */
function displayNameFromLega(name: string): { display: string; ambiguous: boolean } {
  const tokens = name.trim().split(/\s+/)
  if (tokens.length === 2) return { display: `${tokens[1]} ${tokens[0]}`, ambiguous: false }
  return { display: tokens.join(' '), ambiguous: tokens.length > 2 }
}

/**
 * Build ParsedPlayerSeason rows straight from legavolley team tables.
 * No bios/positions/digs/assists exist for these seasons; sets are exact and
 * positive receptions are computable (total − errors − negatives).
 * A player appearing in two teams' tables (mid-season transfer) is merged
 * into one row — the DB has one row per (player, competition, season).
 */
async function parseLegaOnlySeason(
  season: SeasonConfig,
): Promise<ParsedPlayerSeason[]> {
  const { urlSlug, dbSeason } = season
  console.log(`\n── Parsing ${urlSlug} (lega-only) ──`)

  const legaTeams = await loadLegaTeams(urlSlug)
  if (legaTeams.size === 0) {
    throw new Error(`[${urlSlug}] No legavolley data cached — run fetch phase first.`)
  }
  console.log(`  legavolley teams: ${legaTeams.size}`)

  const results: ParsedPlayerSeason[] = []
  const allWarnings: { playerId: number; warnings: string[] }[] = []
  const byNameKey = new Map<string, ParsedPlayerSeason>()

  for (const [label, rows] of legaTeams) {
    const teamName = LEGAVOLLEY_CLUB_OVERRIDES[label] ?? label

    for (const row of rows) {
      if (row.sets <= 0) continue // never on court; sets_played must be > 0

      const { display, ambiguous } = displayNameFromLega(row.name)
      const warnings: string[] = []
      if (ambiguous) {
        warnings.push(`name "${row.name}" kept in legavolley "Cognome Nome" order (3+ tokens, split ambiguous)`)
      }

      const stats: ParsedPlayerSeason['stats'] = {
        sets_played:  row.sets,
        atk_attempts: row.atkTotal,
        atk_kills:    row.atkKills,
        atk_errors:   row.atkErrors,
        total_points: row.points,
        aces:         row.aces,
        serve_errors: row.serveErrors,
        blocks:       row.blocks,
        digs:         null, // not published by legavolley
        rec_attempts: row.recTotal,
        rec_positive: Math.max(0, row.recTotal - row.recErrors - row.recNegative),
        rec_perfect:  row.recPerfect,
        rec_errors:   row.recErrors,
        assists:      null, // not published by legavolley
      }

      // Mid-season transfer: same athlete in two team tables → sum the stints,
      // keep the team where he played more sets.
      const key = nameKey(row.name)
      const existing = byNameKey.get(key)
      if (existing) {
        const bigger = existing.stats.sets_played >= stats.sets_played
        const s = existing.stats
        s.atk_attempts += stats.atk_attempts
        s.atk_kills    += stats.atk_kills
        s.atk_errors   += stats.atk_errors
        s.total_points += stats.total_points
        s.aces         += stats.aces
        s.serve_errors  = (s.serve_errors ?? 0) + (stats.serve_errors ?? 0)
        s.blocks       += stats.blocks
        s.rec_attempts += stats.rec_attempts
        s.rec_positive += stats.rec_positive
        s.rec_perfect  += stats.rec_perfect
        s.rec_errors   += stats.rec_errors
        s.sets_played  += stats.sets_played
        if (!bigger) existing.teamName = teamName
        existing.warnings.push(`played for two teams (transfer) — stats summed, club set to ${existing.teamName}`)
        allWarnings.push({ playerId: 0, warnings: [`"${display}": ${existing.warnings[existing.warnings.length - 1]}`] })
        continue
      }

      const entry: ParsedPlayerSeason = {
        season: dbSeason,
        teamVolleyballworldId: null,
        teamName,
        player: {
          volleyballworld_id: null,
          name:          display,
          position:      null,
          nationality:   null,
          height_cm:     null,
          date_of_birth: null,
        },
        stats,
        warnings,
      }
      byNameKey.set(key, entry)
      results.push(entry)
      if (warnings.length > 0) {
        allWarnings.push({ playerId: 0, warnings: warnings.map((w) => `"${display}": ${w}`) })
      }
    }
  }

  await writeJson(parsedJsonPath(urlSlug), results)
  await writeJson(warningsJsonPath(urlSlug), allWarnings)

  console.log(`  ✓ ${urlSlug}: ${results.length} players parsed, ${allWarnings.length} with warnings`)
  return results
}

// ---------------------------------------------------------------------------
// Parse one season
// ---------------------------------------------------------------------------

export async function parseSeason(
  season: SeasonConfig,
): Promise<ParsedPlayerSeason[]> {
  if (season.source === 'lega-only') return parseLegaOnlySeason(season)

  const { urlSlug, dbSeason } = season
  console.log(`\n── Parsing ${urlSlug} ──`)

  // Teams list
  const teamsHtml = await readLanding(teamsListPath(urlSlug))
  const teams     = parseTeamsPage(teamsHtml)
  const teamById  = new Map(teams.map((t) => [t.volleyballworld_id, t]))
  console.log(`  Teams found: ${teams.length}`)

  // Match set counts (from live-matches API)
  const matchSets = await buildMatchSetsMap(urlSlug)
  console.log(`  Matches with set scores: ${matchSets.size}`)
  if (matchSets.size === 0) {
    console.warn('  ⚠ matches.json missing or empty — re-run fetch phase; sets_played cannot be computed')
  }

  // Build player → team mapping from roster files
  const playerTeamMap = await buildPlayerTeamMap(urlSlug, teams)

  // List all player HTML files
  const playerIds = await listPlayerFiles(urlSlug)
  console.log(`  Player HTML files: ${playerIds.length}`)

  const results: ParsedPlayerSeason[] = []
  const allWarnings: { playerId: number; warnings: string[] }[] = []
  const bench: BenchCandidate[] = []

  for (const playerId of playerIds) {
    const filePath = playerHtmlPath(urlSlug, playerId)
    if (!(await fileExists(filePath))) continue

    const html   = await readLanding(filePath)
    const parsed = parsePlayerPage(html)
    const { info, matchRows, warnings } = parsed

    // Skip players with no usable name
    if (!info.name) {
      allWarnings.push({ playerId, warnings: ['No player name found — skipped'] })
      continue
    }

    // Team association
    const teamId = playerTeamMap.get(playerId)
    if (!teamId) {
      warnings.push(`Player ${playerId} not found in any team roster — skipped`)
      allWarnings.push({ playerId, warnings })
      continue
    }

    if (matchRows.length === 0) {
      warnings.push('No match stats on page — skipped (player likely never appeared)')
      allWarnings.push({ playerId, warnings })
      bench.push({
        playerId,
        teamVolleyballworldId: teamId,
        teamName: teamById.get(teamId)?.name ?? `team-${teamId}`,
        info,
      })
      continue
    }

    // ── Sets played: sum sets of every match the player actually played ──
    // The site emits a row for every match the player was in the squad for,
    // including matches he never entered (all stats zero) — counting those
    // would wildly inflate sets_played for bench players. A match counts
    // only if at least one stat is non-zero.
    const playedRows = matchRows.filter((r) =>
      Object.entries(r).some(([k, v]) => k !== 'matchNo' && v !== 0),
    )

    let sets_played = 0
    let missingMatches = 0
    for (const row of playedRows) {
      const sets = matchSets.get(row.matchNo)
      if (sets === undefined) {
        missingMatches++
      } else {
        sets_played += sets
      }
    }
    if (missingMatches > 0) {
      warnings.push(`${missingMatches}/${playedRows.length} played matches missing from matches.json — sets_played undercounts`)
    }
    if (sets_played === 0) {
      warnings.push('sets_played=0 (no matches with any recorded stat) — skipped')
      allWarnings.push({ playerId, warnings })
      bench.push({
        playerId,
        teamVolleyballworldId: teamId,
        teamName: teamById.get(teamId)?.name ?? `team-${teamId}`,
        info,
      })
      continue
    }

    // ── Sum per-match rows into season totals ──
    const sum = (f: (r: typeof matchRows[number]) => number) =>
      matchRows.reduce((acc, r) => acc + f(r), 0)

    const assists = sum((r) => r.assists)

    const stats: ParsedPlayerSeason['stats'] = {
      sets_played,
      atk_attempts: sum((r) => r.atkAttempts),
      atk_kills:    sum((r) => r.atkKills),
      atk_errors:   sum((r) => r.atkErrors),
      total_points: sum((r) => r.totalPoints),
      aces:         sum((r) => r.aces),
      serve_errors: sum((r) => r.serveErrors),
      blocks:       sum((r) => r.blocks),
      digs:         sum((r) => r.digs),
      rec_attempts: sum((r) => r.recAttempts),
      // Site only publishes perfect ("successful") receptions — positive
      // (non-perfect good) receptions are not tracked. Stored as 0.
      rec_positive: 0,
      rec_perfect:  sum((r) => r.recPerfect),
      rec_errors:   sum((r) => r.recErrors),
      assists:      assists > 0 ? assists : null,
    }

    results.push({
      season: dbSeason,
      teamVolleyballworldId: teamId,
      teamName: teamById.get(teamId)?.name ?? `team-${teamId}`,
      player: {
        volleyballworld_id: playerId,
        name:          info.name,
        position:      info.position,
        nationality:   info.nationality,
        height_cm:     info.height_cm,
        date_of_birth: info.date_of_birth,
      },
      stats,
      warnings,
    })

    if (warnings.length > 0) {
      allWarnings.push({ playerId, warnings })
    }
  }

  // Overlay official legavolley.it numbers (authoritative where published)
  await applyLegavolleyOverlay(urlSlug, dbSeason, results, allWarnings, bench)

  // Write outputs
  await writeJson(parsedJsonPath(urlSlug), results)
  await writeJson(warningsJsonPath(urlSlug), allWarnings)

  const warnCount = allWarnings.length
  console.log(`  ✓ ${urlSlug}: ${results.length} players parsed, ${warnCount} with warnings`)
  if (warnCount > 0) {
    console.log(`    Warnings written to ${warningsJsonPath(urlSlug)}`)
  }

  return results
}

// ---------------------------------------------------------------------------
// Parse all seasons
// ---------------------------------------------------------------------------

export async function parseAll(options: { seasonSlug?: string }): Promise<ParsedPlayerSeason[]> {
  const targets = options.seasonSlug
    ? SEASONS.filter((s) => s.urlSlug === options.seasonSlug)
    : SEASONS

  if (targets.length === 0) {
    throw new Error(`No season found matching slug: ${options.seasonSlug}`)
  }

  const all: ParsedPlayerSeason[] = []
  for (const season of targets) {
    const results = await parseSeason(season)
    all.push(...results)
  }
  return all
}
